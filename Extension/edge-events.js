// edge-events.js (exposes captureLogin / captureLogout helpers)

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
     Event Builders (expose login/logout helpers)
     ------------------------- */

  async function captureProductView(product = {}) {
    const profile = Object.assign({}, loadWholaUser() || {});
    const email = product.email || profile.email || localStorage.getItem('whola_email') || null;
    const hubspotContactId = product.hubspotContactId || profile.hubspotContactId || null;
    const vtexCustomerId = profile.userId || null;

    if (!email && !hubspotContactId && !vtexCustomerId) {
      bufferEvent('captureProductView', product);
      return { status: 0, buffered: true };
    }

    const payload = {
      customerProperties: {
        email: email,
        vtexCustomerId: vtexCustomerId,
        sessionId: null,
        lastActivityType: 'Product view'
      },
      productProperties: {
        productName: product.productName || product.name || document.title,
        productId: product.productId || product.id || product.sku || null,
        selectedItemId: product.sku || null,
        categoryName: product.category || null,
        brandName: product.brand || null
      },
      cartProperties: {
        cartStatus: '' // page-capture will fill this when available
      }
    };

    return sendToMiddleware(payload);
  }

  async function captureLogin(payload = {}) {
    const base = Object.assign({}, payload);
    base.customerProperties = base.customerProperties || {};
    base.customerProperties.lastActivityType = 'Login';
    return sendToMiddleware(base);
  }

  async function captureLogout(payload = {}) {
    const base = Object.assign({}, payload);
    base.customerProperties = base.customerProperties || {};
    base.customerProperties.lastActivityType = 'Logout';
    return sendToMiddleware(base);
  }

  expose('captureProductView', captureProductView);
  expose('captureLogin', captureLogin);
  expose('captureLogout', captureLogout);

  console.debug('edge-events: loaded and API exposed (captureLogin/captureLogout available)');

})(); // END IIFE
} // END else
