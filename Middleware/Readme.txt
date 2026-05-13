Middleware README
Overview
-------------
Purpose: Receive events from the browser extension, upsert or update HubSpot contacts, and create timeline notes (engagements).
Location: Middleware/ (contains package.json, src/, and a constants.js file used to store API tokens and endpoints).

Quick Start
-------------------
Clone or open the repo


Install dependencies
----------------------
bash
npm install


Change the hubspot token in  constants.js.

Run the service
-------------------
node .\server.js 
Confirm the server is running  
Open http://localhost:4000 (or the port you configured).
