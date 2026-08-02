# Mandala Video Export — Design

Date: 2026-07-11. Approved by Austen (approach A, two equal buttons, seamless 20s loop).

## Problem

In the Playground mandala surface (`MandalaModule.svelte` → tap a mandala → detail
drawer), the only export is a **broken** "Export PNG" button, and there is no way
to take home the mandala in motion. Austen wants the animated (breathing +
rotating) mandala exportable as an MP4, presented alongside the still as two
equal actions.

Two independent defects/gaps:

1. **PNG is broken.** `exportMandalaPNG` (`tabs/export/services/mandala-export.ts`)
   hand-rolls an SVG→`Image`→`<canvas>` rasterize. But `renderMandalaSVG`
   (`shared/mandala/services/mandala-renderer.ts:136`) emits the root `<svg>` with
   `width="100%" height="100%"` and only a `viewBox` — no intrinsic pixel size.
   When such an SVG is loaded via `new Image()` and drawn with
   `ctx.drawImage(img, 0,0,size,size)`, the image has no natural dimensions, so
   the draw yields a blank (or 0-sized) result: the downloaded PNG is empty. The
   codebase already has a direct canvas renderer, `renderMandalaToCanvas`
   (`mandala-renderer.ts:241`), which the export path ignores.

2. **No video export on this surface.** A full off-thread MP4 pipeline already
   exists — `mandala-export.worker.ts` (per-frame Path2D render + rotation +
   H.264 via mediabunny/WebCodecs, WASM fallback) with seamless-loop math in
   `mandala-frame-renderer.ts` — but it is only wired into the sequence-viewer's
   `MandalaViewerController`. The Playground `MandalaModule` never adopted it.

## Reuse inventory (never-hand-roll)

Confirmed existing primitives — nothing new gets encoded or rasterized by hand:

- **`shared/mandala/services/mandala-renderer.ts` → `renderMandalaToCanvas(ctx, paths, opts)`**
  — draws a single mandala frame straight to a 2D context (used by the frame
  renderer). The PNG fix routes through this instead of the percentage-SVG dance.
- **`shared/mandala/workers/mandala-export.worker.ts`** — the whole video pipeline
  off the main thread. Message-in: `{ type: "start", spec: MandalaFrameSpec, bitrate }`
  and `{ type: "cancel" }`. Message-out (`MandalaExportOut`): `diag`, `progress`
  (`{frameIndex,totalFrames}`), `finalizing`, `complete` (`{buffer}`), `error`.
- **`shared/mandala/services/mandala-frame-renderer.ts` → `MandalaFrameSpec`,
  `deriveLoopMath`** — guarantees seamless loops: `turns = max(1, round(...))`
  snaps rotation to whole turns; undulation repeats whole cycles. So any `reps`
  produces a clean loop.
- **`shared/foundation/services/file-downloader.ts` → `shareOrDownloadBlob(blob,
  filename, {title})`** — device-aware delivery (mobile share sheet / desktop
  download). Reused verbatim.
- **`shared/pictograph/prop/domain/prop-tip-ends.ts` → `pairTipEnds`** and
  **`shared/mandala/services/mandala-geometry-calculator.ts` → `calculate`** — the
  PNG path already uses these; retained.

### The seamless-20s mapping (verified against `deriveLoopMath`)

`reps: 4`, `period: 5` (`BASE_PERIOD`), `rotation: 90` →
- duration = `period * reps` = **20s**, 4 breathing cycles;
- `turnsRaw = (period*reps / ROTATION_REF_PERIOD) * rotation / 360 = (20/5)*90/360 = 1.0`
  → **exactly one full 360° turn**, seamless.

These are the Playground's video defaults. (The module already declares
`BASE_PERIOD = 5`; `ANIMATE_MAX = 250` maps to `rangeMax`.)

## Approach A — extract a shared video-export service

`MandalaViewerController.startExport()` currently inlines ~90 lines of worker
orchestration (construct cache-busted worker URL, wire `onmessage`/`onerror`,
translate messages to phase/progress, `beforeunload` guard, dispose). That block
is surface-agnostic. Extract it so both the sequence viewer and the Playground
drive the worker through one code path.

### New unit: `shared/mandala/services/mandala-video-exporter.ts`

```ts
export interface MandalaVideoExportHandle {
  /** Resolves with the finished MP4 blob, or rejects on error/cancel. */
  readonly done: Promise<Blob>;
  cancel(): void;
}

export interface MandalaVideoExportCallbacks {
  onPhase?: (phase: "capturing" | "encoding") => void;
  onProgress?: (fraction: number) => void;   // 0..1
  onDiag?: (diag: MandalaExportDiag) => void; // optional live diagnostics
}

/**
 * Spin up the mandala export worker for one clip and return a handle.
 * Owns: cache-busted worker construction, message protocol, beforeunload
 * guard, and teardown. Does NOT own delivery (shareOrDownloadBlob) or any
 * viewer look-state — callers pass a fully-built spec and deliver the blob.
 */
export function exportMandalaVideo(
  spec: MandalaFrameSpec,
  bitrate: number,
  callbacks?: MandalaVideoExportCallbacks,
): MandalaVideoExportHandle;
```

Responsibilities pulled out of the controller, unchanged in behavior:
- `?worker&url` import + `?v=<time>` cache-bust + `new Worker(url,{type:"module"})`.
- `onmessage` switch (`diag`/`progress`/`finalizing`/`complete`/`error`) mapped to
  the callbacks + promise resolution; `onerror` → reject.
- `beforeunload` guard added on start, cleared on settle.
- `worker.terminate()` on complete/error/cancel.

Bitrate stays the caller's choice (the controller keeps its `BITRATE_BY_RES`
table; the Playground reuses the same table via a small shared const — see
below).

### Refactor: `MandalaViewerController.startExport()`

Replace the inline worker block with a call to `exportMandalaVideo(spec, bitrate,
{ onPhase, onProgress, onDiag })`; keep the controller's existing state
(`exportPhase`, `exportProgress`, `lastExportDiag`, `exporting`), the throughput
recording, and the `shareOrDownloadBlob` delivery in the `done`/`onProgress`
handlers. Net behavior identical; the sequence-viewer mandala export must remain
byte-for-byte equivalent (same spec, same bitrate, same filename).

`BITRATE_BY_RES` moves to the service module (or a sibling const module) and both
the controller and the Playground import it, so bitrate policy has one home.

### Playground wiring: `MandalaModule.svelte` + its export service

- **PNG fix** (`tabs/export/services/mandala-export.ts`): replace the SVG-rasterize
  body of `exportMandalaPNG` with a `renderMandalaToCanvas` draw onto the export
  canvas (compute `paths` via the existing `calculateMandalaGeometry` + `pairTipEnds`,
  then `renderMandalaToCanvas(ctx, paths, { size, style:"stroke", show:"both",
  strokeWidth, offsetX:0, offsetY:0, ... })`), then `canvas.toBlob("image/png")`.
  Background fill unchanged. `downloadBlob` unchanged. `renderMandalaSVG` is left
  as-is (other callers rely on the responsive `100%` SVG; only the export stops
  using it for rasterization).
- **New Playground video service** (`tabs/export/services/mandala-video.ts`, thin):
  `buildMandalaVideoSpec(selectedMandala, { reps, resolution, fps, rangeMax,
  period, rotation }): MandalaFrameSpec` (plain-clones steps like the controller
  does), plus a `runMandalaVideoExport(...)` that calls `exportMandalaVideo` and
  delivers via `shareOrDownloadBlob`. Keeps `MandalaModule.svelte` lean.
- **Detail drawer UI** (`detailView` snippet): the current single
  `class="action-btn export-btn"` ("Export PNG") becomes **two equal buttons** in
  the `.detail-actions` row: **"Download Video"** (primary intent, `fa-film`/`fa-video`)
  and **"Download PNG"** (`fa-image`). Both are the existing `.action-btn` primitive
  at the 44px touch floor (design-system mandatory) — no new button primitive, no
  raw chips. "Meditate" stays. **Both buttons download directly** with defaults —
  symmetric behavior: video uses the fixed seamless-20s spec; PNG uses the current
  export defaults (2160px / transparent, from `DEFAULT_EXPORT_OPTIONS`). The old
  `phase = "export"` options screen (resolution / background chips) is **removed**
  along with its state (`phase === "export"` branch, `resolution`/`background`/
  `strokeWidth` chips, `backToDetail`) to avoid dead UI (`cruft`); a PNG-options
  affordance is a future enhancement, not v1 (YAGNI). If removing that screen
  collides with the other agent's work, leave it in place and just stop routing to
  it from the detail drawer — either way the two direct-download buttons are the
  path.
- **Video export state**: local `$state` (`videoExporting`, `videoProgress`,
  `videoPhase`) drives a small inline progress affordance on the "Download Video"
  button (spinner + `%`, `tabular-nums` so it doesn't jitter —
  `no-layout-shift.md`). No fullscreen takeover in v1; the drawer stays put.
  `shareOrDownloadBlob` handles delivery. Errors → `toast.error(...)` (same toast
  already imported for PNG).

## Data flow

```
[Download PNG]  selectedMandala ─► calculateMandalaGeometry ─► renderMandalaToCanvas
                                     (+ pairTipEnds)             ─► canvas.toBlob(png) ─► downloadBlob
[Download Video] selectedMandala ─► buildMandalaVideoSpec ─► exportMandalaVideo(spec,bitrate)
                                     (reps4/period5/rot90)   ─► worker (render+H.264) ─► Blob
                                                             ─► shareOrDownloadBlob(mp4)
```

## Error handling

- **PNG**: `canvas.toBlob` null or geometry failure → caught, `toast.error`, button
  re-enables (existing pattern in `handleExport`).
- **Video**: worker `error`/`onerror` → `exportMandalaVideo` promise rejects →
  `toast.error`, state reset, worker terminated. `beforeunload` guard prevents a
  half-encoded clip from being silently lost on navigation (owned by the service).
- **Cancel**: navigating away / closing the drawer mid-encode calls
  `handle.cancel()` (posts `{type:"cancel"}`, terminates worker). Wire to the
  drawer's close and component destroy.

## Testing

- `npm run check` clean (both files + the refactored controller typecheck).
- **PNG regression** (the actual bug): unit-render `exportMandalaPNG` for a known
  sequence in jsdom/happy-dom is unreliable (canvas rasterization), so verify via
  CDP: open Playground → mandala → Download PNG → assert a non-empty PNG blob with
  non-transparent pixels (sample the center). Before/after: broken (blank) → fixed
  (visible mandala).
- **Video**: CDP export at 720p/lowest reps for speed → assert an MP4 blob > 0
  bytes and `video/mp4` type, and that `deriveLoopMath` for the default spec
  returns `turns === 1`, `totalFrames === framesPerCycle * 4` (pure unit test, no
  browser — locks the seamless-20s contract).
- **Controller parity**: a focused assertion that the refactored
  `MandalaViewerController.startExport()` posts the identical `{spec, bitrate}` it
  did before (spec snapshot test), so the sequence-viewer path is unchanged.

## Coordination note

A second agent may be editing the mandala area. `MandalaViewerController` is the
one shared file this touches. The implementer commits with an explicit pathspec
(`commit-only-your-own-changes.md`), rebases understanding on `git status` before
editing the controller, and if the controller shows uncommitted changes from the
other agent, pauses and coordinates rather than overwriting. The PNG fix, the new
service, and the Playground wiring are independent of the controller refactor and
can land first.

## Non-goals (v1)

- A resolution/fps/reps options UI for video (fixed seamless-20s defaults), and no
  PNG options UI either — both export at defaults (the old PNG options screen is
  dropped, per the detail-drawer section).
- A fullscreen export takeover in the Playground (inline button progress only).
- Changing `renderMandalaSVG` (its responsive `100%` output is correct for live
  DOM rendering; only the export stops rasterizing it).
- Touching the sequence-viewer mandala UX beyond the transparent service extraction.
```
