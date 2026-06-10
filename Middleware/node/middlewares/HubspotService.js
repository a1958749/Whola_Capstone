"use strict";

/*
  HubSpot integration service — FINAL FIXED VERSION

  ✔ BrandView triggers ONLY from ProductViewed events
  ✔ Uses ONLY productProperties (no cart fallback)
  ✔ categoryName preserved exactly as ProductView.js sends it
  ✔ Structured logging
*/

const axios = require("axios");
const path = require("path");
const constants = require(path.join(__dirname, "..", "util", "constants.js"));
const pageTypeDetection = require(path.join(__dirname, "..", "util", "pageTypeDetection"));
const logger = require(path.join(__dirname, "..", "util", "logger"));
const { createBrandViewObject, isMeaningfulValue } = require("./BrandViewService");

function logEvent(level, service, messageID, eventLabel, api, msg, extra = {}) {
  logger[level]({
    timestamp: new Date().toISOString(),
    service,
    messageID,
    eventLabel,
    api,
    msg,
    ...extra
  });
}

const DEDUPE_TTL_MS = 20 * 1000;
const inMemoryDedupe = new Map();
const inMemorySessionByEmail = new Map();

function getHttp() {
  return axios.create({
    headers: {
      Authorization: `Bearer ${constants.HUBSPOT_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: 10000,
  });
}

// -----------------------------
// Masterdata helpers
// -----------------------------
async function getLastSeenFromMasterdata(masterdata, email) {
  if (!masterdata || !email) return null;
  try {
    if (typeof masterdata.getDocument === "function") {
      return await masterdata.getDocument({
        dataEntity: "hubspot_dedupe",
        id: email,
      });
    }
    return null;
  } catch {
    return null;
  }
}

async function upsertLastSeenToMasterdata(masterdata, email, eventName, tsIso) {
  if (!masterdata || !email) return false;
  try {
    const fields = { id: email, email, eventName, lastSeenAt: tsIso };

    if (typeof masterdata.createDocument === "function") {
      try {
        await masterdata.createDocument({
          dataEntity: "hubspot_dedupe",
          schema: "hubspot_dedupe",
          fields,
        });
        return true;
      } catch {
        if (typeof masterdata.updateDocument === "function") {
          try {
            await masterdata.updateDocument({
              dataEntity: "hubspot_dedupe",
              id: email,
              fields,
            });
            return true;
          } catch {
            return false;
          }
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

// -----------------------------
// Contact helpers
// -----------------------------
async function searchContactByEmailV3(email) {
  try {
    const http = getHttp();
    const payload = {
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: ["email"],
      limit: 1,
    };

    const res = await http.post(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      payload
    );

    if (res.data?.total > 0 && res.data.results?.length > 0) {
      return res.data.results[0].id;
    }
    return null;
  } catch {
    return null;
  }
}

async function createContactV3_simple(email) {
  try {
    const http = getHttp();
    const body = { properties: { email } };
    const res = await http.post(constants.HUBSPOT_CREATE_CONTACT_URL, body);
    return res.data?.id || null;
  } catch {
    return null;
  }
}

async function ensureContactByEmail(email) {
  if (!email) return null;

  let contactId = await searchContactByEmailV3(email);
  if (!contactId) {
    contactId = await createContactV3_simple(email);
  }
  return contactId;
}

async function updateContactPropertiesV3(contactId, propertiesObj) {
  if (!contactId) return { ok: false };

  const http = getHttp();
  const url = `${constants.HUBSPOT_UPDATE_CONTACT_URL}${contactId}`;
  const payload = { properties: {} };

  for (const k of Object.keys(propertiesObj || {})) {
    const v = propertiesObj[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      payload.properties[k] = String(v).trim();
    }
  }

  if (Object.keys(payload.properties).length === 0) {
    return { ok: true, skipped: true };
  }

  try {
    const res = await http.patch(url, payload);
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: err?.response?.data || err?.message || err };
  }
}

// -----------------------------
// Timeline note creator
// -----------------------------
function sumCartValue(itemsArr) {
  if (!Array.isArray(itemsArr) || itemsArr.length === 0) return 0;
  return (
    itemsArr.reduce((acc, it) => acc + (Number(it.price || 0) * Number(it.qty || 1)), 0) / 100
  );
}

function formatCurrency(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

async function addTimelineNoteV1(
  contactId,
  items,
  eventLabel = "Cart Updated",
  productProperties = {},
  includeCartItems = false,
  actionType = null,
  remainingItems = null
) {
  const http = getHttp();

  let productName =
    productProperties.productName ||
    productProperties.name ||
    (items?.[0]?.name || items?.[0]?.productName || items?.[0]?.sku || "");

  const brand = productProperties.brandName || productProperties.brand || "";

  const formatItemsBlock = (arr) =>
    arr
      .map((i) => {
        const price = i.price || 0;
        const priceStr = price ? `$${(price / 100).toFixed(2)}` : "no price";
        return `${i.sku || "unknown"} x ${i.qty || 1} (${priceStr}) — ${i.name || ""}`;
      })
      .join("\n");

  const noteParts = [];

  if (!includeCartItems && (eventLabel === "Login" || eventLabel === "Logout")) {
    const pageText =
      productProperties.productName ||
      productProperties.name ||
      productProperties.brandName ||
      "Home";
    const verb = eventLabel === "Login" ? "Logged-in" : "Logged-out";
    noteParts.push(`🛍️ Customer ${verb}: ${pageText}`);
  } else if (includeCartItems) {
    if (actionType === "removed") {
      const removedBlock = formatItemsBlock(items);
      noteParts.push(`🗑️ Product removed from Cart`);
      if (removedBlock) noteParts.push(`Removed Items:\n${removedBlock}`);

      const remainingBlock = remainingItems ? formatItemsBlock(remainingItems) : "";
      if (remainingBlock) {
        noteParts.push(`🛒 Updated Cart : ${remainingBlock}`);
        noteParts.push(`Cart Value : ${formatCurrency(sumCartValue(remainingItems))}`);
      }
    } else {
      noteParts.push(
        productName
          ? `➕ Product added to cart : ${productName}${brand ? ` (${brand})` : ""}`
          : "➕ Product added to cart"
      );

      const itemsBlock = formatItemsBlock(items);
      if (itemsBlock) {
        noteParts.push(`🛒 Updated Cart : ${itemsBlock}`);
        noteParts.push(`Cart Value : ${formatCurrency(sumCartValue(items))}`);
      }
    }
  } else {
    noteParts.push(
      productName
        ? `🛍️ ${eventLabel}: ${productName}${brand ? ` (${brand})` : ""}`
        : `🛍️ ${eventLabel}`
    );
  }

  const htmlEscape = (s) =>
    String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const noteBodyHtml = noteParts
    .map((p) => `<div style="margin-bottom:8px;">${htmlEscape(p).replace(/\n/g, "<br>")}</div>`)
    .join("");

  try {
    const payload = {
      engagement: { type: "NOTE" },
      associations: { contactIds: [Number(contactId)] },
      metadata: { body: noteBodyHtml },
    };

    const res = await http.post("https://api.hubapi.com/engagements/v1/engagements", payload);
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: err?.response?.data || err?.message || err };
  }
}

// -----------------------------
// Main entrypoint
// -----------------------------
async function sendCartToHubSpot(event, masterdata, options = {}) {
  const includeCartItems = !!options.includeCartItems;
  const eventLabel = options.eventLabel || "Activity";
  const serviceName = options.serviceName || "HubSpot";
  const messageID = options.messageID || Date.now().toString();
  const actionType = options.actionType || null;

  logEvent("info", serviceName, messageID, eventLabel, "hubspot:start", "sendCartToHubSpot invoked", {
    includeCartItems,
    actionType,
  });

  try {
    if (!event?.customerProperties) {
      logEvent("warn", serviceName, messageID, eventLabel, "hubspot:skip", "Missing event.customerProperties");
      return { ok: false };
    }

    const email = event.customerProperties.email;
    if (!email) {
      logEvent("warn", serviceName, messageID, eventLabel, "hubspot:skip", "Missing email");
      return { ok: false };
    }

    const eventName = (event.customerProperties.lastActivityType || "product_view").toLowerCase();
    const now = Date.now();

    let lastSeenTs = null;
    let masterdataLastSeen = null;

    if (masterdata) {
      masterdataLastSeen = await getLastSeenFromMasterdata(masterdata, email);
      if (masterdataLastSeen?.lastSeenAt) {
        lastSeenTs = new Date(masterdataLastSeen.lastSeenAt).getTime();
      }
    } else {
      const entry = inMemoryDedupe.get(email);
      if (entry?.eventName === eventName) lastSeenTs = entry.ts;
    }

    if (!options.forceNote && lastSeenTs && now - lastSeenTs < DEDUPE_TTL_MS) {
      logEvent("info", serviceName, messageID, eventLabel, "hubspot:dedupe", "Duplicate suppressed");
      return { ok: false };
    }

    let contactId = await ensureContactByEmail(email);

    // -----------------------------
    // Contact classification
    // -----------------------------
    const currentSessionId = event.customerProperties.sessionId || "";
    const today = new Date().toISOString().split("T")[0];

    let computedCustomerType = "New";
    if (contactId) {
      const prevSession = inMemorySessionByEmail.get(email) || "";
      if (currentSessionId && prevSession && currentSessionId !== prevSession) {
        computedCustomerType = "Returning";
      } else if (masterdataLastSeen?.lastSeenAt) {
        const lastSeenDate = new Date(masterdataLastSeen.lastSeenAt).toISOString().split("T")[0];
        computedCustomerType = lastSeenDate !== today ? "Frequent" : "Returning";
      } else {
        computedCustomerType = "Returning";
      }
    }

    // -----------------------------
    // Page / product / brand flags
    // -----------------------------
    const rawLastActivity = (event.customerProperties.lastActivityType || "").toLowerCase();
    const pageUrl =
      event.customerProperties.lastVisitedUrl ||
      event.customerProperties.lastVisitedPage ||
      "";
    const explicitPageType = (event.customerProperties.pageType || "").toLowerCase();

    const detectedPageType = pageTypeDetection.detectPageType({
      pageUrl,
      productProps: event.productProperties || {},
      jsonLd: event.jsonLdProduct || null,
    });

    const pageType = explicitPageType || detectedPageType || "page";

    const isActivityProductView =
      rawLastActivity.includes("product view") ||
      rawLastActivity.includes("product_view") ||
      eventLabel === "Product Viewed";

    const isProductPage = pageType === "product";

    const rawProductName = (event.productProperties?.productName || "").trim();
    const rawBrandName = (event.productProperties?.brandName || "").trim();
    const rawCategoryName = (event.productProperties?.categoryName || "").trim();
    const rawProductId = (event.productProperties?.productId || "").trim();

    const hasProductId = !!rawProductId;
    const hasMeaningfulBrand = isMeaningfulValue(rawBrandName);

    const isProductBrandViewEligible =
      isProductPage && (hasProductId || hasMeaningfulBrand);

    // -----------------------------
    // Contact properties
    // -----------------------------
    const contactPropsRaw = {
      email,
      last_activity_type: event.customerProperties.lastActivityType || eventLabel,
      last_product_viewed: null,
      last_brand_viewed: null,
      last_category_viewed: null,
      cart_status: event.cartProperties?.cartStatus || "",
      customer_type: computedCustomerType,
    };

    if (isProductBrandViewEligible && isActivityProductView) {
      if (isMeaningfulValue(rawProductName)) contactPropsRaw.last_product_viewed = rawProductName;
      if (hasMeaningfulBrand) contactPropsRaw.last_brand_viewed = rawBrandName;
      if (isMeaningfulValue(rawCategoryName)) contactPropsRaw.last_category_viewed = rawCategoryName;
    }

    const contactProps = {};
    for (const k of Object.keys(contactPropsRaw)) {
      const v = contactPropsRaw[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        contactProps[k] = String(v).trim();
      }
    }

    logEvent("info", serviceName, messageID, eventLabel, "hubspot:contactUpdate", "Updating contact", {
      contactProps,
    });

    if (!contactId) {
      const createRes = await createContactV3_simple(email);
      contactId = createRes || null;
    } else {
      await updateContactPropertiesV3(contactId, contactProps);
    }

    if (currentSessionId) inMemorySessionByEmail.set(email, currentSessionId);

    // -----------------------------
    // brand_view creation — ONLY for ProductViewed
    // -----------------------------
    if (serviceName === "ProductViewed" && isProductBrandViewEligible && contactId) {
      logEvent("info", "BrandView", messageID, eventLabel, "hubspot:brandView", "Creating brand_view");

      // ⭐ Use ONLY productProperties exactly as ProductView.js sent them
      const brandEvent = {
        ...event,
        productProperties: event.productProperties,
      };

      await createBrandViewObject(
        brandEvent,
        contactId,
        "p442999208_brand_view",
        "p442999208_brand_view_to_contact",
        { eventLabel, messageID }
      );
    }

    // -----------------------------
    // Timeline note
    // -----------------------------
    const items =
      options.itemsOverride !== null
        ? options.itemsOverride
        : event.cartProperties?.items || [];

    const remainingItems =
      options.remainingItemsOverride !== null ? options.remainingItemsOverride : null;

    logEvent("info", serviceName, messageID, eventLabel, "hubspot:timelineNote", "Creating timeline note");

    const noteResult = await addTimelineNoteV1(
      contactId,
      items,
      eventLabel,
      event.productProperties || {},
      includeCartItems,
      actionType,
      remainingItems
    );

    inMemoryDedupe.set(email, { ts: now, eventName });
    await upsertLastSeenToMasterdata(masterdata, email, eventName, new Date(now).toISOString());

    logEvent("info", serviceName, messageID, eventLabel, "hubspot:done", "sendCartToHubSpot completed");

    return {
      ok: !!noteResult.ok,
      contactId,
      noteResult,
    };
  } catch (err) {
    logEvent("error", serviceName, messageID, eventLabel, "hubspot:error", "Unhandled error", { err });
    return { ok: false, error: err };
  }
}

module.exports = {
  sendCartToHubSpot,
  searchContactByEmailV3,
  createContactV3_simple,
  updateContactPropertiesV3,
  addTimelineNoteV1,
};
