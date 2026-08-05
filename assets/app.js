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

  // Scenario: "masking config reachability with a REAL customer config" (Part D, added 2026-08-04).
  // `setPIISelectors` is CS's actual public `_uxa` command (confirmed against the tracking-tag source,
  // tracking/sensitive/sensitive.commands.ts + sensitive.commands's SET_PII_COMMANDS registration in
  // webViewSensitive.module.ts) — i.e. what a real customer would push to mask an arbitrary selector,
  // not a baked-in CSS class like .amp-mask/.amp-block. Targets #privacy-target specifically because
  // that marker carries NO class-based masking hook — it exists to test config-DRIVEN masking, the
  // direct CS analogue of Amplitude's privacyConfig-driven target. Gated behind "csMask=1" rather than
  // pushed unconditionally: masking a field permanently would change the baseline other findings rely on
  // (several already-published checks read #privacy-target's plaintext).
  function pushCsPiiMaskConfig() {
    try {
      window._uxa = window._uxa || [];
      appendLogLine("forge-log", "pushing _uxa setPIISelectors -> #privacy-target (real customer masking command)");
      window._uxa.push(["setPIISelectors", { PIISelectors: ["#privacy-target"], Attributes: [] }]);
      appendLogLine(
        "forge-log",
        "setPIISelectors pushed — if the config reaches WebViewSensitiveModule, #privacy-target's text " +
        "should be anonymized in this session's CS payload/replay from this point on"
      );
    } catch (err) {
      appendLogLine("forge-log", "pushCsPiiMaskConfig: threw (" + err.message + ")");
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
        if (!(name in window)) {
          results.push(name + ": not present");
          return;
        }
        // Report the VALUE for primitives, not just the type: `__amp_listener_attached` is a boolean,
        // and "boolean" alone cannot distinguish an attached bridge from a detached one.
        var raw = window[name];
        var t = typeof raw;
        var shown = (t === "boolean" || t === "string" || t === "number") ? t + " = " + String(raw) : t;
        results.push(name + ": " + shown);
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

    // The REAL discovery latency, from the head-probe watcher — i.e. when each global first existed.
    // Reported inside the results block so it cannot be read in isolation from the presence list.
    try {
      var firstSeen = window.__bridge_first_seen__ || {};
      var seenNames = Object.keys(firstSeen);
      results.push("");
      if (seenNames.length) {
        results.push("-- discovery latency (ms after head probe) --");
        seenNames.forEach(function (name) {
          results.push("  " + name + ": +" + firstSeen[name].msSinceHeadProbe +
            "ms (value at first sight: " + firstSeen[name].valueAtFirstSight + ")");
        });
      } else {
        results.push("-- discovery latency: no watched global ever appeared --");
      }
    } catch (err) {
      results.push("discovery-latency readout error: " + err.message);
    }

    var timingLine;
    try {
      var scanTs = Date.now();
      if (typeof window.__head_probe_ts__ === "number") {
        // NOTE: this is CLICK latency, not discovery latency — it measures how long after page load a
        // human pressed Scan. It was previously easy to misread as a discovery measure; the real
        // discovery numbers are in the results block above.
        timingLine =
          "click latency (NOT discovery): scan pressed " + (scanTs - window.__head_probe_ts__) +
          "ms after head probe";
      } else {
        timingLine = "click latency: unavailable (window.__head_probe_ts__ not set)";
      }
    } catch (err) {
      timingLine = "click latency: error (" + err.message + ")";
    }

    try {
      var timingEl = document.getElementById("bridge-scan-timing");
      if (timingEl) timingEl.textContent = timingLine;
      var resultsEl = document.getElementById("bridge-scan-results");
      if (resultsEl) resultsEl.textContent = results.length ? results.join("\n") : "(no matches)";
    } catch (err) {
      // rendering the results is best-effort; the scan itself already ran.
    }

    // Also emit every line through console.* so the scan is readable via the host app's
    // console-forwarding channel (logcat / os_log) instead of only by screenshotting the WebView.
    // Added 2026-08-03: reading these off-screen was the slowest part of the first functional run.
    try {
      console.log("[diagnostics] bridge scan — " + timingLine);
      results.forEach(function (line) {
        if (line) console.log("[diagnostics] bridge scan | " + line);
      });
    } catch (err) {
      // no console — the DOM output above is still there.
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

  // ---------------------------------------------------------------------
  // CS-equivalent of the Amplitude forged-recorder finding — MOBILE-20276
  // critical-findings-register.md Part 1 item 1's open caveat.
  //
  // WHY: forgePortGenerationBridge() found that ONE forged call to window.amp_injected_recorder()
  // with a fabricated-but-well-formed rrweb envelope permanently and silently kills ALL further real
  // WebView capture for the rest of the session, with the global still looking intact afterward
  // (amplitude-android-forged-recorder-breaks-real-capture.md). CS's closest analogues are
  // CSJavascriptBridge.sendSREvent (the continuous DOM-mutation channel the web tag calls once per
  // real mutation) and .sendNativeSREvent (on Android, decoded only for JS_ERROR/CUSTOM_ERROR/
  // NETWORK_REQUEST_METRIC; on iOS, decoded into typed InsertionMutation/RemovalMutation/etc. for
  // every webview mutation — the closer structural analogue of Amplitude's own node-id-tracking
  // mutation observer). Nobody had tried feeding either of them a malformed/fabricated payload and
  // then checking whether CS's own subsequent REAL capture still works — this does that.
  //
  // The envelope below deliberately mirrors Amplitude's exact shape (a mutation claiming to add a
  // text node under parentId 1 with a synthetic id 999999 never issued by any real snapshot) so the
  // two vendors are tested the same way. Isolated per mode/method (no burst) so a break can be
  // attributed to one call, exactly the lesson from the metadata-nulling attribution saga (Card 4)
  // where firing many bridge members in one synchronous forEach made attribution impossible.
  //
  // The always-running sitewide mutation strip (startMutationStrip()) is this test's "does real
  // capture survive afterward" probe, playing the same role Amplitude's page-side mutation ticker
  // played in that investigation — look for it continuing to update, and for the CS session's own
  // health (bridge presence, a harmless post-forge call) rather than assuming "no throw" proves
  // anything either way (a JS-side success proves nothing about native acceptance either direction).
  //
  // ⚠️ Known asymmetry, disclosed rather than glossed over: unlike Amplitude's public Session Replay
  // API, CS publishes no accessible replay-retrieval API here (its internal equivalent is VPN-gated
  // and keyed on different identifiers) — so whether the forged/real content actually shows up in the
  // rendered replay is NOT provable from this probe alone. It needs the human visual pass on the CS
  // quick-playback link this run produces. This probe only proves/disproves the automatable half:
  // does the call succeed, and does the session stay healthy and keep responding afterward.
  //
  // Reached via "#/diagnostics?csForgeSrMode=sendSREvent|sendNativeSREvent|both|none" (mode=none is
  // the CONTROL arm — presence-check only, no call — same discipline as Amplitude's ampForgeMode=none).
  // ---------------------------------------------------------------------
  function forgeCsSrEventBridge(mode) {
    mode = mode || "both";
    try {
      var bridge = window.CSJavascriptBridge;
      if (!bridge) {
        appendLogLine("forge-log", "CSJavascriptBridge: not present — cannot forge SR-event bridge, mode=" + mode);
        return;
      }

      var targets = [];
      if (mode === "both" || mode === "sendSREvent") targets.push("sendSREvent");
      if (mode === "both" || mode === "sendNativeSREvent") targets.push("sendNativeSREvent");

      if (!targets.length) {
        appendLogLine("forge-log", "forgeCsSrEventBridge: mode=" + mode + " — CONTROL arm, no call made");
      }

      targets.forEach(function (methodName) {
        try {
          if (typeof bridge[methodName] !== "function") {
            appendLogLine("forge-log", "CSJavascriptBridge." + methodName + ": not a callable member on this build");
            return;
          }

          var marker = "CSFORGEDSRMARKER-" + methodName + "-" + Date.now();
          var envelope = JSON.stringify({
            type: 3,
            data: {
              source: 0,
              texts: [], attributes: [], removes: [],
              adds: [{
                parentId: 1,
                nextId: null,
                node: { type: 3, textContent: marker, id: 999999 }
              }]
            },
            timestamp: Date.now()
          });
          var ret = bridge[methodName](envelope);
          appendLogLine(
            "forge-log",
            "CSJavascriptBridge." + methodName + "(<fabricated mutation envelope, marker " + marker +
              ">): called without throwing, returned " + typeof ret +
              " — LANDING UNPROVEN from here (no accessible CS replay-retrieval API); watch native " +
              "health + the mutation-strip continuity, and the eventual replay link, for the real answer"
          );
        } catch (err) {
          appendLogLine(
            "forge-log",
            "CSJavascriptBridge." + methodName + "(<fabricated mutation envelope>): threw (" + err.message + ")"
          );
        }
      });

      // Post-forge health check, delayed so it doesn't race the call itself: is the bridge still
      // present, and does a harmless, unrelated call still succeed? This does NOT prove ingestion
      // continues (see the "JS success proves nothing about native acceptance" rule) but a THROW here
      // — where none occurred before the forge — would be strong evidence something broke.
      setTimeout(function () {
        try {
          var b = window.CSJavascriptBridge;
          appendLogLine(
            "forge-log",
            "post-forge health check (mode=" + mode + "): CSJavascriptBridge " + (b ? "still present" : "GONE")
          );
          if (b && typeof b.getVersion === "function") {
            try {
              var v = b.getVersion();
              appendLogLine("forge-log", "post-forge health check: getVersion() -> " + v + " (no throw)");
            } catch (err) {
              appendLogLine("forge-log", "post-forge health check: getVersion() threw (" + err.message + ")");
            }
          }
        } catch (err) {
          appendLogLine("forge-log", "post-forge health check threw (" + err.message + ")");
        }
      }, 4000);
    } catch (err) {
      appendLogLine("forge-log", "forgeCsSrEventBridge: threw (" + err.message + ")");
    }
  }

  // ---------------------------------------------------------------------
  // Port-generation bridge probes — added 2026-08-03 during MOBILE-20603 item 1(c).
  //
  // WHY THIS EXISTS (it closed a false negative): the forge panel above targets
  // `AmplitudeNativeSessionReplay`, the global of Amplitude's REFLECTION-generation bridge (<= 0.22.1).
  // Current stable 0.27.0 uses the WebMessagePort generation, which installs
  // `__amp_listener_attached` + `amp_injected_recorder` instead — so the old panel reports "not
  // present" on the version customers actually receive, and a reader could wrongly conclude the
  // bridge is unreachable from page JS. An absent name and a WRONG name look identical. These probes
  // target the surface the current generation really installs.
  // ---------------------------------------------------------------------

  var egressCounters = null;

  // Set by parseHash() from any query string riding inside the hash.
  var currentRouteQuery = "";

  function routeQueryParam(name) {
    try {
      var parts = currentRouteQuery.split("&");
      for (var i = 0; i < parts.length; i++) {
        var kv = parts[i].split("=");
        if (decodeURIComponent(kv[0]) === name) {
          return kv.length > 1 ? decodeURIComponent(kv[1]) : "";
        }
      }
    } catch (err) {
      // malformed query — treat as absent.
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // AUTORUN — added 2026-08-03 for MOBILE-20603 item 1(c).
  //
  // WHY: the iOS Simulator has no tap tooling at all (no uiautomator, no idb, no cliclick; AppleScript
  // needs an Accessibility grant this environment cannot grant), so the Diagnostics panel was
  // undrivable on iOS — which is why iOS had zero functional validation. On Android, tapping worked but
  // was fragile: every action appends to a log, which pushes later panels down, so coordinates captured
  // from an earlier screenshot silently miss and produce NO output — indistinguishable from a probe
  // that ran and found nothing.
  //
  // Driving the probes from the URL instead makes both platforms scriptable and the run reproducible.
  // Everything goes through console.* which both host apps forward into logcat / os_log.
  // Reached via "#/diagnostics?autorun=1" (or "autorun=dual" to also load the web SR SDK).
  // ---------------------------------------------------------------------
  function startAutorun(mode) {
    var ampForgeMode = routeQueryParam("ampForgeMode") || "both";
    var steps = [
      [500, "scan for bridges", scanForBridges],
      [2000, "install egress counters", installEgressCounters],
      [4000, "forge port-generation recorder (mode=" + ampForgeMode + ")", function () {
        forgePortGenerationBridge(ampForgeMode);
      }],
      [6000, "enumerate CS bridge surface", inspectCsBridgeSurface],
      [7000, "probe CS bridge invocability (string/primitive args)", probeCsBridgeInvocability],
      [8000, "forge reflection-generation bridges (expected absent on 0.27.0+)", function () {
        forgeCsSendTransaction();
        forgeAmplitudeRecord();
        forgeDeleteOverwriteBridges();
      }],
      [10000, "inject oversized/malformed content", injectOversizedContent]
    ];

    // Loading the web SR SDK changes the page's own network behaviour, so it is opt-in per mode.
    if (mode === "dual") {
      steps.push([13000, "load Amplitude web Session Replay SDK (dual collection)", loadAmplitudeWebSdk]);
    }

    // Opt-in only (see pushCsPiiMaskConfig's comment) — reached via "&csMask=1".
    if (routeQueryParam("csMask") === "1") {
      steps.push([11000, "push CS real customer PII-masking config (setPIISelectors -> #privacy-target)", pushCsPiiMaskConfig]);
    }

    // Counters are read late so slow bridge traffic has time to accumulate.
    steps.push([20000, "read egress counts", renderEgressCounts]);

    appendLogLine("forge-log", "AUTORUN START (mode=" + mode + ") — " + steps.length + " steps");

    steps.forEach(function (step) {
      setTimeout(function () {
        try {
          console.log("[diagnostics] AUTORUN STEP: " + step[1]);
          step[2]();
        } catch (err) {
          console.log("[diagnostics] AUTORUN STEP FAILED (" + step[1] + "): " + err.message);
        }
      }, step[0]);
    });

    setTimeout(function () {
      try {
        console.log("[diagnostics] AUTORUN COMPLETE");
      } catch (err) {
        // no console — nothing to do.
      }
    }, 21000);
  }

  function installEgressCounters() {
    if (egressCounters) {
      appendLogLine("egress-log", "counters already installed — counts are cumulative since install");
      renderEgressCounts();
      return;
    }
    egressCounters = { messagePort: 0, webkitHandlers: 0, portSample: "", webkitSample: "" };

    // Android / port generation: the recorder ships events over a MessagePort transferred from native.
    // Patching the PROTOTYPE rather than an instance is what makes this reachable from page JS without
    // ever holding the port itself — that is the whole point of the test.
    try {
      if (typeof MessagePort !== "undefined" && MessagePort.prototype &&
          typeof MessagePort.prototype.postMessage === "function") {
        var originalPortPost = MessagePort.prototype.postMessage;
        MessagePort.prototype.postMessage = function () {
          try {
            egressCounters.messagePort += 1;
            if (!egressCounters.portSample && arguments.length) {
              egressCounters.portSample = String(arguments[0]).slice(0, 300);
            }
          } catch (err) {
            // never break the real send — this probe observes, it does not interfere.
          }
          return originalPortPost.apply(this, arguments);
        };
        appendLogLine("egress-log",
          "MessagePort.prototype.postMessage WRAPPED from page JS — page can now observe every bridge message");
      } else {
        appendLogLine("egress-log", "MessagePort not available in this WebView");
      }
    } catch (err) {
      appendLogLine("egress-log", "MessagePort wrap threw (" + err.message + ")");
    }

    // iOS: the WKScriptMessageHandler surface. Assignment onto a native-backed proxy may silently fail,
    // so verify the wrap actually took rather than assuming it did.
    try {
      var handlers = window.webkit && window.webkit.messageHandlers;
      if (!handlers) {
        appendLogLine("egress-log", "window.webkit.messageHandlers not present (expected off-iOS)");
      } else {
        var names = [];
        try { names = Object.keys(handlers); } catch (err) { names = []; }
        // Object.keys is often empty on the native-backed proxy, so also probe the names each vendor
        // is known to register.
        ["amplitude", "AmplitudeNativeSessionReplay", "amplitudeSessionReplay",
         "csBridge", "contentsquare", "CSJavascriptBridge"].forEach(function (n) {
          try {
            if (names.indexOf(n) === -1 && handlers[n]) names.push(n);
          } catch (err) {
            // probing an absent handler can throw on some WebKit builds — ignore.
          }
        });
        if (!names.length) {
          appendLogLine("egress-log", "messageHandlers present but no handler name was discoverable");
        }
        names.forEach(function (n) {
          try {
            var h = handlers[n];
            if (!h || typeof h.postMessage !== "function") return;
            var originalHandlerPost = h.postMessage.bind(h);
            var marker = function wrappedPostMessage() {
              try {
                egressCounters.webkitHandlers += 1;
                if (!egressCounters.webkitSample && arguments.length) {
                  egressCounters.webkitSample = String(arguments[0]).slice(0, 300);
                }
              } catch (err) {
                // never break the real send.
              }
              return originalHandlerPost.apply(null, arguments);
            };
            h.postMessage = marker;
            appendLogLine("egress-log", "messageHandlers." + n + ".postMessage wrap " +
              (h.postMessage === marker
                ? "SUCCEEDED — page JS can observe/tamper with this handler"
                : "did NOT take effect (native-backed property defended the assignment)"));
          } catch (err) {
            appendLogLine("egress-log", "messageHandlers." + n + " wrap threw (" + err.message + ")");
          }
        });
      }
    } catch (err) {
      appendLogLine("egress-log", "webkit handler wrap threw (" + err.message + ")");
    }
  }

  function renderEgressCounts() {
    if (!egressCounters) {
      appendLogLine("egress-log", "counters not installed yet — nothing to report");
      return;
    }
    appendLogLine("egress-log",
      "counts since install — MessagePort.postMessage: " + egressCounters.messagePort +
      " · webkit.messageHandlers.postMessage: " + egressCounters.webkitHandlers);
    if (egressCounters.portSample) {
      appendLogLine("egress-log", "first MessagePort payload (300 chars): " + egressCounters.portSample);
    }
    if (egressCounters.webkitSample) {
      appendLogLine("egress-log", "first webkit payload (300 chars): " + egressCounters.webkitSample);
    }
  }

  // mode: "both" (default), "call-only", "overwrite-only", "none" — added 2026-08-04 (MOBILE-20603
  // forged-event-landing item) to ATTRIBUTE an unexpected finding: on a real run, native `Amplitude:
  // Adding event` logging went silent for ~72s starting right at this forge, and stayed silent across a
  // later real (non-forged) DOM mutation elsewhere on the page. "none" is the CONTROL — it skips both the
  // forged call and the overwrite, doing only the presence check, so a run with "none" isolates whether
  // the silence is caused by this forge at all versus an unrelated cause (e.g. OS-level process freezing
  // observed in the same window — `ActivityManager: freezing … webview_service` /
  // `Sending oneway calls to frozen process` — which every prior run also had exposure to, since this step
  // has always been part of the default `autorun=1` battery). Reached via
  // "#/diagnostics?autorun=1&ampForgeMode=call-only" (or "overwrite-only", or "none").
  function forgePortGenerationBridge(mode) {
    var RECORDER = "amp_injected_recorder";
    mode = mode || "both";

    try {
      if (!(RECORDER in window)) {
        appendLogLine("forge-log", RECORDER + ": not present");
      } else {
        appendLogLine("forge-log", RECORDER + ": present (typeof " + typeof window[RECORDER] + "), mode=" + mode);

        if (mode !== "overwrite-only" && mode !== "none") {
          try {
            // The forged event carries a distinctive sentinel so "did it LAND?" is answerable rather than
            // inferred. "Called without throwing" is NOT evidence of ingestion — the only proof is finding
            // this marker inside the uploaded replay (Amplitude's /api/1/session-replays/files, or an
            // on-device payload decode). Injecting a text node makes the marker survive as literal text.
            var marker = "AMPFORGEDMARKER-" + Date.now();
            var envelope = JSON.stringify({
              type: 3,
              data: {
                source: 0,
                texts: [],
                attributes: [],
                removes: [],
                adds: [{
                  parentId: 1,
                  nextId: null,
                  node: { type: 3, textContent: marker, id: 999999 }
                }]
              },
              timestamp: Date.now()
            });
            var ret = window[RECORDER](envelope);
            appendLogLine("forge-log",
              RECORDER + "(<forged rrweb envelope, marker " + marker + ">): called without throwing, returned " +
              typeof ret + " — LANDING STILL UNPROVEN until this marker is found in the uploaded replay");
          } catch (err) {
            appendLogLine("forge-log", RECORDER + "(<forged rrweb envelope>): threw (" + err.message + ")");
          }
        }

        if (mode !== "call-only" && mode !== "none") {
          // Overwrite, then restore — a successful overwrite means page JS can silently stop recording.
          // Restoring matters: the rest of the run still needs a live recorder.
          try {
            var saved = window[RECORDER];
            window[RECORDER] = function killedRecorder() { return undefined; };
            var overwritten = window[RECORDER] !== saved;
            appendLogLine("forge-log", RECORDER + ": overwrite " + (overwritten
              ? "SUCCEEDED — page JS can silently disable the recorder"
              : "failed (assignment did not take effect)"));
            window[RECORDER] = saved;
            appendLogLine("forge-log", RECORDER + ": original restored after the overwrite probe");
          } catch (err) {
            appendLogLine("forge-log", RECORDER + ": overwrite probe threw (" + err.message + ")");
          }
        }
      }
    } catch (err) {
      appendLogLine("forge-log", "port-generation recorder probe threw (" + err.message + ")");
    }

    // typeof alone hides true/false, and the false->true flip IS the handshake window.
    try {
      appendLogLine("forge-log", "__amp_listener_attached = " +
        ("__amp_listener_attached" in window ? String(window.__amp_listener_attached) : "not present"));
    } catch (err) {
      appendLogLine("forge-log", "__amp_listener_attached read threw (" + err.message + ")");
    }

    // Is the transferred port itself reachable, or is it closure-held?
    try {
      var portProps = [];
      if (typeof MessagePort !== "undefined") {
        Object.getOwnPropertyNames(window).forEach(function (name) {
          try {
            if (window[name] instanceof MessagePort) portProps.push(name);
          } catch (err) {
            // throwing getter / cross-origin guard — skip.
          }
        });
      }
      appendLogLine("forge-log", portProps.length
        ? "MessagePort instances reachable as window properties: " + portProps.join(", ")
        : "no MessagePort instance exposed on window (transferred port is closure-held)");
    } catch (err) {
      appendLogLine("forge-log", "MessagePort sweep threw (" + err.message + ")");
    }

    try {
      appendLogLine("forge-log", "first-seen latencies: " + JSON.stringify(window.__bridge_first_seen__ || {}));
    } catch (err) {
      appendLogLine("forge-log", "first-seen readout threw (" + err.message + ")");
    }
  }

  // Enumerates CS's bridge at RUNTIME rather than trusting the method list read from source.
  function inspectCsBridgeSurface() {
    try {
      appendLogLine("forge-log", "CS_isWebView = " +
        ("CS_isWebView" in window ? String(window.CS_isWebView) : "not present"));
    } catch (err) {
      appendLogLine("forge-log", "CS_isWebView read threw (" + err.message + ")");
    }

    try {
      var bridge = window.CSJavascriptBridge;
      if (!bridge) {
        appendLogLine("forge-log", "CSJavascriptBridge: not present — nothing to enumerate");
        return;
      }
      var names = [];
      var obj = bridge;
      var depth = 0;
      // Walk the prototype chain: an addJavascriptInterface object exposes its methods on the
      // prototype, not as own properties, so an own-properties-only scan reports an empty surface.
      while (obj && depth < 4) {
        try {
          Object.getOwnPropertyNames(obj).forEach(function (n) {
            if (names.indexOf(n) === -1) names.push(n);
          });
        } catch (err) {
          // ignore this level.
        }
        obj = Object.getPrototypeOf(obj);
        depth += 1;
      }
      var callable = names.filter(function (n) {
        try { return typeof bridge[n] === "function"; } catch (err) { return false; }
      });
      appendLogLine("forge-log",
        "CSJavascriptBridge callable members (" + callable.length + "): " + callable.join(", "));
    } catch (err) {
      appendLogLine("forge-log", "CS bridge enumeration threw (" + err.message + ")");
    }
  }

  // Scenario: "which Android bridge members are actually INVOCABLE" — added 2026-08-03
  // (summary.md ▶️ START THE NEXT CONVERSATION HERE, item 1). The forge panel above calls
  // CSJavascriptBridge members with an OBJECT argument; on Android's addJavascriptInterface an
  // object marshals to the string "undefined", so the "Method not found" it produces is a
  // SIGNATURE-MISMATCH artifact, not a defence (webview-functional-runs skill, "bridge / forgery"
  // section). This retries every runtime-enumerated member with STRING/PRIMITIVE argument shapes —
  // what a real @JavascriptInterface overload actually accepts — to bound the real forgeable surface.
  var CS_BRIDGE_MEMBERS_TO_PROBE = [
    "addEventProperties", "addUserProperties", "clearEventProperties",
    "getAssetTransformerMode", "getVersion", "identify", "onWebviewTrackingReady",
    "optIn", "optOut", "removeEventProperty", "resetIdentity", "sendAssets",
    "sendDynamicVar", "sendEvent", "sendLog", "sendNativeSREvent", "sendSREvent",
    "sendTransaction"
  ];

  function argShapesForInvocabilityProbe(marker) {
    // Cheapest/most-likely shapes first — probeCsBridgeInvocability stops at the first shape that
    // resolves, so ordering here controls which marker ends up in a landed telemetry/replay payload.
    return [
      { label: "0 args", args: [] },
      { label: "1 string arg", args: [marker] },
      { label: "2 string args", args: [marker, marker] },
      { label: "1 JSON-string arg", args: [JSON.stringify({ forged: marker })] },
      { label: "1 number arg", args: [1] }
    ];
  }

  function looksLikeMethodNotFound(message) {
    return typeof message === "string" && /method not found/i.test(message);
  }

  function probeCsBridgeInvocability() {
    try {
      var bridge = window.CSJavascriptBridge;
      if (!bridge) {
        appendLogLine("forge-log", "invocability probe: CSJavascriptBridge not present");
        return;
      }

      appendLogLine(
        "forge-log",
        "invocability probe: retrying " + CS_BRIDGE_MEMBERS_TO_PROBE.length +
          " members with STRING/PRIMITIVE args (object args marshal to \"undefined\" and were already ruled out)"
      );

      CS_BRIDGE_MEMBERS_TO_PROBE.forEach(function (memberName) {
        try {
          if (typeof bridge[memberName] !== "function") {
            appendLogLine("forge-log", "invocability | " + memberName + ": not a callable member on this build");
            return;
          }

          var marker = "CSFORGEPROBE-" + memberName + "-" + Date.now();
          var shapes = argShapesForInvocabilityProbe(marker);
          var resolvedShape = null;
          var attempts = [];

          for (var i = 0; i < shapes.length; i++) {
            var shape = shapes[i];
            try {
              bridge[memberName].apply(bridge, shape.args);
              // No throw at all is the strongest signal available: this shape reached native code.
              resolvedShape = shape.label + " (no throw)";
              attempts.push(shape.label + ": no throw");
              break;
            } catch (err) {
              var msg = err && err.message ? err.message : String(err);
              attempts.push(shape.label + ": threw \"" + msg + "\"");
              if (!looksLikeMethodNotFound(msg)) {
                // A DIFFERENT error (e.g. a parse failure) still proves the call resolved to a real
                // overload and reached native — only "Method not found" means this shape didn't match
                // any @JavascriptInterface signature.
                resolvedShape = shape.label + " (reached native, threw non-\"Method not found\": " + msg + ")";
                break;
              }
            }
          }

          if (resolvedShape) {
            appendLogLine(
              "forge-log",
              "invocability | " + memberName + ": INVOCABLE via " + resolvedShape + " — marker " + marker
            );
          } else {
            appendLogLine(
              "forge-log",
              "invocability | " + memberName + ": no match among " + shapes.length + " shapes tried (" +
                attempts.join(" · ") + ") — NOT proven safe, only these shapes are ruled out"
            );
          }
        } catch (err) {
          appendLogLine("forge-log", "invocability | " + memberName + ": probe itself threw (" + err.message + ")");
        }
      });

      appendLogLine(
        "forge-log",
        "invocability probe complete — any member marked INVOCABLE reached native; check its marker for " +
          "landing exactly like the port-generation forge marker (AMPFORGEDMARKER)"
      );
    } catch (err) {
      appendLogLine("forge-log", "probeCsBridgeInvocability: threw (" + err.message + ")");
    }
  }

  // ---------------------------------------------------------------------
  // ISOLATED single-member invoke — added for MOBILE-20603 open item 1/2 (2026-08-04).
  //
  // WHY: probeCsBridgeInvocability() above fires all 17 members back-to-back in one synchronous
  // forEach with zero delay between calls. That is exactly why the previous run's `optIn`/`optOut`/
  // `resetIdentity` metadata-nulling callback landed in one ~100ms native log cluster and could not be
  // attributed to a specific call — the JS-side timing gave no separation to read the native log
  // against. This calls exactly ONE known-resolved member per timeslot, several seconds apart, so a
  // native log line's timestamp can be matched to a single call unambiguously.
  //
  // Resolved shapes are carried over from the 2026-08-04 invocability retry (session-review-queue.md
  // Card 3): optIn/optOut/resetIdentity all resolved via "0 args"; sendEvent resolved via "1 string
  // arg" (a non-JSON string reaches native JSONObject(...) and throws a parse error — itself the
  // corroborating signal item 2 is trying to reproduce on SDK 4.52.0).
  // ---------------------------------------------------------------------
  var ISOLATED_INVOKE_ARGS = {
    optIn: [],
    optOut: [],
    resetIdentity: []
    // sendEvent's args are built per-call below so the marker is unique per invocation.
  };

  function invokeCsBridgeMemberIsolated(memberName) {
    try {
      var bridge = window.CSJavascriptBridge;
      if (!bridge) {
        appendLogLine("forge-log", "isolated-invoke | " + memberName + ": CSJavascriptBridge not present");
        return;
      }
      if (typeof bridge[memberName] !== "function") {
        appendLogLine("forge-log", "isolated-invoke | " + memberName + ": not a callable member on this build");
        return;
      }

      var marker = "CSISOLATED-" + memberName + "-" + Date.now();
      var args = memberName === "sendEvent"
        ? ["CSISOLATED-sendEvent-marker-" + marker] // deliberately not valid JSON — see header comment
        : (ISOLATED_INVOKE_ARGS[memberName] || []);

      appendLogLine(
        "forge-log",
        "isolated-invoke | " + memberName + ": calling now, marker=" + marker + ", args=" + JSON.stringify(args)
      );
      try {
        bridge[memberName].apply(bridge, args);
        appendLogLine("forge-log", "isolated-invoke | " + memberName + ": no throw");
      } catch (err) {
        appendLogLine("forge-log", "isolated-invoke | " + memberName + ": threw (" + err.message + ")");
      }
    } catch (err) {
      appendLogLine("forge-log", "invokeCsBridgeMemberIsolated: threw (" + err.message + ")");
    }
  }

  // Reached via "#/diagnostics?invokeMembers=optIn,optOut,resetIdentity&invokeDelayMs=6000" (delay is
  // optional, default 6000ms — comfortably wider than the ~100ms cluster the original run showed, and
  // wider than typical [csq-metadata] callback latency of ~120-330ms already measured on this project).
  function startIsolatedInvokeSequence(memberListParam, delayMsParam) {
    var members = memberListParam.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var gap = parseInt(delayMsParam, 10);
    if (!gap || gap < 500) gap = 6000;

    appendLogLine(
      "forge-log",
      "ISOLATED-INVOKE SEQUENCE START — " + members.length + " member(s), " + gap +
        "ms apart: " + members.join(", ")
    );

    members.forEach(function (memberName, idx) {
      setTimeout(function () {
        invokeCsBridgeMemberIsolated(memberName);
      }, gap * (idx + 1));
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
      // URL param takes precedence so an autorun pass can supply a real key with zero taps (mirrors
      // every other autorun input in this file); the input field stays for manual/click-driven use.
      var apiKeyFromUrl = routeQueryParam("ampWebApiKey");
      var apiKeyInput = document.getElementById("amp-web-api-key");
      var apiKey = apiKeyFromUrl || (apiKeyInput ? apiKeyInput.value : "");
      if (!apiKey) {
        appendLogLine("amp-web-sdk-log", "enter an API key (or pass &ampWebApiKey=... in the URL) to actually initialize");
        return;
      }
      if (typeof sdk.init !== "function") {
        appendLogLine(
          "amp-web-sdk-log",
          "sdk global present but .init is not a function (typeof: " + typeof sdk.init + ")"
        );
        return;
      }
      // serverZone: 'EU' — this project's Amplitude project is EU-resident (same reason the native
      // adapters set ServerZone.EU/.EU explicitly). Found missing 2026-08-05 after a first dual-SDK run:
      // the web SDK's remote-config fetch came back "403 Invalid API key" purely from hitting the US
      // config host with an EU-only key — the exact zone-mismatch trap already known from the native
      // side, just not yet applied here.
      sdk.init(apiKey, { serverZone: "EU" });
      appendLogLine("amp-web-sdk-log", "sessionReplay.init() called with the pasted key (serverZone: EU)");
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
      '<button type="button" id="forge-port-btn" class="btn secondary">Forge port-gen recorder (Amplitude 0.27.0+)</button>' +
      '<button type="button" id="inspect-cs-btn" class="btn secondary">Enumerate CS bridge surface</button>' +
      '<button type="button" id="probe-invocability-btn" class="btn secondary">Probe CS bridge invocability (string args)</button>' +
      "</div>" +
      '<p class="diag-meta">The first three buttons target the <em>reflection</em>-generation names ' +
      "(<code>AmplitudeNativeSessionReplay</code>, &le;0.22.1). Amplitude 0.27.0+ installs " +
      "<code>__amp_listener_attached</code> + <code>amp_injected_recorder</code> instead, so on current " +
      'stable those three correctly report "not present" — that is a name mismatch, <strong>not</strong> ' +
      "evidence the bridge is unreachable. Use the port-gen button for current stable. The invocability " +
      "button retries every enumerated CSJavascriptBridge member with string/primitive args instead of " +
      "an object, since an object argument marshals to \"undefined\" across addJavascriptInterface and " +
      'makes every member falsely report "Method not found".</p>' +
      '<div id="forge-log" class="diag-log" aria-live="polite"></div>' +
      "</section>" +

      '<!-- Scenario: bridge egress counting — needed by the ⭐ dual-collection test ("count both egress ' +
      'paths") and by Security Test 2 (can page JS observe/tamper with bridge traffic?). Wrapping is ' +
      "click-triggered, so counts start at install, never at page load. -->" +
      '<section class="diag-panel" id="diag-egress">' +
      "<h2>Bridge egress counters</h2>" +
      "<p>Wraps <code>MessagePort.prototype.postMessage</code> (Android port bridge) and " +
      "<code>window.webkit.messageHandlers.*.postMessage</code> (iOS) <em>from page JS</em>, then counts " +
      "outbound bridge messages. Counts start at install, not at page load.</p>" +
      '<div class="diag-actions">' +
      '<button type="button" id="install-egress-btn" class="btn secondary">Install egress counters</button>' +
      '<button type="button" id="read-egress-btn" class="btn secondary">Read counts</button>' +
      "</div>" +
      '<div id="egress-log" class="diag-log" aria-live="polite"></div>' +
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

      var forgePortBtn = document.getElementById("forge-port-btn");
      if (forgePortBtn) forgePortBtn.addEventListener("click", function () { forgePortGenerationBridge("both"); });

      var inspectCsBtn = document.getElementById("inspect-cs-btn");
      if (inspectCsBtn) inspectCsBtn.addEventListener("click", inspectCsBridgeSurface);

      var installEgressBtn = document.getElementById("install-egress-btn");
      if (installEgressBtn) installEgressBtn.addEventListener("click", installEgressCounters);

      var readEgressBtn = document.getElementById("read-egress-btn");
      if (readEgressBtn) readEgressBtn.addEventListener("click", renderEgressCounts);

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

    try {
      var autorun = routeQueryParam("autorun");
      if (autorun !== null && autorun !== "0") {
        startAutorun(autorun === "" ? "1" : autorun);
      }
    } catch (err) {
      try {
        console.log("[diagnostics] autorun dispatch threw: " + err.message);
      } catch (err2) {
        // no console — nothing more to do.
      }
    }

    try {
      var invokeMembers = routeQueryParam("invokeMembers");
      if (invokeMembers) {
        startIsolatedInvokeSequence(invokeMembers, routeQueryParam("invokeDelayMs"));
      }
    } catch (err) {
      try {
        console.log("[diagnostics] isolated-invoke dispatch threw: " + err.message);
      } catch (err2) {
        // no console — nothing more to do.
      }
    }

    try {
      var csForgeSrMode = routeQueryParam("csForgeSrMode");
      if (csForgeSrMode) {
        // Same +4s timing as the equivalent Amplitude forge step in the autorun battery, kept
        // isolated (its own launch, not folded into startAutorun's burst) per the Card 4 lesson —
        // one call, several seconds of clear air, so a break can be attributed to this call alone.
        setTimeout(function () { forgeCsSrEventBridge(csForgeSrMode); }, 4000);
      }
    } catch (err) {
      try {
        console.log("[diagnostics] CS SR-event forge dispatch threw: " + err.message);
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

    // A query string may ride along inside the hash (e.g. "#/diagnostics?autorun=1"). It is parsed off
    // here so route matching still works, and stashed for the diagnostics view's autorun mode. The hash
    // is used rather than a real query string because the host apps navigate to one fixed URL and only
    // append a suffix to it — see `webViewURLSuffix` (iOS launch arg) / `urlSuffix` (Android intent extra).
    var query = "";
    var qIndex = path.indexOf("?");
    if (qIndex !== -1) {
      query = path.slice(qIndex + 1);
      path = path.slice(0, qIndex);
    }
    currentRouteQuery = query;

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
  // Run label — MOBILE-20276 self-identifying overlay, added 2026-08-03.
  //
  // WHY: the interactive Session-Replay review (session-review-queue.md) goes session by session, and
  // the DOM *is* the replay — so anything rendered here is exactly what shows up in the recording. A
  // reviewer opening a replay cold has no way to tell which run it is without this. It especially
  // matters for Amplitude's explicit-port failure, which is otherwise invisible: the replay looks
  // healthy and the WebView is simply an empty iframe, so the ORIGIN has to be on screen too.
  //
  // Opt-in via a "runlabel" param riding in the initial hash, exactly like "autorun" — most page loads
  // (real shop browsing) carry none and render nothing. Read once at BOOT from the raw initial hash,
  // not via routeQueryParam()/currentRouteQuery, because those are re-parsed on every in-app navigation
  // and would lose the label the moment a reviewer clicks a nav link.
  // ---------------------------------------------------------------------
  function parseInitialHashParam(name) {
    try {
      var hash = window.location.hash || "";
      var qIndex = hash.indexOf("?");
      if (qIndex === -1) return null;
      var parts = hash.slice(qIndex + 1).split("&");
      for (var i = 0; i < parts.length; i++) {
        var eqIndex = parts[i].indexOf("=");
        var key = eqIndex === -1 ? parts[i] : parts[i].slice(0, eqIndex);
        if (decodeURIComponent(key) === name) {
          return eqIndex === -1 ? "" : decodeURIComponent(parts[i].slice(eqIndex + 1));
        }
      }
    } catch (err) {
      // malformed initial hash — treat as absent.
    }
    return null;
  }

  function renderRunLabel() {
    try {
      var supplied = parseInitialHashParam("runlabel");
      if (!supplied) return; // most loads carry none — nothing to render.

      // location.host (not a caller-supplied token) so the label can never claim the wrong origin —
      // that guarantee is the entire point of putting the origin on screen.
      var runId = parseInitialHashParam("runid") || Date.now().toString(36).slice(-4);
      var text = supplied + "/" + window.location.host + " · run " + runId;

      var el = document.createElement("div");
      el.id = "run-label";
      el.setAttribute("aria-hidden", "true");
      el.style.cssText =
        "position:fixed;top:0;left:0;right:0;z-index:99999;" +
        "background:#111;color:#39ff14;font:12px/1.5 monospace;" +
        "padding:3px 8px;text-align:center;pointer-events:none;white-space:pre-wrap;word-break:break-all;";
      el.textContent = text;
      document.body.insertBefore(el, document.body.firstChild);

      console.log("[run-label] " + text);
    } catch (err) {
      // Rendering the label is best-effort diagnostics — never let it break page boot.
      try {
        console.log("[run-label] renderRunLabel threw: " + err.message);
      } catch (err2) {
        // no console — nothing more to do.
      }
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
    renderRunLabel();
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
