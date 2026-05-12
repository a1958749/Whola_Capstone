// background.js - FINAL VERSION (HubSpot tracking removed)

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

// Main message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 1) Forward events to middleware
  if (msg && msg.type === "FORWARD_TO_MW") {
    (async () => {
      try {
        const cfg = await readConfig();
        const target = cfg.middlewareUrl.replace(/\/$/, "") + "/_v/cart-events";

        const res = await fetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg.payload),
        });

        const text = await res.text();
        sendResponse({ status: res.status, body: text });
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
