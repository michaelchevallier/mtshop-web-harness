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

## Diagnostics view (`#/diagnostics`)

An engineering test panel (not styled as shop content) covering the pure
page-content scenarios from `research/webview-comparison-checklist.md`
("Part D — Test-app design requirements") — everything a webpage's own
HTML/JS can carry. Scenarios needing native app / WebView-config changes
(JS-disabled toggle, forced bridge failure, background/foreground, CSP via
real HTTP header, kill-switches) are out of scope here and handled
elsewhere.

- **Bridge inspector** — scans `window` (known globals + a regex sweep) for
  injected SDK bridges on click; tests row 12 origin-allowlist exposure /
  "bridge attack surface from page JS", and reports discovery latency
  against `window.__head_probe_ts__`.
- **Forge panel** — attempts forged CS/Amplitude bridge calls and
  delete/overwrite of the bridge globals; tests Security Test 2.
- **Dual-SDK toggle** — loads Amplitude's public
  `@amplitude/session-replay-browser` SDK from a CDN on click only; tests
  the ⭐ priority "dual collection" scenario.
- **Cross-origin iframe** — a permanent `https://example.com` iframe; tests
  "frame scope" Security Test 3 / row 11 / third-party-iframe checkout.
- **Head-probe timestamp** — `window.__head_probe_ts__`, set by the very
  first, inline `<script>` in `index.html`'s `<head>`; tests the
  `WKUserScript.injectionTime` probe / discovery-latency measurement
  (row 3).
- **Oversized/malformed content injector** — appends a ~1.2MB text block
  and a control-character block on click; tests the row 13 robustness
  probe (CS's own known ~1MB / control-character injection cap).
- **Data-attribute masking marker** (lives on `#/account`, not
  Diagnostics) — a `data-amp-mask="true">` span testing the confirmed
  iOS-works/Android-silently-fails masking-vocabulary gap.

`csp-strict.html` (repo root, standalone — not part of the SPA) serves a
strict `Content-Security-Policy` meta tag plus the same CS tag, to test
row 8's CSP-exemption question for native-injected bridge code. Linked
from the Diagnostics view.
