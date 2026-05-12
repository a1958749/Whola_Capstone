"use strict";

const deepEqual = require("fast-deep-equal"); // npm i fast-deep-equal
const { addLog, createLogsSchema } = require("../util/logs");
const { sendCartToHubSpot } = require("./HubspotService");
const { Result } = require("../general/Result");

// In-memory last-cart snapshot per email (short-term). For persistence use masterdata.
const lastCartByEmail = new Map();

// In-memory last product viewed per email (session-level flag).
const lastProductViewedByEmail = new Map();

function isLoginEvent(body) {
  const lastActivity = body?.customerProperties?.lastActivityType?.toLowerCase?.() || "";
  return lastActivity.includes("login") || lastActivity.includes("signed in");
}

function isProductViewEvent(body) {
  const lastActivity = body?.customerProperties?.lastActivityType?.toLowerCase?.() || "";
  return lastActivity.includes("product view") || lastActivity.includes("product_view") || (lastActivity.includes("product") && lastActivity.includes("view"));
}

function cartItemsNormalized(cartProperties) {
  const items = (cartProperties && cartProperties.items) || [];
  // normalize to array of {sku, qty, name, price, variant}
  return items.map(i => ({
    sku: i.sku || i.skuId || i.itemId || "",
    qty: Number(i.qty || i.quantity || 1),
    name: i.name || i.productName || "",
    price: i.price || 0,
    variant: i.variant || i.variantName || i.skuVariant || ""
  }));
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

    // 1) Login event
    if (isLoginEvent(body)) {
      console.log(" [CartEvents] Detected login event for", email);
      try {
        // Pass potential homepage name via productProperties.productName fallback so HubSpot note can show it
        const loginPage = body?.customerProperties?.lastVisitedPage || body?.customerProperties?.homePage || body?.customerProperties?.landingPage || "";
        const event = {
          customerProperties: body.customerProperties || {},
          productProperties: { productName: loginPage },
          cartProperties: body.cartProperties || {}
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

    // compute delta if cart changed
    let delta = { added: [], removed: [], actionType: null };
    if (cartChanged) {
      delta = computeCartDeltaDetailed(prev, normalized);
      console.log(" [CartEvents] Cart delta for", email, delta);
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
