"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrders = getOrders;

/* eslint-disable no-console */


const { getOrderById, getClientProfileByEmail } = require("./VtexService");
const { Result } = require("../general/Result");
const {
  getDealByDealName,
  updateDeal,
  getContactInfo,
  createContactInfo,
} = require("./HubSpotClient");
const { createCompletedDeal } = require("./HubspotService");
const { Deal } = require("../general/Deal");
const { OrderItem } = require("../general/OrderItem");
const { createLogsSchema } = require("../util/logs");

// -----------------------------------------------------
// Logging helpers
// -----------------------------------------------------
function logStep(label, data) {
  console.log(`\n[OrdersHook] ${label}`);
  if (data !== undefined) console.log(JSON.stringify(data, null, 2));
}

function logError(label, error) {
  console.error(`\n[OrdersHook ERROR] ${label}`);
  console.error(error?.stack || error);
}

// -----------------------------------------------------
// MAIN HANDLER
// -----------------------------------------------------
async function getOrders(ctx, next) {
  logStep("START handler");

  const body = ctx.req.body;
  logStep("Incoming Body (ctx.req.body)", body);

  if (!body) {
    logError("Empty or missing body on ctx.req.body", {});
    ctx.status = 400;
    ctx.body = { error: "Empty request body" };
    return;
  }


  const result = new Result();

  await createLogsSchema(ctx);

  try {
    // =====================================================
    // PAYMENT APPROVED
    // =====================================================
    if (body.State === "payment-approved") {
      logStep("State = payment-approved");

      // ---- VTEX ORDER DATA ----
      logStep("Calling VTEX → getOrderById()", body.OrderId);
      const orderData = await getOrderById(ctx, body.OrderId);
      logStep("VTEX Order Response", orderData);

      if (!orderData?.data) {
        logError("VTEX getOrderById returned no data", orderData);
        throw new Error("VTEX order lookup failed");
      }

      const email = orderData.data.clientProfileData.email;
      logStep("Extracted Email", email);

      const formattedValue = String(orderData.data.value / 100);

      // ---- CREATE DEAL ----
      const deal = new Deal(
        body.OrderId,
        "processed",
        formattedValue,
        orderData.data.lastChange
      );
      logStep("Deal Created", deal);

      // ---- ORDER ITEMS ----
      const orderItems = getItems(orderData.data.items);
      logStep("Order Items", orderItems);

      // ---- CREATE DEAL IN HUBSPOT ----
      logStep("Calling HubSpot → createCompletedDeal()");
      await createCompletedDeal(deal, [], orderItems, ctx, email);
      logStep("createCompletedDeal() SUCCESS");

      // ---- CONTACT PROFILE ----
      logStep("Calling VTEX → getClientProfileByEmail()", email);
      const profile = await getClientProfileByEmail(ctx, email);
      logStep("VTEX Profile Response", profile);

      // ---- HUBSPOT CONTACT ----
      logStep("Calling HubSpot → getContactInfo()", email);
      const contactInfo = await getContactInfo(email);
      logStep("HubSpot ContactInfo Response", contactInfo);

      if (contactInfo.status === 200) {
        logStep("Updating HubSpot Contact", contactInfo.data);
        await updateContactInfo(contactInfo.data.vid, profile.data);
      } else if (
        contactInfo.status === 500 &&
        contactInfo.data?.response?.status === 404
      ) {
        logStep("HubSpot Contact Not Found → Creating New Contact");
        await createContactInfo(profile.data);
      }
    }

    // =====================================================
    // INVOICED / CANCELLED
    // =====================================================
    else if (body.State === "invoiced" || body.State === "canceled") {
      logStep(`State = ${body.State}`);

      logStep("Calling HubSpot → getDealByDealName()", body.OrderId);
      const dealData = await getDealByDealName(body.OrderId);
      logStep("HubSpot Deal Lookup Response", dealData);

      const dealId = dealData.data.results[0].id;

      if (body.State === "invoiced") {
        logStep("Updating deal → shipped");
        await updateDeal(dealId, "shipped");
      } else {
        logStep("Updating deal → cancelled");
        await updateDeal(dealId, "cancelled");
      }
    }

    result.ok(true);
  } catch (error) {
    logError("Unhandled exception in getOrders", error);
    result.error("Unexpected error while processing order", error);
  }

  ctx.status = 200;
  ctx.body = result.data;

  ctx.set("Access-Control-Allow-Origin", "*");
  ctx.set(
    "Access-Control-Allow-Methods",
    "OPTIONS,POST,GET,PUT,DELETE,PATCH"
  );

  logStep("END handler");
  await next();
}

// -----------------------------------------------------
// Helper: Convert VTEX items → OrderItem[]
// -----------------------------------------------------
function getItems(orderItems) {
  const items = [];
  for (let index = 0; index <= orderItems.length - 1; index++) {
    const { id, quantity, seller, price, name } = orderItems[index];
    const cartItem = new OrderItem(id, quantity, seller, price, name);
    items.push(cartItem);
  }
  return items;
}
