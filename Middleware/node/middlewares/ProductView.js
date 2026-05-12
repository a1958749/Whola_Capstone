"use strict";

const { Result } = require("../general/Result");
const { addLog, createLogsSchema } = require("../util/logs");
const { sendCartToHubSpot } = require("./HubspotService");

// Attempt to use shared setter from CartEvents if available.
// If CartEvents exports a setLastProductViewed(email, productKey) helper, prefer that so both endpoints share the same in-memory session flag.
// Otherwise fall back to a local in-memory map.
let cartEventsHelper = null;
try {
  cartEventsHelper = require("./CartEvents");
} catch (e) {
  cartEventsHelper = null;
}

// Local fallback map (used only if CartEvents does not expose a setter)
const localLastProductViewedByEmail = new Map();

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

// Setter that tries to update shared CartEvents session flag, otherwise updates local map
function setLastProductViewed(email, productKey) {
  try {
    if (cartEventsHelper && typeof cartEventsHelper.setLastProductViewed === "function") {
      // If CartEvents exposes a setter, use it (preferred)
      cartEventsHelper.setLastProductViewed(email, productKey);
      return;
    }
  } catch (e) {
    // ignore and fallback
  }
  // Fallback: update local in-memory map
  localLastProductViewedByEmail.set(email, { productKey, ts: Date.now() });
}

// Optional: expose a getter for testing or other modules (keeps parity with CartEvents)
function getLastProductViewed(email) {
  try {
    if (cartEventsHelper && typeof cartEventsHelper.getLastProductViewed === "function") {
      return cartEventsHelper.getLastProductViewed(email);
    }
  } catch (e) {
    // ignore and fallback
  }
  return localLastProductViewedByEmail.get(email) || null;
}

// Handles product view events only. Creates a product-view note (no cart items).
async function processProductView(ctx, next) {
  console.log("\n [ProductView] START handler");
  const body = ctx.req.body;
  console.log(" [ProductView] Incoming Body", body);

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
      message: "ProductView triggered",
      body: JSON.stringify(body),
    });

    const email = body?.customerProperties?.email;
    if (!email) {
      console.log(" [ProductView] Missing email — skipping");
      result.ok(false);
      ctx.status = 200;
      ctx.body = result.data;
      return;
    }

    // Build teammate-style event
    const event = {
      customerProperties: body.customerProperties || {},
      productProperties: body.productProperties || {},
      cartProperties: body.cartProperties || {},
    };

    // Call HubSpot to create a product-view note only (no cart items)
    try {
      const masterdata = ctx?.clients?.masterdata;

      // Send product-view note (no cart items) and force creation so it is not suppressed when add-to-cart follows immediately
      await sendCartToHubSpot(event, masterdata, {
        includeCartItems: false,
        eventLabel: "Product Viewed",
        forceNote: true
      });

      // Update the session-level product-view flag so subsequent cart updates from the same product page are suppressed
      // Derive productKey and set it in the shared/session store
      const productKey = getProductKey(body);
      setLastProductViewed(email, productKey);

      result.ok(true);
    } catch (e) {
      console.error("[ProductView] Error sending product view to HubSpot:", e?.response?.data || e?.message || e);
      result.ok(false);
    }
  } catch (err) {
    console.error(" [ProductView ERROR] Unhandled exception", err);
    result.error("Unexpected error in ProductView", err);
  }

  ctx.status = 200;
  ctx.body = result.data;
  ctx.set("Access-Control-Allow-Origin", "*");
  ctx.set("Access-Control-Allow-Methods", "OPTIONS,POST,GET,PUT,DELETE,PATCH");

  console.log(" [ProductView] END handler");
  await next();
}

module.exports = {
  processProductView,
  // Export helpers so other modules can share the same session flag if desired
  setLastProductViewed,
  getLastProductViewed,
};
