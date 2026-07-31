# mtshop-web-harness

Static web page for **MOBILE-20276** (ContentSquare vs. Amplitude mobile SDK
WebView comparison), built under **MOBILE-20605**. A small "kinda parity"
mini-shop — Home / Product / Cart / Account, hash-routed, vanilla JS, no
build step — mirroring the product catalog used by the native iOS/Android
**MTShop** test apps from the same project, so all three surfaces stay in
data/visual parity. It's loaded inside those apps' "Help & Support" WebView
screen to observe how each vendor's mobile SDK bridge captures/masks this
page's DOM.

## Dual hosting (required, not incidental)

Served from **two origins on purpose**:

1. GitHub Pages — `https://<user>.github.io/mtshop-web-harness/` (default-port https).
2. A local HTTPS server on an **explicit, non-default port** — e.g.
   `https://localhost:8443/` or `https://10.0.2.2:8443/` (Android emulator host alias).

The second origin exists for a specific regression test: a WebView SDK
bridge's `postMessage` handshake computes `targetOrigin` from the page URL,
and at least one vendor's bridge silently fails that computation once the
URL carries a non-default port (works on `:443`, silently captures nothing
on `:8443`). Testing only the default-port origin would produce a false
"it works" verdict. Hence: no absolute paths, no bundler, no origin-specific
assumptions anywhere in this repo.

## Files

- `index.html` — shell, nav, the analytics tag, the mutation strip.
- `assets/app.js` — router, cart state (in-memory only), all four views.
- `assets/style.css` — styling.
- `products.json` — the shared catalog. **Must stay byte-identical** to the
  sibling `competitor_analysis` repo's `app/shared/products.json` — that repo's
  native iOS/Android test apps read the same list so all three surfaces show
  the same 8 products. If you edit one, copy it to the other.

## ANALYTICS TAG SWAP POINT

`index.html`'s `<head>` has exactly one active analytics `<script>` tag,
bracketed by HTML comments marking it as the single swap point. To test a
different competitor's JS SDK later, replace that one `<script src="...">`
line only — nothing else in the page should need to change.
