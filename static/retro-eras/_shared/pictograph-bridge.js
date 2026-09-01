// ─────────────────────────────────────────────────────────────────────────────
// Pictograph Bridge - postMessage contract between the History Lab parent
// and every era renderer iframe.
//
// Parent → Iframe:
//   { type: "pictograph", data: RetroPictographData,
//     canonical?: ImageBitmap,   // canonical renderer output (optional)
//     canonicalSize?: number }   // pixel size of the canonical render (square)
//
// Iframe → Parent (on DOMContentLoaded):
//   { type: "ready" }
//
// Usage in an era page:
//   <script src="./_shared/pictograph-geometry.js"></script>
//   <script src="./_shared/pictograph-bridge.js"></script>
//   <script>
//     PictographBridge.onPictograph(function(data, canonical, meta) {
//       // data:      RetroPictographData
//       // canonical: ImageBitmap | null - the real pictograph render,
//       //            ready to recolor + composite via PictographStylize
//       // meta:      { canonicalSize: number } | null
//     });
//   </script>
// ─────────────────────────────────────────────────────────────────────────────

(function (global) {
  let handler = null;
  let latestData = null;
  let latestCanonical = null;
  let latestMeta = null;

  // The standalone era pages predate the performer-relative field names. Keep
  // their legacy aliases contained at this iframe boundary so the application
  // and postMessage contract remain canonical left/right.
  function withLegacyHandAliases(data) {
    if (!data || data.blueHand || !data.leftHand) return data;
    return {
      ...data,
      blueHand: data.leftHand,
      redHand: data.rightHand,
    };
  }

  function onPictograph(fn) {
    handler = fn;
    // If we already received data before the handler was set, render now.
    if (latestData) fn(latestData, latestCanonical, latestMeta);
  }

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "pictograph" && msg.data) {
      latestData = withLegacyHandAliases(msg.data);
      latestCanonical = msg.canonical || null;
      latestMeta =
        typeof msg.canonicalSize === "number"
          ? { canonicalSize: msg.canonicalSize }
          : null;
      if (handler) handler(latestData, latestCanonical, latestMeta);
    }
  });

  // Announce readiness so the parent can push the current pictograph to us.
  function announceReady() {
    try {
      window.parent.postMessage({ type: "ready" }, "*");
    } catch {
      // iframe may be cross-origin or standalone - ignore
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", announceReady);
  } else {
    announceReady();
  }

  global.PictographBridge = { onPictograph };
})(typeof window !== "undefined" ? window : globalThis);
