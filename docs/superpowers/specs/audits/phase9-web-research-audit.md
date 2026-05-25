# Phase 9: Wallpaper / Tessellation Export — Web Research Audit

**Spec:** `docs/superpowers/specs/2026-05-25-mandala-phase9-wallpaper-design.md`
**Date:** 2026-05-25

---

## Findings

### 1. Tessellation Algorithms

**Spec says:** Custom implementations of square, hex, triangular, and brick tile layouts via pure `computeTileLayout()` functions. No third-party tessellation library referenced. The four patterns cover square grid (p4m), hexagonal honeycomb (p6m), triangular (p3m1), and brick offset (pmm) wallpaper groups — though the spec does not name them as wallpaper groups.

**2026 SOTA:** No dominant JavaScript library for wallpaper-group tessellation layout exists in 2026. The GitHub `tessellation` topic lists academic C++/Julia work and patent-heavy geometry tools — nothing that provides a `computeHexLayout(W, H, tileSize)` → `TileDescriptor[]` function. The closest active JS work is in parametric tile deformation research (Escher-style tiles, arxiv 2506.23388) — not relevant to this spec's needs.

For the four patterns the spec uses (square, hex, brick, triangular), the math is classical, stable, and short enough (< 40 lines each) that hand-rolling is the correct choice. The only potential trap is the hex tileRadius/tileSize naming ambiguity (see existing code audit M1) — standard references define hex tileSize as distance between parallel sides (flat-to-flat), making vertical pitch for pointy-top = `tileSize * sqrt(3)`.

**Verdict:** ✅ Spec is current — hand-rolled layout functions are the right call. No library adds value here.

**Recommendation:** None. Clarify `tileSize` = flat-to-flat distance in the hex layout code comments so future readers get the pitch formula right.

---

### 2. High-Resolution PNG Export (Canvas Memory Limits)

**Spec says:** Static PNG export scales by `devicePixelRatio` on export canvas. Max custom resolution capped at 4096×4096. 4K portrait wallpaper = 2160×3840 px.

**2026 SOTA:** Canvas size limits are hardware- and browser-dependent and have not meaningfully changed since 2024:

- **Chrome (desktop/Android):** Max dimensions ~32,767 px per side; max area ~268 MP. A 2160×3840 canvas (~8.3 MP) is nowhere near this limit.
- **Safari (desktop):** Max area 16,777,216 px (16 MP). 2160×3840 (~8.3 MP) fits.
- **Mobile Safari (iOS):** Two separate constraints:
  1. Per-canvas pixel area cap: 16,777,216 px (16 MP) on older devices; recent iPhones allow more but enforcement is inconsistent.
  2. Total canvas memory budget: ~384 MB on iOS 15+ (device-dependent). A single 2160×3840 RGBA canvas = ~33 MB; well within budget.
  3. The **actual failure mode** is multiple simultaneous large canvases. The overlap-mask bug described in the code audit (C1) creates two full-size OffscreenCanvases per tile — 64 tiles × 2 × 33 MB = 4.2 GB, which will crash mobile Safari before the first tile renders.

**The per-tile OffscreenCanvas approach (per-tile 220×220 px) already recommended in the code audit is also the correct fix for the memory constraint.** A 220×220 RGBA tile is ~194 KB. 64 tiles in flight simultaneously = ~12 MB. Safe on all platforms.

The `devicePixelRatio` scaling approach is also partially wrong for export purposes: `devicePixelRatio` reflects the screen's pixel density of the device running the export, not the export target resolution. For a 4K export on a 2× DPR screen, multiplying by DPR doubles the intended resolution. The spec should set export canvas dimensions directly from the resolution preset (e.g., 2160×3840) without DPR multiplication.

**Verdict:** ⚠️ Better approach exists — per-tile canvas eliminates the memory risk; remove `devicePixelRatio` scaling from the export path (use it only for the live preview canvas to match screen sharpness).

**Recommendation:**
1. Export canvas = exact resolution preset pixels (2160×3840 for 4K portrait). No DPR multiplier.
2. Preview canvas = `previewWidthPx × devicePixelRatio` so the on-screen preview is crisp.
3. Per-tile OffscreenCanvas = tile size in export-space pixels (not scaled).

---

### 3. Live Wallpaper Formats

**Spec says:** Phase 9 delivers an MP4 loop. Explicitly out of scope: `.heic` motion photo, `.lwp` Android live wallpaper. Rationale: users install it themselves.

**2026 SOTA:**

**iOS (iPhone):** iPhones do not support looping MP4 as a native lock/home screen wallpaper in any iOS version through 2026. The live wallpaper system is tied to Live Photos — a `.HEIC` still paired with a `.MOV` (H.265 / HEVC) clip, capped at ~1.5–3 seconds. Setting a downloaded MP4 as an iOS wallpaper requires:
1. A third-party app (e.g., WidgetClub, intoLive) to convert the MP4 to a Live Photo, OR
2. iOS 18+ "Live Photo from Video" Shortcuts workflow — but this is limited to <5 s clips.

There is no direct "set MP4 as wallpaper" path in iOS 18/19. MP4 delivery is correct as the intermediate format (all conversion apps accept it), but the user journey requires an extra step not acknowledged by the spec.

**Android:** Android 12+ supports looping video wallpapers via the `WallpaperManager` API. Third-party wallpaper apps (e.g., Backdrops, Muzei, KLWP) all accept MP4 (H.264 or H.265) directly. Some OEM launchers (Samsung One UI 6+, Pixel Launcher on Android 14+) accept MP4 natively as animated wallpaper without a separate app. So MP4 is the correct target for Android.

**HEVC vs H.264 for MP4:** HEVC (H.265) offers ~40–50% better compression at equal quality, and Apple devices (iPhone, Mac) decode it in hardware. However, the existing `h264-mp4-encoder` WASM fallback produces H.264, not H.265. The WebCodecs `VideoEncoder` can target HEVC on Safari 16.4+/macOS and Chrome on hardware-accelerated paths, but HEVC encoding support via WebCodecs is not universal. H.264 MP4 remains the correct lowest-common-denominator target for 2026 cross-platform compatibility.

**Verdict:** ⚠️ Better approach exists — the spec's MP4-and-done approach is technically correct for Android but requires user education for iOS. The spec should add a brief note about the iOS Live Photo conversion step in the UI (a tooltip or link in the WallpaperExportDrawer near the Export button).

**Recommendation:** Add a single-line UI note when "Phone Portrait" aspect ratio is selected: "iPhone users: convert to Live Photo with intoLive or a similar app to set as wallpaper." No code change required in the exporter itself — the MP4 format decision is correct.

---

### 4. WebCodecs for Video Export

**Spec says:** Uses existing `VideoExporter` class which auto-detects WebCodecs hardware acceleration (Chrome/Edge/Safari) and falls back to WASM `h264-mp4-encoder` for Firefox. Do not import `h264-mp4-encoder` directly.

**2026 SOTA:** WebCodecs `VideoEncoder` browser support as of May 2026:

| Browser | VideoEncoder support |
|---|---|
| Chrome 94+ (desktop + Android 147+) | Full |
| Edge 94+ | Full |
| Safari 26.0+ | Full; partial (video only) in 16.4–25 |
| Firefox 130+ (desktop only) | Full for video; **no AAC audio encoding** |
| Firefox Android | VideoDecoder still undefined on some builds |
| Samsung Internet 17+ | Full |

MP4 muxing is NOT part of the WebCodecs spec and will never be. Third-party muxers required (`mp4-muxer`, `MP4Box.js`, Mediabunny). The existing `VideoExporter` already handles this (per the code audit) — no change needed.

The notable 2026 development: **mp4-muxer** (the lightweight pure-JS muxer) is now the de facto standard for WebCodecs MP4 output, having displaced MP4Box.js for new projects due to its simpler API and smaller bundle. If `VideoExporter` currently uses `h264-mp4-encoder`'s built-in muxer, consider whether a WebCodecs + mp4-muxer path would produce better quality at lower CPU cost — but this is a separate concern from Phase 9.

**Verdict:** ✅ Spec is current — the `VideoExporter` abstraction with hardware acceleration fallback is the right approach. The existing class's design matches 2026 best practice.

**Recommendation:** None for Phase 9. If the `VideoExporter` class doesn't already use WebCodecs + `mp4-muxer` as its primary path, that's a worthwhile future upgrade — but it's not Phase 9 scope.

---

### 5. Aspect Ratio and Resolution Presets

**Spec says:**

| Label | Pixels | Notes |
|---|---|---|
| 1080p | 1080 × 1920 (portrait) | Fast export, ~2 MB PNG |
| 1440p | 1440 × 2560 | Good for recent Android/iOS |
| 4K | 2160 × 3840 | Maximum quality, ~8 MB PNG |
| Custom | user W×H | Max 4096×4096 |

**2026 SOTA — Actual device resolutions:**

| Device | Native resolution | Wallpaper recommended |
|---|---|---|
| iPhone 16 | 1170 × 2532 px | 1170 × 2532 or higher |
| iPhone 16 Pro | 1179 × 2556 px | 1179 × 2556 or higher |
| iPhone 16 Pro Max | 1320 × 2868 px | 1320 × 2868 or higher |
| Google Pixel 9 | 1080 × 2400 px | 1080 × 2400 or higher |
| Google Pixel 9 Pro | 1344 × 2992 px | 1344 × 2992 or higher |
| Samsung Galaxy S25 Ultra | 1440 × 3088 px (QHD+) | 1440 × 3088 or higher |
| Desktop 1440p | 2560 × 1440 px | — |
| Desktop 4K | 3840 × 2160 px | — |

Key observations:
1. **1080p (1080×1920) is undersized for modern flagship phones.** The iPhone 16 Pro Max and Pixel 9 Pro both exceed 1080p in at least one dimension. A 1080×1920 wallpaper will be upscaled and appear slightly soft on these devices.
2. **1440p (1440×2560) covers most flagship phones and is the practical sweet spot.** It exceeds the native resolution of every current iPhone model and matches or exceeds most Android flagships.
3. **4K portrait (2160×3840) is overkill for phones** — no phone wallpaper surface exceeds 1440×3120 as of 2026 — but it is the correct target for desktop wallpaper (3840×2160 landscape at 4K). The spec repurposes 4K for portrait, which produces a 9:20 aspect ratio file — unnecessarily large for phone use.
4. **The custom cap of 4096×4096** is fine; the spec's canvas memory analysis above shows this is safe on modern devices with the per-tile rendering approach.

**Verdict:** ⚠️ Better approach exists — the resolution labels are slightly off-target. 1080p undersells modern phones; 4K portrait is oversized for phones but correct for desktop.

**Recommendation:** Revise presets as follows:

| Label | Pixels (Portrait) | Primary Use |
|---|---|---|
| Standard | 1170 × 2532 | iPhone 16 native resolution |
| QHD | 1440 × 3120 | Android flagships (S25, Pixel 9 Pro) |
| 4K | 2160 × 3840 | Desktop (export landscape separately) |
| Custom | user W×H | — |

Add a separate aspect ratio for "Desktop 4K" that defaults to **3840 × 2160** (landscape) rather than the portrait 4K. The current spec uses the same 2160×3840 pixels for both "4K portrait phone" and "Desktop 4K" — those are different aspect ratios with different use cases.

---

### 6. Canvas Tiling Performance: `createPattern` vs `drawImage` Loop

**Spec says:** Manual `drawImage` loop — stamp each per-tile OffscreenCanvas onto the export canvas. No mention of `ctx.createPattern()`.

**2026 SOTA:** Web search returned no definitive 2026 benchmark for `createPattern` vs manual `drawImage` tiling. The existing documented behavior is:

- `ctx.createPattern(image, 'repeat')` + `ctx.fillRect(0, 0, W, H)` hands tiling entirely to the GPU compositing pipeline, which can be faster when the tile is truly uniform (same image repeated at identical size, no per-tile rotation/color variation).
- Manual `drawImage` loop allows per-tile transform, rotation, and color variation — which is a requirement for Phase 9's `rotationJitter` and `colorVariant` features.

`createPattern` cannot express per-tile variation. For the Phase 9 use case (each tile may have a different rotation, color phase, and animation offset), `createPattern` is not applicable. The spec's manual `drawImage` loop is the only viable approach.

**Verdict:** ✅ Spec is current — `createPattern` is inapplicable when tiles vary. `drawImage` loop is correct.

**Recommendation:** None. If a future "uniform" mode preset (no jitter, no color variation, no phase offset) is added, `createPattern` could be used as a fast path for that specific case — but it is not worth spec'ing for Phase 9.

---

### 7. Image Compression: AVIF/WebP vs PNG

**Spec says:** Static export as PNG only. GIF is explicitly rejected. AVIF/WebP are mentioned in the code audit (M3) as a future enhancement.

**2026 SOTA:**

| Format | Browser encoding support | Relative file size | Encoding speed |
|---|---|---|---|
| PNG | Universal | 1× (baseline) | Fast |
| WebP | ~97% coverage (Chrome, Firefox, Safari 14+, Edge) | 30–40% smaller than PNG | Fast (near-instant in browser) |
| AVIF | ~93% coverage (Chrome 85+, Firefox 93+, Safari 16+) | 40–60% smaller than PNG | 5–47× slower than WebP; 10× slower than JPEG |

For geometric mandala art (large uniform color regions, no photographic texture), AVIF's advantage over WebP is reduced — its block-partitioning wins most on high-frequency photographic content. For this type of content, WebP and AVIF both outperform PNG significantly, but AVIF's slow encoding makes it a poor UX choice for client-side export.

A 4K portrait PNG (~8 MB per spec estimate) would become:
- WebP: ~3–5 MB
- AVIF: ~2–3 MB (but encoding takes 15–60 seconds client-side for a 2160×3840 canvas)

`canvas.toBlob('image/webp', 0.92)` is supported in Chrome and Edge but **not in Firefox or Safari**. `canvas.toBlob('image/avif')` is Chrome-only and encoding is too slow for a good UX.

The spec's decision to ship PNG only for Phase 9 is pragmatic. WebP would be a worthwhile addition for Chrome/Edge users in a future phase — but it requires a fallback path (check `canvas.toBlob('image/webp')` support, fall back to PNG) and a format selector in the UI.

**Verdict:** ✅ Spec is current for Phase 9 scope — PNG-only is the correct safe default. WebP is a desirable future enhancement but adds format-detection complexity.

**Recommendation:** Add a note to the spec: after Phase 9 ships, add optional WebP export for Chrome/Edge with PNG fallback, behind a format picker in the Canvas section of the drawer. Skip AVIF — encoding latency makes it a poor UX for a 4K canvas.

---

## Summary Table

| Topic | Verdict | Action Required |
|---|---|---|
| Tessellation algorithms | ✅ Current | None — hand-rolled layout is correct |
| High-res canvas export | ⚠️ Better approach | Remove DPR from export path; per-tile canvas (already in code audit) solves memory |
| Live wallpaper formats | ⚠️ Better approach | Add iOS Live Photo conversion note to drawer UI |
| WebCodecs MP4 export | ✅ Current | VideoExporter abstraction is correct 2026 practice |
| Aspect ratio presets | ⚠️ Better approach | Replace 1080p/4K labels; add true desktop 4K preset (landscape) |
| createPattern vs drawImage | ✅ Current | drawImage loop is the only option when tiles vary |
| Image compression | ✅ Current (for Phase 9) | PNG-only is correct now; flag WebP as post-Phase-9 enhancement |

---

## Sources

- [WidgetClub Smartphone Wallpaper Size Guide 2026](https://widget-club.com/article/wallpaper-size-quickguide-for-smartphones)
- [iPhone Wallpaper Dimensions 2026 — sizedesk.com](https://sizedesk.com/iphone-wallpaper-size/)
- [WebCodecs API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [WebCodecs Browser Support — TestMu AI](https://www.testmuai.com/learning-hub/webcodecs-browser-support/)
- [Muxing and Demuxing — WebCodecs Fundamentals](https://webcodecsfundamentals.org/basics/muxing/)
- [Canvas Area Exceeds Maximum Limit — PQINA](https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/)
- [Total Canvas Memory Use Exceeds Maximum Limit — PQINA](https://pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/)
- [canvas-size library — jhildenbiddle](https://jhildenbiddle.github.io/canvas-size/)
- [OffscreenCanvas — Can I Use](https://caniuse.com/offscreencanvas)
- [WebP vs AVIF 2026 Benchmark — pixotter.com](https://pixotter.com/blog/webp-vs-avif/)
- [Best Image Format for Web 2026 — thecssagency.com](https://www.thecssagency.com/blog/best-web-image-format)
- [iOS Live Wallpaper / Live Photo conversion — Wondershare](https://videoconverter.wondershare.com/converter/convert-video-to-live-photo.html)
- [Using HEIF or HEVC on Apple devices — Apple Support](https://support.apple.com/en-us/116944)
- [GitHub canvas-size — jhildenbiddle](https://github.com/jhildenbiddle/canvas-size)
