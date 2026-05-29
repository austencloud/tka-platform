# Mandala Export Experience — Design

**Date:** 2026-05-29
**Status:** Approved (pending spec review)
**Topic:** Premium mandala download/export experience + canonical responsive control surface

## Problem

The mandala viewer's download is weak and inconsistent:

- The current export (`MandalaViewerController.handleDownload()`) is a **blocking
  main-thread frame loop** — single undulation cycle, fixed 1080/30fps, no
  repetitions, no fidelity choice, no time estimate, no progress UI. It freezes
  the undulation while encoding.
- The real viewer's mandala controls are still the desktop **side rail**
  (`MandalaViewerControls` inside `MandalaPane.svelte`). The prettier mobile
  drill-down dock (cat-bar + trays) lives only on the `/test/mandala-mobile`
  sandbox and was never ported.

Goal: make the test-route dock the **single canonical** mandala control surface
(responsive — mobile bottom sheet + desktop centered floating bar), replace the
side rail in `MandalaPane`, and build a top-tier download experience inside it —
config tray (repetitions / fidelity / fps + live estimate) and a fullscreen
export takeover with off-main-thread encoding so the mandala keeps undulating
smoothly during render.

## Goals

- One responsive control component, same underlying code for mobile + desktop.
- Replace `MandalaViewerControls` (side rail) in the real viewer.
- Download config tray mirroring the 2D animation downloader (reps / fidelity /
  fps + live device-calibrated time estimate).
- Fullscreen export takeover: live undulating mandala, progress bar,
  "don't navigate away" message, cancel — natural transitions in/out.
- MP4 encoding off the main thread so undulation never freezes.
- Reuse existing export infrastructure; no hand-rolled encoder/estimate/UI.

## Non-Goals

- No new encoder. Reuse `VideoExporter` / `video-export.worker.ts`.
- No changes to desktop non-mandala panes (2D/3D/image/split).
- Effect overrides, cinema supersampling, split composites (2D-only features) are
  out of scope for the mandala export.

## Reused Primitives (never hand-roll)

| Need | Reused source |
|---|---|
| Off-main-thread H.264 encode (WebCodecs + WASM fallback) | `animation-engine/workers/video-export.worker.ts` |
| High-level manual exporter API | `VideoExporter.createManualExporter(w,h,{fps,bitrate})` → `{addFrame(canvas), finish(): Blob, cancel()}` |
| Device-calibrated time estimate | `export-timing-tracker.ts` — `estimateExportTime(resolution, fps, singlePlayDurationSeconds, loopCount)`, `recordExportThroughput`, `hasDeviceMetrics` |
| Progress + cancel overlay baseline | `ExportProgressOverlay.svelte` (extended for fullscreen takeover) |
| Config vocabulary (loopCount 1–10, resolution tiers, fps tiers) | `export-options-state.svelte.ts` |
| Mandala geometry + SVG render | `getMandalaGeometryCalculator()`, `renderMandalaSVG()` |

## Architecture (Approach A)

### New components

**`MandalaControlDock.svelte`**
- Extracted from `/test/mandala-mobile`'s `.dock` (cat-bar + active tray +
  download button). Driven entirely by a `MandalaViewerController` prop.
- Container-query responsive:
  - narrow (< ~700px): full-width bottom sheet (today's mobile look).
  - wide (≥ ~700px): centered floating bar — `max-width ~640px`, auto-width
    buttons, all-corner radius, `bottom: 16px`, side margins auto; tray opens
    above the bar.
- Hosts all existing trays (speed, shape, spin, colors, weight, depth) plus the
  new download tray.
- All layout-shift interactions keep the slide/fade transitions added 2026-05-29
  (tray open/close, cat-swap height morph, preset-row + custom-flow collapse),
  reduced-motion gated. Hover affordances (`@media (hover:hover)`) apply on
  desktop.

**`MandalaExportTakeover.svelte`**
- Fullscreen overlay shown when `ctrl.exportPhase !== 'idle'`.
- Live `SequenceMandala` filling the pane (own rAF — keeps undulating/spinning),
  background dimmed to `ctrl.bgColor`.
- Below center: progress bar (0–100%), phase label, message
  "Please don't navigate away — your mandala is rendering.", Cancel button.
- Error state: message + Retry / Close.
- Transitions in/out with `fly`/`fade` (reduced-motion gated). Fixed-position,
  covers header + bottom bar (navigation trap).

### Controller additions (`mandala-viewer-controller.svelte.ts`)

```
// config (persisted to localStorage key "tka_mandala_export")
exportReps        = $state(3)            // 1..10, clamped
exportResolution  = $state(1080)         // 720 | 1080 | 2160
exportFps         = $state(60)           // 30 | 60

// lifecycle
exportPhase    = $state<'idle'|'capturing'|'encoding'|'complete'|'error'>('idle')
exportProgress = $state(0)               // 0..1 (capturing)
exportError    = $state<string | null>(null)

// derived
estimateSeconds = $derived(estimateExportTime(exportResolution, exportFps, period, exportReps))
hasMetrics      = $derived(hasDeviceMetrics(exportResolution))

async startExport(): Promise<void>   // replaces handleDownload body
cancelExport(): void
```

`bitrate` chosen per resolution tier (e.g. 720→6Mbps, 1080→12Mbps, 2160→40Mbps).

### Download config tray

Tapping the Download button opens a tray above the cat-bar (same mechanic as the
other cats). Contents:

- **Repetitions** — slider 1–10 with value label (matches speed/spin/depth).
- **Fidelity** — chips: `HD 720` / `Full HD 1080` / `4K 2160` (matches
  weight/shape chips).
- **FPS** — chips `30` / `60`.
- **Estimate line** — `~12s` when device-calibrated (`hasMetrics`), `≈12s`
  first-run fallback; plus total frame count. Recomputes live.
- **Primary "Export MP4" button** — calls `ctrl.startExport()`.

## Data Flow — `startExport()`

1. `exportPhase = 'capturing'`, `exportProgress = 0`, add `beforeunload` guard.
2. `const { addFrame, finish, cancel } = await new VideoExporter()
   .createManualExporter(resolution, resolution, { fps: exportFps, bitrate })`.
3. `totalFrames = ceil(period * exportFps) * exportReps`;
   `framesPerCycle = ceil(period * exportFps)`.
4. For `i` in `0..totalFrames`:
   - undulation phase = `(i % framesPerCycle) / framesPerCycle` → triangle →
     `breatheEase` → `tipDx` (same as current handleDownload).
   - rotation = continuous across the whole clip; **total rotation snapped to
     nearest whole multiple of 360°** for a seamless loop.
   - flow-color phase snapped so the clip ends on a **whole integer** number of
     color cycles (seamless color loop).
   - render SVG (`calculator.calculate` + `renderMandalaSVG`), draw to canvas
     with rotation, `await addFrame(canvas)`.
   - `exportProgress = (i + 1) / totalFrames`. If cancelled, break + `cancel()`.
   - The `await` + async SVG decode yield the main thread every frame → live
     mandala (separate rAF) stays smooth; encoding happens in the worker.
5. `exportPhase = 'encoding'`; `const blob = await finish()`.
6. `recordExportThroughput(resolution, totalFrames, durationMs)`.
7. Trigger download (`a.download = mandala-<shape>-<preset>-<reps>x.mp4`).
8. `exportPhase = 'complete'` (brief), remove `beforeunload`, then `'idle'`.

## MandalaPane swap

Replace:

```
<aside class="controls-rail">
  <MandalaViewerControls ... />
</aside>
```

with a full-bleed stage + overlay dock (same structure as the test route
`.screen`):

```
<div class="mandala-stage"> <SequenceMandala .../> </div>
<MandalaControlDock {ctrl} />
<MandalaExportTakeover {ctrl} />
```

`MandalaViewerControls.svelte` has exactly one consumer (`MandalaPane`,
grep-confirmed 2026-05-29) — delete it after the swap.

## Error Handling

- Worker/encoder failure → `exportPhase = 'error'`, `exportError` set, takeover
  shows message + Retry / Close. No silent catch.
- WebCodecs unsupported → `VideoExporter` auto-falls back to WASM (no UI branch).
- Cancel mid-flight → `cancel()` + reset to `'idle'`, no file written.
- No sequence / no steps → Export button disabled.

## Testing

- `npm run check` clean (capture once, grep many).
- Runtime (dev server :5174, never :5173) on `/test/mandala-mobile` mobile +
  new Desktop preset, and on real `MandalaPane`:
  - Download tray opens; reps/fidelity/fps change estimate live.
  - Export → takeover transition; progress advances; **undulation never freezes
    during encode** (the core requirement).
  - File downloads; cancel aborts cleanly; error state renders on forced failure.
- Visual confirmation via Chrome DevTools MCP / screenshot only with explicit
  permission; otherwise report what cannot be verified.

## Open risk

- If main-thread SVG rasterization still janks the live mandala at 2160/high
  reps, fall back to pushing SVG strings to a worker and rasterizing via
  `createImageBitmap` + `OffscreenCanvas` (precedent:
  `qr-video/workers/headless-video-renderer.worker.ts`). Not built up front —
  only if the yielding loop proves insufficient.
