// background.js - UPDATED (route Cart Updated + login/logout + product views correctly)

const DEFAULTS = {
  middlewareUrl: "http://localhost:4000",
};

// Initialize default config
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(["middlewareUrl"], (items) => {
    if (!items.middlewareUrl) {
      chrome.storage.sync.set(DEFAULTS);
    }
  });
});

// Read config
function readConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["middlewareUrl"], (items) => {
      resolve({
        middlewareUrl: items.middlewareUrl || DEFAULTS.middlewareUrl,
      });
    });
  });
}

// Decide route based on payload content
function chooseRouteForPayload(baseUrl, payload) {
  const base = baseUrl.replace(/\/$/, "");
  const la = (payload?.customerProperties?.lastActivityType || "").toLowerCase();
  const pageType = (payload?.customerProperties?.pageType || "").toLowerCase();

  // 1) LOGIN / LOGOUT → CartEvents
  if (
    la.includes("login") ||
    la.includes("logout") ||
    la.includes("signed in") ||
    la.includes("sign in") ||
    la.includes("sign out") ||
    la.includes("signed out")
  ) {
    return `${base}/_v/cart-events`;
  }

  // 2) CART UPDATED (including empty cart) → CartEvents
  if (la.includes("cart updated")) {
    return `${base}/_v/cart-events`;
  }

  // 3) PRODUCT VIEW → ProductView
  if (la.includes("product view") || pageType === "product") {
    return `${base}/_v/product-view`;
  }

  // 4) CART UPDATES inferred only from items (fallback) → CartEvents
  const hasItems =
    Array.isArray(payload?.cartProperties?.items) &&
    payload.cartProperties.items.length > 0;

  if (hasItems) {
    return `${base}/_v/cart-events`;
  }

  // 5) BRAND PAGE → PageViews (brand_view handled inside sendCartToHubSpot)
  if (pageType === "brand") {
    return `${base}/_v/page-views`;
  }

  // 6) CATEGORY / PAGE / HOME / OTHER → PageViews
  return `${base}/_v/page-views`;
}

// Main message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 1) Forward events to middleware
  if (msg && msg.type === "FORWARD_TO_MW") {
    (async () => {
      try {
        const cfg = await readConfig();
        const target = chooseRouteForPayload(cfg.middlewareUrl, msg.payload);

        const res = await fetch(target, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Whola-Raw-Capture":
              msg.payload && msg.payload.rawCapture ? "1" : "0",
          },
          body: JSON.stringify(msg.payload),
        });

        const text = await res.text();
        sendResponse({ status: res.status, body: text, target });
      } catch (err) {
        sendResponse({ status: 0, error: String(err) });
      }
    })();
    return true;
  }

  // 2) Provide middleware URL to content script
  if (msg.type === "GET_MIDDLEWARE_CONFIG") {
    readConfig().then((cfg) => {
      sendResponse({ ok: true, middlewareUrl: cfg.middlewareUrl });
    });
    return true;
  }

  // 3) Inject middleware URL into MAIN world
  if (msg.type === "INJECT_CONFIG_TO_PAGE") {
    const tabId = sender.tab.id;

    chrome.scripting
      .executeScript({
        target: { tabId },
        world: "MAIN",
        func: (url) => {
          window.__MIDDLEWARE_URL__ = url;
          window.__WHOLA_INJECTED__ = true;
        },
        args: [msg.middlewareUrl],
      })
      .then(() => sendResponse({ ok: true }));

    return true;
  }

  // 4) Inject page-capture.js into MAIN world
  if (msg.type === "INJECT_EXTENSION_SCRIPT") {
    const tabId = sender.tab.id;

    chrome.scripting
      .executeScript({
        target: { tabId, allFrames: true },
        world: "MAIN",
        files: ["page-capture.js"],
      })
      .then(() => sendResponse({ ok: true, method: "direct-file" }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));

    return true;
  }

  sendResponse({ ok: false, err: "unknown message type" });
});
