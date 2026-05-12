"use strict";

const { Result } = require("../general/Result");
const { addLog, createLogsSchema } = require("../util/logs");
const { sendCartToHubSpot } = require("./HubspotService");

// AbandonedCart handler: focused on abandoned/logout semantics.
// Product-view forwarding has been removed — product views should be handled by CartEvents or /events.

async function processAbandonedCart(ctx, next) {
  console.log("\n [AbandonedCart] START handler");
  const body = ctx.req.body;
  console.log(" [AbandonedCart] Incoming Body (ctx.req.body)", body);

  if (!body) {
    ctx.status = 400;
    ctx.body = { error: "Empty request body" };
    return;
  }

  const result = new Result();

  try {
    // Ensure logs schema exists (safe no-op in local stub)
    await createLogsSchema(ctx);

    addLog(ctx, {
      orderId: body.OrderId || null,
      message: "processAbandonedCart triggered",
      body: JSON.stringify(body),
    });

    // Build teammate-style event for potential future use
    const event = {
      customerProperties: body.customerProperties || {},
      productProperties: body.productProperties || {},
      cartProperties: body.cartProperties || {},
    };

    // NOTE: Product-view and cart-update forwarding removed from AbandonedCart.
    // Keep AbandonedCart focused on abandoned/logout events only.
    // If you want to forward abandoned/logout events to HubSpot, call sendCartToHubSpot here
    // only when you detect an actual abandoned/logout condition.

    result.ok(true);
  } catch (err) {
    console.error(" [AbandonedCart ERROR] Unhandled exception in processAbandonedCart", err);
    result.error("Unexpected error while processing abandoned cart", err);
  }

  ctx.status = 200;
  ctx.body = result.data;

  ctx.set("Access-Control-Allow-Origin", "*");
  ctx.set("Access-Control-Allow-Methods", "OPTIONS,POST,GET,PUT,DELETE,PATCH");

  console.log(" [AbandonedCart] END handler");
  await next();
}

module.exports = { processAbandonedCart };
