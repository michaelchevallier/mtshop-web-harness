// CSP existential probe (MOBILE-20276, Part D row 8) — self-hosted so it survives the strict CSP on
// csp-strict.html ("script-src 'self' ..."); an inline <script> here would itself violate that policy.
//
// The question this settles: is a native-injected WebView bridge/recorder (WKUserContentController +
// evaluateJavascript on iOS, addJavascriptInterface + evaluateJavascript on Android) exempt from the
// PAGE's own script-src, or does the WebView engine apply CSP to it like any other script? A CSP
// violation report is the ground truth here — without it, "the bridge global is present" and "CSP had
// nothing to block in the first place" look identical from the page side alone.
(function () {
  function log(line) {
    try {
      console.log("[csp-probe] " + line);
    } catch (err) {
      // no console — nothing more to do.
    }
  }

  document.addEventListener("securitypolicyviolation", function (e) {
    log(
      "CSP VIOLATION: directive=" + e.violatedDirective +
      " blockedURI=" + e.blockedURI +
      " sourceFile=" + e.sourceFile +
      " lineNumber=" + e.lineNumber
    );
  });

  // Same known-globals vocabulary as app.js's scanForBridges, duplicated here (not shared) because this
  // page is deliberately standalone — loading the SPA's app.js would pull in router/diagnostics code
  // this static page has no use for.
  var knownGlobals = [
    "CSJavascriptBridge",
    "CS_isWebView",
    "AmplitudeNativeSessionReplay",
    "__amp_listener_attached",
    "amp_injected_recorder",
    "amp_injected_session_replay"
  ];

  function scanOnce(label) {
    log("scan (" + label + "):");
    knownGlobals.forEach(function (name) {
      try {
        if (!(name in window)) {
          log("  " + name + ": not present");
          return;
        }
        var raw = window[name];
        var t = typeof raw;
        var shown = (t === "boolean" || t === "string" || t === "number") ? (t + " = " + String(raw)) : t;
        log("  " + name + ": " + shown);
      } catch (err) {
        log("  " + name + ": error (" + err.message + ")");
      }
    });
  }

  // Two passes: as early as this self-hosted script can run, and again after a delay — native
  // discovery/injection is async relative to page-script execution on both vendors, so a single
  // immediate scan could read "not present" purely because injection hasn't happened yet.
  scanOnce("immediate");
  setTimeout(function () { scanOnce("t+3000ms"); }, 3000);

  log("probe loaded and ran (this line existing at all proves this self-hosted script was NOT blocked" +
    " by script-src, which is expected — the open question is only about NATIVE-injected code)");
})();
