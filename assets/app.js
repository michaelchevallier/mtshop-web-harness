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
      '<div class="promo-field">' +
      '<label for="secret">Promo code</label>' +
      '<input id="secret" type="text" value="typed-secret-value" placeholder="Enter a promo code">' +
      "</div>" +
      "</div>";
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
