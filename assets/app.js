// MTShop web harness — vanilla JS, no framework, no build step.
// Loaded from GitHub Pages (default-port https) AND from an explicit-port
// https origin for MOBILE-20276's regression test — keep every path relative.

(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // State (in-memory only — no localStorage/sessionStorage: this page is
  // also loaded from low-trust / file://-adjacent origins elsewhere in
  // this project, where storage APIs are unreliable).
  // ---------------------------------------------------------------------
  var state = {
    products: [],
    productsById: {},
    cart: {}, // productId -> quantity
    lastOrder: null // { orderNumber, total } while a confirmation is showing
  };

  var appEl = document.getElementById("app");
  var cartBadgeEl = document.getElementById("cart-badge");

  // ---------------------------------------------------------------------
  // Catalog loading
  // ---------------------------------------------------------------------
  function loadProducts() {
    return fetch("products.json")
      .then(function (res) {
        if (!res.ok) throw new Error("products.json HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        state.products = data.products || [];
        state.productsById = {};
        state.products.forEach(function (p) {
          state.productsById[p.id] = p;
        });
      });
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  function formatPrice(n) {
    return "$" + Number(n).toFixed(2);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function priceRowHtml(product) {
    if (product.isOnSale) {
      // Sale price shown at 25% off the listed price for a believable markdown.
      var sale = Math.round(product.price * 0.75 * 100) / 100;
      return (
        '<div class="price-row">' +
        '<span class="original">' + formatPrice(product.price) + "</span>" +
        '<span class="sale">' + formatPrice(sale) + "</span>" +
        "</div>"
      );
    }
    return (
      '<div class="price-row"><span class="regular">' +
      formatPrice(product.price) +
      "</span></div>"
    );
  }

  function salePrice(product) {
    return product.isOnSale ? Math.round(product.price * 0.75 * 100) / 100 : product.price;
  }

  function cartCount() {
    var total = 0;
    Object.keys(state.cart).forEach(function (id) {
      total += state.cart[id];
    });
    return total;
  }

  function updateCartBadge() {
    var count = cartCount();
    if (count > 0) {
      cartBadgeEl.hidden = false;
      cartBadgeEl.textContent = String(count);
    } else {
      cartBadgeEl.hidden = true;
    }
  }

  function setActiveNav(routePath) {
    var links = document.querySelectorAll(".site-nav a[data-route]");
    links.forEach(function (a) {
      var route = a.getAttribute("data-route");
      var isActive =
        route === routePath ||
        (route === "/" && routePath.indexOf("/product/") === 0);
      a.classList.toggle("active", isActive);
    });
  }

  // ---------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------
  function renderHome() {
    setActiveNav("/");
    if (!state.products.length) {
      appEl.innerHTML = '<p class="empty-state">No products available.</p>';
      return;
    }
    var cards = state.products
      .map(function (p) {
        return (
          '<a class="product-card" href="#/product/' + encodeURIComponent(p.id) + '">' +
          '<img src="' + escapeHtml(p.imageUrl) + '" alt="' + escapeHtml(p.name) + '" loading="lazy">' +
          '<div class="card-body">' +
          '<div class="category">' + escapeHtml(p.category) + "</div>" +
          '<div class="name">' + escapeHtml(p.name) + "</div>" +
          priceRowHtml(p) +
          "</div>" +
          "</a>"
        );
      })
      .join("");

    appEl.innerHTML =
      '<h1 class="page-title">Shop the collection</h1>' +
      '<div class="product-grid">' + cards + "</div>";
  }

  function renderProduct(productId) {
    setActiveNav("/product/" + productId);
    var product = state.productsById[productId];
    if (!product) {
      appEl.innerHTML =
        '<p class="empty-state">Product not found.</p>' +
        '<a class="back-link" href="#/">&larr; Back to shop</a>';
      return;
    }

    appEl.innerHTML =
      '<div class="detail-view">' +
      '<div>' +
      '<img src="' + escapeHtml(product.imageUrl) + '" alt="' + escapeHtml(product.name) + '">' +
      "</div>" +
      '<div class="detail-info">' +
      '<div class="category">' + escapeHtml(product.category) + "</div>" +
      "<h1>" + escapeHtml(product.name) + "</h1>" +
      priceRowHtml(product) +
      '<p class="description">' + escapeHtml(product.description) + "</p>" +
      '<div class="qty-stepper">' +
      '<button type="button" data-step="-1" aria-label="Decrease quantity">&minus;</button>' +
      '<input type="text" id="qty-input" value="1" inputmode="numeric" aria-label="Quantity">' +
      '<button type="button" data-step="1" aria-label="Increase quantity">+</button>' +
      "</div>" +
      '<button type="button" class="btn" id="add-to-cart-btn">Add to Cart</button>' +
      "</div>" +
      "</div>" +
      '<a class="back-link" href="#/">&larr; Back to shop</a>';

    var qtyInput = document.getElementById("qty-input");
    appEl.querySelectorAll(".qty-stepper button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var delta = parseInt(btn.getAttribute("data-step"), 10);
        var current = parseInt(qtyInput.value, 10);
        if (isNaN(current) || current < 1) current = 1;
        var next = current + delta;
        if (next < 1) next = 1;
        qtyInput.value = String(next);
      });
    });

    document.getElementById("add-to-cart-btn").addEventListener("click", function () {
      var qty = parseInt(qtyInput.value, 10);
      if (isNaN(qty) || qty < 1) qty = 1;
      state.cart[product.id] = (state.cart[product.id] || 0) + qty;
      updateCartBadge();
      var btn = document.getElementById("add-to-cart-btn");
      var originalText = btn.textContent;
      btn.textContent = "Added!";
      setTimeout(function () {
        btn.textContent = originalText;
      }, 900);
    });
  }

  function renderCart() {
    setActiveNav("/cart");

    if (state.lastOrder) {
      var order = state.lastOrder;
      appEl.innerHTML =
        '<h1 class="page-title">Checkout</h1>' +
        '<div class="confirmation">' +
        "<p>Thank you! Your order has been placed.</p>" +
        '<div class="order-number">Order #' + escapeHtml(order.orderNumber) + "</div>" +
        "<p>Order total: " + formatPrice(order.total) + "</p>" +
        '<a class="btn secondary" href="#/">Continue shopping</a>' +
        "</div>";
      state.lastOrder = null; // confirmation is shown once, then the cart is simply empty
      return;
    }

    var ids = Object.keys(state.cart).filter(function (id) {
      return state.cart[id] > 0;
    });

    if (!ids.length) {
      appEl.innerHTML =
        '<h1 class="page-title">Your Cart</h1>' +
        '<p class="empty-state">Your cart is empty. <a href="#/">Start shopping</a>.</p>';
      return;
    }

    var subtotal = 0;
    var rows = ids
      .map(function (id) {
        var product = state.productsById[id];
        if (!product) return "";
        var qty = state.cart[id];
        var unit = salePrice(product);
        var lineTotal = unit * qty;
        subtotal += lineTotal;
        return (
          "<tr>" +
          "<td>" + escapeHtml(product.name) + "</td>" +
          "<td>" + qty + "</td>" +
          "<td>" + formatPrice(unit) + "</td>" +
          "<td>" + formatPrice(lineTotal) + "</td>" +
          "</tr>"
        );
      })
      .join("");

    appEl.innerHTML =
      '<h1 class="page-title">Your Cart</h1>' +
      '<table class="cart-table">' +
      "<thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Subtotal</th></tr></thead>" +
      "<tbody>" + rows + "</tbody>" +
      "</table>" +
      '<div class="cart-summary">' +
      '<span class="subtotal-label">Order subtotal</span>' +
      '<span class="subtotal-value">' + formatPrice(subtotal) + "</span>" +
      "</div>" +
      '<div class="cart-actions">' +
      '<button type="button" class="btn" id="checkout-btn">Checkout</button>' +
      "</div>";

    document.getElementById("checkout-btn").addEventListener("click", function () {
      var orderNumber =
        "MT-" + Date.now().toString(36).toUpperCase().slice(-6) +
        "-" + Math.floor(Math.random() * 900 + 100);
      state.lastOrder = { orderNumber: orderNumber, total: subtotal };
      state.cart = {};
      updateCartBadge();
      renderCart();
    });
  }

  function renderAccount() {
    setActiveNav("/account");

    appEl.innerHTML =
      '<h1 class="page-title">Account</h1>' +
      '<div class="profile-card">' +
      '<div class="avatar-row">' +
      '<div class="avatar">JR</div>' +
      "<div>" +
      "<div><strong>Jamie Rivera</strong></div>" +
      '<div style="color:var(--muted);font-size:13px;">jamie.rivera@example.com</div>' +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="loyalty-section">' +
      "<h3>Loyalty &amp; Preferences</h3>" +
      "<!-- Privacy-masking test markers — exact class/id/text values are relied on by " +
      "MOBILE-20276's payload-forensics tooling; do not rename. -->" +
      '<div class="account-row"><span>Membership</span><span class="amp-block">Loyalty Tier: BLOCK-ME (Gold)</span></div>' +
      '<div class="account-row"><span>Gift preferences</span><span class="amp-mask">Saved Note: MASK-ME</span></div>' +
      '<div class="account-row"><span>Member ID</span><span id="privacy-target">Member ID: PRIVACYCONFIG-TARGET</span></div>' +
      // Scenario: data-attribute masking-vocabulary gap — iOS supports data-amp-mask/data-amp-block/
      // data-amp-unmask data-attribute masking, Android only supports the CSS-class forms, so a customer
      // using the data-attribute form gets silently un-masked content on Android. This is an ADDITION
      // alongside the class/id-based markers above, which stay exactly as they are.
      '<div class="account-row"><span>Backup contact</span><span data-amp-mask="true">Backup Contact: DATA-ATTR-MASK-ME</span></div>' +
      '<div class="promo-field">' +
      '<label for="secret">Promo code</label>' +
      '<input id="secret" type="text" value="typed-secret-value" placeholder="Enter a promo code">' +
      "</div>" +
      "</div>";
  }

  // ---------------------------------------------------------------------
  // Diagnostics view — MOBILE-20276 engineering test panel (NOT shop content).
  // Covers the pure page-content scenarios from research/webview-comparison-checklist.md
  // "Part D — Test-app design requirements" that a webpage's own HTML/JS can carry.
  // Every action here is click-triggered only — nothing in this section runs on page load,
  // so it never perturbs the page's default network trace / bridge-discovery timing.
  // ---------------------------------------------------------------------

  function appendLogLine(containerId, message) {
    try {
      console.log("[diagnostics] " + message);
    } catch (err) {
      // console unavailable — nothing more to do.
    }
    try {
      var el = document.getElementById(containerId);
      if (!el) return;
      var line = document.createElement("div");
      line.className = "diag-log-line";
      line.textContent = message;
      el.insertBefore(line, el.firstChild);
    } catch (err) {
      // DOM unavailable/detached — swallow, this is a best-effort diagnostic log.
    }
  }

  // Scenario: "bridge attack surface from page JS" / row 12 origin-allowlist exposure.
  // Enumerates window for known native-bridge globals plus a generic pattern sweep, and reports
  // discovery latency relative to window.__head_probe_ts__ (see index.html <head>).
  function scanForBridges() {
    var results = [];
    var knownGlobals = [
      "CSJavascriptBridge",
      "CS_isWebView",
      "AmplitudeNativeSessionReplay",
      "__amp_listener_attached",
      "amp_injected_recorder"
    ];

    knownGlobals.forEach(function (name) {
      try {
        results.push(name + ": " + (name in window ? typeof window[name] : "not present"));
      } catch (err) {
        results.push(name + ": error (" + err.message + ")");
      }
    });

    try {
      var pattern = /amp|rrweb|record|replay|csq|contentsquare|_uxa|cs_wvt/i;
      var seen = {};
      var candidateNames = [];
      try {
        candidateNames = candidateNames.concat(Object.getOwnPropertyNames(window));
      } catch (err) {
        // some hosts restrict getOwnPropertyNames on window — fall through to Object.keys below.
      }
      try {
        candidateNames = candidateNames.concat(Object.keys(window));
      } catch (err) {
        // ignore — best effort.
      }

      candidateNames.forEach(function (name) {
        if (seen.hasOwnProperty(name)) return;
        seen[name] = true;
        if (knownGlobals.indexOf(name) !== -1) return; // already reported above
        if (!pattern.test(name)) return;
        try {
          results.push(name + " (sweep): " + typeof window[name]);
        } catch (err) {
          results.push(name + " (sweep): error (" + err.message + ")");
        }
      });
    } catch (err) {
      results.push("generic sweep error: " + err.message);
    }

    var timingLine;
    try {
      var scanTs = Date.now();
      if (typeof window.__head_probe_ts__ === "number") {
        timingLine =
          "ms since head probe: " + (scanTs - window.__head_probe_ts__) +
          " (head probe @ " + window.__head_probe_ts__ + ", scan @ " + scanTs + ")";
      } else {
        timingLine = "ms since head probe: unavailable (window.__head_probe_ts__ not set)";
      }
    } catch (err) {
      timingLine = "ms since head probe: error (" + err.message + ")";
    }

    try {
      var timingEl = document.getElementById("bridge-scan-timing");
      if (timingEl) timingEl.textContent = timingLine;
      var resultsEl = document.getElementById("bridge-scan-results");
      if (resultsEl) resultsEl.textContent = results.length ? results.join("\n") : "(no matches)";
    } catch (err) {
      // rendering the results is best-effort; the scan itself already ran.
    }
  }

  // Scenario: "attempt forged payloads to inject fabricated replay/analytics events" — Security Test 2.
  function forgeCsSendTransaction() {
    try {
      var bridge = window.CSJavascriptBridge;
      if (!bridge) {
        appendLogLine("forge-log", "CSJavascriptBridge: not present");
        return;
      }
      var candidateMethods = ["sendTransaction", "sendEvent", "_csq_identify", "optIn", "optOut"];
      var calledAny = false;
      candidateMethods.forEach(function (methodName) {
        try {
          if (typeof bridge[methodName] !== "function") return;
          calledAny = true;
          var payload;
          if (methodName === "sendTransaction") payload = { transactionId: "forged-1", amount: 0 };
          else if (methodName === "sendEvent") payload = { event: "forged_event" };
          else payload = { forged: true };
          bridge[methodName](payload);
          appendLogLine("forge-log", "CSJavascriptBridge." + methodName + "(): called with forged payload (success)");
        } catch (err) {
          appendLogLine("forge-log", "CSJavascriptBridge." + methodName + "(): threw (" + err.message + ")");
        }
      });
      if (!calledAny) {
        appendLogLine(
          "forge-log",
          "CSJavascriptBridge present, but none of " + candidateMethods.join(", ") + " are callable functions"
        );
      }
    } catch (err) {
      appendLogLine("forge-log", "forgeCsSendTransaction: threw (" + err.message + ")");
    }
  }

  function forgeAmplitudeRecord() {
    try {
      var recorder = window.AmplitudeNativeSessionReplay;
      if (!recorder) {
        appendLogLine("forge-log", "AmplitudeNativeSessionReplay: not present");
        return;
      }
      if (typeof recorder.record !== "function") {
        appendLogLine(
          "forge-log",
          "AmplitudeNativeSessionReplay present, but .record is not a function (typeof: " + typeof recorder.record + ")"
        );
        return;
      }
      var envelope = JSON.stringify({
        type: 3,
        data: { source: 0, texts: [], attributes: [] },
        timestamp: Date.now()
      });
      recorder.record(envelope);
      appendLogLine("forge-log", "AmplitudeNativeSessionReplay.record(): called with fabricated rrweb envelope (success)");
    } catch (err) {
      appendLogLine("forge-log", "forgeAmplitudeRecord: threw (" + err.message + ")");
    }
  }

  function forgeDeleteOverwriteBridges() {
    var targets = ["CSJavascriptBridge", "AmplitudeNativeSessionReplay"];
    targets.forEach(function (name) {
      try {
        if (!(name in window)) {
          appendLogLine("forge-log", name + ": not present, nothing to delete/overwrite");
          return;
        }

        var deleteSucceeded = false;
        try {
          deleteSucceeded = delete window[name];
        } catch (err) {
          deleteSucceeded = false;
        }
        var stillPresent = false;
        try {
          stillPresent = name in window;
        } catch (err) {
          stillPresent = true; // assume worst case if we can't even check
        }
        appendLogLine(
          "forge-log",
          name + ": delete " +
            (deleteSucceeded && !stillPresent
              ? "SUCCEEDED (bridge silently gone — SDK did not defend the global)"
              : "did NOT remove it (still present)")
        );

        try {
          window[name] = function noopBridge() { return undefined; };
          appendLogLine(
            "forge-log",
            name + ": overwrite with no-op " +
              (typeof window[name] === "function"
                ? "SUCCEEDED (bridge silently replaced — SDK did not defend the global)"
                : "failed (assignment did not take effect)")
          );
        } catch (err) {
          appendLogLine("forge-log", name + ": overwrite threw (" + err.message + ")");
        }
      } catch (err) {
        appendLogLine("forge-log", name + ": delete/overwrite probe threw (" + err.message + ")");
      }
    });
  }

  // Scenario: ⭐ PRIORITY "dual collection" — load Amplitude's public browser Session Replay SDK
  // (@amplitude/session-replay-browser) inside a page that may already be sitting in an
  // Amplitude-instrumented WebView, to see whether two independent replay streams result.
  //
  // CDN URL verified by hand against jsdelivr on 2026-07-31: resolves to v1.48.1 at that time
  // (HTTP 200, ~450KB minified UMD bundle). It exposes a single global, window.sessionReplay, with
  // .init / .setSessionId / .getSessionId / .flush / .shutdown methods. @latest can drift to a newer
  // version later — re-verify the URL and global name if this test starts failing outright.
  var AMPLITUDE_WEB_SR_SDK_URL =
    "https://cdn.jsdelivr.net/npm/@amplitude/session-replay-browser@latest/lib/scripts/session-replay-browser-min.js";
  var AMPLITUDE_WEB_SR_GLOBAL = "sessionReplay";

  function initAmplitudeWebSdkIfPossible() {
    try {
      var sdk = window[AMPLITUDE_WEB_SR_GLOBAL];
      if (!sdk) {
        appendLogLine(
          "amp-web-sdk-log",
          "global window." + AMPLITUDE_WEB_SR_GLOBAL + " not found after load — CDN path/global name may need re-verification"
        );
        return;
      }
      var apiKeyInput = document.getElementById("amp-web-api-key");
      var apiKey = apiKeyInput ? apiKeyInput.value : "";
      if (!apiKey) {
        appendLogLine("amp-web-sdk-log", "enter an API key to actually initialize");
        return;
      }
      if (typeof sdk.init !== "function") {
        appendLogLine(
          "amp-web-sdk-log",
          "sdk global present but .init is not a function (typeof: " + typeof sdk.init + ")"
        );
        return;
      }
      sdk.init(apiKey, {});
      appendLogLine("amp-web-sdk-log", "sessionReplay.init() called with the pasted key");
    } catch (err) {
      appendLogLine("amp-web-sdk-log", "initAmplitudeWebSdkIfPossible: threw (" + err.message + ")");
    }
  }

  function loadAmplitudeWebSdk() {
    try {
      var existingScript = document.getElementById("amp-web-sr-sdk-script");
      if (existingScript) {
        appendLogLine("amp-web-sdk-log", "script already injected earlier this page load — re-attempting init only");
        initAmplitudeWebSdkIfPossible();
        return;
      }

      var script = document.createElement("script");
      script.id = "amp-web-sr-sdk-script";
      script.src = AMPLITUDE_WEB_SR_SDK_URL;
      script.async = true;
      script.onload = function () {
        appendLogLine("amp-web-sdk-log", "script loaded from CDN");
        initAmplitudeWebSdkIfPossible();
      };
      script.onerror = function () {
        appendLogLine(
          "amp-web-sdk-log",
          "script failed to load (network error or the CDN URL is stale) — re-verify AMPLITUDE_WEB_SR_SDK_URL in app.js"
        );
      };
      document.head.appendChild(script);
      appendLogLine("amp-web-sdk-log", "script tag injected, waiting for load...");
    } catch (err) {
      appendLogLine("amp-web-sdk-log", "loadAmplitudeWebSdk: threw (" + err.message + ")");
    }
  }

  // Scenario: "inject oversized/malformed content" robustness probe (row 13) — CS's own known
  // ~1MB / control-character injection cap.
  function injectOversizedContent() {
    try {
      var host = document.getElementById("oversized-injection-host");
      if (!host) return;

      var bigLength = 0;
      try {
        // ~1.2MB of repeated benign text, built at runtime — comfortably over a 1MB cap.
        // Built client-side on purpose so this source file never carries a literal 1MB string.
        var big = typeof "x".repeat === "function" ? "x".repeat(1200000) : new Array(1200001).join("x");
        bigLength = big.length;
        var bigEl = document.createElement("div");
        bigEl.id = "oversized-content-target"; // tests: oversized-content handling / truncation / errors
        bigEl.textContent = big;
        host.appendChild(bigEl);
      } catch (err) {
        appendLogLine("oversized-log", "oversized text block: threw (" + err.message + ")");
      }

      try {
        // Control characters mixed with visible text — tests malformed-content handling separately
        // from raw size.
        var controlStr = "before\u0000\u0001\u0002 control-chars \u0007\u0008 after visible text";
        var ctrlEl = document.createElement("div");
        ctrlEl.id = "control-char-target"; // tests: embedded control-character handling
        ctrlEl.textContent = controlStr;
        host.appendChild(ctrlEl);
      } catch (err) {
        appendLogLine("oversized-log", "control-char block: threw (" + err.message + ")");
      }

      appendLogLine(
        "oversized-log",
        "injected oversized-content-target (" + bigLength + " chars) and control-char-target"
      );
    } catch (err) {
      appendLogLine("oversized-log", "injectOversizedContent: threw (" + err.message + ")");
    }
  }

  function renderDiagnostics() {
    setActiveNav("/diagnostics");

    appEl.innerHTML =
      '<h1 class="page-title">Diagnostics</h1>' +
      '<p class="diagnostics-intro">This view is an engineering test panel for MOBILE-20276 — it exercises ' +
      'specific mobile-SDK WebView-bridge test scenarios (bridge discovery, forged-payload injection, ' +
      'dual-SDK collection, cross-origin frame scope, and oversized-content handling). It is deliberately ' +
      'not styled to look like a real store page.</p>' +

      '<!-- Scenario: "bridge attack surface from page JS" / row 12 origin-allowlist exposure. -->' +
      '<section class="diag-panel" id="diag-bridge-inspector">' +
      "<h2>Bridge inspector</h2>" +
      '<p>Scans <code>window</code> for known native-bridge globals plus a generic pattern sweep. Runs ' +
      "only on click — never automatically — to avoid noise on every page load.</p>" +
      '<button type="button" id="scan-bridges-btn" class="btn secondary">Scan for bridges</button>' +
      '<div id="bridge-scan-timing" class="diag-meta">(not scanned yet)</div>' +
      '<pre id="bridge-scan-results" class="diag-output">(not scanned yet)</pre>' +
      "</section>" +

      '<!-- Scenario: "attempt forged payloads to inject fabricated replay/analytics events" ' +
      "(Security Test 2). This is a defensive/investigative test surface for THIS project's own " +
      "ContentSquare SDK and Amplitude's SDK, not an attack on a third party — it only ever touches " +
      "globals injected into this exact page by whichever native SDK is currently active. -->" +
      '<section class="diag-panel" id="diag-forge-panel">' +
      "<h2>Forge panel</h2>" +
      "<p>Each button introspects the relevant bridge with <code>typeof</code> before calling it, and " +
      "logs success/threw/not-present to the log below and to the console (for native console-forwarding).</p>" +
      '<div class="diag-actions">' +
      '<button type="button" id="forge-cs-btn" class="btn secondary">Forge CS sendTransaction</button>' +
      '<button type="button" id="forge-amp-btn" class="btn secondary">Forge Amplitude record()</button>' +
      '<button type="button" id="forge-delete-btn" class="btn secondary">Attempt to delete/overwrite bridges</button>' +
      "</div>" +
      '<div id="forge-log" class="diag-log" aria-live="polite"></div>' +
      "</section>" +

      '<!-- Scenario: ⭐ PRIORITY "dual collection" — loading Amplitude\'s public browser Session Replay ' +
      "SDK only on click, never automatically, so it never affects the page's default network trace. -->" +
      '<section class="diag-panel" id="diag-dual-sdk">' +
      "<h2>Dual-SDK toggle</h2>" +
      "<p>Dynamically injects Amplitude's public <code>@amplitude/session-replay-browser</code> SDK from a " +
      "CDN. Loading the SDK code alone (even without a working key) is enough to test whether it " +
      "interferes with the native mobile bridge's own instrumentation.</p>" +
      '<div class="diag-actions">' +
      '<input type="text" id="amp-web-api-key" ' +
      'placeholder="paste a test Amplitude API key to init (never commit a real one here)">' +
      '<button type="button" id="load-amp-web-sdk-btn" class="btn secondary">Load Amplitude Web SDK (session replay)</button>' +
      "</div>" +
      '<div id="amp-web-sdk-log" class="diag-log" aria-live="polite"></div>' +
      "</section>" +

      '<!-- Scenario: "frame scope" Security Test 3 / row 11 / "third-party-iframe checkout" — tests ' +
      "whether either vendor's WebView bridge/recorder reaches into a cross-origin child frame. CS is " +
      "known to set window.CS_isWebView with forMainFrameOnly: false, which is expected to leak into " +
      "child frames; this iframe is what makes that testable. -->" +
      '<section class="diag-panel" id="diag-iframe">' +
      "<h2>Cross-origin iframe</h2>" +
      "<p>A permanently-visible iframe pointing at a genuinely different origin.</p>" +
      '<iframe class="diag-iframe" src="https://example.com" width="400" height="300" ' +
      'title="cross-origin diagnostic frame"></iframe>' +
      "</section>" +

      '<!-- Scenario: "inject oversized/malformed content" robustness probe (row 13) — CS\'s own known ' +
      "~1MB / control-character injection cap. -->" +
      '<section class="diag-panel" id="diag-oversized">' +
      "<h2>Oversized / malformed content injector</h2>" +
      "<p>Appends a ~1.2MB benign text block and a separate short block containing embedded control " +
      "characters, to test whether a competitor's WebView bridge silently truncates, errors, or handles " +
      "it.</p>" +
      '<button type="button" id="inject-oversized-btn" class="btn secondary">Inject oversized content</button>' +
      '<div id="oversized-log" class="diag-log" aria-live="polite"></div>' +
      '<div id="oversized-injection-host"></div>' +
      "</section>" +

      '<!-- Scenario: "CSP existential test" (row 8) — a separate standalone page, not part of this SPA, ' +
      "since applying a strict CSP to the main SPA would break its own inline scripts/router. -->" +
      '<section class="diag-panel" id="diag-csp-link">' +
      "<h2>CSP-strict test page</h2>" +
      "<p>A standalone page with a strict Content-Security-Policy, to check whether native-injected " +
      'bridge code is exempt from the page\'s own CSP: <a href="csp-strict.html">csp-strict.html</a>.</p>' +
      "</section>";

    try {
      var scanBtn = document.getElementById("scan-bridges-btn");
      if (scanBtn) scanBtn.addEventListener("click", scanForBridges);

      var forgeCsBtn = document.getElementById("forge-cs-btn");
      if (forgeCsBtn) forgeCsBtn.addEventListener("click", forgeCsSendTransaction);

      var forgeAmpBtn = document.getElementById("forge-amp-btn");
      if (forgeAmpBtn) forgeAmpBtn.addEventListener("click", forgeAmplitudeRecord);

      var forgeDeleteBtn = document.getElementById("forge-delete-btn");
      if (forgeDeleteBtn) forgeDeleteBtn.addEventListener("click", forgeDeleteOverwriteBridges);

      var loadAmpBtn = document.getElementById("load-amp-web-sdk-btn");
      if (loadAmpBtn) loadAmpBtn.addEventListener("click", loadAmplitudeWebSdk);

      var injectBtn = document.getElementById("inject-oversized-btn");
      if (injectBtn) injectBtn.addEventListener("click", injectOversizedContent);
    } catch (err) {
      // Wiring failure shouldn't break the rest of the page — the view has already rendered.
      try {
        console.log("[diagnostics] event wiring threw: " + err.message);
      } catch (err2) {
        // no console — nothing more to do.
      }
    }
  }

  // ---------------------------------------------------------------------
  // Router — plain hashchange listener, no routing library.
  // ---------------------------------------------------------------------
  function parseHash() {
    var hash = window.location.hash || "#/";
    var path = hash.replace(/^#/, "");
    if (path === "" || path === "/") return { view: "home" };

    var productMatch = path.match(/^\/product\/(.+)$/);
    if (productMatch) return { view: "product", id: decodeURIComponent(productMatch[1]) };

    if (path === "/cart") return { view: "cart" };
    if (path === "/account") return { view: "account" };
    if (path === "/diagnostics") return { view: "diagnostics" };

    return { view: "home" };
  }

  function route() {
    var parsed = parseHash();
    if (parsed.view === "product") {
      renderProduct(parsed.id);
    } else if (parsed.view === "cart") {
      renderCart();
    } else if (parsed.view === "account") {
      renderAccount();
    } else if (parsed.view === "diagnostics") {
      renderDiagnostics();
    } else {
      renderHome();
    }
  }

  // ---------------------------------------------------------------------
  // Continuous DOM mutation strip — sitewide, independent of the router,
  // never display:none (it must actually render and repaint).
  // ---------------------------------------------------------------------
  function startMutationStrip() {
    var el = document.getElementById("mutation-strip");
    var counter = 0;

    function tick() {
      counter += 1;
      var now = new Date();
      var hh = String(now.getHours()).padStart(2, "0");
      var mm = String(now.getMinutes()).padStart(2, "0");
      var ss = String(now.getSeconds()).padStart(2, "0");
      el.textContent = "mutation #" + counter + " · " + hh + ":" + mm + ":" + ss;
    }

    tick();
    setInterval(tick, 1000);
  }

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------
  function boot() {
    startMutationStrip();
    loadProducts()
      .then(function () {
        route();
      })
      .catch(function (err) {
        appEl.innerHTML =
          '<p class="empty-state">Could not load the product catalog (' +
          escapeHtml(err.message) +
          ").</p>";
      });

    window.addEventListener("hashchange", route);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
