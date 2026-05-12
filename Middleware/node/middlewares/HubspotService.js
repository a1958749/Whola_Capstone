"use strict";

/*
  HubSpot integration service
  - sendCartToHubSpot(event, masterdata, options)
    options = { includeCartItems: boolean, eventLabel: string, forceNote: boolean, actionType: "added"|"removed"|"updated"|null, itemsOverride: array|null, remainingItemsOverride: array|null }
  - Uses CRM v3 for contact create/update and engagements v1 for notes
  - Deduping: in-memory + optional masterdata persistence
  - Only updates the cleaned set of contact properties (no vtex_customer_id, no customer_session_id, no last_visit_date/recent_visit_date)
*/

const axios = require("axios");
const path = require("path");
const constants = require(path.join(__dirname, "..", "util", "constants.js"));

const DEDUPE_TTL_MS = 20 * 1000; // 20 seconds
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
      const doc = await masterdata.getDocument({ dataEntity: "hubspot_dedupe", id: email });
      console.debug("[HubSpot] masterdata.getDocument result:", doc);
      return doc || null;
    }
    return null;
  } catch (e) {
    console.debug("[HubSpot] getLastSeenFromMasterdata failed", e?.message || e);
    return null;
  }
}

async function upsertLastSeenToMasterdata(masterdata, email, eventName, tsIso) {
  if (!masterdata || !email) return false;
  try {
    const fields = { id: email, email, eventName, lastSeenAt: tsIso };
    if (typeof masterdata.createDocument === "function") {
      try {
        await masterdata.createDocument({ dataEntity: "hubspot_dedupe", schema: "hubspot_dedupe", fields });
        console.debug("[HubSpot] masterdata.createDocument succeeded for", email);
        return true;
      } catch (createErr) {
        console.debug("[HubSpot] createDocument failed, trying updateDocument", createErr?.message || createErr);
        if (typeof masterdata.updateDocument === "function") {
          try {
            await masterdata.updateDocument({ dataEntity: "hubspot_dedupe", id: email, fields });
            console.debug("[HubSpot] masterdata.updateDocument succeeded for", email);
            return true;
          } catch (updateErr) {
            console.debug("[HubSpot] updateDocument failed", updateErr?.message || updateErr);
            return false;
          }
        }
        return false;
      }
    }
    return false;
  } catch (e) {
    console.debug("[HubSpot] upsertLastSeenToMasterdata failed", e?.message || e);
    return false;
  }
}

// -----------------------------
// Contact helpers (CRM v3)
// -----------------------------
async function searchContactByEmailV3(email) {
  try {
    const http = getHttp();
    const payload = {
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: ["email"],
      limit: 1,
    };
    console.debug("[HubSpot] searchContactByEmailV3 payload:", JSON.stringify(payload));
    const res = await http.post("https://api.hubapi.com/crm/v3/objects/contacts/search", payload);
    console.debug("[HubSpot] searchContactByEmailV3 response:", res.status, JSON.stringify(res.data));
    if (res.data && res.data.total > 0 && Array.isArray(res.data.results) && res.data.results.length > 0) {
      return res.data.results[0].id;
    }
    return null;
  } catch (err) {
    console.error("[HubSpot] searchContactByEmailV3 failed:", err?.response?.status, err?.response?.data || err?.message || err);
    return null;
  }
}

async function createContactV3(props) {
  try {
    const http = getHttp();
    const payload = { properties: props };
    console.debug("[HubSpot] createContactV3 payload:", JSON.stringify(payload));
    const res = await http.post("https://api.hubapi.com/crm/v3/objects/contacts", payload);
    console.debug("[HubSpot] createContactV3 response:", res.status, JSON.stringify(res.data));
    return { ok: true, id: res.data.id, data: res.data };
  } catch (err) {
    console.error("[HubSpot] createContactV3 failed:", err?.response?.status, err?.response?.data || err?.message || err);
    return { ok: false, error: err?.response?.data || err?.message || err };
  }
}

async function createContactV3_simple(email) {
  // backward-compatible helper if only email is provided
  try {
    const http = getHttp();
    const body = { properties: { email } };
    console.debug("[HubSpot] createContactV3_simple payload:", JSON.stringify(body));
    const res = await http.post(constants.HUBSPOT_CREATE_CONTACT_URL, body);
    console.debug("[HubSpot] createContactV3_simple response:", res.status, JSON.stringify(res.data));
    return res.data?.id || null;
  } catch (err) {
    console.error("[HubSpot] createContactV3_simple failed:", err?.response?.status, err?.response?.data || err?.message || err);
    return null;
  }
}

async function ensureContactByEmail(email) {
  if (!email) return null;
  let contactId = await searchContactByEmailV3(email);
  if (!contactId) {
    console.debug("[HubSpot] contact not found, creating for email:", email);
    const created = await createContactV3_simple(email);
    contactId = created || null;
    if (contactId) console.debug("[HubSpot] contact created id:", contactId);
    else console.warn("[HubSpot] contact creation failed for email:", email);
  } else {
    console.debug("[HubSpot] contact found id:", contactId);
  }
  return contactId;
}

// Update contact properties (skip unknown props)
async function updateContactPropertiesV3(contactId, propertiesObj) {
  if (!contactId) {
    console.warn("[HubSpot] updateContactPropertiesV3 missing contactId");
    return { ok: false };
  }
  const http = getHttp();
  const url = `${constants.HUBSPOT_UPDATE_CONTACT_URL}${contactId}`;
  const payload = { properties: {} };
  for (const k of Object.keys(propertiesObj || {})) {
    payload.properties[k] = propertiesObj[k] === undefined || propertiesObj[k] === null ? "" : String(propertiesObj[k]);
  }
  try {
    console.debug("[HubSpot] updateContactPropertiesV3 request:", url, JSON.stringify(payload));
    const res = await http.patch(url, payload);
    console.debug("[HubSpot] updateContactPropertiesV3 success:", res.status, JSON.stringify(res.data));
    return { ok: true, data: res.data };
  } catch (err) {
    const resp = err?.response?.data;
    console.warn("[HubSpot] updateContactPropertiesV3 failed:", err?.response?.status, resp || err?.message || err);
    return { ok: false, error: resp || err?.message || err };
  }
}

// -----------------------------
// Engagements v1 note creator (HTML-friendly)
// -----------------------------
function sumCartValue(itemsArr) {
  if (!Array.isArray(itemsArr) || itemsArr.length === 0) return 0;
  // price is expected in cents (integer). Multiply by qty, sum, then divide by 100.
  const totalCents = itemsArr.reduce((acc, it) => {
    const price = Number(it.price || 0);
    const qty = Number(it.qty || it.quantity || 1);
    return acc + (price * qty);
  }, 0);
  return totalCents / 100;
}

function formatCurrency(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

async function addTimelineNoteV1(contactId, items, eventLabel = "Cart Updated", productProperties = {}, includeCartItems = false, actionType = null, remainingItems = null) {
  // Prefer explicit productProperties name; fallback to first item name/sku when needed
  let productName = (productProperties && (productProperties.productName || productProperties.name)) || "";
  const brand = productProperties?.brandName || productProperties?.brand || "";

  // If productName missing, try to use first item name (useful for added notes when productProperties absent)
  if (!productName && Array.isArray(items) && items.length > 0) {
    const first = items.find(i => i.name || i.productName || i.sku);
    if (first) {
      productName = first.name || first.productName || first.sku || "";
    }
  }

  // Helper: format items block (single-line per item)
  const formatItemsBlock = (itemsArr) => {
    return itemsArr
      .map(i => {
        const price = (i.price || 0);
        const priceStr = (typeof price === "number" && price !== 0) ? `$${(price / 100).toFixed(2)}` : (price ? String(price) : "no price");
        const variantInfo = i.variant || i.variantName || i.skuVariant || "";
        const variantSuffix = variantInfo ? ` ${variantInfo}` : "";
        const namePart = i.name || i.productName || "";
        return `${i.sku || i.skuId || i.itemId || "unknown"} x ${i.qty || i.quantity || 1} (${priceStr}) — ${namePart}${variantSuffix}`;
      })
      .join("\n");
  };

  // Compose note parts
  const noteParts = [];

  // Only treat as a login note when the eventLabel explicitly indicates Login.
  // This prevents product view payloads that include productProperties from being misclassified as login notes.
  if (!includeCartItems && eventLabel === "Login") {
    // Format login note exactly as requested
    const pageText = productProperties?.productName || productProperties?.name || productProperties?.brandName || "Home";
    noteParts.push(`🛍️ Customer Logged-in: ${pageText}`);
  } else if (includeCartItems) {
    if (actionType === "removed") {
      const removedItems = Array.isArray(items) ? items : [];
      const pluralHeader = removedItems.length > 1 ? "Products removed from Cart" : "Product removed from Cart";
      const headerItemText = removedItems.length === 1
        ? (removedItems[0].name || removedItems[0].productName || removedItems[0].sku || "unknown")
        : removedItems.map(it => (it.name || it.productName || it.sku || "unknown")).join("; ");

      noteParts.push(`🗑️ ${pluralHeader} : ${headerItemText}`);

      if (removedItems.length > 0) {
        const removedBlock = formatItemsBlock(removedItems);
        if (removedBlock) noteParts.push(`Removed Items:\n${removedBlock}`);
      }

      const remaining = Array.isArray(remainingItems) ? remainingItems : [];
      if (remaining.length > 0) {
        const remainingText = formatItemsBlock(remaining);
        noteParts.push(`🛒 Updated Cart : ${remainingText}`);
        const cartValue = sumCartValue(remaining);
        noteParts.push(`Cart Value : ${formatCurrency(cartValue)}`);
      } else {
        noteParts.push(`🛒 Updated Cart : (no items)`);
      }

    } else {
      // ADDED or UPDATED
      if (actionType === "added") {
        if (productName) noteParts.push(`➕ Product added to cart : ${productName}${brand ? ` (${brand})` : ""}`);
        else noteParts.push(`➕ Product added to cart`);
      } else {
        if (productName) noteParts.push(`Product updated in cart : ${productName}${brand ? ` (${brand})` : ""}`);
        else noteParts.push(`${eventLabel}`);
      }

      if (Array.isArray(items) && items.length > 0) {
        const itemsText = formatItemsBlock(items);
        noteParts.push(`🛒 Updated Cart : ${itemsText}`);
        const cartValue = sumCartValue(items);
        noteParts.push(`Cart Value : ${formatCurrency(cartValue)}`);
      }
    }
  } else {
    // Product view formatting (no cart items)
    if (productName) noteParts.push(`🛍️ Product viewed: ${productName}${brand ? ` (${brand})` : ""}`);
    else noteParts.push(`🛍️ ${eventLabel}`);
  }

  // Plain text fallback
  const noteBodyPlain = noteParts.join("\n\n");

  // Build HTML body: escape and replace newlines with <br>, wrap blocks in divs
  const htmlEscape = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const noteBodyHtml = noteParts
    .map(part => htmlEscape(part).replace(/\n/g, "<br>"))
    .map(p => `<div style="margin-bottom:8px;">${p}</div>`)
    .join("");

  try {
    const http = getHttp();
    const payload = {
      engagement: { type: "NOTE" },
      associations: { contactIds: [Number(contactId)] },
      // Use HTML body so HubSpot UI renders line breaks and blocks
      metadata: { body: noteBodyHtml || htmlEscape(noteBodyPlain) },
    };
    console.debug("[HubSpot] addTimelineNoteV1 request payload:", JSON.stringify(payload));
    const res = await http.post("https://api.hubapi.com/engagements/v1/engagements", payload);
    console.debug("[HubSpot] addTimelineNoteV1 response:", res.status, JSON.stringify(res.data));
    const engagementId = res.data && (res.data.engagement?.id || res.data?.engagementId || res.data?.id) || null;
    console.log("[HubSpot] Note created (v1) engagementId:", engagementId);
    return { ok: true, data: res.data, engagementId };
  } catch (err) {
    console.warn("[HubSpot] addTimelineNoteV1 failed", err?.response?.data || err?.message || err);
    return { ok: false, error: err?.response?.data || err?.message || err };
  }
}

// -----------------------------
// Main entrypoint: sendCartToHubSpot(event, masterdata, options)
// options: { includeCartItems: boolean, eventLabel: string, forceNote: boolean, actionType: "added"|"removed"|"updated"|null, itemsOverride: array|null, remainingItemsOverride: array|null }
// -----------------------------
async function sendCartToHubSpot(event, masterdata, options = {}) {
  const includeCartItems = !!options.includeCartItems;
  const eventLabel = options.eventLabel || "Activity";
  const forceNote = !!options.forceNote;
  const actionType = options.actionType || null;
  const itemsOverride = Array.isArray(options.itemsOverride) ? options.itemsOverride : null;
  const remainingItemsOverride = Array.isArray(options.remainingItemsOverride) ? options.remainingItemsOverride : null;

  console.debug("[HubSpot] sendCartToHubSpot invoked. event present:", !!event, "masterdata present:", !!masterdata, "options:", options);

  try {
    if (!event || !event.customerProperties) {
      console.warn("[HubSpot] Missing event.customerProperties — skipping");
      return { ok: false, reason: "missing_event" };
    }

    const email = event.customerProperties.email;
    if (!email) {
      console.warn("[HubSpot] Missing email — skipping");
      return { ok: false, reason: "missing_email" };
    }

    const eventName = (event.customerProperties.lastActivityType || "product_view").toString().toLowerCase();
    const now = Date.now();
    let lastSeenTs = null;

    // Check masterdata dedupe if available
    let masterdataLastSeen = null;
    if (masterdata) {
      try {
        masterdataLastSeen = await getLastSeenFromMasterdata(masterdata, email);
        if (masterdataLastSeen && masterdataLastSeen.lastSeenAt) lastSeenTs = new Date(masterdataLastSeen.lastSeenAt).getTime();
      } catch (e) {
        console.debug("[HubSpot] masterdata read error (ignored)", e?.message || e);
      }
    } else {
      const entry = inMemoryDedupe.get(email);
      if (entry && entry.eventName === eventName) lastSeenTs = entry.ts;
    }

    if (!forceNote && lastSeenTs && (now - lastSeenTs) < DEDUPE_TTL_MS) {
      console.debug("[HubSpot] Duplicate event suppressed by dedupe", { email, eventName, lastSeenTs, now });
      return { ok: false, reason: "deduped" };
    }

    // Ensure contact exists (create if missing)
    let contactId = await searchContactByEmailV3(email);
    if (!contactId) {
      console.debug("[HubSpot] contact not found, creating for email:", email);
      const created = await createContactV3_simple(email);
      contactId = created || null;
      if (contactId) console.debug("[HubSpot] contact created id:", contactId);
      else console.warn("[HubSpot] contact creation failed for email:", email);
    } else {
      console.debug("[HubSpot] contact found id:", contactId);
    }

    // Compute customer_type (internal only). Use inMemorySessionByEmail + masterdata lastSeen date as heuristics.
    const currentSessionId = event.customerProperties?.sessionId || "";
    const today = new Date().toISOString().split("T")[0];

    let computedCustomerType = "New";
    if (!contactId) {
      computedCustomerType = "New";
    } else {
      const prevSession = inMemorySessionByEmail.get(email) || "";
      if (currentSessionId && prevSession && currentSessionId !== prevSession) {
        computedCustomerType = "Returning";
      } else {
        if (masterdataLastSeen && masterdataLastSeen.lastSeenAt) {
          const lastSeenDate = new Date(masterdataLastSeen.lastSeenAt).toISOString().split("T")[0];
          if (lastSeenDate !== today) computedCustomerType = "Frequent";
          else computedCustomerType = "Returning";
        } else {
          computedCustomerType = "Returning";
        }
      }
    }

    // Build cleaned contact properties (only the fields you want in HubSpot)
    const contactProps = {
      email: email,
      last_activity_type: event.customerProperties?.lastActivityType || "Product view",
      last_product_viewed: event.productProperties?.productName || "",
      last_brand_viewed: event.productProperties?.brandName || "",
      last_category_viewed: event.productProperties?.categoryName || "",
      cart_status: event.cartProperties?.cartStatus || "",
      customer_type: computedCustomerType,
    };

    // Upsert contact properties
    try {
      if (!contactId) {
        const createRes = await createContactV3(contactProps);
        if (createRes.ok) {
          contactId = createRes.id;
          console.log("[HubSpot] Created new contact id:", contactId);
        } else {
          console.warn("[HubSpot] createContactV3 failed, continuing to note creation if possible", createRes.error);
        }
      } else {
        const updateRes = await updateContactPropertiesV3(contactId, contactProps);
        if (updateRes.ok) {
          console.log("[HubSpot] Updated contact id:", contactId);
        } else {
          console.warn("[HubSpot] updateContactPropertiesV3 failed", updateRes.error);
        }
      }
    } catch (err) {
      console.error("[HubSpot] contact upsert error:", err?.message || err);
    }

    // Persist session in-memory for future customer_type computation (internal only)
    if (currentSessionId) inMemorySessionByEmail.set(email, currentSessionId);

    // Build items for note (if includeCartItems)
    // Use itemsOverride when provided (CartEvents will pass removed-only items for removals)
    const items = itemsOverride !== null ? itemsOverride : ((event.cartProperties && event.cartProperties.items) || []);
    const productProps = event.productProperties || {};
    const remainingItems = remainingItemsOverride !== null ? remainingItemsOverride : null;

    // Create timeline note (only one note per call, controlled by includeCartItems)
    let noteResult = null;
    try {
      if (!contactId) {
        // try one more time to find contact id
        contactId = await searchContactByEmailV3(email);
      }
      if (!contactId) {
        console.warn("[HubSpot] No contactId available; skipping timeline note creation");
        noteResult = { ok: false, reason: "no_contact_id" };
      } else {
        // Pass actionType and remainingItems through to the note creator
        noteResult = await addTimelineNoteV1(contactId, items, eventLabel, productProps, includeCartItems, actionType, remainingItems);
      }
    } catch (err) {
      console.error("[HubSpot] timeline note creation error:", err?.message || err);
      noteResult = { ok: false, error: err };
    }

    // Update in-memory dedupe and masterdata
    try {
      inMemoryDedupe.set(email, { ts: now, eventLabel });
      await upsertLastSeenToMasterdata(masterdata, email, eventName, new Date(now).toISOString());
    } catch (e) {
      console.debug("[HubSpot] dedupe persistence failed", e?.message || e);
    }

    console.log("[HubSpot] sendCartToHubSpot processed for", email);
    return {
      ok: !!(noteResult && noteResult.ok),
      contactId,
      noteResult,
    };
  } catch (err) {
    console.error("[HubSpot] sendCartToHubSpot unhandled error", err?.response?.data || err?.message || err);
    return { ok: false, error: err };
  }
}

module.exports = {
  sendCartToHubSpot,
  // Exported for tests or other modules if needed
  searchContactByEmailV3,
  createContactV3,
  updateContactPropertiesV3,
  addTimelineNoteV1,
};
