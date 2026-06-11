"use strict";

const deepEqual = require("fast-deep-equal"); // npm i fast-deep-equal
const { addLog, createLogsSchema } = require("../util/logs");
const {
  sendCartToHubSpot,
  ensureContactByEmail,
  getContactPropertiesV3,
  updateContactPropertiesV3,
} = require("./HubspotService");
const { Result } = require("../general/Result");

// In-memory last-cart snapshot per email (short-term). For persistence use masterdata.
const lastCartByEmail = new Map();

// In-memory last product viewed per email (session-level flag).
const lastProductViewedByEmail = new Map();

// In-memory last cart/checkout page logged per email (prevents poll loops).
const lastPageVisitLoggedByEmail = new Map();

// Products already logged this session (keyed by VTEX sessionId or email).
const sessionProductsVisited = new Map();

function getSessionKey(body) {
  const sessionId = body?.customerProperties?.sessionId;
  if (sessionId) return `sid:${sessionId}`;
  const email = body?.customerProperties?.email;
  if (email) return `email:${email}`;
  return null;
}

function clearSessionProductVisits(body) {
  const sessionKey = getSessionKey(body);
  if (sessionKey) sessionProductsVisited.delete(sessionKey);
}

// One abandoned-cart log per session (reset on login).
const abandonedCartLoggedBySession = new Map();

function shouldLogAbandonedCart(body) {
  const sessionKey = getSessionKey(body);
  if (!sessionKey) return true;
  if (abandonedCartLoggedBySession.get(sessionKey)) return false;
  abandonedCartLoggedBySession.set(sessionKey, true);
  return true;
}

function clearAbandonedCartLogged(body) {
  const sessionKey = getSessionKey(body);
  if (sessionKey) abandonedCartLoggedBySession.delete(sessionKey);
}

function isAbandonedCartEvent(body, incomingItems) {
  const hasItems = Array.isArray(incomingItems) && incomingItems.length > 0;
  if (!hasItems) return false;

  const cartStatus = (body?.cartProperties?.cartStatus || "").toLowerCase();
  if (cartStatus.includes("abandon")) return true;

  const lastActivity = (body?.customerProperties?.lastActivityType || "").toLowerCase();
  if (lastActivity.includes("abandon")) return true;

  if (isLogoutEvent(body)) return true;

  return false;
}

async function logAbandonedCart(body, email, incomingItems) {
  if (!isAbandonedCartEvent(body, incomingItems)) return;
  if (!shouldLogAbandonedCart(body)) return;
  //decrease purchase_intent_score by 5
  await updateScore(email, "purchase_intent_score", -5);
  console.log("abandoned cart", email, `| Items in cart: ${incomingItems.length}`);
}

function shouldLogPageVisit(email, visitType, page) {
  const key = `${visitType}:${page || ""}`;
  if (lastPageVisitLoggedByEmail.get(email) === key) return false;
  lastPageVisitLoggedByEmail.set(email, key);
  return true;
}

function isLoginEvent(body) {
  const lastActivity = body?.customerProperties?.lastActivityType?.toLowerCase?.() || "";
  return lastActivity.includes("login") || lastActivity.includes("signed in") || lastActivity.includes("log in");
}

function isLogoutEvent(body) {
  const lastActivity = body?.customerProperties?.lastActivityType?.toLowerCase?.() || "";
  return lastActivity.includes("logout") || lastActivity.includes("sign out") || lastActivity.includes("signed out") || lastActivity.includes("log out");
}

function isProductViewEvent(body) {
  const lastActivity = body?.customerProperties?.lastActivityType?.toLowerCase?.() || "";
  return lastActivity.includes("product view") || lastActivity.includes("product_view") || (lastActivity.includes("product") && lastActivity.includes("view"));
}

function isCartVisitEvent(body) {
  const lastActivity = body?.customerProperties?.lastActivityType?.toLowerCase?.() || "";
  if (
    lastActivity.includes("cart visit") ||
    lastActivity.includes("view cart") ||
    lastActivity.includes("visit cart")
  ) {
    return true;
  }

  const page = (body?.customerProperties?.lastVisitedPage || "").toLowerCase();
  return page.includes("#/cart");
}

function isCheckoutVisitEvent(body) {
  const lastActivity = body?.customerProperties?.lastActivityType?.toLowerCase?.() || "";
  if (lastActivity.includes("checkout visit")) return true;

  const page = (body?.customerProperties?.lastVisitedPage || "").toLowerCase();
  return page.includes("#/profile");
}

function getCartItemKey(item) {
  return String(item.sku || item.skuId || item.itemId || item.id || item.name || "");
}

function cartItemsNormalized(cartProperties) {
  const items = (cartProperties && cartProperties.items) || [];
  // normalize to array of {sku, qty, name, price, variant}
  return items
    .map(i => ({
      sku: getCartItemKey(i),
      qty: Number(i.qty ?? i.quantity ?? 1),
      name: i.name || i.productName || "",
      price: i.price || 0,
      variant: i.variant || i.variantName || i.skuVariant || ""
    }))
    .filter(i => i.sku && i.qty > 0);
}

// Helper: derive a stable product key from the payload (best-effort)
function getProductKey(body) {
  const p = body?.productProperties || {};
  const id = p.productId || p.product_id || p.sku || p.skuId || p.sku_id || p.itemId || p.id;
  if (id) return String(id);
  if (p.productName || p.name) return String(p.productName || p.name);
  const brand = p.brandName || p.brand || "";
  const cat = p.categoryName || p.category || "";
  const name = p.productName || p.name || "";
  return `${brand}|${cat}|${name}`;
}

function isLikelyProductPage(body) {
  const p = body?.productProperties || {};
  if (p.productId && String(p.productId).trim()) return true;

  const page = (body?.customerProperties?.lastVisitedPage || "").toLowerCase();
  if (page.endsWith("/p") || page.includes("/p/")) return true;

  return false;
}

function shouldLogNewProductPageVisit(body, productKey) {
  const sessionKey = getSessionKey(body);
  if (!sessionKey || !productKey) return false;

  let visited = sessionProductsVisited.get(sessionKey);
  if (!visited) {
    visited = new Set();
    sessionProductsVisited.set(sessionKey, visited);
  }
  if (visited.has(productKey)) return false;

  visited.add(productKey);
  return true;
}

async function logNewProductPageVisit(body, email, productKey) {
  if (!productKey || !isLikelyProductPage(body)) return;

  const productName =
    body?.productProperties?.productName ||
    body?.productProperties?.name ||
    productKey;

  if (shouldLogNewProductPageVisit(body, productKey)) {
    console.log("new product page visited", email, productName);
    try {
      await updateScore(email, "engagement_score", 2);
    } catch (e) {
      console.error("[CartEvents] Failed to update engagement_score:", e?.message || e);
    }
  }
}

// Compute delta between two normalized item arrays and return detailed added/removed lists
function computeCartDeltaDetailed(prevItems = [], newItems = []) {
  const prevMap = new Map(prevItems.map(i => [i.sku, { ...i }]));
  const newMap = new Map(newItems.map(i => [i.sku, { ...i }]));

  const added = [];
  const removed = [];

  // detect added or qty increase, and qty decrease
  for (const [sku, newIt] of newMap.entries()) {
    const prevIt = prevMap.get(sku);
    const prevQty = prevIt ? prevIt.qty : 0;
    const newQty = newIt.qty || 0;
    if (newQty > prevQty) {
      // added or increased
      added.push({
        sku,
        qty: newQty - prevQty,
        name: newIt.name || "",
        price: newIt.price || 0,
        variant: newIt.variant || ""
      });
    } else if (newQty < prevQty) {
      // decreased -> removed (partial)
      removed.push({
        sku,
        qty: prevQty - newQty,
        name: prevIt?.name || newIt?.name || "",
        price: prevIt?.price || newIt?.price || 0,
        variant: prevIt?.variant || newIt?.variant || ""
      });
    }
  }

  // detect skus removed entirely
  for (const [sku, prevIt] of prevMap.entries()) {
    if (!newMap.has(sku)) {
      removed.push({
        sku,
        qty: prevIt.qty,
        name: prevIt.name || "",
        price: prevIt.price || 0,
        variant: prevIt.variant || ""
      });
    }
  }

  // decide actionType:
  let actionType = "updated";
  const prevHadItems = prevItems && prevItems.length > 0;
  const newHasItems = newItems && newItems.length > 0;

  if (prevHadItems && !newHasItems && removed.length > 0) {
    actionType = "removed";
  } else if (added.length > 0 && removed.length === 0) {
    actionType = "added";
  } else if (removed.length > 0 && added.length === 0) {
    actionType = "removed";
  } else if (added.length > 0 && removed.length > 0) {
    actionType = "updated";
  }

  return { added, removed, actionType };
}

const SCORE_BOUNDS = {
  engagement_score: { min: 0, max: 20 },
  purchase_intent_score: { min: 0, max: 20 },
  customer_value_score: { min: 0, max: 20 },
};

const LEAD_SCORE_FIELDS = [
  "engagement_score",
  "purchase_intent_score",
  "customer_value_score",
];

function clampScore(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

// HubSpot dropdown option labels (must match portal configuration exactly).
function getLeadTier(overallLeadScore) {
  const score = clampScore(overallLeadScore, 0, 60);
  if (score <= 14) return "Cold Lead";
  if (score <= 29) return "Marketing Qualified Lead (MQL)";
  if (score <= 44) return "Sales Qualified Lead (SQL)";
  return "High-Value Lead";
}

function buildLeadScoreSnapshot(props, scoreOverrides = {}) {
  const engagement = clampScore(
    scoreOverrides.engagement_score ?? props?.engagement_score,
    SCORE_BOUNDS.engagement_score.min,
    SCORE_BOUNDS.engagement_score.max
  );
  const purchaseIntent = clampScore(
    scoreOverrides.purchase_intent_score ?? props?.purchase_intent_score,
    SCORE_BOUNDS.purchase_intent_score.min,
    SCORE_BOUNDS.purchase_intent_score.max
  );
  const customerValue = clampScore(
    scoreOverrides.customer_value_score ?? props?.customer_value_score,
    SCORE_BOUNDS.customer_value_score.min,
    SCORE_BOUNDS.customer_value_score.max
  );
  const overallLeadScore = engagement + purchaseIntent + customerValue;

  return {
    engagement_score: engagement,
    purchase_intent_score: purchaseIntent,
    customer_value_score: customerValue,
    overall_lead_score: overallLeadScore,
    lead_tier: getLeadTier(overallLeadScore),
  };
}

async function updateScore(email, scoreName, delta) {
  if (!email || !scoreName || delta == null || delta === 0) return;

  const bounds = SCORE_BOUNDS[scoreName];
  if (!bounds) return;

  const contactId = await ensureContactByEmail(email);
  if (!contactId) {
    console.error("[CartEvents] updateScore: no HubSpot contact for", email);
    return;
  }

  const props = (await getContactPropertiesV3(contactId, LEAD_SCORE_FIELDS)) || {};
  const current = clampScore(props[scoreName], bounds.min, bounds.max);
  const next = clampScore(current + delta, bounds.min, bounds.max);
  if (next === current) {
    console.log("[CartEvents] updateScore: no change for", scoreName, `(already ${current})`);
    return;
  }

  const snapshot = buildLeadScoreSnapshot(props, { [scoreName]: next });

  const scoreResult = await updateContactPropertiesV3(contactId, { [scoreName]: next });
  if (!scoreResult.ok) {
    console.error("[CartEvents] updateScore failed:", scoreName, scoreResult.error);
    return;
  }

  const leadResult = await updateContactPropertiesV3(contactId, {
    overall_lead_score: snapshot.overall_lead_score,
    lead_tier: snapshot.lead_tier,
  });
  if (!leadResult.ok) {
    console.error("[CartEvents] updateScore: overall_lead_score/lead_tier failed:", leadResult.error);
  }

  console.log(
    "[CartEvents] Score updated:",
    email,
    `${scoreName}: ${current} -> ${next}`,
    `overall_lead_score: ${snapshot.overall_lead_score}`,
    `lead_tier: ${snapshot.lead_tier}`
  );
}

async function logCartItemChanges(delta, currentCartItems, email) {
  const cartItemCount = Array.isArray(currentCartItems) ? currentCartItems.length : 0;

  if (delta.added.length > 0) {
    console.log(
      `[CartEvents] Item added to cart (${email}):`,
      delta.added,
      `| Total items in cart: ${cartItemCount}`
    );
    try {
      await updateScore(email, "purchase_intent_score", 3);
    } catch (e) {
      console.error("[CartEvents] Failed to update purchase_intent_score:", e?.message || e);
    }
  }
  if (delta.removed.length > 0) {
    console.log(
      `[CartEvents] Item removed from cart (${email}):`,
      delta.removed,
      `| Total items in cart: ${cartItemCount}`
    );
    try {
      await updateScore(email, "purchase_intent_score", -3);
    } catch (e) {
      console.error("[CartEvents] Failed to update purchase_intent_score:", e?.message || e);
    }
  }
}

// Optional TTL for product-view session flag (ms). Set to null to never auto-expire during the session.
const PRODUCT_VIEW_TTL_MS = null;

async function handleLoginOrCartUpdate(ctx, next) {
  console.log("\n [CartEvents] START handler");
  const body = ctx.req.body;
  console.log(" [CartEvents] Incoming Body", body);

  if (!body) {
    ctx.status = 400;
    ctx.body = { error: "Empty request body" };
    return;
  }

  const result = new Result();

  try {
    await createLogsSchema(ctx);
    addLog(ctx, {
      orderId: null,
      message: "CartEvents triggered",
      body: JSON.stringify(body),
    });

    const email = body?.customerProperties?.email;
    if (!email) {
      console.log(" [CartEvents] Missing email — skipping");
      result.ok(false);
      ctx.status = 200;
      ctx.body = result.data;
      return;
    }

    const masterdata = ctx?.clients?.masterdata;

    // Normalize cartProperties object to ensure cartProperties exists
    body.cartProperties = body.cartProperties || {};
    const incomingItems = Array.isArray(body.cartProperties.items) ? body.cartProperties.items : [];

    // 1) Login event
    if (isLoginEvent(body)) {
      clearAbandonedCartLogged(body);
      console.log(" [CartEvents] Detected login event for", email);
      try {
        // On login: if cart has items -> Active Cart; if no items -> No Cart
        const cartStatus = (incomingItems && incomingItems.length > 0) ? "Active Cart" : "No Cart";
        const event = {
          customerProperties: body.customerProperties || {},
          productProperties: { productName: body?.customerProperties?.lastVisitedPage || "" },
          cartProperties: Object.assign({}, body.cartProperties, { cartStatus })
        };
        const res = await sendCartToHubSpot(event, masterdata, { includeCartItems: false, eventLabel: "Login", forceNote: true });
        console.debug("[CartEvents] sendCartToHubSpot(login) result:", res);
        result.ok(true);
      } catch (e) {
        console.error(" [CartEvents] Error sending login event to HubSpot:", e);
        result.ok(false);
      }
      ctx.status = 200;
      ctx.body = result.data;
      return;
    }

    // 1b) Logout event
    if (isLogoutEvent(body)) {
      clearSessionProductVisits(body);
      logAbandonedCart(body, email, incomingItems);
      console.log(" [CartEvents] Detected logout event for", email);
      try {
        // On logout: if cart has items -> Abandoned Cart; if no items -> No Cart
        const cartStatus = (incomingItems && incomingItems.length > 0) ? "Abandoned Cart" : "No Cart";
        const event = {
          customerProperties: body.customerProperties || {},
          productProperties: { productName: body?.customerProperties?.lastVisitedPage || "" },
          cartProperties: Object.assign({}, body.cartProperties, { cartStatus })
        };
        const res = await sendCartToHubSpot(event, masterdata, { includeCartItems: false, eventLabel: "Logout", forceNote: true });
        console.debug("[CartEvents] sendCartToHubSpot(logout) result:", res);
        result.ok(true);
      } catch (e) {
        console.error(" [CartEvents] Error sending logout event to HubSpot:", e);
        result.ok(false);
      }
      ctx.status = 200;
      ctx.body = result.data;
      return;
    }

    // 1b2) Explicit abandoned cart (e.g. tab close / VTEX webhook — not logout)
    if (isAbandonedCartEvent(body, incomingItems) && !isLogoutEvent(body)) {
      logAbandonedCart(body, email, incomingItems);
      result.ok(true);
      ctx.status = 200;
      ctx.body = result.data;
      return;
    }

    // 1c) Cart page visit (/checkout/#/cart) or "view cart" click
    if (isCartVisitEvent(body)) {
      const page = body?.customerProperties?.lastVisitedPage || "";
      if (shouldLogPageVisit(email, "cart", page)) {
        console.log("cart visited", email);
        //increase purchase_intent_score by 4
        await updateScore(email, "purchase_intent_score", 4);
      }
      result.ok(true);
      ctx.status = 200;
      ctx.body = result.data;
      return;
    }

    // 1d) Checkout page visit (/checkout/#/profile)
    if (isCheckoutVisitEvent(body)) {
      const page = body?.customerProperties?.lastVisitedPage || "";
      if (shouldLogPageVisit(email, "checkout", page)) {
        console.log("checkout visited", email);
        //increase customer_value_score by 5
        await updateScore(email, "customer_value_score", 5);
      }
      result.ok(true);
      ctx.status = 200;
      ctx.body = result.data;
      return;
    }

    // 2) Determine cart change and product view flags
    const normalized = cartItemsNormalized(body.cartProperties || {});
    const prev = lastCartByEmail.get(email) || [];
    const cartChanged = !deepEqual(prev, normalized);
    let productView = isProductViewEvent(body);

    // product session suppression
    const productKey = getProductKey(body);
    const lastProductEntry = lastProductViewedByEmail.get(email);
    if (productView) {
      if (lastProductEntry && lastProductEntry.productKey === productKey) {
        if (PRODUCT_VIEW_TTL_MS) {
          const now = Date.now();
          if ((now - (lastProductEntry.ts || 0)) < PRODUCT_VIEW_TTL_MS) {
            productView = false;
            console.log(" [CartEvents] Product view suppressed by TTL for", email);
          }
        } else {
          productView = false;
          console.log(" [CartEvents] Product view suppressed (same product) for", email);
        }
      }
    }

    if (productView) {
      await logNewProductPageVisit(body, email, productKey);
    }

    // compute delta if cart changed
    let delta = { added: [], removed: [], actionType: null };
    if (cartChanged) {
      delta = computeCartDeltaDetailed(prev, normalized);
      await logCartItemChanges(delta, normalized, email);
      lastCartByEmail.set(email, normalized);
    } else {
      console.log(" [CartEvents] Cart unchanged for", email);
    }

    // 3) Decide actions and call HubSpot with actionType and appropriate items payload
    if (cartChanged && productView) {
      console.log(" [CartEvents] Both product view and cart change detected in same payload for", email);

      // Product view note (no cart items) — force creation so it's not suppressed when cart update follows
      try {
        const productEvent = {
          customerProperties: body.customerProperties || {},
          productProperties: body.productProperties || {},
          cartProperties: body.cartProperties || {}
        };
        const productNoteRes = await sendCartToHubSpot(productEvent, masterdata, {
          includeCartItems: false,
          eventLabel: "Product Viewed",
          forceNote: true
        });
        console.debug("[CartEvents] product-view note result:", productNoteRes);
        lastProductViewedByEmail.set(email, { productKey, ts: Date.now() });
      } catch (e) {
        console.error("[CartEvents] Error creating product-view note:", e);
      }

      // Cart update note (include cart items) — pass actionType and items depending on actionType
      try {
        // For removals: send removed items as itemsOverride and remaining cart as remainingItemsOverride
        const itemsToSend = (delta.actionType === "removed" && delta.removed.length > 0) ? delta.removed : normalized;
        const remainingToSend = (delta.actionType === "removed") ? normalized : null;

        // Ensure we pass productProperties if available so added header can use it
        const cartEvent = {
          customerProperties: body.customerProperties || {},
          productProperties: body.productProperties || {},
          cartProperties: body.cartProperties || {}
        };

        const cartNoteRes = await sendCartToHubSpot(cartEvent, masterdata, {
          includeCartItems: true,
          eventLabel: "Cart Updated",
          actionType: delta.actionType || (prev.length > 0 && normalized.length === 0 ? "removed" : "updated"),
          itemsOverride: itemsToSend,
          remainingItemsOverride: remainingToSend
        });
        console.debug("[CartEvents] cart-update note result:", cartNoteRes);
        result.ok(true);
      } catch (e) {
        console.error("[CartEvents] Error creating cart-update note:", e);
        result.ok(false);
      }

    } else if (cartChanged) {
      // Only cart changed -> cart update note with actionType
      try {
        const itemsToSend = (delta.actionType === "removed" && delta.removed.length > 0) ? delta.removed : normalized;
        const remainingToSend = (delta.actionType === "removed") ? normalized : null;

        const cartEvent = {
          customerProperties: body.customerProperties || {},
          productProperties: body.productProperties || {},
          cartProperties: body.cartProperties || {}
        };

        const cartNoteRes = await sendCartToHubSpot(cartEvent, masterdata, {
          includeCartItems: true,
          eventLabel: "Cart Updated",
          actionType: delta.actionType || (prev.length > 0 && normalized.length === 0 ? "removed" : "updated"),
          itemsOverride: itemsToSend,
          remainingItemsOverride: remainingToSend
        });
        console.debug("[CartEvents] cart-update note result:", cartNoteRes);
        result.ok(true);
      } catch (e) {
        console.error("[CartEvents] Error creating cart-update note:", e);
        result.ok(false);
      }

    } else if (productView) {
      // Only product view -> product-view note (no cart items)
      try {
        const productEvent = {
          customerProperties: body.customerProperties || {},
          productProperties: body.productProperties || {},
          cartProperties: body.cartProperties || {}
        };
        const productNoteRes = await sendCartToHubSpot(productEvent, masterdata, {
          includeCartItems: false,
          eventLabel: "Product Viewed",
          forceNote: true
        });
        console.debug("[CartEvents] product-view note result:", productNoteRes);
        lastProductViewedByEmail.set(email, { productKey, ts: Date.now() });
        result.ok(true);
      } catch (e) {
        console.error("[CartEvents] Error creating product-view note:", e);
        result.ok(false);
      }

    } else {
      console.log(" [CartEvents] No actionable event (not login, not product view, cart unchanged) for", email);
      result.ok(false);
    }

  } catch (err) {
    console.error(" [CartEvents ERROR] Unhandled exception", err);
    result.error("Unexpected error in CartEvents", err);
  }

  ctx.status = 200;
  ctx.body = result.data;
  ctx.set("Access-Control-Allow-Origin", "*");
  ctx.set("Access-Control-Allow-Methods", "OPTIONS,POST,GET,PUT,DELETE,PATCH");

  console.log(" [CartEvents] END handler");
  await next();
}

module.exports = {
  handleLoginOrCartUpdate,
  // helpers to allow ProductView to share session flag if needed
  setLastProductViewed: (email, productKey) => lastProductViewedByEmail.set(email, { productKey, ts: Date.now() }),
  getLastProductViewed: (email) => lastProductViewedByEmail.get(email) || null
};
