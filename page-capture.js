// page-capture.js
// Only forward when product or cart actually changes (dedupe at source).
// Place at the root of your extension and inject into the page main world.

(function () {
  const MIDDLEWARE_URL = window.__MIDDLEWARE_URL__ || null;
  const LAST_SENT_KEY = "__WHOLA_LAST_SENT__";

  // --- Utilities ---
  function safeStringify(obj) {
    try {
      return JSON.stringify(obj);
    } catch (e) {
      // fallback for circular refs
      const cache = new WeakSet();
      return JSON.stringify(obj, (k, v) => {
        if (typeof v === "object" && v !== null) {
          if (cache.has(v)) return "[Circular]";
          cache.add(v);
        }
        return v;
      });
    }
  }

  // Simple stable hash (FNV-like) for small payloads
  function simpleHash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16);
  }

  // --- Data extraction (same as before, minimal) ---
  async function getCartStatusAndItems() {
    try {
      const res = await fetch('/api/checkout/pub/orderForm', { credentials: 'include' });
      if (!res.ok) return { cartStatus: 'No cart', items: [] };
      const orderForm = await res.json();
      const items = (orderForm.items || []).map(i => ({
        sku: i.id,
        name: i.name,
        qty: i.quantity,
        price: i.sellingPrice
      }));
      return { cartStatus: items.length > 0 ? 'Active cart' : 'No cart', items };
    } catch (e) {
      return { cartStatus: 'No cart', items: [] };
    }
  }

  function getProductFromJsonLd() {
    try {
      const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
      for (const s of scripts) {
        try {
          const data = JSON.parse(s.textContent || '{}');
          const arr = Array.isArray(data) ? data : [data];
          for (const item of arr) {
            if (item && (item['@type'] === 'Product' || item.name)) {
              return {
                productName: item.name || '',
                brandName: typeof item.brand === 'string' ? item.brand : item.brand?.name || '',
                categoryName: item.category || '',
                productId: item.sku || item.productID || item['@id'] || ''
              };
            }
          }
        } catch (e) { /* ignore parse errors */ }
      }
    } catch (e) {}
    return null;
  }

  async function getSessionEmailAndIds() {
    try {
      const res = await fetch('/api/sessions?items=profile.id,profile.email,authentication.storeUserEmail', { credentials: 'include' });
      if (!res.ok) return { email: null, id: null, sessionId: null };
      const data = await res.json();
      const email = data?.namespaces?.authentication?.storeUserEmail?.value || data?.namespaces?.profile?.email?.value || null;
      const id = data?.namespaces?.profile?.id?.value || null;
      return { email, id, sessionId: data?.id || null };
    } catch (e) {
      return { email: null, id: null, sessionId: null };
    }
  }

  // --- Forwarding bridge (same as before) ---
  function forwardToExtension(payload) {
    try {
      const ev = new CustomEvent('WHOLA_SEND_TO_MW', { detail: payload });
      window.dispatchEvent(ev);
    } catch (e) {
      console.warn('[WholaCapture] forwardToExtension failed', e);
    }
  }

  // --- Core: capture snapshot, compute hash, forward only on change ---
  async function captureAndForwardIfChanged() {
    const session = await getSessionEmailAndIds();
    const fallbackEmail = localStorage.getItem('whola_email') || null;
    const email = session.email || fallbackEmail;

    const product = getProductFromJsonLd() || { productName: document.title || '', brandName: '', categoryName: '', productId: '' };
    const cart = await getCartStatusAndItems();

    // Build the snapshot that matters for HubSpot notes (product + cart)
    const snapshot = {
      email: email || null,
      product: {
        productName: product.productName || '',
        brandName: product.brandName || '',
        categoryName: product.categoryName || '',
        productId: product.productId || ''
      },
      cart: {
        cartStatus: cart.cartStatus,
        items: cart.items || []
      }
    };

    const snapshotStr = safeStringify(snapshot);
    const hash = simpleHash(snapshotStr);

    const last = localStorage.getItem(LAST_SENT_KEY);

    // If unchanged, do nothing
    if (last === hash) {
      // console.debug('[WholaCapture] snapshot unchanged — skipping forward');
      return;
    }

    // Build payload (same shape your middleware expects)
    const payload = {
      customerProperties: {
        email: email,
        vtexCustomerId: session.id || null,
        sessionId: session.sessionId || null,
        lastActivityType: 'Product view'
      },
      productProperties: {
        productName: product.productName || '',
        brandName: product.brandName || '',
        categoryName: product.categoryName || '',
        productId: product.productId || ''
      },
      cartProperties: {
        cartStatus: cart.cartStatus,
        items: cart.items || []
      }
    };

    // Forward to extension background (bridge)
    forwardToExtension(payload);

    // Persist last-sent hash
    try {
      localStorage.setItem(LAST_SENT_KEY, hash);
    } catch (e) {
      // ignore
    }
  }

  // --- Init and periodic checks ---
  (function init() {
    // Run once immediately
    captureAndForwardIfChanged();

    // Run on navigation/interval but less frequently than before
    // 5s interval is a reasonable compromise; adjust as needed
    setInterval(captureAndForwardIfChanged, 5000);

    // Also flush buffer when session becomes available (if you implemented buffering)
    // (left out here for brevity — keep your existing flush logic if present)
  })();

  console.log("[WholaCapture] page-capture dedupe enabled");
})();
