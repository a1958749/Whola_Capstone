"use strict";

const axios = require("axios");
const {
  HUBSPOT_TOKEN,
  HUBSPOT_GET_CONTACT_URL,
  HUBSPOT_UPDATE_CONTACT_URL,
  HUBSPOT_CREATE_CONTACT_URL,
  HUBSPOT_GET_DEAL_BY_NAME,
  HUBSPOT_UPDATE_DEAL_URL,
  HUBSPOT_CREATE_DEAL_URL,
  HUBSPOT_SEARCH_PRODUCT_URL,
  HUBSPOT_CREATE_PRODUCT_URL,
  HUBSPOT_CREATE_ITEM_LINE_URL,
  HUBSPOT_SEARCH_COMPANY_BY_NAME_URL,
  HUBSPOT_CREATE_COMPANY_URL,
} = require("../util/constants");

const { Result } = require("../general/Result");

// --------------------------------------------------
// Logging Helpers
// --------------------------------------------------
function logStep(label, data) {
  console.log(`\n[HubSpotClient] ${label}`);
  if (data !== undefined) console.log(JSON.stringify(data, null, 2));
}

function logError(label, error) {
  console.error(`\n[HubSpotClient ERROR] ${label}`);
  console.error(error?.response?.data || error?.stack || error);
}

// --------------------------------------------------
// HTTP Factory
// --------------------------------------------------
function getHttp() {
  return axios.create({
    headers: {
      "Cache-Control": "no-cache",
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
    },
  });
}

// --------------------------------------------------
// CONTACTS
// --------------------------------------------------
async function getContactInfo(email) {
  const result = new Result();
  logStep("GET Contact Info", { email });

  try {
    const http = getHttp();
    const url = `${HUBSPOT_GET_CONTACT_URL}${email}/profile`;

    logStep("Request → GET", { url });

    const { data, status } = await http.get(url, { timeout: 5000 });

    logStep("Response ← GET Contact Info", { status, data });

    if (status === 200) result.ok(data);
    else result.error("not accepted", data);
  } catch (error) {
    logError("getContactInfo failed", error);
    result.error("Unexpected error in getContactInfo", error);
  }

  return result;
}

async function updateContactInfo(vid, clientData) {
  const result = new Result();
  logStep("PATCH Update Contact", { vid, clientData });

  try {
    const http = getHttp();
    const url = `${HUBSPOT_UPDATE_CONTACT_URL}${vid}`;

    // ---- SAFE FALLBACKS ----
    const addr = (clientData.availableAddresses && clientData.availableAddresses[0]) || {};
    const profile = clientData.userProfile || {};

    const dataSend = {
      properties: {
        email: profile.email || clientData.email || "",
        firstname: profile.firstName || "",
        lastname: profile.lastName || "",
        phone: profile.phone || "",
        company: profile.corporateName || "",

        city: addr.city || "",
        state: addr.state || "",
        country: addr.country || "",
        address: `${addr.street || ""} ${addr.number || ""} ${addr.complement || ""}`.trim(),
        zip: addr.postalCode || "",
      },
    };

    logStep("Request → PATCH", { url, dataSend });

    const { data, status } = await http.patch(url, dataSend, { timeout: 5000 });

    logStep("Response ← PATCH Update Contact", { status, data });

    if (status === 200) result.ok(data);
    else result.result(status, "not accepted", data);
  } catch (error) {
    logError("updateContactInfo failed", error);
    result.error("Unexpected error in updateContactInfo", error);
  }

  return result;
}


async function createContactInfo(contactInfo) {
  const result = new Result();
  logStep("POST Create Contact", { contactInfo });

  try {
    const http = getHttp();
    const url = HUBSPOT_CREATE_CONTACT_URL;

    // ---- SAFE FALLBACKS ----
    const addr = (contactInfo.availableAddresses && contactInfo.availableAddresses[0]) || {};
    const profile = contactInfo.userProfile || {};

    const dataSend = {
      properties: {
        city: addr.city || "",
        state: addr.state || "",
        country: addr.country || "",
        address: `${addr.street || ""} ${addr.number || ""} ${addr.complement || ""}`.trim(),
        zip: addr.postalCode || "",

        company: profile.corporateName || "",
        email: profile.email || contactInfo.email || "",
        firstname: profile.firstName || "",
        lastname: profile.lastName || "",
        phone: profile.phone || "",
      },
    };

    logStep("Request → POST", { url, dataSend });

    const { data, status } = await http.post(url, dataSend, { timeout: 5000 });

    logStep("Response ← POST Create Contact", { status, data });

    if (status === 201) result.ok(data);
    else result.result(status, "not accepted", data);
  } catch (error) {
    logError("createContactInfo failed", error);
    result.error("Unexpected error in createContactInfo", error);
  }

  return result;
}

// --------------------------------------------------
// DEALS
// --------------------------------------------------
async function getDealByDealName(dealname) {
  const result = new Result();
  logStep("POST Search Deal By Name", { dealname });

  try {
    const http = getHttp();
    const url = HUBSPOT_GET_DEAL_BY_NAME;

    const dataSend = {
      filterGroups: [
        {
          filters: [
            {
              value: dealname,
              propertyName: "dealname",
              operator: "EQ",
            },
          ],
        },
      ],
      sorts: ["ascend"],
      properties: ["dealname"],
      limit: 1,
      after: 0,
    };

    logStep("Request → POST", { url, dataSend });

    const { data, status } = await http.post(url, dataSend, { timeout: 5000 });

    logStep("Response ← POST Search Deal", { status, data });

    if (status === 200) result.ok(data);
    else result.result(status, "not accepted", data);
  } catch (error) {
    logError("getDealByDealName failed", error);
    result.error("Unexpected error in getDealByDealName", error);
  }

  return result;
}

async function updateDeal(dealId, dealStatus) {
  const result = new Result();
  logStep("PATCH Update Deal", { dealId, dealStatus });

  try {
    const http = getHttp();
    const url = `${HUBSPOT_UPDATE_DEAL_URL}${dealId}`;

    const dataSend = {
      properties: {
        dealstage: dealStatus,
      },
    };

    logStep("Request → PATCH", { url, dataSend });

    const { data, status } = await http.patch(url, dataSend, { timeout: 5000 });

    logStep("Response ← PATCH Update Deal", { status, data });

    if (status === 200) result.ok(data);
    else result.result(status, "not accepted", data);
  } catch (error) {
    logError("updateDeal failed", error);
    result.error("Unexpected error in updateDeal", error);
  }

  return result;
}

async function createDeal(deal) {
  const result = new Result();
  logStep("POST Create Deal", { deal });

  try {
    const http = getHttp();
    const url = HUBSPOT_CREATE_DEAL_URL;

    const dataSend = {
      properties: {
        amount: deal.amount,
        closedate: deal.closedate,
        dealname: deal.dealName,
        dealstage: deal.dealStage,
      },
      associations: getAsociations(deal.itemlines, deal.companyIds, deal.contactId),
    };

    logStep("Request → POST", { url, dataSend });

    const { data, status } = await http.post(url, dataSend, { timeout: 5000 });

    logStep("Response ← POST Create Deal", { status, data });

    if (status === 201) result.ok(data);
    else result.result(status, "not accepted", data);
  } catch (error) {
    logError("createDeal failed", error);
    result.error("Unexpected error in createDeal", error);
  }

  return result;
}

// --------------------------------------------------
// PRODUCTS
// --------------------------------------------------
async function getProductByName(productNames) {
  const result = new Result();
  logStep("POST Search Product", { productNames });

  try {
    const http = getHttp();
    const url = HUBSPOT_SEARCH_PRODUCT_URL;

    const dataSend = {
      filterGroups: getProductsNames(productNames),
    };

    logStep("Request → POST", { url, dataSend });

    const { data, status } = await http.post(url, dataSend, { timeout: 5000 });

    logStep("Response ← POST Search Product", { status, data });

    if (status === 200) result.ok(data);
    else result.result(status, "not accepted", data);
  } catch (error) {
    logError("getProductByName failed", error);
    result.error("Unexpected error in getProductByName", error);
  }

  return result;
}

async function createProduct(productInfo, priceList) {
  const result = new Result();
  logStep("POST Create Product", { productInfo, priceList });

  try {
    const http = getHttp();
    const url = HUBSPOT_CREATE_PRODUCT_URL;

    const dataSend = {
      properties: {
        description: removeTags(productInfo.ProductDescription),
        hs_cost_of_goods_sold: priceList.costPrice,
        name: productInfo.NameComplete,
        price: priceList.basePrice,
      },
    };

    logStep("Request → POST", { url, dataSend });

    const { data, status } = await http.post(url, dataSend, { timeout: 5000 });

    logStep("Response ← POST Create Product", { status, data });

    if (status === 201) result.ok(data);
    else result.result(status, "not accepted", data);
  } catch (error) {
    logError("createProduct failed", error);
    result.error("Unexpected error in createProduct", error);
  }

  return result;
}

async function createItemLine(productInfo, qty) {
  const result = new Result();
  logStep("POST Create Item Line", { productInfo, qty });

  try {
    const http = getHttp();
    const url = HUBSPOT_CREATE_ITEM_LINE_URL;

    const dataSend = {
      properties: {
        name: productInfo.properties.name,
        hs_product_id: productInfo.id,
        quantity: qty,
        price: productInfo.properties.price,
      },
    };

    logStep("Request → POST", { url, dataSend });

    const { data, status } = await http.post(url, dataSend, { timeout: 5000 });

    logStep("Response ← POST Create Item Line", { status, data });

    if (status === 201) result.ok(data);
    else result.result(status, "not accepted", data);
  } catch (error) {
    logError("createItemLine failed", error);
    result.error("Unexpected error in createItemLine", error);
  }

  return result;
}

// --------------------------------------------------
// COMPANIES
// --------------------------------------------------
async function getCompanyByName(companyNames) {
  const result = new Result();
  logStep("POST Search Company", { companyNames });

  try {
    const http = getHttp();
    const url = HUBSPOT_SEARCH_COMPANY_BY_NAME_URL;

    const dataSend = {
      filterGroups: getCompanyNames(companyNames),
    };

    logStep("Request → POST", { url, dataSend });

    const { data, status } = await http.post(url, dataSend, { timeout: 5000 });

    logStep("Response ← POST Search Company", { status, data });

    if (status === 200) result.ok(data);
    else result.result(status, "not accepted", data);
  } catch (error) {
    logError("getCompanyByName failed", error);
    result.error("Unexpected error in getCompanyByName", error);
  }

  return result;
}

async function createCompany(companyInfo) {
  const result = new Result();
  logStep("POST Create Company", { companyInfo });

  try {
    const http = getHttp();
    const url = HUBSPOT_CREATE_COMPANY_URL;

    const dataSend = {
      properties: {
        industry: "seller",
        name: companyInfo.Name,
      },
    };

    logStep("Request → POST", { url, dataSend });

    const { data, status } = await http.post(url, dataSend, { timeout: 5000 });

    logStep("Response ← POST Create Company", { status, data });

    if (status === 201) result.ok(data);
    else result.result(status, "not accepted", data);
  } catch (error) {
    logError("createCompany failed", error);
    result.error("Unexpected error in createCompany", error);
  }

  return result;
}

// --------------------------------------------------
// ASSOCIATION HELPERS
// --------------------------------------------------
function getAsociations(lineIds, companies, contactId) {
  let objectAssociation = `[${getAsosiationContat(contactId)},`;

  companies.forEach((company) => {
    objectAssociation += `${getCompanyAsociations(company)},`;
  });

  lineIds.forEach((line) => {
    objectAssociation += `${getLineAsociations(line)},`;
  });

  objectAssociation = objectAssociation.substring(0, objectAssociation.length - 1);
  objectAssociation += "]";

  return JSON.parse(objectAssociation);
}

function getAsosiationContat(contactId) {
  return `{ "to": {"id":${contactId}}, "types": [{"associationCategory": "HUBSPOT_DEFINED","associationTypeId": 3}]}`;
}

function getLineAsociations(lineId) {
  return `{ "to": { "id":${lineId}}, "types": [ { "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 19 }]}`;
}

function getCompanyAsociations(companyId) {
  return `{ "to": { "id":${companyId}}, "types": [ { "associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 5 }]}`;
}

// --------------------------------------------------
// UTILS
// --------------------------------------------------
function removeTags(str) {
  if (!str) return "";
  return str.toString().replace(/(<([^>]+)>)/gi, "");
}

function getProductsNames(productNames) {
  return productNames.map((name) => ({
    filters: [
      {
        propertyName: "name",
        value: name,
        operator: "EQ",
      },
    ],
  }));
}

function getCompanyNames(companyNames) {
  return companyNames.map((name) => ({
    filters: [
      {
        propertyName: "name",
        value: name,
        operator: "EQ",
      },
    ],
  }));
}

// --------------------------------------------------
// EXPORTS
// --------------------------------------------------
module.exports = {
  getContactInfo,
  updateContactInfo,
  createContactInfo,
  getDealByDealName,
  updateDeal,
  createDeal,
  getProductByName,
  createProduct,
  createItemLine,
  getCompanyByName,
  createCompany,
};
