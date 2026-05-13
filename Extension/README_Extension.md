# Whola_Capstone

Browser Extension
Overview
Purpose: Injects a lightweight capture layer into Whola storefront pages and forwards product and cart events to the middleware.
Location: Extension/ (contains manifest.json, background.js, content-injector.js, page-capture.js, edge-events.js, options.js, etc.)

Quick start (developer)
Load unpacked extension
----------------------------
Open Chrome/Edge
Navigate to chrome://extensions or edge://extensions
Enable Developer mode
Click Load unpacked and select the Extension/ folder
Open options and set middleware URL

Open the extension action (toolbar icon) → Options, or open options.html.

Set Middleware URL to your middleware endpoint (example http://localhost:4000) and click Save.


How it works (high level)
---------------------------
content-injector.js runs as a content script and:

Reads middleware URL from extension storage.

Injects page-capture.js into the page MAIN world.

Forwards custom events from the page to the extension background.

page-capture.js runs in the page MAIN world and:

Extracts product data (JSON-LD, global VTEX objects), session email, and cart snapshot.

Deduplicates by hashing the snapshot and only forwards on change.

Dispatches WHOLA_SEND_TO_MW events with a payload shaped for the middleware.

background.js receives forwarded payloads and POSTs them to the middleware endpoint /_v/cart-events.

Configuration
Middleware URL stored in chrome.storage.sync under middlewareUrl. Default http://localhost:4000.

Dedupe interval and other runtime flags are controlled in edge-events.js via window.__WHOLA_CONFIG__ if you need to override.

Testing locally
------------------------
Start your middleware (see middleware README).

Load the extension unpacked and set middleware URL to http://localhost:4000.

Open a product page on the site and wait for page-capture to forward the payload.

Inspect network logs on the middleware or check the extension background console for the POST response.

Troubleshooting
No events forwarded
---------------------------------------
Confirm window.__MIDDLEWARE_URL__ is set in the page (DevTools Console).

Confirm WHOLA_SEND_TO_MW events are dispatched by page-capture.js.

Confirm background script can reach the middleware (CORS/network).

