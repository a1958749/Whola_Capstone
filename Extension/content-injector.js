// content-injector.js
(async function () {
  try {
    // Ensure we are in extension context
    if (typeof chrome === "undefined" || !chrome.runtime) {
      console.warn("Whola injector: chrome.runtime undefined — running in PAGE, aborting.");
      return;
    }

    console.debug("Whola injector: start", location.hostname);

    const allowedHostPattern = /\.?whola\.com\.au$|^(localhost|127\.0\.0\.1)$/;
    if (!allowedHostPattern.test(location.hostname)) {
      console.debug("Whola injector: host not allowed", location.hostname);
      return;
    }

    // 1) Load middleware config
    const config = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_MIDDLEWARE_CONFIG" }, (resp) => {
        if (chrome.runtime.lastError) {
          console.error("Whola injector: GET_MIDDLEWARE_CONFIG error", chrome.runtime.lastError);
        }
        resolve(resp || {});
      });
    });
    console.debug("Whola injector: config", config);

    // 2) Inject middleware URL into MAIN world
    const injectResp = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "INJECT_CONFIG_TO_PAGE",
          middlewareUrl: config.middlewareUrl,
        },
        (resp) => {
          if (chrome.runtime.lastError) {
            console.error("Whola injector: INJECT_CONFIG_TO_PAGE error", chrome.runtime.lastError);
          }
          resolve(resp);
        }
      );
    });
    console.debug("Whola injector: INJECT_CONFIG_TO_PAGE response", injectResp);

    // 3) Inject page-capture.js into MAIN world
    const injectScriptResp = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "INJECT_EXTENSION_SCRIPT",
          scriptPath: "page-capture.js",
        },
        (resp) => {
          if (chrome.runtime.lastError) {
            console.error("Whola injector: INJECT_EXTENSION_SCRIPT error", chrome.runtime.lastError);
          }
          resolve(resp);
        }
      );
    });
    console.debug("Whola injector: INJECT_EXTENSION_SCRIPT response", injectScriptResp);

    // 4) Listen for identify calls from background (removed HubSpot identify/tracking)

    // 5) Forward events from page → middleware
    window.addEventListener("WHOLA_SEND_TO_MW", (ev) => {
      const payload = ev.detail;
      chrome.runtime.sendMessage({ type: "FORWARD_TO_MW", payload }, (resp) => {
        window.dispatchEvent(
          new CustomEvent("WHOLA_SEND_TO_MW_RESP", {
            detail: resp || { status: 0, error: "no-response" },
          })
        );
      });
    });
  } catch (err) {
    console.warn("Whola content-injector error", err);
  }
})();
