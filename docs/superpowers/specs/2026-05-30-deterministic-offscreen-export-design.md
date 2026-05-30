# Deterministic Offscreen Video Export — Design

**Status:** Approved design, pending implementation plan
**Date:** 2026-05-30
**Supersedes:** the live-capture export path in `video-export-orchestrator.ts` (single-animation mode) and the P3/P5 "offscreen export" task that was reverted on the trail-density blocker.

---

## Goal

One clean, deterministic video-export path. A fresh headless `AnimationEngine` is constructed per export, stepped frame-by-frame with an **explicit fixed `dt`** (no `requestAnimationFrame`, no wall-clock), and disposed afterward. The on-screen live engine is never touched.

Eliminates, by construction:
- The live-engine hijack (registry lookup, `pauseObservation`, `resize`, `restoreSize`, `resumeObservation`).
- The trail-clear band-aid (`clearTrails` / `clearBuffers` at export start).
- Per-frame `waitForAnimationFrame` and the rAF duplicate-stamp guard reliance.
- The sparse/blobby export trails that killed the prior offscreen attempt.

Output must be visually identical to the gorgeous live canvas (parity gate), and **deterministic**: same sequence + settings → identical frames on the same machine.

---

## Architecture

Wire the already-built, currently-orphaned scaffolding into a new **offscreen export driver**, and refactor the engine's render core to be **time-pure** so live and export share one render path with no fork.

Existing scaffolding to reuse (complete + tested, dead after revert):
- `createOffscreenContext(size, options)` — `render-context-factory.ts`. Fresh `new AnimationEngine()` on a hidden detached container, size-seeded via `setInitialCanvasSize`, returns a handle with `engine`, `context`, `dispose()`.
- `assembleExportEngineProps(panelState, frame)` — `export-engine-props.ts`. Pure mapper: panel/frame → `AnimationEngineProps` (props, virtualTime, trailSettings, propTypes; omits glyph fields by design).

Three new/refactored capabilities make it deterministic and clean:

### 1. Time-pure render core (no internal clocks)

The render core becomes a pure function of `(state, time, dt)`:

- **`animation-render-loop.ts`**: the private `render(params, effectiveTime)` gains an explicit `dt` argument: `render(params, effectiveTime, dt)`. The free-running `renderLoop(currentTime)` computes `dt` from the rAF timestamp delta (`currentTime - lastFrameTime`, clamped to the existing `0.066s` ceiling) and passes it down. The export driver passes a fixed `dt = 1 / fps`.
- **`web-gl-fire-renderer.ts`** (`stepSimulation`, ~line 716): **delete** the internal `this.lastTime` tracking and the `totalDt = (now - this.lastTime) / 1000` derivation. The renderer receives `dt` as an argument and uses it directly (still sub-stepped to `MAX_SUB_DT = 0.017`, and the `turbulenceClock` still accumulates `dt`). No internal clock remains.
- **Charcoal renderer**: same change (mirror the fire renderer; the plan pins the exact file).
- **Live behavior is preserved**: live now feeds the same `dt` it would have computed from wall-clock anyway, so the only change for live is that `dt` arrives as a parameter instead of being derived inside the renderer. One time model, zero "export vs live" branches.

Add a public synchronous render entry point on `AnimationEngine`:

```
renderFrame(props: AnimationEngineProps, timeMs: number, dt: number): void
```

It calls `render()` directly (synchronously), bypassing `triggerRender`/`needsRender`/rAF. After it returns, the base layer + every overlay (trail, fire, charcoal, led, …) is drawn for that frame. The offscreen engine's rAF loop is never started.

### 2. Pure positional sampler (no global mutation)

Today `calculateState(step)` / `calculateStateForStep(step)` **mutates** the shared `animationStateService` and there is no side-effect-free "prop state at position X" query. Add one:

```
// SequenceAnimationOrchestrator (or PropInterpolator)
samplePropStateAt(step: number): { blue: PropState; red: PropState }
```

Runs the same beat-fraction interpolation (`calculateBeatState` + `interpolatePropAngles`) but **returns** the prop states instead of writing them to the shared service. Used to generate trail sub-step positions without thrashing global state, and reusable anywhere a positional query is needed.

### 3. Adaptive sub-stepped trail accumulation

Live trails are dense because the free-running rAF stamps ~60×/s through continuous motion; the export advances one beat-step per frame and stamps once → sparse. Fix deterministically:

Per output frame, the driver walks the beat position `prevPos → curPos` and stamps trail points at interpolated sub-positions matching live's distance-gating (`DEFAULT_POINT_SPACING = 0.75px`, `trail-capturer.ts`):

1. Compute sub-step count `N` adaptively from prop-tip travel distance ÷ spacing, capped (`MAX_SUBSTEPS ≈ 32`) to bound cost on loop-seam jumps.
2. For `k` in `1..N`: `props_k = samplePropStateAt(lerp(prevPos, curPos, k/N))`; `trailCapturer.captureFrame(props_k, step, subTime_k)` where `subTime_k` interpolates `virtualTime` across the frame. The capturer's existing distance-gate dedups naturally.
3. Render the frame once with the **final** props (`props` at `curPos`) via `renderFrame` — base shows the prop at frame position; the trail overlay shows the accumulated ribbon.

The rAF duplicate-stamp guard is irrelevant here — the driver calls `captureFrame` directly, not through the render loop.

### 4. Offscreen export driver

New orchestration replacing the live-capture body of `executeExport` for single-animation mode:

1. `createOffscreenContext(outputCanvasSize)` → fresh engine on a hidden container, seeded to output size.
2. **Deterministic fire/charcoal warmup** (only if those effects are active): `N` synchronous `renderFrame` calls at step 0 with fixed `dt` to converge the fluid sim from zero, then thermal-clear. Replaces the 60× `waitForAnimationFrame` warmup. Warmup frame count + `dt` chosen to reproduce live convergence.
3. Per output frame `i`: compute beat position (existing time→beat logic) → `assembleExportEngineProps` → adaptive sub-step trail capture (§3) → `engine.renderFrame(props, virtualTime, dt)` → composite offscreen canvas + overlays via `ExportFrameCompositor` (**unchanged**) → `renderOverlays` glyph/header/progress (**unchanged**) → `getImageData` → `backgroundEncoder.addFrame` (**unchanged**).
4. `dispose()` the offscreen context in `finally`.

---

## Data flow (per export frame)

```
panelState + frame ctx
  → assembleExportEngineProps(props, virtualTime, dt)
  → [adaptive sub-loop k=1..N:
        samplePropStateAt(lerp(prevPos,curPos,k/N))
        → trailCapturer.captureFrame(props_k, step, subTime_k)]
  → engine.renderFrame(finalProps, virtualTime, dt)   // base + trail + fire/charcoal/led drawn
  → ExportFrameCompositor.renderCanvasLayers + renderOverlays   // unchanged
  → offscreenCtx.getImageData (flattened over black — shipped fix)
  → backgroundEncoder.addFrame   // unchanged (H.264 High / AV1 4:4:4)
```

---

## What is deleted

- Resize hack: `getRenderContextRegistry().getAll().find(...)`, `resizer.pauseObservation/resumeObservation`, `liveContext.resize/restoreSize` in `video-export-orchestrator.ts`.
- Trail-clear band-aid: `liveContext.trailCapturer.clearTrails()` + `trailOverlay.clearBuffers()` at export start.
- Per-frame `waitForAnimationFrame` capture wait.
- The fire/charcoal internal `lastTime` clock.

The render-context **registration fix** (`CanvasSurface` registers after async init resolves) stays — it is correct regardless, and the live engine still needs a registered context for non-export features.

## What is untouched

- Encoder/worker/codec (`background-video-encoder.ts`, `video-export.worker.ts`) — handoff is pixel-format-identical.
- `ExportFrameCompositor` glyph / step-number / word-header / progress-bar / path-line overlays — engine-agnostic.
- Composite-grid mode — already uses a separate `CompositeVideoRenderer`, independent of the live/offscreen engine.
- Shipped export fixes: alpha-flatten-over-black, H.264 High profile, AV1 4:4:4 codec option.

---

## Determinism guarantees and limits

- **Guaranteed:** same sequence + settings + machine → identical frames every run. Achieved via fixed-`dt` stepping, the time-pure render core, no rAF, and no RNG in the effect path (fire/charcoal use time-accumulated curl-noise, not `Math.random`).
- **Not guaranteed / not required:** byte-identical frames across different GPUs (WebGL float differences). The bar is **visual parity with the live canvas**, not cross-machine bit-equality.

---

## Error handling

- `createOffscreenContext` failure → throw, abort export. No silent fallback to the live path.
- Offscreen WebGL context loss → surface error, abort (never emit half-rendered frames).
- `dispose()` the offscreen context in `finally` on success, error, and cancel.

---

## Testing / parity gate

No feature flag (project rule): land behind the parity gate, then delete the live-capture body.

- **Parity (extend `/test/trail-export-parity`):** export a sequence through the **offscreen** path, decode the MP4, and diff against a **live-canvas** reference rendered at matched `virtualTime`s. Gate at the established body-parity threshold (~Δ32, <0.5% body pixels). Cover a trail-heavy sequence and add a **fire/charcoal** visual-parity case.
- **Determinism test:** export the same sequence twice → frames identical within epsilon on the same machine.
- **Unit tests:** `assembleExportEngineProps` (exists); `samplePropStateAt` returns correct interpolated state with no global mutation; adaptive sub-step count math (distance ÷ spacing, capped); fire/charcoal `stepSimulation` advances by the passed `dt` (deterministic) and ignores wall-clock.
- **Regression:** live preview unchanged — a frame rendered through the new time-pure path with rAF-derived `dt` matches the pre-refactor live render.

---

## Scope / non-goals

**In scope:** single-animation export (mp4/webm) for all effects (trails, led, fire, charcoal, none), fully deterministic, offscreen.

**Out of scope:** composite-grid mode (unaffected, separate renderer); the encoder/codec (done); promo-generator and qr-video exporters (separate pipelines); cross-GPU byte determinism; WebGPU migration (separate backlog project); temporal supersampling / motion blur (deliberately rejected — would blur the props and break TKA's crisp-prop aesthetic).

---

## File map

**Create:**
- `offscreen-export-driver.ts` (feature/compose/services) — the new deterministic driver. Grep first for an existing export-orchestration seam to extend rather than a parallel class.

**Modify:**
- `animation-render-loop.ts` — `render(params, time, dt)`; compute live `dt` from rAF delta; pass `dt` down.
- `animation-engine.svelte.ts` — public `renderFrame(props, timeMs, dt)` (synchronous render entry).
- `fire/web-gl-fire-renderer.ts` + charcoal renderer — accept explicit `dt`, delete internal `lastTime`.
- `sequence-animation-orchestrator.ts` (or `prop-interpolator.ts`) — `samplePropStateAt(step)`.
- `video-export-orchestrator.ts` — route single-animation export through the offscreen driver; delete resize hack + trail-clear band-aid + per-frame `waitForAnimationFrame`.
- `render-context-factory.ts` / `export-engine-props.ts` — wire the dead-but-complete scaffolding into the live path; remove "dead code" status.
- `routes/test/trail-export-parity/+page.svelte` — add the offscreen-vs-live parity + determinism + fire cases.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Time-pure refactor changes live rendering for every consumer (large blast radius) | `dt` for live = exactly the wall-clock delta it derived before; regression test asserts live frames match pre-refactor. Land the render-core refactor first, verify live unchanged, then build the driver on top. |
| Fire/charcoal warmup via synchronous stepping doesn't converge like live | Pin warmup frame count + `dt` to reproduce the live 60-frame convergence; fire visual-parity case in the gate. |
| Adaptive sub-step cost on huge prop jumps (loop seams) | Cap `N` at `MAX_SUBSTEPS`; seam jumps are rare and bounded. |
| Offscreen WebGL context limits (many exports) | Fresh-per-export + `dispose()` releases the context each time; abort on context loss. |

---

## Sequencing (for the plan)

1. **Time-pure render core** — `dt` parameter through `render` + fire/charcoal; delete internal clocks; live regression-tested unchanged. (Foundational, isolated.)
2. **Synchronous `renderFrame` + `samplePropStateAt`** — the two pure entry points.
3. **Offscreen export driver** — wire scaffolding, adaptive sub-step trails, deterministic warmup; delete the live-capture hacks.
4. **Parity + determinism gate** — extend the harness; verify; then remove the old path.
