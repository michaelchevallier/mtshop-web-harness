// ContentSquare web-tag bootstrap — MUST run BEFORE the tag <script> tag so `setOption` and
// `trackPageview` are queued in time for the tag's own boot-time config read.
//
// isWebView is set UNCONDITIONALLY, not detected (no navigator.userAgent / CSJavascriptBridge /
// CS_isWebView check) — this harness only ever loads inside a native app's WebView, unlike a real
// customer page that is also reachable from a normal browser and needs the conditional variant from
// docs.contentsquare.com/en/webview-tracking-tag/.
//
// Without this push, the tag boots in its default non-WebView module graph unless the project itself
// is server-side configured as isWebView=true — this project's project is NOT (confirmed with the user,
// 2026-08-04) — so this client-side push is the only way to reach WebView mode.
// MOBILE-20276 (2026-08-07): `setOption isWebView` STAYS here — it must be queued before the tag boots.
//
// The `trackPageview` that used to be on the next line has MOVED to app.js's router (`trackSpaPageview()`),
// and must not come back. Two reasons, both of which broke real runs:
//  1. This file runs once per document load. This is a hash-router SPA, so every in-page navigation replaced
//     the whole DOM with NO pageview — and CS attaches replay content to pageviews, so everything after the
//     initial route was orphaned. The router is the only place that sees every navigation.
//  2. `setPIISelectors` must be queued BEFORE the pageview it applies to or masking does not take effect
//     (user-confirmed 2026-08-07). A pageview fired from here, at load, always precedes any masking config
//     the page could push, making the first route's pageview structurally unmaskable. The router pushes
//     config first, pageview second.
window._uxa = window._uxa || [];
window._uxa.push(["setOption", "isWebView", true]);
