// edge-events.js (FINAL FIXED VERSION — no syntax errors)

// Prevent double injection
if (window.__WHOLA_EDGE_EVENTS_LOADED__) {
  console.debug('edge-events: already loaded — skipping duplicate injection');
} else {
(function () {

  try { window.__WHOLA_EDGE_EVENTS_LOADED__ = true; } catch (e) {}

  console.debug('edge-events: top-of-file executed', location.href);

  function expose(name, fn) {
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: false,
        writable: false,
        value: fn
      });
    } catch (e) {
      window[name] = fn;
    }
  }

  /* -------------------------
     Config
     ------------------------- */

  if (typeof window.__WHOLA_CONFIG__ === 'undefined') {
    window.__WHOLA_CONFIG__ = {
      MIDDLEWARE_URL: window.__MIDDLEWARE_URL__ || null,
      SEND_TIMEOUT_MS: window.__WHOLA_SEND_TIMEOUT_MS__ || 5000,
      CONTACT_PRODUCT_PROPERTY: window.__WHOLA_CONTACT_PRODUCT_PROPERTY__ || 'product_viewed'
    };
  }

  const MIDDLEWARE_URL = window.__WHOLA_CONFIG__.MIDDLEWARE_URL;
  const SEND_TIMEOUT_MS = window.__WHOLA_CONFIG__.SEND_TIMEOUT_MS;
  const CONTACT_PRODUCT_PROPERTY = window.__WHOLA_CONFIG__.CONTACT_PRODUCT_PROPERTY;

  /* -------------------------
     Identity + Buffering
     ------------------------- */

  const WHOLA_STORAGE_KEY = '__WHOLA_USER__';
  let __WHOLA_USER__ = null;
  let __WHOLA_EVENT_BUFFER__ = [];

  function persistWholaUser(user) {
    try {
      __WHOLA_USER__ = user || null;
      if (user) sessionStorage.setItem(WHOLA_STORAGE_KEY, JSON.stringify(user));
      else sessionStorage.removeItem(WHOLA_STORAGE_KEY);
    } catch (e) {}
  }

  function loadWholaUser() {
    try {
      const raw = sessionStorage.getItem(WHOLA_STORAGE_KEY);
      if (raw) __WHOLA_USER__ = JSON.parse(raw);
    } catch (e) {
      __WHOLA_USER__ = null;
    }
    return __WHOLA_USER__;
  }

  function bufferEvent(fnName, payload) {
    __WHOLA_EVENT_BUFFER__.push({ fnName, payload, ts: new Date().toISOString() });
  }

  function flushBufferedEvents() {
    if (!__WHOLA_USER__ || !__WHOLA_USER__.email) return;
    if (!__WHOLA_EVENT_BUFFER__.length) return;

    const buf = __WHOLA_EVENT_BUFFER__.slice();
    __WHOLA_EVENT_BUFFER__ = [];

    buf.forEach(item => {
      const merged = Object.assign({}, item.payload, {
        email: __WHOLA_USER__.email,
        hubspotContactId: __WHOLA_USER__.hubspotContactId
      });

      if (item.fnName === 'captureProductView') captureProductView(merged);
      if (item.fnName === 'captureCartUpdate') captureCartUpdate(merged);
      if (item.fnName === 'captureCheckout') captureCheckout(merged);
    });
  }

  function setWholaUser(user) {
    persistWholaUser(user);
    flushBufferedEvents();
  }

  function clearWholaUser() {
    persistWholaUser(null);
  }

  expose('setWholaUser', setWholaUser);
  expose('clearWholaUser', clearWholaUser);
  loadWholaUser();

  /* -------------------------
     Utilities
     ------------------------- */

  function makeEventId(prefix = '') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function fetchWithTimeout(url, opts = {}, timeout = SEND_TIMEOUT_MS) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  async function sendToMiddleware(payload) {
    if (!MIDDLEWARE_URL) {
      console.warn('edge-events: no middleware URL configured');
      return { status: 0, error: 'no_middleware_url' };
    }

    try {
      const ev = new CustomEvent('WHOLA_SEND_TO_MW', { detail: payload });
      window.dispatchEvent(ev);

      return await new Promise(resolve => {
        const onResp = (respEv) => {
          window.removeEventListener('WHOLA_SEND_TO_MW_RESP', onResp);
          resolve(respEv.detail || { status: 0, error: 'no-response' });
        };
        window.addEventListener('WHOLA_SEND_TO_MW_RESP', onResp);
        setTimeout(() => resolve({ status: 0, error: 'timeout' }), SEND_TIMEOUT_MS + 200);
      });
    } catch (err) {
      try {
        const res = await fetchWithTimeout(MIDDLEWARE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const text = await res.text();
        return { status: res.status, body: text };
      } catch (e) {
        return { status: 0, error: e.toString() };
      }
    }
  }

  /* -------------------------
     VTEX Extraction Helpers
     ------------------------- */

  function safeParseJson(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  function findProductFromGlobals() {
    const candidates = [];

    ['__PRELOADED_STATE__','__INITIAL_STATE__','__RENDERED__','__STORE__','__VTEX__','__PRODUCT__','__STATE__']
      .forEach(k => { try { if (window[k]) candidates.push(window[k]); } catch(e){} });

    try {
      for (const k in window) {
        const v = window[k];
        if (v && typeof v === 'object') {
          if (('productId' in v && 'productName' in v) ||
              ('product' in v && v.product && v.product.productId)) {
            candidates.push(v);
          }
        }
      }
    } catch(e){}

    try {
      document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
        const parsed = safeParseJson(s.textContent || '{}');
        if (parsed && (parsed['@type'] === 'Product' || parsed.name)) candidates.push(parsed);
      });
    } catch(e){}

    for (let c of candidates) {
      if (!c) continue;
      if (c.product) c = c.product;
      if (c.productId || c.productName || c.name) return c;
      if (c.sku && c.sku.productId) return c.sku;
    }
    return null;
  }

  function findProfileFromGlobals() {
    const profile = { email: null, userId: null };

    try {
      const keys = ['__PRELOADED_STATE__','__INITIAL_STATE__','__STORE__','__VTEX__','vtexjs','__SESSION__'];
      for (const k of keys) {
        const obj = window[k];
        if (!obj) continue;
        const str = JSON.stringify(obj).toLowerCase();
        if (str.includes('email')) {
          const m = JSON.parse(JSON.stringify(obj));
          if (m.profile?.email) profile.email = m.profile.email;
          if (m.session?.email) profile.email = m.session.email;
        }
      }

      ['vtex_session','vtex_session_data','session'].forEach(k => {
        const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
        const parsed = safeParseJson(raw);
        if (parsed?.email) profile.email = parsed.email;
        if (parsed?.userId) profile.userId = parsed.userId;
      });

      const metaEmail = document.querySelector('meta[name="user-email"], meta[property="user:email"]');
      if (metaEmail?.content) profile.email = metaEmail.content;

    } catch(e){}

    return profile;
  }

  /* -------------------------
     Event Builders
     ------------------------- */

  function buildBasePayload(eventName, properties = {}) {
    return {
      eventId: makeEventId(eventName),
      eventName,
      timestamp: new Date().toISOString(),
      properties
    };
  }

  async function captureProductView(product = {}) {
    const vtProduct = findProductFromGlobals();
    const p = Object.assign({}, vtProduct || {}, product || {});
    const productValue = p.productId || p.id || p.sku || p.name || document.title;

    const profile = Object.assign({}, findProfileFromGlobals(), __WHOLA_USER__ || {});
    const email = p.email || profile.email || localStorage.getItem('whola_email') || null;
    const hubspotContactId = p.hubspotContactId || profile.hubspotContactId || null;
    const vtexCustomerId = profile.userId || null;

    if (!email && !hubspotContactId && !vtexCustomerId) {
      bufferEvent('captureProductView', p);
      return { status: 0, buffered: true };
    }

    // Build teammate-style payload
    const payload = {
      customerProperties: {
        email: email,
        vtexCustomerId: vtexCustomerId,
        sessionId: null,
        lastActivityType: 'Product view'
      },
      productProperties: {
        productName: p.productName || p.name || document.title,
        productId: p.productId || p.id || p.sku || null,
        selectedItemId: p.sku || null,
        categoryName: p.category || null,
        brandName: p.brand || null
      },
      cartProperties: {
        cartStatus: '' // edge-events doesn't fetch cart here; keep empty
      }
    };

    return sendToMiddleware(payload);
  }
  expose('captureProductView', captureProductView);

  /* -------------------------
     Auto Init
     ------------------------- */

  function autoCaptureProductPage() {
    try {
      const p = findProductFromGlobals();
      if (!p) return;
      captureProductView(p);
    } catch (e) {}
  }

  console.debug('edge-events: loaded and API exposed');

  (function initEdgeEvents() {
    autoCaptureProductPage();
  })();

})(); // END IIFE
} // END else
