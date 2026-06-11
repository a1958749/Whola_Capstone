// page-capture.js (client MAIN world) — conservative capture + login/logout + cart updates
(function () {
  const LAST_SENT_KEY = "__WHOLA_LAST_SENT__";
  const LAST_KNOWN_EMAIL_KEY = "__WHOLA_LAST_KNOWN_EMAIL__";
  const LAST_CART_HASH_KEY = "__WHOLA_LAST_CART_HASH__";

  function safeStringify(obj) {
    try {
      return JSON.stringify(obj);
    } catch (e) {
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

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16);
  }

  function detectPageTypeClient(pageUrl, product) {
    const url = (pageUrl || "").toString().toLowerCase();
    if (!url) return "page";
    if (url.endsWith("/p")) return "product";
    if (url.includes("/brands") || url.includes("/brand/")) return "brand";
    const categoryKeywords = [
      "womens",
      "women",
      "mens",
      "men",
      "kids",
      "homeware",
      "dresses",
      "denim",
      "tops",
      "bottoms",
      "accessories",
      "sale",
      "collections",
    ];
    for (const k of categoryKeywords) {
      if (url.includes(`/${k}/`) || url.endsWith(`/${k}`)) return "category";
    }
    if (url === "/" || url.includes("/home")) return "home";
    if (
      url.includes("/search") ||
      url.includes("/login") ||
      url.includes("/checkout")
    )
      return "other";
    return "page";
  }

  async function getCartStatusAndItems() {
    try {
      const res = await fetch("/api/checkout/pub/orderForm", {
        credentials: "include",
      });
      if (!res.ok) return { cartStatus: "No Cart", items: [] };
      const orderForm = await res.json();
      const items = (orderForm.items || []).map((i) => ({
        sku: i.id,
        name: i.name,
        qty: i.quantity,
        price: i.sellingPrice,
        brandName: i.brand || "",
      }));
      return {
        cartStatus: items.length > 0 ? "Active Cart" : "No Cart",
        items,
      };
    } catch (e) {
      return { cartStatus: "No Cart", items: [] };
    }
  }

  function getProductFromJsonLd() {
    try {
      const scripts = [
        ...document.querySelectorAll('script[type="application/ld+json"]'),
      ];
      for (const s of scripts) {
        try {
          const data = JSON.parse(s.textContent || "{}");
          const arr = Array.isArray(data) ? data : [data];
          for (const item of arr) {
            if (item && (item["@type"] === "Product" || item.name)) {
              return {
                productName: item.name || "",
                brandName:
                  typeof item.brand === "string"
                    ? item.brand
                    : item.brand?.name || "",
                categoryName: item.category || "",
                productId:
                  item.sku || item.productID || item["@id"] || "",
              };
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
    return null;
  }

  async function getSessionEmailAndIds() {
    try {
      const res = await fetch(
        "/api/sessions?items=profile.id,profile.email,authentication.storeUserEmail",
        { credentials: "include" }
      );
      if (!res.ok) return { email: null, id: null, sessionId: null };
      const data = await res.json();
      const email =
        data?.namespaces?.authentication?.storeUserEmail?.value ||
        data?.namespaces?.profile?.email?.value ||
        null;
      const id = data?.namespaces?.profile?.id?.value || null;
      return { email, id, sessionId: data?.id || null };
    } catch (e) {
      return { email: null, id: null, sessionId: null };
    }
  }

  function forwardToExtension(payload) {
    try {
      const ev = new CustomEvent("WHOLA_SEND_TO_MW", { detail: payload });
      window.dispatchEvent(ev);
    } catch (e) {
      console.warn("[WholaCapture] forwardToExtension failed", e);
    }
  }

  async function captureAndForwardIfChanged() {
    const session = await getSessionEmailAndIds();
    const fallbackEmail = localStorage.getItem("whola_email") || null;
    const email = session.email || fallbackEmail;
    const vtexCustomerId = session.id || null;
    const sessionId = session.sessionId || null;

    let previousEmail = null;
    try {
      previousEmail = sessionStorage.getItem(LAST_KNOWN_EMAIL_KEY) || null;
    } catch (e) {}

    const jsonLdProduct = getProductFromJsonLd();
    const productCandidate =
      jsonLdProduct || {
        productName: "",
        brandName: "",
        categoryName: "",
        productId: "",
      };

    const cart = await getCartStatusAndItems();

    const pageUrl = window.location.href || window.location.pathname || "";
    const pageType = detectPageTypeClient(pageUrl, productCandidate);

    // Build conservative productProperties
    let productProps = {
      productName: "",
      brandName: "",
      categoryName: "",
      productId: "",
    };
    if (pageType === "product") {
      productProps.productName =
        productCandidate.productName || document.title || "";
      productProps.brandName = productCandidate.brandName || "";
      productProps.categoryName = productCandidate.categoryName || "";
      productProps.productId = productCandidate.productId || "";
    } else if (pageType === "brand") {
      productProps.brandName =
        productCandidate.brandName ||
        (document.title || "").split("-")[0].trim() ||
        "";
    } else {
      productProps = {
        productName: "",
        brandName: "",
        categoryName: "",
        productId: "",
      };
    }

    // --- Detect login / logout transitions ---
    const isLogin = !previousEmail && !!email;
    const isLogout = !!previousEmail && !email;

    // --- Debounce cart changes: only item count or total value ---
    const itemsForHash = cart.items || [];
    const itemCount = itemsForHash.length;
    const totalCents = itemsForHash.reduce(
      (acc, it) => acc + Number(it.price || 0) * Number(it.qty || 1),
      0
    );
    const cartSnapshotStr = `${itemCount}|${totalCents}`;
    const cartHash = hashString(cartSnapshotStr);
    let previousCartHash = null;
    try {
      previousCartHash = localStorage.getItem(LAST_CART_HASH_KEY) || null;
    } catch (e) {}

    const cartChanged = !!previousCartHash && previousCartHash !== cartHash;

    // Decide lastActivityType
    let lastActivityType;
    if (isLogin) {
      lastActivityType = "Login";
    } else if (isLogout) {
      lastActivityType = "Logout";
    } else if (cartChanged) {
      lastActivityType = "Cart Updated";
    } else {
      lastActivityType = pageType === "product" ? "Product view" : "Page view";
    }

    // Use previousEmail for logout so CartEvents can still associate the contact
    let effectiveEmail = email;
    if (!effectiveEmail && isLogout && previousEmail) {
      effectiveEmail = previousEmail;
    }

    const payload = {
      customerProperties: {
        email: effectiveEmail || null,
        vtexCustomerId: vtexCustomerId || null,
        sessionId: sessionId || null,
        lastActivityType,
        lastVisitedUrl: pageUrl,
        pageType: pageType,
      },
      productProperties: productProps,
      cartProperties: {
        cartStatus: cart.cartStatus || "",
        items: cart.items || [],
      },
      jsonLdProduct: jsonLdProduct || null,
      ts: new Date().toISOString(),
    };

    // dedupe by snapshot hash (email + pageType + product + cart)
    const snapshotStr = safeStringify({
      email: payload.customerProperties.email,
      pageType: payload.customerProperties.pageType,
      product: payload.productProperties,
      cart: {
        itemCount,
        totalCents,
      },
    });
    const hash = hashString(snapshotStr);

    const last = localStorage.getItem(LAST_SENT_KEY);
    if (last === hash) return;

    forwardToExtension(payload);

    try {
      localStorage.setItem(LAST_SENT_KEY, hash);
    } catch (e) {}
    try {
      if (email) {
        // real session email present → treat as logged-in
        sessionStorage.setItem(LAST_KNOWN_EMAIL_KEY, email);
      } else {
        // on logout we clear the stored email
        sessionStorage.removeItem(LAST_KNOWN_EMAIL_KEY);
      }
    } catch (e) {}
    try {
      localStorage.setItem(LAST_CART_HASH_KEY, cartHash);
    } catch (e) {}
  }

  (function init() {
    captureAndForwardIfChanged();
    setInterval(captureAndForwardIfChanged, 5000);
    try {
      window.__WHOLA_CAPTURE_LOGIN__ = captureAndForwardIfChanged;
    } catch (e) {}
  })();

  console.log(
    "[WholaCapture] page-capture loaded (conservative product detection + login/logout + cart updates with debounce)"
  );
})();
