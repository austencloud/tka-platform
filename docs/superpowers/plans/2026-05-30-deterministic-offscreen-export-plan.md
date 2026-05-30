# Deterministic Offscreen Video Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the live-engine-capture video export with a deterministic, headless offscreen render path that produces frames identical to the live canvas with no rAF reliance, no live-engine mutation, and no trail-clear band-aid.

**Architecture:** Make the render core time-pure (effects step on an explicit `dt`, internal wall-clock removed), add a synchronous render entry point and a side-effect-free prop sampler, then drive a fresh offscreen `AnimationEngine` frame-by-frame with fixed `dt`, over-sampling trail sub-positions so the capturer's existing 0.75px distance-gate reproduces live trail density.

**Tech Stack:** Svelte 5 + TypeScript, WebGL2 (fire/charcoal fluid sim), Canvas2D (trails/led), WebCodecs/mediabunny (encoder — unchanged), Vitest.

**Spec:** `docs/superpowers/specs/2026-05-30-deterministic-offscreen-export-design.md`

---

## Git discipline (ENFORCED — active multi-agent race on main)

Every commit MUST be path-limited to the files that task touched:
`git commit -m "msg" -- <explicit paths>`. NEVER `git add -A`/`.`, NEVER `reset`/`rebase`/`amend`/`stash`/rewrite history. Subagents MUST NOT run on Opus 4.7 (omit the model param to inherit 4.8, or use sonnet).

## Keep (do not touch / do not regress)

- Render-context registration fix in `CanvasSurface.svelte` (register after async init resolves).
- Alpha-flatten-over-black before encode in `export-frame-compositor.ts`.
- H.264 High profile + AV1 4:4:4 codec option in `video-export.worker.ts` / `video-export-calculations.ts`.

## Out of scope

Composite-grid mode (separate `CompositeVideoRenderer`), encoder/codec, promo-generator + qr-video exporters. Cross-GPU byte determinism (bar is visual parity + same-machine reproducibility).

## Fast checks during iteration

Run `npm run check:watch` in the background. One full `npm run check` before each commit. Vitest: `npx vitest run <file>`.

---

## File Structure

**Modify:**
- `src/lib/shared/animation-engine/services/fire/web-gl-fire-renderer.ts` — fire sim steps on explicit `dt`; delete `lastTime`.
- `src/lib/shared/animation-engine/services/charcoal/charcoal-spark-renderer.ts` — charcoal sim steps on explicit `dt`; delete `lastTime`.
- `src/lib/shared/animation-engine/domain/types/FireTypes.ts` (or wherever `FireFrameInput` is defined) — add `dt: number`.
- `src/lib/shared/animation-engine/services/animation-render-loop.ts` — `render()` threads `dt` to fire/charcoal input; add public `renderSync()`.
- `src/lib/shared/animation-engine/services/animation-engine.svelte.ts` — public `renderFrame(props, timeMs, dt)`.
- `src/lib/shared/animation-engine/services/sequence-animation-orchestrator.ts` — pure `samplePropStateAt(step)`.
- `src/lib/features/compose/services/video-export-orchestrator.ts` — route single-animation export through the new driver; delete resize hack + trail-clear + per-frame `waitForAnimationFrame`.

**Create:**
- `src/lib/features/compose/services/offscreen-export-renderer.ts` — owns the offscreen context, deterministic warmup, per-frame render + sub-step trail accumulation.
- `src/lib/features/compose/services/export-substep.ts` — pure sub-step-count helper.

**Test:**
- `tests/unit/animation-engine/fire-explicit-dt.test.ts`
- `tests/unit/animation-engine/sample-prop-state-at.test.ts`
- `tests/unit/compose/export-substep.test.ts`
- `src/routes/test/trail-export-parity/+page.svelte` — extend (offscreen-vs-live + determinism + fire cases).

---

# Phase 1 — Time-pure render core

### Task 1: Fire renderer steps on explicit `dt`

**Files:**
- Modify: `src/lib/shared/animation-engine/domain/types/FireTypes.ts` (find `FireFrameInput` — grep `interface FireFrameInput`)
- Modify: `src/lib/shared/animation-engine/services/fire/web-gl-fire-renderer.ts:716-726` (`stepSimulation`), and the `lastTime` field declaration
- Test: `tests/unit/animation-engine/fire-explicit-dt.test.ts`

- [ ] **Step 1: Add `dt` to the fire input type.** In `FireTypes.ts`, add to `FireFrameInput`:

```typescript
  /** Simulation timestep in SECONDS. Provided by the render core so the sim is
   *  deterministic; replaces the renderer's old wall-clock (now - lastTime). */
  dt: number;
```

- [ ] **Step 2: Write the failing test.** `tests/unit/animation-engine/fire-explicit-dt.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeFireStepDt } from "$lib/shared/animation-engine/services/fire/web-gl-fire-renderer";

// computeFireStepDt(inputDt, reducedMotion) is the pure dt-derivation extracted
// from stepSimulation: clamp to 0.066s, scale 0.2x under reduced motion, floor 0.016.
describe("computeFireStepDt", () => {
  it("uses the provided dt, clamped to 0.066s", () => {
    expect(computeFireStepDt(0.02, false)).toBeCloseTo(0.02, 5);
    expect(computeFireStepDt(5.0, false)).toBeCloseTo(0.066, 5);
  });
  it("floors non-positive dt to 0.016s", () => {
    expect(computeFireStepDt(0, false)).toBeCloseTo(0.016, 5);
    expect(computeFireStepDt(-1, false)).toBeCloseTo(0.016, 5);
  });
  it("scales by 0.2 under reduced motion", () => {
    expect(computeFireStepDt(0.02, true)).toBeCloseTo(0.004, 5);
  });
});
```

- [ ] **Step 3: Run it, expect FAIL** (`computeFireStepDt` not exported).

Run: `npx vitest run tests/unit/animation-engine/fire-explicit-dt.test.ts`

- [ ] **Step 4: Extract the pure dt helper + use the input dt.** In `web-gl-fire-renderer.ts`, add an exported pure function and rewrite the dt lines of `stepSimulation`. Replace the current block:

```typescript
    const now = input.currentTime;
    let totalDt = Math.min((now - this.lastTime) / 1000, 0.066);
    if (this.reducedMotion) totalDt *= 0.2;
    this.lastTime = now;
    if (totalDt <= 0) totalDt = 0.016;
```

with:

```typescript
    const totalDt = computeFireStepDt(input.dt, this.reducedMotion);
```

and add at module scope:

```typescript
/** Pure: clamp the provided sim dt (seconds) the way the fire sim needs.
 *  Max 0.066s (30fps floor), 0.2x under reduced motion, floor 0.016s. */
export function computeFireStepDt(dt: number, reducedMotion: boolean): number {
  let d = Math.min(dt, 0.066);
  if (reducedMotion) d *= 0.2;
  if (d <= 0) d = 0.016;
  return d;
}
```

Delete the `private lastTime = 0;` field declaration (grep it in the file; remove the line and any other `this.lastTime` references — there should be none after this edit).

- [ ] **Step 5: Run it, expect PASS.** `npx vitest run tests/unit/animation-engine/fire-explicit-dt.test.ts`

- [ ] **Step 6: Full check + commit (path-limited).**

```bash
npm run check
git commit -m "refactor(fire): step fluid sim on explicit dt, delete internal clock" -- \
  src/lib/shared/animation-engine/services/fire/web-gl-fire-renderer.ts \
  src/lib/shared/animation-engine/domain/types/FireTypes.ts \
  tests/unit/animation-engine/fire-explicit-dt.test.ts
```

---

### Task 2: Charcoal renderer steps on explicit `dt`

**Files:**
- Modify: `src/lib/shared/animation-engine/services/charcoal/charcoal-spark-renderer.ts:291-298` (`renderCharcoal`) + the `lastTime` field (line ~178)

- [ ] **Step 1: Use the input dt.** Replace the dt block in `renderCharcoal`:

```typescript
    const now = input.currentTime;
    let dt = Math.min((now - this.lastTime) / 1000, 0.033);
    if (this.reducedMotion) dt *= 0.2;
    this.lastTime = now;
```

with (charcoal keeps its own 0.033 cap):

```typescript
    let dt = Math.min(input.dt, 0.033);
    if (this.reducedMotion) dt *= 0.2;
    if (dt <= 0) dt = 0.016;
```

Delete `private lastTime = 0;` and any remaining `this.lastTime` references.

- [ ] **Step 2: Full check + commit.**

```bash
npm run check
git commit -m "refactor(charcoal): step sim on explicit dt, delete internal clock" -- \
  src/lib/shared/animation-engine/services/charcoal/charcoal-spark-renderer.ts
```

---

### Task 3: Render core supplies `dt` (live unchanged, export pinnable)

**Files:**
- Modify: `src/lib/shared/animation-engine/services/animation-render-loop.ts` — `render()` (line 781), fire/charcoal input construction (line 1066-1092)

- [ ] **Step 1: Thread dt into render().** Change the private signature at line 781 from `private render(params: RenderFrameParams, currentTime: number): void` to:

```typescript
  // providedDtSeconds: explicit sim timestep for deterministic (export) render.
  // When omitted (live), derive it from the rAF-to-rAF gap.
  private render(
    params: RenderFrameParams,
    currentTime: number,
    providedDtSeconds?: number,
  ): void {
```

Immediately after the existing `const rafGap = ...; this.lastFrameTime = currentTime;` lines (785-786), add:

```typescript
    const dtSeconds = providedDtSeconds ?? (rafGap > 0 ? rafGap / 1000 : 0.016);
```

- [ ] **Step 2: Pass dt to the effect input.** In the `fireInput` object (line 1066), add `dt: dtSeconds,` alongside `currentTime`. (Both fire and charcoal read `fireInput`, so this single field covers both at lines 1085 and 1091.)

- [ ] **Step 3: Verify live is unchanged.** The live path passes no `providedDtSeconds`, so `dtSeconds = rafGap/1000` — exactly the wall-clock delta fire/charcoal derived themselves before. Run the existing animation-engine unit tests:

Run: `npx vitest run tests/unit/animation-engine`
Expected: PASS (no behavior change for live).

- [ ] **Step 4: Full check + commit.**

```bash
npm run check
git commit -m "refactor(render): supply explicit dt to effects (live derives from rAF gap)" -- \
  src/lib/shared/animation-engine/services/animation-render-loop.ts
```

---

# Phase 2 — Synchronous render + pure sampler

### Task 4: Public synchronous `renderSync` on the render loop

**Files:**
- Modify: `src/lib/shared/animation-engine/services/animation-render-loop.ts`
- Modify: `src/lib/shared/animation-engine/services/IAnimationRenderLoop.ts` (add to interface)

- [ ] **Step 1: Add the public method.** In `animation-render-loop.ts`, add (near `triggerRender`, line ~310):

```typescript
  /** Render ONE frame synchronously, now, with an explicit sim dt (seconds).
   *  Bypasses rAF/needsRender scheduling. Used by the offscreen export path so
   *  rendering is deterministic. The free-running loop is never started. */
  renderSync(params: RenderFrameParams, timeMs: number, dtSeconds: number): void {
    this.render(params, timeMs, dtSeconds);
  }
```

- [ ] **Step 2: Add to the interface.** In `IAnimationRenderLoop.ts`, add to the `IAnimationRenderLoop` interface:

```typescript
  renderSync(params: RenderFrameParams, timeMs: number, dtSeconds: number): void;
```

- [ ] **Step 3: Full check + commit.**

```bash
npm run check
git commit -m "feat(render): public renderSync for deterministic on-demand render" -- \
  src/lib/shared/animation-engine/services/animation-render-loop.ts \
  src/lib/shared/animation-engine/services/IAnimationRenderLoop.ts
```

---

### Task 5: `AnimationEngine.renderFrame(props, timeMs, dt)`

**Files:**
- Modify: `src/lib/shared/animation-engine/services/animation-engine.svelte.ts` (near the `triggerRender` callback usage, line ~228)

- [ ] **Step 1: Add the public engine method.** Build frame params from the supplied props (mirroring the existing `triggerRender` callback at line 228-229) and render synchronously:

```typescript
  /** Render one export frame synchronously and deterministically. timeMs is the
   *  frame's virtualTime; dtSeconds is the fixed sim step (e.g. 1/fps). */
  renderFrame(props: AnimationEngineProps, timeMs: number, dtSeconds: number): void {
    const params = this.frameSystem.buildFrameParams(props, this.buildFrameDeps());
    params.virtualTime = timeMs;
    this.lifecycleManager.renderLoop?.renderSync(params, timeMs, dtSeconds);
  }
```

(Confirm `buildFrameParams` and `buildFrameDeps` are reachable here — they are used at line 229. `AnimationEngineProps` is the existing engine prop type.)

- [ ] **Step 2: Smoke-test via the parity harness later (Task 10).** No unit test here — it's a thin orchestration over `renderSync` + `buildFrameParams`, both covered elsewhere. Full check + commit:

```bash
npm run check
git commit -m "feat(engine): public renderFrame(props, timeMs, dt) sync export entry" -- \
  src/lib/shared/animation-engine/services/animation-engine.svelte.ts
```

---

### Task 6: Pure `samplePropStateAt(step)` (no global mutation)

**Files:**
- Modify: `src/lib/shared/animation-engine/services/sequence-animation-orchestrator.ts` (alongside `calculateState`, line 165)
- Test: `tests/unit/animation-engine/sample-prop-state-at.test.ts`

- [ ] **Step 1: Write the failing test.** `tests/unit/animation-engine/sample-prop-state-at.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
import { AnimationStateManager } from "$lib/shared/animation-engine/services/animation-state-manager";
import { createAngleCalculator } from "$lib/shared/animation-engine/services/angle-calculator";
import { EndpointCalculator } from "$lib/shared/animation-engine/services/endpoint-calculator";
import { PropInterpolator } from "$lib/shared/animation-engine/services/prop-interpolator";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

// Minimal 1-step sequence fixture with blue+red motion. (Reuse an existing
// fixture if the repo has one under tests/fixtures; otherwise inline the
// smallest SequenceData the interpolator accepts.)
function makeOrchestrator(seq: SequenceData) {
  const angle = createAngleCalculator();
  const interp = new PropInterpolator(angle, new EndpointCalculator(angle));
  const stateManager = new AnimationStateManager();
  const orch = new SequenceAnimationOrchestrator(stateManager, interp);
  orch.loadSequence(seq); // use the orchestrator's existing load API (grep it)
  return { orch, stateManager };
}

describe("samplePropStateAt", () => {
  it("returns interpolated blue+red prop state for a fractional step", () => {
    const { orch } = makeOrchestrator(FIXTURE);
    const s = orch.samplePropStateAt(1.5);
    expect(s.blue).toHaveProperty("centerPathAngle");
    expect(s.blue).toHaveProperty("staffRotationAngle");
    expect(s.red).toHaveProperty("centerPathAngle");
  });

  it("does NOT mutate the shared animation state", () => {
    const { orch, stateManager } = makeOrchestrator(FIXTURE);
    const before = JSON.stringify(stateManager.getCurrentPropStates?.() ?? null);
    orch.samplePropStateAt(1.5);
    const after = JSON.stringify(stateManager.getCurrentPropStates?.() ?? null);
    expect(after).toEqual(before);
  });

  it("is deterministic: same step => same output", () => {
    const { orch } = makeOrchestrator(FIXTURE);
    expect(orch.samplePropStateAt(1.3)).toEqual(orch.samplePropStateAt(1.3));
  });
});
```

> NOTE TO IMPLEMENTER: replace `FIXTURE` and `loadSequence` with the orchestrator's real load method and a real minimal sequence — grep `sequence-animation-orchestrator.ts` for the method that ingests a `SequenceData` (it sets `this.steps`/`this.totalSteps`), and reuse any existing 1-step fixture.

- [ ] **Step 2: Run it, expect FAIL** (`samplePropStateAt` not defined).

Run: `npx vitest run tests/unit/animation-engine/sample-prop-state-at.test.ts`

- [ ] **Step 3: Implement the pure sampler.** In `sequence-animation-orchestrator.ts`, factor the PURE part of `calculateState` (the `calculateBeatState` → `applyEffort`/phrase → `interpolatePropAngles` chain at lines 206-273) into a method that RETURNS instead of mutating. Do not call `this.animationStateService.updatePropStates` from it:

```typescript
  /** Pure: compute interpolated blue+red prop state at a fractional step
   *  WITHOUT mutating the shared animation state. Mirrors calculateState's
   *  interpolation path (calculateBeatState -> effort/phrase -> interpolatePropAngles). */
  samplePropStateAt(step: number): { blue: PropState; red: PropState } {
    const adjustedBeat = step; // apply the same adjustment calculateState uses (grep it)
    const stepState = calculateBeatState(adjustedBeat, this.steps, this.totalSteps);

    let result: InterpolationResult;
    if (this.effortTimeline?.phrases?.length) {
      const phraseResult = /* same phrase resolution calculateState uses */;
      result = this.propInterpolationService.interpolatePropAngles(
        phraseResult.targetStepData, phraseResult.localProgress,
      );
    } else {
      const effortPreset = /* same effort preset calculateState reads */;
      const easedProgress = applyEffort(effortPreset, stepState.stepProgress);
      result = this.propInterpolationService.interpolatePropAngles(
        stepState.currentStepData, easedProgress,
      );
    }

    return {
      blue: result.blueAngles ?? { centerPathAngle: 0, staffRotationAngle: 0 },
      red: result.redAngles ?? { centerPathAngle: 0, staffRotationAngle: 0 },
    };
  }
```

> IMPLEMENTER: extract the exact `adjustedBeat`, phrase resolution, and `effortPreset` expressions verbatim from `calculateState` (lines 165-273) so sampler and live render agree bit-for-bit. Best refactor: have `calculateState` call `samplePropStateAt` and then do its mutation (`updatePropStates`) on the returned values — DRY, guarantees agreement. Verify the existing animator-state tests still pass after this refactor.

- [ ] **Step 4: Run it, expect PASS.** `npx vitest run tests/unit/animation-engine/sample-prop-state-at.test.ts`

- [ ] **Step 5: Regression — animator-state + playback tests.**

Run: `npx vitest run tests/unit/animation-engine`
Expected: PASS (calculateState behavior unchanged).

- [ ] **Step 6: Full check + commit.**

```bash
npm run check
git commit -m "feat(engine): pure samplePropStateAt(step); calculateState reuses it" -- \
  src/lib/shared/animation-engine/services/sequence-animation-orchestrator.ts \
  tests/unit/animation-engine/sample-prop-state-at.test.ts
```

---

# Phase 3 — Offscreen export driver

### Task 7: Sub-step count helper (pure)

**Files:**
- Create: `src/lib/features/compose/services/export-substep.ts`
- Test: `tests/unit/compose/export-substep.test.ts`

- [ ] **Step 1: Write the failing test.** `tests/unit/compose/export-substep.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeTrailSubSteps } from "$lib/features/compose/services/export-substep";

// Over-sample sub-positions across a per-frame beat advance. The trail
// capturer's 0.75px distance-gate prunes redundant points, so we only need
// ENOUGH samples that the fastest sweep gets >=1 sample per 0.75px. Count is
// proportional to beat delta, clamped to [1, 32].
describe("computeTrailSubSteps", () => {
  it("returns 1 for a zero/tiny advance", () => {
    expect(computeTrailSubSteps(0)).toBe(1);
    expect(computeTrailSubSteps(0.001)).toBe(1);
  });
  it("scales with beat delta", () => {
    expect(computeTrailSubSteps(0.5)).toBeGreaterThan(1);
    expect(computeTrailSubSteps(1.0)).toBeGreaterThan(computeTrailSubSteps(0.25));
  });
  it("caps at 32 for huge jumps (loop seams)", () => {
    expect(computeTrailSubSteps(99)).toBe(32);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.** `npx vitest run tests/unit/compose/export-substep.test.ts`

- [ ] **Step 3: Implement.** `export-substep.ts`:

```typescript
/** Sub-step count for trail accumulation across one export frame's beat advance.
 *  We over-sample and let the trail capturer's 0.75px distance-gate prune to
 *  exact live density. ~24 samples per full beat is dense enough for the fastest
 *  sweep at any export resolution; capped at 32 to bound cost on loop seams. */
const SUBSTEPS_PER_BEAT = 24;
const MAX_SUBSTEPS = 32;

export function computeTrailSubSteps(beatDelta: number): number {
  const n = Math.ceil(Math.abs(beatDelta) * SUBSTEPS_PER_BEAT);
  return Math.max(1, Math.min(MAX_SUBSTEPS, n));
}
```

- [ ] **Step 4: Run it, expect PASS.** `npx vitest run tests/unit/compose/export-substep.test.ts`

- [ ] **Step 5: Commit.**

```bash
npm run check
git commit -m "feat(export): pure trail sub-step count helper" -- \
  src/lib/features/compose/services/export-substep.ts \
  tests/unit/compose/export-substep.test.ts
```

---

### Task 8: OffscreenExportRenderer

**Files:**
- Create: `src/lib/features/compose/services/offscreen-export-renderer.ts`

Before creating: grep `RenderContextFactory` to confirm `createOffscreenContext` import path, and `assembleExportEngineProps` / `ExportFrameContext` in `export-engine-props.ts`.

- [ ] **Step 1: Implement the renderer class.** `offscreen-export-renderer.ts`:

```typescript
import { RenderContextFactory } from "$lib/shared/animation-engine/services/render-context-factory";
import type { OffscreenContextHandle } from "$lib/shared/animation-engine/services/render-context-factory";
import { assembleExportEngineProps, type ExportFrameContext } from "./export-engine-props";
import { computeTrailSubSteps } from "./export-substep";
import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";

export interface OffscreenExportInit {
  outputCanvasSize: number;
  fps: number;
  /** active effects, to decide whether to run the fire/charcoal warmup */
  needsFluidWarmup: boolean;
}

/** Owns a fresh offscreen AnimationEngine for the duration of one export.
 *  Renders each frame deterministically (fixed dt, sub-stepped trails) and
 *  exposes its canvas for the ExportFrameCompositor. Dispose when done. */
export class OffscreenExportRenderer {
  private handle: OffscreenContextHandle | null = null;
  private dtSeconds = 0;
  private prevBeatPos: number | null = null;

  constructor(
    private readonly playback: AnimationPlaybackController,
    private readonly panelState: AnimationPanelState,
  ) {}

  async initialize(init: OffscreenExportInit): Promise<void> {
    this.dtSeconds = 1 / init.fps;
    this.handle = await new RenderContextFactory().createOffscreenContext(
      init.outputCanvasSize,
    );
    if (init.needsFluidWarmup) {
      // Converge the fluid sim from zero (replaces the 60x rAF warmup).
      const WARMUP_FRAMES = 60;
      for (let w = 0; w < WARMUP_FRAMES; w++) {
        this.renderAt(0, 0); // step 0, virtualTime 0 — sub-step skipped at pos 0
      }
      this.handle.context.trailCapturer.clearTrails(); // discard warmup trail
    }
  }

  /** The offscreen canvas the compositor reads (same role as the live canvas). */
  get canvas(): HTMLCanvasElement {
    if (!this.handle) throw new Error("OffscreenExportRenderer not initialized");
    return this.handle.context.canvas;
  }

  /** Render one export frame at beat position `beatPos` and `virtualTimeMs`.
   *  Sub-steps the trail from the previous beat position so density matches live. */
  renderFrame(beatPos: number, virtualTimeMs: number): void {
    this.renderAt(beatPos, virtualTimeMs);
  }

  private renderAt(beatPos: number, virtualTimeMs: number): void {
    if (!this.handle) throw new Error("OffscreenExportRenderer not initialized");
    const engine = this.handle.engine;
    const trail = this.handle.context.trailCapturer;
    const orch = this.playback.orchestrator; // grep: expose the orchestrator or a sampler proxy

    // 1) Sub-step trail capture from prevBeatPos -> beatPos (gate prunes density).
    const prev = this.prevBeatPos ?? beatPos;
    const n = computeTrailSubSteps(beatPos - prev);
    for (let k = 1; k <= n; k++) {
      const f = k / n;
      const subPos = prev + (beatPos - prev) * f;
      const subTime = virtualTimeMs; // single frame timestamp; gate keys on distance
      const s = orch.samplePropStateAt(subPos);
      trail.captureFrame(
        { blueProp: s.blue, redProp: s.red /* + propTypes as captureFrame needs */ } as never,
        Math.floor(subPos),
        subTime,
      );
    }
    this.prevBeatPos = beatPos;

    // 2) Render the frame at the FINAL beat position (props shown at frame pos;
    //    trail overlay shows the accumulated ribbon).
    this.playback.calculateStateForStep(beatPos);
    const frameCtx: ExportFrameContext = {
      virtualTime: virtualTimeMs,
      isSeamlesslyLoopable: this.playback.isSeamlesslyLoopable,
      backgroundAlpha: 1,
      showNonRadialPoints: true,
      trailSettings: this.panelState /* trailSettings source — grep animationSettings.trail */ as never,
      bluePropType: null,
      redPropType: null,
      previewDarkMode: null,
    };
    const props = assembleExportEngineProps(this.panelState, frameCtx);
    engine.renderFrame(props, virtualTimeMs, this.dtSeconds);
  }

  dispose(): void {
    this.handle?.dispose();
    this.handle = null;
  }
}
```

> IMPLEMENTER NOTES (resolve by grepping — do not guess):
> 1. `captureFrame`'s first arg is `TrailCapturePropStates` — read its exact shape (`trail-capturer.ts`) and the prop-type fields it needs; build it from the sampled state + `panelState` prop types.
> 2. `playback.orchestrator` / sampler access: `AnimationPlaybackController` may not expose the orchestrator. Either add a thin `samplePropStateAt(step)` passthrough on the controller, or pass the orchestrator into this class. Pick the smaller change.
> 3. `trailSettings` for `ExportFrameContext` comes from `animationSettings.trail` (`animation-settings-state.svelte`), as the live AnimatorCanvas uses — not `panelState`.
> 4. `propTypes` (`bluePropType`/`redPropType`) come from the export options / panel, same values the current orchestrator passes — carry them through `OffscreenExportInit` if needed.

- [ ] **Step 2: Full check + commit.**

```bash
npm run check
git commit -m "feat(export): offscreen render driver (deterministic, sub-stepped trails)" -- \
  src/lib/features/compose/services/offscreen-export-renderer.ts
```

---

### Task 9: Route single-animation export through the offscreen driver

**Files:**
- Modify: `src/lib/features/compose/services/video-export-orchestrator.ts`

- [ ] **Step 1: Replace the live-capture setup with the offscreen renderer.** In `executeExport`, for the non-composite path:
  - DELETE the resize-hack block (the `getRenderContextRegistry().getAll().find(...)`, `resizer.pauseObservation()`, `liveContext.resize(outputCanvasSize)`, the `clearTrails()`/`clearBuffers()` band-aid, and the `await this.waitForAnimationFrame()` inside it).
  - DELETE the `finally` restore block (`liveContext.restoreSize()`, `liveContext.resizer.resumeObservation()`).
  - Construct and initialize an `OffscreenExportRenderer` instead:

```typescript
let offscreen: OffscreenExportRenderer | null = null;
if (!isCompositeMode) {
  offscreen = new OffscreenExportRenderer(playbackController, panelState);
  await offscreen.initialize({
    outputCanvasSize,
    fps,
    needsFluidWarmup,
  });
}
```

  (`needsFluidWarmup` already computed in the current code from the tipEffectMap.)

- [ ] **Step 2: Replace the per-frame capture.** In the frame loop, replace `calculateStateForStep(...) + await waitForAnimationFrame()` + reading the live `canvas` with:

```typescript
// beatPos = the playbackPosition already computed for this frame
offscreen!.renderFrame(beatPos, virtualTimeMs);
const sourceCanvas = isCompositeMode ? canvas : offscreen!.canvas;
```

and pass `sourceCanvas` to `frameCompositor.renderCanvasLayers(...)` instead of the live `canvas`. The overlays the compositor reads via `container.querySelectorAll("canvas")` now come from the offscreen engine's container — confirm the compositor reads from `sourceCanvas.parentElement` (it uses `canvas.parentElement`; pass `sourceCanvas`).

- [ ] **Step 3: Dispose in finally.**

```typescript
} finally {
  offscreen?.dispose();
  // ...existing cleanup (effect state, playback state, panelState.setVirtualTime(undefined))...
}
```

- [ ] **Step 4: Full check.** `npm run check` — fix any type errors from the signature changes.

- [ ] **Step 5: Commit.**

```bash
git commit -m "feat(export): route single-animation export through offscreen driver" -- \
  src/lib/features/compose/services/video-export-orchestrator.ts
```

---

# Phase 4 — Parity + determinism gate, then delete old path

### Task 10: Extend the parity harness (offscreen vs live + determinism + fire)

**Files:**
- Modify: `src/routes/test/trail-export-parity/+page.svelte`

- [ ] **Step 1: Add a determinism run.** After the existing offscreen export + decode, run the SAME export a second time and assert the decoded frames match within epsilon (reuse the `bodyDiff` helper; expect `bodyDiffPct ≈ 0`, `maxDelta` within codec noise). Surface `determinismDiffPct` on `window.__trailParityResult`.

- [ ] **Step 2: Add a fire-effect parity case.** Add a codec/effect toggle for `fire`; export a fire sequence offscreen, decode, and visually compare a mid-frame against a live-canvas fire reference at the same virtualTime (same `bodyDiff` gate). The existing live-render reference path already exists in the harness; extend it to set the active effect to `fire`.

- [ ] **Step 3: Run it (Chrome DevTools, user-driven or via the existing harness).** Verify: trail-heavy sequence body parity within ~Δ32 / <0.5%; fire parity within threshold; determinism diff ≈ 0. Capture `window.__trailParityResult`.

- [ ] **Step 4: Commit.**

```bash
npm run check
git commit -m "test(export): offscreen-vs-live parity + determinism + fire cases" -- \
  src/routes/test/trail-export-parity/+page.svelte
```

### Task 11: Delete dead live-capture remnants + verify

**Files:**
- Modify: `src/lib/features/compose/services/video-export-orchestrator.ts` (remove now-unused imports: `getRenderContextRegistry`, `RenderContext`, `ITrailOverlayCanvas` if no longer referenced; remove the parity-capture/PNG-dump DEV diagnostics if superseded)

- [ ] **Step 1: Remove unused imports/locals.** After Task 9, grep the orchestrator for `getRenderContextRegistry`, `liveContext`, `ITrailOverlayCanvas`, `RenderContext` — delete any now-unused. Keep the `__tka_parity_capture` hook only if the harness still uses it; otherwise remove.

- [ ] **Step 2: Full check + the unit suites.**

```bash
npm run check
npx vitest run tests/unit/animation-engine tests/unit/compose
```
Expected: green (only pre-existing unrelated failures from other agents' in-flight work, if any — confirm none are in the files this plan touched).

- [ ] **Step 3: Commit.**

```bash
git commit -m "chore(export): remove dead live-capture remnants" -- \
  src/lib/features/compose/services/video-export-orchestrator.ts
```

- [ ] **Step 4: Final verification (user-confirmed).** Re-export a real trail-heavy + a fire sequence from the actual viewer; confirm trails match the live canvas, frame 0 has no stub, and a repeat export is identical. Report `window.__trailParityResult` numbers as evidence.

---

## Done criteria

- Export runs entirely on a fresh offscreen engine; no live-engine resize/restore, no trail-clear band-aid, no per-frame `waitForAnimationFrame`.
- Trails match live density (sub-step + 0.75px gate). Frame 0 has no stale stub by construction.
- Fire/charcoal converge deterministically via fixed dt; repeat export of the same sequence is identical on the same machine.
- Parity gate passes (~Δ32 / <0.5% body). Live preview rendering is unchanged (regression-tested).
- All shipped fixes (registration, alpha-flatten, H.264/AV1) intact.
