# Mandala Export Experience — Design (v2, worker pipeline)

**Date:** 2026-05-29
**Status:** Approved scope; v2 supersedes the main-thread prototype
**Topic:** Premium mandala download experience + canonical responsive control surface, with a fully off-main-thread render+encode pipeline and seamless looping.

## Problem

The mandala download is weak and the prototype shipped to the test route is not
top tier. Three concrete failures (verified 2026-05-29):

1. **Not off the main thread.** The prototype uses
   `VideoExporter.createManualExporter`, whose `WebCodecsVideoEncoder.addFrame`
   builds the `VideoFrame` and calls `encoder.encode()` **on the main thread**
   (`web-codecs-video-encoder.ts:144-152`). The dedicated `video-export.worker.ts`
   is never engaged. Worse, SVG rasterization (string → Blob → `Image` decode →
   `drawImage`) is 100% main-thread, per frame, serial. At 4K / high loop counts
   this stutters the very undulation that is supposed to stay smooth. Firefox
   (WASM fallback) is fully main-thread.
2. **Loop handling is buggy.** The prototype snaps total rotation with
   `Math.round(rawTotalRot / 360) * 360`. Loops=1 + Spin=90 → rounds to **0** →
   exported clip has no spin; other values change the spin *rate* so the MP4 no
   longer matches the on-screen preview.
3. **Per-frame waste.** A fresh SVG string + Blob + `Image` + objectURL every
   frame. Geometry and rasterization are recomputed for frames that repeat each
   loop.

The real viewer's mandala controls are still the desktop side rail
(`MandalaViewerControls` in `MandalaPane.svelte`); the prettier mobile dock lives
only on `/test/mandala-mobile`.

## Goals

- **Fully off-main-thread** render+encode: geometry, SVG, rasterization, and H.264
  encoding all run in a worker. Main thread only sends config and paints the live
  preview → undulation stays smooth at any fidelity.
- **Seamless loops**: undulation, rotation, and flow-color all close cleanly at
  the loop point, at (or honestly near) the on-screen rates.
- **Efficient**: cache per-cycle rasterization where the content repeats.
- One responsive canonical control surface (mobile dock + desktop floating dock)
  replacing the side rail, with a download config tray (loops / fidelity / fps +
  live estimate) and a fullscreen export takeover.
- Reuse existing encode infrastructure; extract a shared core rather than fork it.

## Non-Goals

- No new H.264 codec. Reuse WebCodecs + `h264-mp4-encoder` (WASM) via a shared core.
- No changes to the 2D/3D/image/split panes.
- Effect overrides / cinema supersampling / split composites (2D-only) stay out.

## Worker-safety (verified 2026-05-29)

- `mandala-renderer.ts` (`renderMandalaSVG`) — pure string builder, no DOM.
- `mandala-geometry-calculator.ts` (`MandalaGeometryCalculator.calculate`) — pure
  math, no DOM. Imports are domain enums/types only.
- `createImageBitmap(Blob)`, `OffscreenCanvas`, `VideoEncoder`, and
  `h264-mp4-encoder` all run inside a Web Worker.

Therefore the whole frame pipeline is portable to a worker. `sequence.steps`,
prop types, palette, and tunables are structured-cloneable.

## Architecture (Approach A + worker pipeline)

### Shared encode core (extracted, DRY)

`video-export.worker.ts` already implements the WebCodecs (mediabunny) + WASM
(`h264-mp4-encoder`) dual path. Extract its encode half into a worker-importable
module so both the 2D pipeline and the mandala pipeline share one encoder:

`animation-engine/services/mp4-encoder-core.ts` (runs in worker scope)
```
createMp4Encoder(config: { width; height; fps; bitrate; totalFrames })
  : Promise<{
      addImageBitmap(bmp: ImageBitmap, index: number): void; // WebCodecs: VideoFrame(bmp)
      addImageData(data: ImageData, index: number): void;     // WASM: addFrameRgba
      finish(): Promise<ArrayBuffer>;
      cancel(): void;
    }>
```
- WebCodecs path: `new VideoFrame(bitmap, { timestamp, duration })` → `encode` →
  mediabunny mux → `BufferTarget`. (Same logic + error handling that lives in
  `video-export.worker.ts` today, including the `encoderErrored` guard and even
  dimension padding.)
- WASM path: `addFrameRgba(imageData.data)` → `FS.readFile`.
- `video-export.worker.ts` is refactored to consume this core (no behavior
  change). Fallback if extraction proves risky under the in-flight refactor:
  the mandala worker inlines the encode logic (documented exception to DRY).

### New dedicated worker

`mandala/workers/mandala-export.worker.ts`
- **One** `config` message carries everything: `steps`, `bluePropType`,
  `redPropType`, `pathShape`, `rotationDeg`, `period`, `rangeMax`, `colorMode`,
  preset `morphColors` / `solidPair`, `lineWeight`, `bgColor`, `resolution`,
  `fps`, `reps`, `bitrate`.
- Owns the full loop: for each frame → geometry (`MandalaGeometryCalculator`) →
  `renderMandalaSVG` → `createImageBitmap(svgBlob)` → draw onto `OffscreenCanvas`
  with the rotation transform + bg fill → hand the bitmap/ImageData to the
  encoder core.
- Posts `ready`, `progress {frameIndex, totalFrames}`, `complete {buffer}` (zero-
  copy transfer), `error {message}`. Accepts `cancel`.
- Instantiated as a module worker: `new Worker(new URL(...), { type: "module" })`.

### Main-thread orchestration (controller)

`MandalaViewerController` (`mandala-viewer-controller.svelte.ts`):
- Config state (persisted `localStorage` `tka_mandala_export`): `exportReps`
  (1–10), `exportResolution` (720|1080|2160), `exportFps` (30|60).
- Lifecycle: `exportPhase: 'idle'|'capturing'|'encoding'|'complete'|'error'`,
  `exportProgress` (0–1), `exportError`.
- Derived: `estimateSeconds` via `estimateExportTime(resolution, fps, period,
  reps)`, `hasMetrics` via `hasDeviceMetrics`, `exportFrameCount`.
- `startExport()`: spawn `mandala-export.worker`, post `config`, translate
  `progress`→`exportProgress`, `complete`→download Blob +
  `recordExportThroughput(...)`, terminate worker. Adds `beforeunload` guard for
  the duration. `cancelExport()` posts `cancel` + terminates.
- The current main-thread `startExport` loop (the prototype) is **deleted** and
  replaced by the worker dispatch. `handleDownload()` stays as an alias.

The main thread does no geometry, no raster, no encode → the live `SequenceMandala`
(its own rAF) renders uninterrupted.

## Seamless loop algorithm

Let `framesPerCycle = ceil(period * fps)`, `totalFrames = framesPerCycle * reps`,
`clipT = i / totalFrames`.

- **Undulation** — triangle wave over `framesPerCycle`, repeated `reps` times.
  Identical each cycle → seamless by construction.
- **Rotation** — encode a whole number of turns at (near) the true rate:
  ```
  turnsRaw = (period * reps / ROTATION_REF_PERIOD) * rotation / 360
  turns    = rotation === 0 ? 0 : Math.max(1, Math.round(turnsRaw))
  rotDeg   = turns * 360 * clipT      // starts 0, ends turns*360 ≡ 0 → seamless
  ```
  Guarantees a spinning mandala always completes whole turns (fixes the
  Loops=1+Spin→0 bug). For short clips the spin rate may differ slightly from the
  live preview to preserve a clean loop — intentional, documented.
- **Flow color** — whole number of color cycles:
  ```
  colorCycles = Math.max(1, Math.round(reps / COLOR_CYCLE_BREATHS))
  cPhase      = (clipT * colorCycles) % 1
  ```

Frame at `i = totalFrames` is never encoded (loop wraps to frame 0), so no
duplicate seam frame.

## Efficiency: per-cycle raster cache

- **Solid color** (`colorMode === 'solid'`): the mandala geometry+SVG depends only
  on undulation phase (cycle-periodic); rotation is applied as a post-raster
  canvas transform. Cache the `framesPerCycle` un-rotated `ImageBitmap`s once,
  then each global frame only does `drawImage(cachedBitmap, rotate)` →
  geometry+SVG+raster cost drops by `reps×`.
- **Flow color**: palette changes every frame → SVG differs per frame → no cache;
  render each frame. (Documented; flow is the expensive mode by nature.)

## UI (unchanged from v1, lands in the canonical dock)

- **`MandalaControlDock.svelte`** — extract the test-route dock; container-query
  responsive (narrow = full-width bottom sheet; wide ≥ ~700px = centered floating
  bar, auto-width buttons, tray opens above). Hosts existing trays + the download
  tray. Keeps the 2026-05-29 slide/fade layout-shift transitions + `hover:hover`
  affordances.
- **Download config tray** — Loops slider (1–10), Fidelity chips (HD 720 /
  Full HD 1080 / 4K 2160), FPS chips (30/60), live estimate (`~12s` calibrated /
  `≈12s` fallback + frame count), primary **Export MP4** button.
- **`MandalaExportTakeover.svelte`** — fullscreen overlay over the pane (covers
  header + bottom bar): live undulating `SequenceMandala`, progress bar, phase
  label, message `Please don't navigate away.`, Cancel; error state with
  Retry / Close. `fade`/`fly` transitions, reduced-motion gated.
- **`MandalaPane.svelte`** — drop `controls-rail` + `MandalaViewerControls`
  (sole consumer, grep-confirmed), full-bleed stage, mount `MandalaControlDock` +
  `MandalaExportTakeover`. Delete `MandalaViewerControls.svelte`.
- **Test route** — add a "Desktop" device preset to tune the floating layout.

## Error handling

- Worker `error` → `exportPhase='error'`, message surfaced in takeover (no silent
  catch). Worker terminated.
- WebCodecs absent → encoder core takes WASM path inside the worker (no UI branch).
- `createImageBitmap` failure on a frame → worker posts `error` (spike confirms
  the mandala SVG rasterizes identically off-thread before relying on it).
- Cancel → `cancel` message + terminate + reset to `idle`, no file.
- No sequence/steps → Export disabled.

## Risks

- **Shared-core extraction** touches `video-export.worker.ts` (used by the 2D
  pipeline). Mitigation: extraction is behavior-preserving; run the 2D export
  path after to confirm no regression. Fallback: inline encode in the mandala
  worker.
- **SVG-in-worker rasterization** — `createImageBitmap` on an SVG Blob must
  produce pixels identical to the main-thread `Image` path. De-risk with a one-
  frame spike (worker raster vs main-thread raster, pixel diff) before building
  the full loop.
- **Worker bundling** — the worker dynamically imports `h264-mp4-encoder`
  (already done in `video-export.worker.ts`); mirror that import style.

## Testing

- `npm run check` clean (capture once, grep many).
- Spike: worker-rasterized frame vs main-thread frame — confirm visual parity.
- Runtime (dev :5174, never :5173), test route (mobile + Desktop preset) + real
  `MandalaPane`:
  - Tray opens; loops/fidelity/fps update estimate live.
  - Export → takeover; progress advances; **undulation never freezes during
    encode at 4K** (core requirement, the prototype's failure).
  - Output MP4 loops seamlessly (undulation, spin whole-turns, flow color);
    spin present when Loops=1.
  - Cancel aborts cleanly; forced error renders error state.
  - 2D animation export still works (shared-core regression check).
- Visual confirmation via Chrome DevTools MCP / screenshot only with explicit
  permission; otherwise report what cannot be verified.

## Build order

1. Spike: SVG raster in worker, pixel-parity vs main thread.
2. Extract `mp4-encoder-core.ts`; refactor `video-export.worker.ts` onto it;
   verify 2D export.
3. `mandala-export.worker.ts` (geometry→SVG→raster→encode loop, seamless math,
   solid-mode cache, progress/cancel).
4. Controller: worker dispatch replaces the prototype loop.
5. Extract `MandalaControlDock` + `MandalaExportTakeover`; download tray; desktop
   preset.
6. Swap `MandalaPane`; delete `MandalaViewerControls`.
7. Verify (runtime + 2D regression).
