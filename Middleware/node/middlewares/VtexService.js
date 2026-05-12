"use strict";

const axios = require("axios");
const { Result } = require("../general/Result");

const {
  VTEX_API_KEY,
  VTEX_API_TOKEN,
  BASE_URL_PRICE,
  BASE_URL_SHIPOP,
} = require("../util/constants");

/* eslint-disable no-console */

// -----------------------------------------------------
// Logging helpers
// -----------------------------------------------------
function logVTEX(label, url) {
  console.log(`\n [VTEX REQUEST] ${label}`);
  console.log("URL:", url);
}

function logVTEXResponse(label, status, data) {
  console.log(` [VTEX RESPONSE] ${label}`);
  console.log("Status:", status);
  console.log("Data:", JSON.stringify(data, null, 2));
}

function logVTEXError(label, error) {
  console.error(` [VTEX ERROR] ${label}`);
  console.error(error?.response?.data || error);
}

// -----------------------------------------------------
// Check if VTEX credentials exist
// -----------------------------------------------------
function isVtexConfigured() {
  return !!(
    VTEX_API_KEY &&
    VTEX_API_TOKEN &&
    (BASE_URL_PRICE || BASE_URL_SHIPOP)
  );
}

// -----------------------------------------------------
// Authenticated HTTP client
// -----------------------------------------------------
function getHttpAuth(ctx) {
  const headers = {
    VtexIdclientAutCookie: ctx?.vtex?.authToken || "",
    "Cache-Control": "no-cache",
    "X-Vtex-Use-Https": "true",
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (VTEX_API_KEY && VTEX_API_TOKEN) {
    headers["X-VTEX-API-AppKey"] = VTEX_API_KEY;
    headers["X-VTEX-API-AppToken"] = VTEX_API_TOKEN;
  } else {
    console.warn("⚠️ VTEX API key/token missing — requests may fail.");
  }

  return axios.create({ headers });
}

// -----------------------------------------------------
// Non-auth HTTP client (pricing API)
// -----------------------------------------------------
function getHttp() {
  const headers = {
    "Cache-Control": "no-cache",
    "X-Vtex-Use-Https": "true",
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (VTEX_API_KEY && VTEX_API_TOKEN) {
    headers["X-VTEX-API-AppKey"] = VTEX_API_KEY;
    headers["X-VTEX-API-AppToken"] = VTEX_API_TOKEN;
  } else {
    console.warn("⚠️ VTEX API key/token missing — requests may fail.");
  }

  return axios.create({ headers });
}

// -----------------------------------------------------
// Safe wrapper for GET requests
// -----------------------------------------------------
async function safeGet(url, httpInstance, label) {
  const result = new Result();

  if (!isVtexConfigured()) {
    console.warn("⚠️ VTEX not configured — returning 204");
    result.result(204, "VTEX not configured", null);
    return result;
  }

  logVTEX(label, url);

  try {
    const { data, status } = await httpInstance.get(url);

    logVTEXResponse(label, status, data);

    if (status === 200) {
      result.ok(data);
    } else {
      result.result(status, "not accepted", data);
    }
  } catch (error) {
    logVTEXError(label, error);
    result.error("Unexpected VTEX error", error);
  }

  return result;
}

// -----------------------------------------------------
// VTEX API FUNCTIONS
// -----------------------------------------------------

// GET /orders/{orderId}
async function getOrderById(ctx, orderId) {
  const url = `${BASE_URL_SHIPOP}api/oms/pvt/orders/${orderId}`;
  return safeGet(url, getHttpAuth(ctx), "getOrderById");
}

// GET /profiles?email=
async function getClientProfileByEmail(ctx, email) {
  const url = `${BASE_URL_SHIPOP}api/checkout/pub/profiles?email=${encodeURIComponent(
    email
  )}`;
  return safeGet(url, getHttpAuth(ctx), "getClientProfileByEmail");
}

// GET /sku/{id}
async function getSkuById(ctx, id) {
  const url = `${BASE_URL_SHIPOP}api/catalog_system/pvt/sku/stockkeepingunitbyid/${id}`;
  return safeGet(url, getHttpAuth(ctx), "getSkuById");
}

// GET /pricing/prices/{skuId}
async function getPriceBySkuId(ctx, skuid) {
  const url = `${BASE_URL_PRICE}pricing/prices/${skuid}`;
  return safeGet(url, getHttp(ctx), "getPriceBySkuId");
}

// GET /sellers/{sellerId}
async function getSellerById(ctx, sellerId) {
  const url = `${BASE_URL_SHIPOP}api/catalog_system/pvt/sellers/${sellerId}`;
  return safeGet(url, getHttpAuth(ctx), "getSellerById");
}

module.exports = {
  getOrderById,
  getClientProfileByEmail,
  getSkuById,
  getPriceBySkuId,
  getSellerById,
};
