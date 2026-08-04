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
window._uxa = window._uxa || [];
window._uxa.push(["setOption", "isWebView", true]);
window._uxa.push(["trackPageview", window.location.pathname + window.location.hash.replace("#", "?__")]);
