# Whola_Capstone

Goal
Objective: Run the extension and middleware together so product and cart events captured in the browser appear as timeline notes on the corresponding HubSpot contact.

Prerequisites
Local machine with Node.js and Chrome/Edge.

GitHub repo with Extension/ and Middleware/ folders.

HubSpot account and a private app token (store it securely).

Middleware running and reachable from the browser (use http://localhost:4000 for local testing).

Step-by-step setup
1 Prepare middleware
Copy .env.example to .env in Middleware/ and set values:

env
PORT=4000
HUBSPOT_TOKEN=REPLACE_WITH_YOUR_TOKEN
Install and start:

bash
cd Middleware
npm install
npm run dev
Confirm middleware is listening:

Visit http://localhost:4000/ or check logs for listening on port 4000.

2 Load the extension
Open Chrome/Edge → chrome://extensions or edge://extensions.

Enable Developer mode.

Click Load unpacked and select the Extension/ folder.

Open the extension Options page and set Middleware URL to http://localhost:4000. Save.

3 Test a product view
Open a Whola product page (or a local page that contains JSON-LD product data).

Wait a few seconds for page-capture.js to run (it runs immediately and on interval).

Confirm the extension forwarded a payload:

Check middleware logs for a POST to /_v/cart-events.

Or open DevTools Console and look for WHOLA_SEND_TO_MW events and WHOLA_SEND_TO_MW_RESP.

4 Verify HubSpot timeline
In HubSpot, search for the contact by the email used in the payload.

Open the contact record and check the Activity / Timeline for a note with the product view text:

Example: 🛍️ Product viewed: AF00013 SLEEVELESS LONG COAT GRAY (whola)

If the contact did not exist, the middleware should have created it and then added the note.

5 Test login and cart flows
Login event: Use the extension identify flow (if implemented) or simulate a payload with eventLabel: "Login" to see 🛍️ Customer Logged-in: <brand> notes.

Cart updates: Add items to cart and ensure middleware receives cartProperties.items and creates notes with 🛒 Updated Cart and Cart Value.
