// server.js
//Sriragavi implemented errror handling------------------------------------->
process.on("uncaughtException", (err) => {
  console.error(" UNCAUGHT EXCEPTION:", err.stack || err);
});

process.on("unhandledRejection", (reason) => {
  console.error(" UNHANDLED REJECTION:", reason);
});
//-------------------------------------------------------------------------->>
const express = require("express");
const cors = require("cors");
const path = require("path");

// ===============================
// CONSTANTS
// ===============================
const constants = require(path.join(__dirname, "util", "constants.js"));

// ===============================
// EXPRESS APP
// ===============================
const app = express();
//Sriragavi implemented-------------------------------------------------------->>
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
//------------------------------------------------------------------------------>>
// ===============================
// VTEX HANDLERS
// ===============================
const OrdersHook = require(path.join(__dirname, "middlewares", "OrdersHook.js"));
const AbandonedCart = require(path.join(__dirname, "middlewares", "AbandonedCart.js"));
const CartEvents = require(path.join(__dirname, "middlewares", "CartEvents.js"));
const Ping = require(path.join(__dirname, "middlewares", "ping.js"));
const ProductView = require(path.join(__dirname, "middlewares", "ProductView.js"));
const PageViews = require(path.join(__dirname, "middlewares", "PageViews.js"));

// ===============================
// HUBSPOT SERVICE
// ===============================
const { sendCartToHubSpot } = require(path.join(__dirname, "middlewares", "HubspotService.js"));
console.log("[SERVER] HubspotService loaded, sendCartToHubSpot type:", typeof sendCartToHubSpot);

// ===============================
// Helper: runHandler adapter
// ===============================
//Sriragavi implemented------------------------------------------------------------------------------>>
async function runHandler(handlerFn, req, res) {
  const ctx = {
    req: req,
    res: res,
    set: (k, v) => {
      try { res.set(k, v); } catch (e) {}
    },
    status: null,
    body: null,
    app: req.app || app,
  };
//---------------------------------------------------------------------------------------------------->>
  const existingClients = (req.app && (req.app.locals?.clients || req.app.clients)) || null;

  if (existingClients && existingClients.masterdata) {
    ctx.clients = existingClients;
  } else {
    const _inMemorySchemas = {};
//Sriragavi implemented--------------------------------------------------------------------------------->>
    const masterdataStub = {
      async getSchema({ dataEntity, schema }) {
        console.debug(`[masterdataStub] getSchema called for ${dataEntity}/${schema}`);
        const key = `${dataEntity}::${schema}`;
        return _inMemorySchemas[key] || null;
      },
      async createOrUpdateSchema({ dataEntity, schemaName, schemaBody }) {
        console.debug(`[masterdataStub] createOrUpdateSchema ${dataEntity}/${schemaName}`);
        const key = `${dataEntity}::${schemaName}`;
        _inMemorySchemas[key] = schemaBody;
        return { ok: true };
      },
      async createDocument({ dataEntity, schema, fields }) {
        console.debug(`[masterdataStub] createDocument ${dataEntity}`, fields);
        return { id: `stub-${Date.now()}` };
      },
      async getDocument({ dataEntity, id }) {
        console.debug(`[masterdataStub] getDocument ${dataEntity} id=${id}`);
        return null;
      },
    };

    ctx.clients = { masterdata: masterdataStub };
//----------------------------------------------------------------------------------------------------------->>
    try {
      if (!req.app.locals) req.app.locals = {};
      req.app.locals.clients = req.app.locals.clients || {};
      req.app.locals.clients.masterdata = masterdataStub;
    } catch (e) {}
  }
//Sriragavi implemented--------------------------------------------------------------------------------------->>
  try {
    await handlerFn(ctx, async () => { /* next */ });

    if (ctx.status) {
      try { res.status(ctx.status); } catch (e) {}
    }

    if (ctx.body !== undefined && ctx.body !== null) {
      if (typeof ctx.body === "object") res.send(ctx.body);
      else res.send(String(ctx.body));
    } else {
      if (!res.headersSent) res.status(ctx.status || 200).send({ ok: true });
    }
  } catch (err) {
    console.error("runHandler caught error:", err?.stack || err);
    if (!res.headersSent) res.status(500).send({ error: "server_error", detail: String(err) });
  }
}
//--------------------------------------------------------------------------------------------------------------->>
// ===============================
// VTEX ROUTES
// ===============================
// Sriragavi implemented-------------------------------------------------------------------->>
app.post("/_v/orders", (req, res) => runHandler(OrdersHook.getOrders, req, res));

app.post("/_v/abandoned-cart-custom", (req, res) => {
  console.log(" ROUTE HIT: abandoned-cart-custom");
  return runHandler(AbandonedCart.processAbandonedCart, req, res);
});

app.post("/_v/cart-events", (req, res) => {
  console.log(" ROUTE HIT: cart-events");
  return runHandler(CartEvents.handleLoginOrCartUpdate, req, res);
});

app.post("/_v/product-view", (req, res) => {
  console.log(" ROUTE HIT: product-view");
  return runHandler(ProductView.processProductView, req, res);
});

app.post("/_v/page-views", (req, res) => {
  console.log(" ROUTE HIT: page-views");
  return runHandler(PageViews.processPageView, req, res);
});

app.get("/_v/whola-integration-app/ping", (req, res) =>
  runHandler(Ping.pong, req, res)
);
//---------------------------------------------------------------------------------------------->>
// ===============================
// NEW ROUTE: /events (FROM EXTENSION)
// ===============================
app.post("/events", async (req, res) => {
  const event = req.body;

  console.log("\n===============================");
  console.log(" EVENT RECEIVED FROM EXTENSION:");
  console.log(JSON.stringify(event, null, 2));
  console.log("===============================\n");

  res.status(200).json({ ok: true });

  // Send to HubSpot (fire-and-forget)
  try {
    const masterdata =
      (req.app && req.app.locals && req.app.locals.clients && req.app.locals.clients.masterdata)
        ? req.app.locals.clients.masterdata
        : undefined;

    console.debug("[SERVER] /events route received event; calling sendCartToHubSpot");

    await sendCartToHubSpot(event, masterdata);
  } catch (e) {
    console.error("Error sending event to HubSpot:", e?.response?.data || e?.message || e);
  }
});

// ===============================
// START SERVER
// ===============================
const port = Number(process.env.PORT || 4000);
app.listen(port, "localhost", () => {
  console.log(` Local integration server running at http://localhost:${port}`);
});
