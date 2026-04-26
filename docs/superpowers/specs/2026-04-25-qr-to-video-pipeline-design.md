# QR-to-Video Pipeline

**Status:** Draft
**Owner:** Austen + Claude
**Date drafted:** 2026-04-25

## Problem

When someone scans a TKA QR code, `/q/[code]` loads the full app bundle: SequenceViewerOrchestrator, animation engine, 3D renderer, export panels, footer controls — hundreds of KB of JS before anything renders. On a phone from a cold scan, this takes multiple seconds. The sequence viewer is powerful, but a stranger scanning a card at a jam doesn't need it. They need to see the animation playing.

## Solution

Replace the QR landing experience with a single-purpose video page. Every scan lands on the same minimal page — a `<video>` element, a download button, and an "Open in TKA" link. No app bundle, no sequence viewer, no fork in the experience.

Videos are keyed by **sequence hash** (SHA-256 of the deterministic pipe-encoded sequence), not by short code. Multiple cards sharing the same sequence reuse one cached MP4.

**Two states, one page:**

1. **Cached (warm):** R2 has `videos/{hash}.mp4`. Video starts playing immediately. Sub-second load.
2. **Not cached (cold):** Page shows "You're the first to view this sequence" with a progress indicator. A self-contained web worker renders the animation headlessly using OffscreenCanvas, encodes to MP4 via WebCodecs + mp4-muxer, and plays the result. The finished MP4 uploads to R2 in the background so the next scanner gets it instantly.

No full app viewer as fallback. One path, one experience.

---

## Architecture

### Landing Page (`/q/[code]`)

The page becomes two-phase:

**Phase 1 — Resolve (unchanged):** ShortCodeManager resolves the short code to SequenceData via the existing 4-tier fallback (inline decode → Firebase → static snapshot → public index).

**Phase 2 — Video (new):** Check R2 for `videos/{sequenceHash}.mp4`.

- **Hit:** Set `<video src>` to the R2 URL. Autoplay, muted, loop.
- **Miss:** Post the resolved SequenceData to the headless render worker. Show first-viewer message + progress bar. When the worker returns the MP4 blob, create an object URL, play it, and upload to R2 in the background.

**Bundle size target:** The video landing page imports zero components from the sequence viewer, animation engine, or 3D renderer. The only heavy dependency is the headless render worker, loaded on-demand via `new Worker()` only on cache miss.

### Component Breakdown

```
src/routes/q/[code]/
  +page.server.ts          ← existing (geo headers) + video URL lookup
  +page.svelte             ← REWRITE: minimal video player page
  +layout@.svelte          ← layout reset (skip auth gate, app shell)

src/lib/shared/video-delivery/
  workers/
    headless-render.worker.ts    ← self-contained: OffscreenCanvas + renderer + encoder
  services/
    VideoCacheChecker.ts         ← HEAD request to R2 to check video existence
    VideoUploader.ts             ← PUT to R2 via presigned URL or CF Worker endpoint
  components/
    VideoLandingPage.svelte      ← video player + first-viewer state + download + CTA
```

### Headless Render Worker

A dedicated web worker that takes SequenceData in and produces an MP4 ArrayBuffer out. Self-contained — no DOM, no app imports.

**What it bundles:**
- `Canvas2DDirectRenderer` — already supports OffscreenCanvas (explicit check at lines 194-206)
- `SvgAssetLoader` — uses `fetch()` + `createImageBitmap()`, both available in workers
- `PictographPreparer` — calculates layout positions for pictograph elements
- Synchronous animation stepper — replaces RAF-based playback controller with pure calculation
- `video-export.worker.ts` encoding pipeline — WebCodecs + mp4-muxer (existing)

**What it does NOT bundle:**
- WebGL effects (fire, charcoal, LED, trails) — Canvas 2D only
- SequenceViewerOrchestrator or any Svelte components
- 3D renderer (Three.js)
- Animation engine (RAF loop, reactive state)
- Full app DI container

**Refactoring required:**

| File | Change | Scope |
|------|--------|-------|
| `CompositeVideoRenderer.ts` | Replace `document.createElement("canvas")` with `new OffscreenCanvas()` behind a flag | 3 lines |
| `VideoExportOrchestrator.ts` | Extract frame-stepping math into a pure function (no RAF, no DOM queries) | ~40 lines extracted |
| `CanvasRenderer.ts` | Guard `document` access behind `typeof document !== "undefined"` | 2-3 lines |
| `Canvas2DDirectRenderer.ts` | Already headless-compatible | No change |
| `SvgAssetLoader.ts` | Already headless-compatible (`fetch` + `createImageBitmap`) | No change |

**Worker message protocol:**

```typescript
// Main thread → Worker
interface RenderRequest {
  type: "render";
  sequenceData: SequenceData;       // full resolved sequence
  assetBaseUrl: string;             // e.g. "https://tka.run" or origin
  outputWidth: number;              // 720
  outputHeight: number;             // 720
  fps: number;                      // 30
  bpm: number;                      // 60
  loopCount: number;                // 2
}

// Worker → Main thread
interface RenderProgress {
  type: "progress";
  phase: "loading-assets" | "rendering" | "encoding" | "finalizing";
  percent: number;                  // 0-100
}

interface RenderComplete {
  type: "complete";
  mp4: ArrayBuffer;                 // transferred, zero-copy
  hash: string;                     // sequence hash for R2 key
  durationMs: number;               // for analytics
}

interface RenderError {
  type: "error";
  message: string;
}
```

### Video Cache Layer

**Storage:** R2 bucket (existing CDN endpoint: `pub-f5505ed75927471cb198c54336317370.r2.dev`)

**Key format:** `videos/{sequenceHash}.mp4`
- SHA-256 hash via `PublicSequenceHashMatcher.computeEncoderHash()` (existing)
- Deterministic: same sequence always produces same hash regardless of who shared it

**Cache check:** HTTP HEAD request to `{R2_CDN}/videos/{hash}.mp4` from `+page.server.ts`. Returns 200 (cached) or 404 (not cached). The video URL is passed as page data so the client knows immediately whether to show the player or the render worker.

**Upload path:** After the worker produces the MP4, the landing page uploads it. Two options:

**Option 1 — Direct R2 upload via presigned URL:**
- Small Cloudflare Worker endpoint: `POST /api/video-upload-url` → returns a time-limited PUT URL for `videos/{hash}.mp4`
- Landing page PUTs the MP4 blob directly to R2
- Auth: Firebase ID token not required (the scanner is probably not a TKA user). Instead, the endpoint validates that the hash matches a known shortcode's `encoderHash` in Firestore.

**Option 2 — Proxy upload via CF Worker:**
- `PUT /api/videos/{hash}` with the MP4 body
- CF Worker writes to R2
- Same hash validation

Option 1 is preferred — the MP4 goes directly to R2 without proxying through a worker, saving bandwidth and CPU time.

**TTL policy (future):** Auto-delete videos not scanned in 90 days. Regenerate on next scan. Not needed at launch — storage is cheap ($0.015/GB/month, zero egress on R2).

### Landing Page UX

**Cached (warm path):**
```
┌──────────────────────────────┐
│                              │
│     ┌──────────────────┐     │
│     │                  │     │
│     │   <video>        │     │
│     │   autoplay       │     │
│     │   muted          │     │
│     │   loop           │     │
│     │                  │     │
│     └──────────────────┘     │
│                              │
│     SEQUENCE NAME            │
│     "tagline if present"     │
│                              │
│     [ ⬇ Download ]           │
│     [ Open in TKA ]          │
│                              │
└──────────────────────────────┘
```

**Not cached (cold path):**
```
┌──────────────────────────────┐
│                              │
│     ✨ You're the first to   │
│     view this sequence!      │
│                              │
│     Building animation...    │
│     ████████░░░░░  62%       │
│                              │
│     Subsequent scans will    │
│     load instantly.          │
│                              │
│     [ Open in TKA ]          │
│                              │
└──────────────────────────────┘
```

After the render completes, the cold path transitions to the warm path layout with the video playing.

### Data Flow

```
QR scan
  │
  ▼
/q/[code] +page.server.ts
  ├── resolve shortcode → SequenceData
  ├── compute sequenceHash
  └── HEAD R2 /videos/{hash}.mp4 → videoUrl | null
  │
  ▼
+page.svelte (minimal bundle)
  │
  ├── videoUrl exists?
  │   YES → <video src={videoUrl}> → playing
  │   NO  → spawn headless-render.worker
  │           ├── load SVG assets via fetch()
  │           ├── render frames on OffscreenCanvas
  │           ├── encode H.264 via WebCodecs + mp4-muxer
  │           └── post MP4 ArrayBuffer back
  │         → play video from object URL
  │         → upload MP4 to R2 (background, fire-and-forget)
  │
  ▼
Next scan of same sequence → warm path (instant)
```

---

## Implementation Phases

### Phase 1 — Headless render worker extraction

Extract the rendering pipeline into a self-contained worker:
- Create `HeadlessAnimationStepper` — pure function that computes frame state from SequenceData + time offset (no RAF, no reactive state)
- Create `HeadlessFrameRenderer` — wraps Canvas2DDirectRenderer + SvgAssetLoader + PictographPreparer with OffscreenCanvas
- Patch `CompositeVideoRenderer` and `CanvasRenderer` for headless mode (OffscreenCanvas, no `document`)
- Bundle existing WebCodecs + mp4-muxer encoding from `video-export.worker.ts`
- Wire up the worker message protocol
- Test: worker takes SequenceData → produces valid MP4

### Phase 2 — R2 video cache layer

- Add `videos/` prefix to R2 bucket
- Create `VideoCacheChecker` service (HEAD request against R2 CDN)
- Create CF Worker endpoint for presigned upload URLs
- Hash validation: endpoint checks that the hash matches a known shortcode
- Wire up upload from landing page after render completes

### Phase 3 — Landing page rewrite

- Rewrite `/q/[code]/+page.svelte` as the minimal video player page
- Add `+layout@.svelte` for layout reset (skip auth gate) — pattern already used in codebase
- Server-side video URL lookup in `+page.server.ts`
- Warm path: `<video>` element with autoplay/muted/loop
- Cold path: first-viewer message + progress bar + worker spawn
- Transition from cold to warm when render completes
- Download button (warm path)
- "Open in TKA" CTA linking to app store / web app

### Phase 4 — Analytics + polish

- Track video generation events (sequence hash, device, render time)
- Track video views (warm vs cold, watch duration)
- Add OG meta tags for social media previews (sequence name, thumbnail)
- Error handling: if worker fails (no WebCodecs, OOM), show a static pictograph grid as fallback with a link to the full viewer
- Progressive enhancement: if the browser doesn't support WebCodecs, fall back to the existing full viewer path

---

## Storage Math

| Scale | Storage | Monthly cost |
|-------|---------|-------------|
| 100 videos | 500 MB | $0.01 |
| 1,000 videos | 5 GB | $0.08 |
| 10,000 videos | 50 GB | $0.75 |
| 100,000 videos | 500 GB | $7.50 |

R2 egress is free. At any realistic scale for the next 2+ years, storage cost is negligible.

---

## Risks and Mitigations

**Risk: WebCodecs not available on scanner's device.**
Firefox and older browsers lack WebCodecs. The worker already has a WASM H.264 fallback (`h264-mp4-encoder`). If even that fails, show a static pictograph image (single canvas render, no video) with a link to the full viewer.

**Risk: OffscreenCanvas not available.**
Safari 16.4+ and all modern Chromium browsers support it. For older Safari (< 2% of mobile traffic), fall back to the full viewer.

**Risk: Worker rendering produces visual differences from the live app.**
The headless worker uses the same `Canvas2DDirectRenderer` and asset pipeline. WebGL effects are disabled, but those are premium features most sequences don't use. The rendered video matches the 2D canvas view, which is the default experience.

**Risk: Large sequences take too long to render on mobile.**
Cap at 30 seconds render time. If exceeded, abort and show the static pictograph fallback. Most sequences are 4-16 steps — render time should be 5-15 seconds at 30fps.

**Risk: R2 upload fails (network, quota).**
Fire-and-forget. The scanner still sees their video (played from the local blob). The next scanner will re-render. No data loss, no broken experience.

---

## What This Does NOT Change

- The in-app sequence viewer is untouched. Users inside TKA still get the full interactive viewer.
- QR code generation is untouched. Short codes, Firestore records, scan analytics — all unchanged.
- The existing video export feature is untouched. Users can still export custom videos with effects, resolution options, loop counts, etc.
- No server-side rendering infrastructure. All rendering happens on the client (scanner's device on cache miss).

## Dependencies

- R2 bucket (existing)
- Cloudflare Worker for presigned upload URLs (new, ~50 lines)
- WebCodecs + mp4-muxer (existing in video-export.worker.ts)
- Canvas2DDirectRenderer with OffscreenCanvas (existing, already supported)
- SvgAssetLoader (existing, already worker-compatible)
