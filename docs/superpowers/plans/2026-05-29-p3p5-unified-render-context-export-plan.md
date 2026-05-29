# P3+P5: Unified Render-Context Construction + Offscreen Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `AnimationEngine` the sole render-context construction authority and render video export on a fresh, disposable, native-size offscreen engine — deleting the live-engine resize hack and the dead/half-built factory stubs.

**Architecture:** `RenderContextFactory.createOffscreenContext()` delegates to a headless `new AnimationEngine()` (proven safe: zero `$effect`/`$derived` in the engine core). The export orchestrator drives that offscreen engine per frame — `calculateStateForStep` writes prop states into `animationPanelState`, a pure `assembleExportEngineProps()` maps them to `AnimationEngineProps`, `offscreenEngine.update(props)` pushes them, one rAF, then `ExportFrameCompositor` composites off the offscreen canvas. The glyph/word/progress overlays are composited separately (unchanged), so the engine only needs render-relevant props.

**Tech Stack:** TypeScript, Svelte 5 runes (`$state` in `.svelte.ts`), Vitest, Canvas2D, the existing `CanvasLifecycleManager` / `FrameSystem` / `ExportFrameCompositor`.

**Spec:** `docs/superpowers/specs/2026-05-29-p3p5-unified-render-context-export-design.md`

---

## ⚠️ Active multi-agent git race

Other agents commit to `main` concurrently. For EVERY commit:
- Stage files **by explicit name** — never `git add -A`/`.`.
- Use a **path-limited commit**: `git commit -m "msg" -- <path1> <path2>`. This commits only the named paths and leaves other agents' staged files in the index untouched.
- If your files end up swept into another agent's commit, that is acceptable — content is preserved. **Never** `git reset`, `git rebase`, amend, or rewrite history to "fix" grouping.
- Before each commit, `git diff --cached --name-only` to see what else is staged; rely on path-limited commit rather than unstaging their files.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/features/compose/services/export-engine-props.ts` | Pure mapper: `(panelState, frameContext) → AnimationEngineProps` for the offscreen engine. | **Create** |
| `src/lib/features/compose/services/__tests__/export-engine-props.test.ts` | Unit tests for the mapper. | **Create** |
| `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts` | `createOffscreenContext` delegates to a headless engine; `createLiveContext` deleted. | **Modify** |
| `src/lib/shared/animation-engine/services/implementations/__tests__/render-context-factory.test.ts` | Unit test for the factory contract (handle shape + dispose). | **Create** |
| `src/lib/shared/animation-engine/services/implementations/RenderContext.ts` | Resolve `LiveRenderContext.triggerRender` `() => ({})` stub. | **Modify** |
| `src/lib/features/compose/services/video-export-orchestrator.ts` | Route the non-composite path through the offscreen engine; delete resize hack + `liveContext` lookup. | **Modify** |

Scope note: the resize hack is **non-composite only** (`if (!isCompositeMode)`). Composite mode (`compositeRenderer`) is **unchanged** by this plan.

---

## Task 1: Pure `assembleExportEngineProps` mapper

Builds the per-frame `AnimationEngineProps` for the offscreen engine from panel state + a small frame context. Render-relevant props only — glyph/word/step overlays are composited separately by `ExportFrameCompositor`, so `letter`/`stepData` are intentionally omitted.

**Files:**
- Create: `src/lib/features/compose/services/export-engine-props.ts`
- Test: `src/lib/features/compose/services/__tests__/export-engine-props.test.ts`

Reference — the target type (`src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts:63`):

```ts
export interface AnimationEngineProps {
  blueProp: PropState | null;
  redProp: PropState | null;
  additionalLayers?: AdditionalLayerProps[];
  gridVisible?: boolean;
  gridMode?: GridMode | null;
  backgroundAlpha?: number;
  letter?: Letter | null;
  stepData?: StartPositionData | StepData | null;
  sequenceData?: SequenceData | null;
  currentStep?: number;
  isPlaying?: boolean;
  externalTrailSettings?: TrailSettings;
  bluePropType?: string | null;
  redPropType?: string | null;
  previewDarkMode?: boolean | null;
  isSeamlesslyLoopable?: boolean;
  virtualTime?: number;
  showNonRadialPoints?: boolean;
}
```

Panel-state getters available (`src/lib/shared/animation-engine/state/animation-panel-state.svelte.ts`): `bluePropState: PropState`, `redPropState: PropState`, `currentStep: number`, `sequenceData: SequenceData | null`, `sequenceWord: string`, `virtualTime?: number`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/features/compose/services/__tests__/export-engine-props.test.ts
import { describe, it, expect } from "vitest";
import { assembleExportEngineProps } from "../export-engine-props";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { PropState } from "$lib/shared/foundation/domain/types/PropState";

const blue: PropState = { x: 1, y: 2, angle: 10 } as unknown as PropState;
const red: PropState = { x: 3, y: 4, angle: 20 } as unknown as PropState;

function fakePanel(overrides: Record<string, unknown> = {}) {
  return {
    bluePropState: blue,
    redPropState: red,
    currentStep: 5,
    sequenceData: { gridMode: GridMode.DIAMOND, steps: [] } as any,
    sequenceWord: "TEST",
    virtualTime: 1234,
    ...overrides,
  } as any;
}

describe("assembleExportEngineProps", () => {
  it("maps panel prop states + frame context into AnimationEngineProps", () => {
    const props = assembleExportEngineProps(fakePanel(), {
      virtualTime: 999,
      isSeamlesslyLoopable: true,
      backgroundAlpha: 1,
      showNonRadialPoints: false,
    });
    expect(props.blueProp).toBe(blue);
    expect(props.redProp).toBe(red);
    expect(props.currentStep).toBe(5);
    expect(props.virtualTime).toBe(999); // frame context wins over panel
    expect(props.isSeamlesslyLoopable).toBe(true);
    expect(props.backgroundAlpha).toBe(1);
    expect(props.showNonRadialPoints).toBe(false);
    expect(props.gridMode).toBe(GridMode.DIAMOND); // derived from sequenceData
    expect(props.isPlaying).toBe(true); // export always advances time
  });

  it("falls back to DIAMOND grid when sequenceData has none", () => {
    const props = assembleExportEngineProps(
      fakePanel({ sequenceData: { steps: [] } as any }),
      { virtualTime: 0, isSeamlesslyLoopable: false, backgroundAlpha: 1, showNonRadialPoints: true },
    );
    expect(props.gridMode).toBe(GridMode.DIAMOND);
  });

  it("omits letter/stepData (glyph is composited separately)", () => {
    const props = assembleExportEngineProps(fakePanel(), {
      virtualTime: 0, isSeamlesslyLoopable: false, backgroundAlpha: 1, showNonRadialPoints: true,
    });
    expect(props.letter).toBeUndefined();
    expect(props.stepData).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/features/compose/services/__tests__/export-engine-props.test.ts`
Expected: FAIL — `assembleExportEngineProps` is not defined.

- [ ] **Step 3: Implement the mapper**

```ts
// src/lib/features/compose/services/export-engine-props.ts
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { AnimationEngineProps } from "$lib/shared/animation-engine/services/implementations/AnimationEngine.svelte";
import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";

/** Per-frame context the export loop already computes. */
export interface ExportFrameContext {
  virtualTime: number;
  isSeamlesslyLoopable: boolean;
  backgroundAlpha: number;
  showNonRadialPoints: boolean;
}

/**
 * Map live panel state + the frame context into the render-relevant props the
 * offscreen engine needs. letter/stepData are intentionally omitted: in export
 * the glyph/word/step overlays are composited by ExportFrameCompositor, not by
 * the engine canvas. The engine renders props + effects (fire/trails/grid) only.
 */
export function assembleExportEngineProps(
  panelState: AnimationPanelState,
  frame: ExportFrameContext,
): AnimationEngineProps {
  const sequenceData = panelState.sequenceData;
  const gridMode = sequenceData?.gridMode ?? GridMode.DIAMOND;
  return {
    blueProp: panelState.bluePropState,
    redProp: panelState.redPropState,
    gridVisible: true,
    gridMode,
    backgroundAlpha: frame.backgroundAlpha,
    sequenceData,
    currentStep: panelState.currentStep,
    isPlaying: true,
    isSeamlesslyLoopable: frame.isSeamlesslyLoopable,
    virtualTime: frame.virtualTime,
    showNonRadialPoints: frame.showNonRadialPoints,
  };
}
```

If `SequenceData` has no `gridMode` field, drop the `sequenceData?.gridMode ??` read and use `GridMode.DIAMOND` directly (confirm by grepping `interface SequenceData` in `src/lib/shared/foundation/domain/models/SequenceData.ts` during Step 3; adjust the test's first case accordingly).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/features/compose/services/__tests__/export-engine-props.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/compose/services/export-engine-props.ts src/lib/features/compose/services/__tests__/export-engine-props.test.ts
git commit -m "feat(compose): pure assembleExportEngineProps mapper for offscreen export" -- src/lib/features/compose/services/export-engine-props.ts src/lib/features/compose/services/__tests__/export-engine-props.test.ts
```

---

## Task 2: `createOffscreenContext` delegates to a headless engine; delete `createLiveContext`

Replace the hand-wired six-service construction (and the `getFrameParams: () => ({} as any)` stub) with delegation to `new AnimationEngine()`. Return a handle exposing the engine (for `update`/setters), the render context (for `canvas`/`resizer`), and a `dispose()`.

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts` (whole file)
- Test: `src/lib/shared/animation-engine/services/implementations/__tests__/render-context-factory.test.ts`

Reference — engine API: `async initialize(container, { onCanvasReady?, onTrailSettingsChange?, onEffectError? })`, `getRenderContext(id, container): RenderContext | null`, `dispose()`.

- [ ] **Step 1: Write the failing test (factory contract + dispose)**

jsdom has no real Canvas2D/WebGL, so this test mocks `AnimationEngine` to assert the factory's wiring contract (offscreen container created/appended, engine initialized, handle shape, dispose tears down).

```ts
// src/lib/shared/animation-engine/services/implementations/__tests__/render-context-factory.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const initialize = vi.fn().mockResolvedValue(undefined);
const dispose = vi.fn();
const fakeCanvas = { width: 720, height: 720 } as HTMLCanvasElement;
const getRenderContext = vi.fn(() => ({
  id: "x", canvas: fakeCanvas, container: {} as any,
  renderer: {} as any, effectManager: {} as any, trailCapturer: {} as any,
  renderLoop: {} as any, resizer: {} as any, precomputer: {} as any,
  size: 720, resize() {}, restoreSize() {}, triggerRender() {}, dispose,
}));

vi.mock("../AnimationEngine.svelte", () => ({
  AnimationEngine: vi.fn().mockImplementation(() => ({ initialize, getRenderContext, dispose })),
}));

import { RenderContextFactory } from "../RenderContextFactory";

describe("RenderContextFactory.createOffscreenContext", () => {
  beforeEach(() => { initialize.mockClear(); dispose.mockClear(); getRenderContext.mockClear(); });

  it("builds a headless engine, returns a context, and disposes cleanly", async () => {
    const factory = new RenderContextFactory();
    const handle = await factory.createOffscreenContext(720);
    expect(initialize).toHaveBeenCalledOnce();
    expect(handle.engine).toBeDefined();
    expect(handle.context.canvas).toBe(fakeCanvas);
    const containerInDom = document.body.querySelector("div[data-offscreen-render]");
    expect(containerInDom).not.toBeNull();
    handle.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(document.body.querySelector("div[data-offscreen-render]")).toBeNull();
  });

  it("no longer exposes createLiveContext", () => {
    const factory = new RenderContextFactory() as unknown as Record<string, unknown>;
    expect(factory.createLiveContext).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/shared/animation-engine/services/implementations/__tests__/render-context-factory.test.ts`
Expected: FAIL — current factory hand-wires services (no `engine` on handle), and `createLiveContext` still exists.

- [ ] **Step 3: Rewrite the factory**

```ts
// src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts
import type { RenderContext } from "./RenderContextRegistry";
import { AnimationEngine } from "./AnimationEngine.svelte";

export interface OffscreenContextOptions {
  id?: string;
}

/** Handle returned by createOffscreenContext: the headless engine, its render
 *  context, and a dispose that tears down both + removes the offscreen DOM node. */
export interface OffscreenContextHandle {
  engine: AnimationEngine;
  context: RenderContext;
  dispose(): void;
}

export class RenderContextFactory {
  async createOffscreenContext(
    size: number,
    options?: OffscreenContextOptions,
  ): Promise<OffscreenContextHandle> {
    const id = options?.id ?? `offscreen-${size}`;

    const container = document.createElement("div");
    container.setAttribute("data-offscreen-render", id);
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.pointerEvents = "none";
    document.body.appendChild(container);

    const engine = new AnimationEngine();
    await engine.initialize(container, {});

    const context = engine.getRenderContext(id, container);
    if (!context) {
      engine.dispose();
      container.remove();
      throw new Error("createOffscreenContext: engine.getRenderContext returned null");
    }

    return {
      engine,
      context,
      dispose() {
        engine.dispose();
        container.remove();
      },
    };
  }
}
```

Note: `createLiveContext` and all the hand-wired service imports are deleted in this rewrite.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/shared/animation-engine/services/implementations/__tests__/render-context-factory.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify no callers referenced `createLiveContext` or the old offscreen shape**

Run: `npx grep -rn "createLiveContext\|createOffscreenContext" src/lib --include="*.ts" --include="*.svelte"` (or the Grep tool).
Expected: the only `createOffscreenContext` reference is the orchestrator (rewritten in Task 4) and these tests. No `createLiveContext` references remain. If any other caller exists, STOP and reconcile before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts src/lib/shared/animation-engine/services/implementations/__tests__/render-context-factory.test.ts
git commit -m "refactor(animation): createOffscreenContext delegates to headless engine; drop createLiveContext" -- src/lib/shared/animation-engine/services/implementations/RenderContextFactory.ts src/lib/shared/animation-engine/services/implementations/__tests__/render-context-factory.test.ts
```

---

## Task 3: Resolve `LiveRenderContext.triggerRender` stub

`triggerRender` currently calls `this.renderLoop.triggerRender(() => ({} as any))` — a stub that paints with empty params. Determine whether anything still calls `ctx.triggerRender()` after the resize hack is gone (Task 4 deletes the only known caller path).

**Files:**
- Modify: `src/lib/shared/animation-engine/services/implementations/RenderContext.ts:61-63`

- [ ] **Step 1: Find callers**

Run: `npx grep -rn "\.triggerRender(" src/lib --include="*.ts" --include="*.svelte"` (Grep tool).
Distinguish `renderLoop.triggerRender(getFrameParams)` (legitimate, takes a real param builder) from `context.triggerRender()` (the stubbed no-arg wrapper on `LiveRenderContext`/`RenderContext`).

- [ ] **Step 2: Apply the resolution**

- If **no** `RenderContext.triggerRender()` callers remain: remove `triggerRender` from the `RenderContext` interface (`RenderContextRegistry.ts:23`) and from `LiveRenderContext` (`RenderContext.ts:61-63`).
- If callers **do** remain: they need real frame params, which only the engine has. Rather than reintroduce a stub, change those callers to drive a render through the engine they already hold (`engine`/`renderLoop` with `buildFrameParams`), then remove the no-arg `triggerRender` from the context. The context is a passive handle (canvas/resizer/services); it must not synthesize empty frame params.

Pick the branch that matches Step 1's findings and implement it. Do not leave the `() => ({} as any)` stub in place.

- [ ] **Step 3: Type-check the change**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -iE "RenderContext|triggerRender"` (or rely on the running `npm run check:watch`).
Expected: no errors mentioning `RenderContext`/`triggerRender`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/animation-engine/services/implementations/RenderContext.ts src/lib/shared/animation-engine/services/implementations/RenderContextRegistry.ts
git commit -m "refactor(animation): remove LiveRenderContext.triggerRender empty-params stub" -- src/lib/shared/animation-engine/services/implementations/RenderContext.ts src/lib/shared/animation-engine/services/implementations/RenderContextRegistry.ts
```

(If only `RenderContext.ts` changed, drop `RenderContextRegistry.ts` from both commands.)

---

## Task 4: Route export through the offscreen engine; delete the resize hack

Replace the non-composite live-canvas path with the offscreen engine. The composite-mode branch is unchanged.

**Files:**
- Modify: `src/lib/features/compose/services/video-export-orchestrator.ts`
  - Imports: add `RenderContextFactory` + `assembleExportEngineProps`.
  - Delete the resize hack at `:402-409` and the restore at `:659-661`, plus the `liveContext` declaration (`:234`) and the `getRenderContextRegistry` import (`:33`) if unused afterward.
  - Build the offscreen handle for non-composite mode; drive + composite off its canvas; dispose in `finally`.

- [ ] **Step 1: Add the offscreen handle (non-composite) and remove the resize hack**

Replace the resize-hack block (currently `:398-409`):

```ts
// BEFORE (delete):
// if (!isCompositeMode) {
//   const contexts = getRenderContextRegistry().getAll();
//   liveContext = contexts.find(c => c.canvas === canvas) ?? null;
//   if (liveContext) {
//     liveContext.resizer.pauseObservation();
//     liveContext.resize(outputCanvasSize);
//     await this.waitForAnimationFrame();
//   }
// }

// AFTER:
let offscreen: import("$lib/shared/animation-engine/services/implementations/RenderContextFactory").OffscreenContextHandle | null = null;
let renderCanvas = canvas; // composite mode keeps reading the live canvas
if (!isCompositeMode) {
  const factory = new RenderContextFactory();
  offscreen = await factory.createOffscreenContext(outputCanvasSize);
  renderCanvas = offscreen.context.canvas;
  // One-time config the live CanvasSurface feeds once (not per frame):
  const vm = getAnimationVisibilityManager();
  offscreen.engine.setEffectsConfigState(vm.effectsConfigState ?? null);
  if (options.fireConfig) offscreen.engine.setFireConfig(options.fireConfig);
  if (options.ledConfig) offscreen.engine.setLedConfig(options.ledConfig);
  offscreen.engine.setCellTipEffectMap(options.tipEffectMap);
  offscreen.engine.setCellTipEffortMap(options.tipEffortMap);
  await this.waitForAnimationFrame(); // let the engine paint its first frame
}
```

Add at the top of the file (with the other imports):

```ts
import { RenderContextFactory } from "$lib/shared/animation-engine/services/implementations/RenderContextFactory";
import { assembleExportEngineProps } from "./export-engine-props";
```

Delete the `let liveContext: RenderContext | null = null;` declaration (`:234`). Remove the `getRenderContextRegistry` import (`:33`) and the `RenderContext` type import (`:34`) once unused (confirm with the check at Step 5).

The exact source of `options.fireConfig`/`ledConfig`/`tipEffectMap`/`tipEffortMap` must match `VideoExportOrchestratorOptions`. During Step 1, grep `interface VideoExportOrchestratorOptions` in this file (or its types module) and the live `AnimatorCanvas` consumer (`SequenceDrawerHost.svelte` / `AnimationSheetCoordinator.svelte`) to confirm the field names the live canvas receives; use those exact names. If a config is sourced from the visibility manager rather than options, read it from `getAnimationVisibilityManager()` to match the live path.

- [ ] **Step 2: Push props into the offscreen engine each frame**

After the existing `playbackController.calculateStateForStep(...)` calls and BEFORE the `await this.waitForAnimationFrame()` at `:531`, add (non-composite only):

```ts
if (offscreen) {
  const props = assembleExportEngineProps(panelState, {
    virtualTime: virtualTimeMs,
    isSeamlesslyLoopable: playbackController.isSeamlesslyLoopable,
    backgroundAlpha: isDarkMode ? 1 : 1, // engine bg opaque at export; matches live hero
    showNonRadialPoints: visibilityManager.getVisibility("nonRadialPoints"),
  });
  offscreen.engine.update(props);
}
```

Confirm the visibility key for non-radial points by grepping `getVisibility(` usages / the visibility key union during Step 2; if there is no such key, pass `true` (the live default) instead.

- [ ] **Step 3: Composite off the offscreen canvas**

Replace the `canvas` argument passed to the compositor (`:554-569`) with `renderCanvas`, and update the canvas-availability guard (`:538`) to read `renderCanvas`:

```ts
let canvasAvailable = renderCanvas.width > 0 && renderCanvas.height > 0;
// ... retry loop uses renderCanvas ...
frameCompositor.renderCanvasLayers(offscreenCtx, renderCanvas, !!isCompositeMode, compositeStepIndex, offscreenCanvas, i);
frameCompositor.renderOverlays(offscreenCtx, renderCanvas, stepIndex, isInStartPosition, isInEndHold, playbackPosition, /* …existing trailing args… */);
```

Keep every other argument to `renderCanvasLayers`/`renderOverlays` exactly as-is — only the canvas source changes.

- [ ] **Step 4: Dispose the offscreen engine; delete the restore hack**

Delete the restore block at `:659-661`:

```ts
// BEFORE (delete):
// if (liveContext) {
//   liveContext.restoreSize();
//   liveContext.resizer.resumeObservation();
// }
```

In the same `finally`/cleanup region, add:

```ts
offscreen?.dispose();
offscreen = null;
```

Ensure `offscreen?.dispose()` runs in the `finally` that also resets `this._isExporting`, so a thrown/cancelled export still tears down the offscreen engine.

- [ ] **Step 5: Type-check + tests + LOCAL PARITY (gate before committing the deletion)**

Run (one full check, warranted by the cross-file change):
```bash
npm run check > /tmp/p3check.log 2>&1; echo "EXIT:$?"
```
Then filter: `grep -niE "video-export-orchestrator|export-engine-props|RenderContextFactory" /tmp/p3check.log`. Expected: no errors in those files. (Pre-existing unrelated errors from other agents may remain; confirm none are in the touched files.)

Run the unit tests: `npx vitest run src/lib/features/compose/services/__tests__/ src/lib/shared/animation-engine` — animator-state + new tests green.

**LOCAL PARITY (manual, not shipped — no feature flag):** before committing, on the dev server export ONE sequence that uses **fire + trails + a glyph** as a short MP4. Compare against a build from before this task (e.g. `git stash`-free: export from the prior commit in a second checkout, or export immediately before applying Step 1–4). Confirm: props animate correctly, trails accumulate identically (no doubled opacity), fire renders at native sharpness, no on-screen flicker of the live canvas during export. If parity fails, fix before committing — do not ship a regressed export.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/compose/services/video-export-orchestrator.ts
git commit -m "refactor(compose): render video export on a fresh offscreen engine; delete live-canvas resize hack" -- src/lib/features/compose/services/video-export-orchestrator.ts
```

---

## Task 5: Final gate + user runtime verification

- [ ] **Step 1: Full check + full test run**

```bash
npm run check > /tmp/p3final.log 2>&1; echo "EXIT:$?"
npx vitest run src/lib/shared/animation-engine src/lib/features/compose
```
Triage only errors in files this plan touched; pre-existing other-agent errors are out of scope.

- [ ] **Step 2: User runtime verification (cannot self-verify)**

Ask the user to:
1. Open a sequence with fire + trails in the viewer, Download Animation (MP4).
2. Confirm the exported video matches the live preview (props, trails, fire, glyph, word header, progress bar) and is sharp at output resolution.
3. Confirm the on-screen live canvas does **not** flicker/resize during export.
4. Export a composite-mode video (if used) to confirm that path is unaffected.

State explicitly: "I can't verify the exported video myself — please export and confirm."

- [ ] **Step 3: Update the master plan**

Mark the P3 and P5 sections of `docs/superpowers/plans/2026-05-28-animation-engine-rearchitecture.md` as superseded-and-complete (point to this plan). Path-limited commit:

```bash
git add docs/superpowers/plans/2026-05-28-animation-engine-rearchitecture.md
git commit -m "docs(plan): mark P3+P5 complete, superseded by offscreen-export plan" -- docs/superpowers/plans/2026-05-28-animation-engine-rearchitecture.md
```

---

## Self-Review

**Spec coverage:**
- Decision 1 (factory delegates to headless engine) → Task 2. ✅
- Decision 2 (delete createLiveContext; CanvasSurface keeps direct engine) → Task 2 (delete) + no CanvasSurface change needed (confirmed). ✅
- Decision 3 (fresh per export, dispose after) → Task 4 Steps 1 + 4. ✅
- Per-frame prop push from panelState → Task 1 (mapper) + Task 4 Step 2. ✅
- Delete resize hack `:402-407` + `:659-661` + liveContext lookup → Task 4 Steps 1 + 4. ✅
- triggerRender stub → Task 3. ✅
- Parity gate, no flag → Task 4 Step 5 (local manual) + Task 5 Step 2 (user). ✅
- Glyph composited separately (engine props omit letter/stepData) → Task 1. ✅

**Placeholder scan:** Two steps intentionally instruct a grep-to-confirm-then-use-exact-names (Task 1 Step 3 gridMode field; Task 4 Step 1 options field names; Task 4 Step 2 visibility key). These are reconciliations against live code that must not be fabricated — each names the exact file to read and the fallback to use. Not open-ended placeholders.

**Type consistency:** `assembleExportEngineProps(panelState, ExportFrameContext) → AnimationEngineProps` used identically in Task 1 and Task 4. `OffscreenContextHandle { engine, context, dispose }` defined in Task 2, consumed in Task 4. `AnimationEngineProps` fields match the engine interface verbatim. ✅

**Scope:** Single subsystem (render-context construction + export routing). Composite mode explicitly out of scope. Focused for one plan. ✅
