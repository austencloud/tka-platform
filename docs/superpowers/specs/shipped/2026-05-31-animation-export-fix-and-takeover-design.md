# Animation Export — Props Fix, No-Freeze, Codec Fix, Shared Takeover

**Date:** 2026-05-31
**Status:** Design approved, ready for plan
**Scope:** Fix the production animation-export pipeline (props missing, 0%-forever hang, frozen canvas) and add a gorgeous Mandala-style screen-takeover during export, extracted as a shared primitive.

---

## Problem

Exporting an animation from production — especially via the QR-scan minimalist viewer (`/q/[code]`), on both desktop and mobile — fails three ways:

1. **Props/staffs do not appear** in the exported video (grid + trails render, staves missing).
2. **Export stays at 0% forever**: the progress bar never advances and the spinner never clears.
3. **The animation canvas freezes** for the whole export instead of continuing to play.

All three reproduce on the current `main`. The export files are committed (not in-flight edits).

---

## Root causes (verified at source)

### Bug A — Props missing
The non-composite (`compositeMode: "none"`) export builds a **fresh offscreen `AnimationEngine`** via `RenderContextFactory.createOffscreenContext` → `engine.initialize(container, {})` (`render-context-factory.ts:57`, empty props). The orchestrator hands the offscreen renderer `bluePropType: null, redPropType: null` (`video-export-orchestrator.ts:408-409`) with a comment admitting the author could not locate the prop-type source.

- The offscreen engine boot-loads prop textures from the **global `settingsService.settings`** (`prop-type-manager.ts:285-289`, default `"staff"`).
- The renderer draws prop bodies only when an image exists: `if (bluePropImage) {...}` / `if (redPropImage) {...}` (`canvas-2d-animation-renderer.ts:457, 513`); `renderProp` early-returns on null (`:588`).
- On the **QR landing page** there is **no DI/settings bootstrap** (landing mode — `composition-root` never imported). The user's chosen prop lives in the page-local `selectedProp` (`q/[code]/+page.svelte:112, 351`), never in `settingsService`. So the second engine boots with default/blank prop state and the user's prop is never loaded.
- The renderer already exposes `loadPerColorPropTextures(bluePropType, redPropType, darkMode)` (`canvas-2d-animation-renderer.ts:295`). The offscreen `initialize()` calls `loadGridTexture` (`offscreen-export-renderer.ts:114`) but has **no equivalent prop-texture call**.

Two secondary inputs are also hardcoded in the export path and diverge from live:
`previewDarkMode: null` (`offscreen-export-renderer.ts:210`) and `showNonRadialPoints: true` (`:205`).

### Bug B — Canvas freezes during export
The non-composite capture loop (`video-export-orchestrator.ts:482-699`) runs as **one synchronous main-thread task**: each iteration does a synchronous offscreen WebGL render + a full-canvas `getImageData` readback + `postMessage`, with **no `await` that yields to the event loop**. (The composite path already `await this.waitForAnimationFrame()` at `:542`; the offscreen path does not.) The browser cannot paint, so the live canvas's rAF loop starves and the on-screen animation freezes; the Svelte progress update can't flush either.

### Bug C — Stuck at 0% forever
Two un-timed `await`s run **before the first `onProgress` tick**:
- `backgroundEncoder.initialize()` (`video-export-orchestrator.ts:201`) resolves only when the worker posts `"ready"` (`background-video-encoder.ts:78-93`). The worker defaults to `codec ?? "av1"` (`video-export-orchestrator.ts:211`) → `selectCodecAv1(..., "10")` → **`av01.1.08M.10` (10-bit AV1)** (`video-export.worker.ts:374, 198-207`). Web research: 10-bit AV1 **encode** support is ~8% of sessions; H.264 has hardware encode on essentially every device of the last decade ([WebCodecs Fundamentals 2026](https://webcodecsfundamentals.org/datasets/codec-analysis-2026/)). On Safari/mobile the AV1 `configure()` can stall with no `"ready"` and no error → `initialize()` never resolves → `executeExport` is suspended at `:201`, the `finally` (`:736`) never runs, `isExporting` stays true, the bar sits at exactly 0%.
- There is **no timeout** around the worker handshake (`background-video-encoder.ts:78-93`) or the second WebGL2 context creation (`:401`).

The **mandala** export worker (which works on mobile) is the proven reference: **H.264-only, platform-aware** — `avc1.42e0xx` (Constrained Baseline) on mobile, `avc1.6400xx` (High) on desktop, `isConfigSupported` probe + graceful fallback (`mandala-export.worker.ts:111-141, 236-242`). The animation worker should mirror it.

---

## Design

### Part 1 — Bug fixes

**A. Props end-to-end.**
1. `export-options-state.svelte.ts` `VideoExportOptions` gains `bluePropType?: string` / `redPropType?: string` (and getters/persist if surfaced; not user-facing — resolved at call time).
2. `q/[code]/+page.svelte handleDownload` passes `bluePropType: selectedProp, redPropType: selectedProp` (it already holds `selectedProp`).
3. The AnimationPanel/app path resolves `settingsService.settings.bluePropType ?? settingsService.settings.propType ?? "staff"` for both colors.
4. `video-export-orchestrator.ts` stops hardcoding `null` (`:408-409`); forwards the resolved types into `OffscreenExportInit`. Also forwards real `previewDarkMode` and `showNonRadialPoints` (currently hardcoded) so dark mode + non-radial points match the live view. Where the orchestrator can't see them, thread from the caller via options.
5. `OffscreenExportRenderer.initialize()` calls `this.handle.context.renderer.loadPerColorPropTextures(bluePropType, redPropType, darkMode)` immediately after the existing `loadGridTexture` call — the direct mirror of the grid fix. This also corrects `state.bluePropDimensions/redPropDimensions` from the real SVG viewBox (`prop-type-manager.ts:307-308` path), so prop scaling is right.
6. Resolution order for the type string mirrors live: explicit option → `settingsService.settings.bluePropType` → `.propType` → `"staff"`.

**B. Yield to repaint.**
Add `await this.waitForAnimationFrame()` once per iteration of the non-composite capture loop (`video-export-orchestrator.ts:482-699`), matching the composite branch. The browser repaints between captured frames, so the live canvas keeps animating and the progress bar advances. (The offscreen engine is deterministic and unaffected by the yield.)

**C. Codec — mirror the mandala worker (H.264, platform-aware).**
In `video-export.worker.ts`:
- Default to **H.264**, not AV1. Adopt the mandala worker's platform-aware `selectCodec`: `avc1.42e0{level}` (Constrained Baseline) on mobile, `avc1.6400{level}` (High) on desktop, with the existing resolution→level mapping.
- Keep the `isConfigSupported` probe; configure HW config if supported, else base config.
- AV1 becomes opt-in only (retain the path behind an explicit `codec: "av1"` for callers who ask; default callers never hit it). 8-bit if ever used, never 10-bit by default.
- In `background-video-encoder.ts initialize()`, wrap the `"ready"` handshake in a **timeout** (reject after a bounded interval, e.g. 15s) so a stalled `configure()` rejects → `executeExport` catch runs → `finally` resets `isExporting` and the takeover shows an error instead of hanging at 0% forever. Apply the same bounded-wait safety to the offscreen WebGL init await.

### Part 2 — Shared `ExportTakeover` primitive

Per `never-hand-roll`, extract the Mandala takeover pattern into a controller-agnostic shared component instead of duplicating it.

**New:** `src/lib/shared/video-export/components/ExportTakeover.svelte`
Props (all plain, no controller coupling):
- `phase: "idle" | "capturing" | "encoding" | "complete" | "error"`
- `progress: number` (0..1)
- `phaseLabel: string`
- `error?: string | null`
- `onCancel?: () => void`
- `onRetry?: () => void`
- `centerpiece?: Snippet` (optional — Mandala passes its `SequenceMandala`; animation export passes nothing, letting the live canvas show through)
- `diag?: Snippet` (optional floating diagnostics card — Mandala passes its existing card)
- `opaque?: boolean` (Mandala = true with its own bg; animation = false → dim scrim)

Behavior:
- **Dim scrim** by default (`rgba(0,0,0,0.85)` + `backdrop-filter: blur(10px)`, between the modal and spotlight precedents), `position: absolute; inset: 0; z-index: var(--z-overlay, 500)`. NOT opaque — the real live canvas stays visible underneath. With freeze fix B, the live canvas **scrubs through the sequence as it renders** (the exporter drives the shared `playbackController`/`panelState`) — a truthful "watch it render" effect, props/trails all live.
- **Centered glass panel:** `var(--theme-panel-bg)` + `var(--theme-stroke-strong)` border + the modal deep-shadow recipe + an accent-glow ring; `border-radius: var(--modal-border-radius, 20px)`.
- **Progress visual:** a **conic-gradient ring** sweeping the brand prop-trail colors `#3575E2 → #ED1C24` (the blue/red motion colors) with the `%` centered, `font-variant-numeric: tabular-nums`. Built on the existing `ProgressRing.svelte` styling vocabulary (stroke-dashoffset / conic sweep). The "circle filling up" the user pictured, uniquely TKA.
- **Copy:** "Please don't navigate away." Cancel button (transparent + `--theme-stroke`, hover → `--semantic-error`), per `ExportProgressOverlay.svelte:81-95`. Error state → message + Close/Retry.
- **`beforeunload` guard** while `phase !== "idle"` (lifted from the Mandala controller pattern, `mandala-viewer-controller.svelte.ts:342-346`).
- **No-layout-shift:** ghost-sizer or reserved width on the phase label ("Capturing" vs "Encoding…" differ in width); `tabular-nums` on `%`.
- **Reduced motion:** all transitions through a `dur()` helper returning 0 under `prefers-reduced-motion`.
- Theme-adaptive: consumes `--theme-*` with `var(--token, fallback)` for every token the QR page's fixed theme block omits (it lacks `--theme-accent-glow`/`-strong`/`panel-shadow`).

**Refactor:** `MandalaExportTakeover.svelte` becomes a thin wrapper that renders `ExportTakeover` with `opaque={true}`, its `SequenceMandala` via the `centerpiece` snippet, and its diagnostics card via the `diag` snippet — zero behavior loss, single overlay to maintain.

**Mount points:**
- `q/[code]/+page.svelte`: render `ExportTakeover` driven by `exportProgress.stage`/`.progress` + `isExporting`, mapping `stage → phase`.
- `AnimationPanel.svelte`: same, replacing/feeding the inline mobile progress block (`:493-517`) so desktop + mobile both get the takeover.

### Files

**New:** `src/lib/shared/video-export/components/ExportTakeover.svelte`
**Edit:**
- `src/lib/shared/animation-panel/state/export-options-state.svelte.ts` (prop-type fields)
- `src/lib/features/compose/services/video-export-orchestrator.ts` (forward prop types + previewDarkMode + showNonRadialPoints; default codec h264; yield per loop)
- `src/lib/shared/video-export/services/offscreen-export-renderer.ts` (loadPerColorPropTextures in initialize; accept previewDarkMode/showNonRadialPoints)
- `src/lib/shared/video-export/services/export-engine-props.ts` (thread real previewDarkMode/showNonRadialPoints instead of null/true)
- `src/lib/shared/animation-engine/workers/video-export.worker.ts` (platform-aware H.264 default, mirror mandala selectCodec)
- `src/lib/shared/animation-engine/services/background-video-encoder.ts` (timeout-wrap the ready handshake)
- `src/routes/q/[code]/+page.svelte` (pass prop types; mount ExportTakeover)
- `src/lib/shared/animation-panel/components/AnimationPanel.svelte` (mount ExportTakeover)
- `src/lib/shared/sequence-viewer/components/MandalaExportTakeover.svelte` (refactor to consume ExportTakeover)

---

## Testing

**Unit (Vitest):**
- `export-engine-props` / options: resolved prop types propagate (not null) and `previewDarkMode`/`showNonRadialPoints` are threaded.
- `background-video-encoder`: `initialize()` rejects after the timeout when no `"ready"` arrives (no infinite hang).
- worker `selectCodec`: returns Constrained-Baseline on mobile UA, High on desktop; default codec is H.264 not AV1.

**Runtime (user-verified in browser — flaky tooling means I cannot screenshot):**
1. Scan a QR / open `/q/[code]` → click Export.
2. Props/staves are visible in the takeover's live canvas and in the downloaded MP4.
3. The conic ring advances 0 → 100% (no longer stuck at 0%).
4. The animation keeps moving under the dim scrim during export.
5. The MP4 downloads and plays with props.
6. Repeat in the main app's AnimationPanel (desktop + mobile widths).

---

## Out of scope
- Independent normal-speed loop centerpiece (user chose scrub-with-export).
- AV1 quality toggle UI (user chose H.264-only, mirror mandala).
- Retiring the legacy `video-pre-renderer.ts` MediaRecorder path (separate cleanup).
