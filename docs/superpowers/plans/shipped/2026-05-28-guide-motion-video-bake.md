# Guide Motion Video Bake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 19 live `GuideMotionDemo` animation instances in the Level 1 Guide with pre-baked H.264 mp4 loops so the guide page mounts zero animation engine (no rAF, no scroll mount/unmount churn).

**Architecture:** A dev-only in-browser bake route drives the existing `Canvas2DAnimationRenderer` (the exact renderer behind the live `AnimatorCanvas`) frame-by-frame and feeds each frame to the existing `VideoExporter` (`getVideoExporter().createManualExporter`, WebCodecs H.264). A dev-only `+server.ts` writes the resulting blobs to `static/guide/level-1/motions/{id}.mp4`. Runtime swaps every `<GuideMotionDemo>` for a dumb `<GuideMotionVideo id="…">` that renders a plain `<video autoplay loop muted playsinline>`. A single `guide-motion-configs.ts` is the shared contract: the bake reads it to render, and it owns `buildGuideMotionSequence` (extracted from `GuideMotionDemo`).

**Tech Stack:** Svelte 5 (`$props`/`$derived`), SvelteKit route groups + dev-only endpoints, vitest (jsdom), existing TKA animation-engine services (`Canvas2DAnimationRenderer`, `getSequenceAnimationOrchestrator`, `getVideoExporter`, `generateBluePropSvg`/`generateRedPropSvg`).

**Spec:** `docs/superpowers/specs/2026-05-28-guide-motion-video-bake-design.md`

---

## Reuse audit (never-hand-roll)

Verified by reading the code this planning pass:

- **`Canvas2DAnimationRenderer`** (`src/lib/shared/animation-engine/services/implementations/Canvas2DAnimationRenderer.ts`) — the renderer behind the live `AnimatorCanvas`. `initialize(container, size, backgroundAlpha=1, paintBackground=true)`, `setDarkMode(enabled, animate=true)`, `loadGridTexture(gridMode, showNonRadialPoints=true)`, `loadPerColorPropTextures(bluePropType, redPropType, darkMode?)`, `renderScene(params)` (honors `params.visibility.blueMotionVisible/redMotionVisible` and `params.bluePropType/redPropType` → hand forces angle 0), `getCanvas()`, `destroy()`. Reused directly → baked frames are pixel-identical to the live demo.
- **`VideoExporter`** (`getVideoExporter().createManualExporter(width, height, { format:"mp4", fps, autoDownload:false })` → `{ addFrame(canvas), finish():Blob, cancel() }`). WebCodecs H.264 (Chrome/Safari/Edge) with WASM `h264-mp4-encoder` fallback (Firefox); deterministic per-frame timestamps. The app's Download Animation feature already uses it. Reused as-is for render→mp4.
- **`getSequenceAnimationOrchestrator`** — `initializeWithDomainData(sequence)`, `calculateState(position)`, `getBluePropState()`, `getRedPropState()`. Same orchestrator `VideoPreRenderer` uses. Reused.
- **`generateBluePropSvg`/`generateRedPropSvg`** (`src/lib/shared/animation-engine/services/svg-generator.ts`) — `("hand", /*darkMode*/ true)` returns `{ svg, width, height }`; we use width/height for prop dimensions. Reused.
- **`DEFAULT_TRAIL_SETTINGS`** (`src/lib/shared/animation-engine/domain/types/TrailTypes.ts`) — passed to `renderScene` (trails disabled). Reused.
- **`card-back-capture`** route (`src/routes/test/card-back-capture/+page.svelte`) — the in-browser render→blob→preview-grid page pattern. Followed.

**Not reused:** `VideoPreRenderer` — its MediaRecorder loop is real-time (loop-seam jitter), its mp4 output is browser-dependent (falls back to webm), and it hardcodes staff props / both-hands-visible / light theme. `VideoExporter` + a direct `Canvas2DAnimationRenderer` drive is strictly better for a deterministic, hand-prop, dark, per-config-visibility bake (rationale in spec §"Why VideoExporter, not VideoPreRenderer").

---

## File structure

**Create:**
- `src/routes/(public)/guide/level-1/_components/guide-motion-configs.ts` — `GuideMotionConfig` interface, `GUIDE_MOTION_CONFIGS` (19), `buildGuideMotionSequence(config)`, `GUIDE_MOTION_IDS` set, `isKnownMotionId(id)`. (No engine *runtime* import leaks into the guide page — only the bake route and the dev endpoint import this module.)
- `src/routes/(public)/guide/level-1/_components/GuideMotionVideo.svelte` — runtime `<video>` consumer (imports nothing from the configs/engine).
- `src/routes/test/guide-motion-bake/bake-motion.ts` — browser-only bake helper composing `Canvas2DAnimationRenderer` + `VideoExporter`.
- `src/routes/test/guide-motion-bake/+page.svelte` — dev bake UI (progress + preview grid + per-config error).
- `src/routes/test/guide-motion-bake/+server.ts` — dev-only POST write endpoint.
- `tests/unit/guide/guide-motion-configs.test.ts` — unit tests for the configs module.
- `static/guide/level-1/motions/*.mp4` — 19 generated assets (committed after bake).

**Edit (swap `<GuideMotionDemo>` → `<GuideMotionVideo>` + fix imports):**
- `src/routes/(public)/guide/level-1/_sections/ch10/HandMotions.svelte` (5 instances)
- `…/Type1AlphaBeta.svelte` (4)
- `…/Type1Gamma.svelte` (2)
- `…/Type2Shifts.svelte` (2)
- `…/Type3CrossShifts.svelte` (1)
- `…/Type4Dash.svelte` (1)
- `…/Type5DualDash.svelte` (1)
- `…/Type6Static.svelte` (3)

**Remove:**
- `src/routes/(public)/guide/level-1/_components/GuideMotionDemo.svelte` — after zero references remain.

---

### Task 1: Config module — `guide-motion-configs.ts`

**Files:**
- Create: `src/routes/(public)/guide/level-1/_components/guide-motion-configs.ts`
- Test: `tests/unit/guide/guide-motion-configs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/guide/guide-motion-configs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  GUIDE_MOTION_CONFIGS,
  buildGuideMotionSequence,
  isKnownMotionId,
} from "../../../src/routes/(public)/guide/level-1/_components/guide-motion-configs";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

describe("GUIDE_MOTION_CONFIGS", () => {
  it("has 19 entries", () => {
    expect(GUIDE_MOTION_CONFIGS).toHaveLength(19);
  });

  it("has unique kebab-slug ids", () => {
    const ids = GUIDE_MOTION_CONFIGS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("every entry has a non-empty accessibility label", () => {
    for (const c of GUIDE_MOTION_CONFIGS) {
      expect(c.label.length).toBeGreaterThan(0);
    }
  });
});

describe("buildGuideMotionSequence", () => {
  it("builds a single-step diamond sequence with hand props", () => {
    const config = GUIDE_MOTION_CONFIGS.find((c) => c.id === "hm-shift-wn")!;
    const seq = buildGuideMotionSequence(config);
    expect(seq.steps).toHaveLength(1);
    expect(seq.gridMode).toBe(GridMode.DIAMOND);
    const red = seq.steps[0].motions.red;
    expect(red.startLocation).toBe(GridLocation.WEST);
    expect(red.endLocation).toBe(GridLocation.NORTH);
    expect(red.motionType).toBe(MotionType.PRO);
    expect(red.propType).toBe(PropType.HAND);
    expect(red.pathShape).toBe("arc"); // shift arcs
  });

  it("uses linear pathShape for dashes", () => {
    const config = GUIDE_MOTION_CONFIGS.find((c) => c.id === "hm-dash-we")!;
    const red = buildGuideMotionSequence(config).steps[0].motions.red;
    expect(red.motionType).toBe(MotionType.DASH);
    expect(red.pathShape).toBe("linear");
  });

  it("defaults blue to a static hold at red's start when config.blue is absent", () => {
    const config = GUIDE_MOTION_CONFIGS.find((c) => c.id === "hm-start")!;
    const blue = buildGuideMotionSequence(config).steps[0].motions.blue;
    expect(blue.motionType).toBe(MotionType.STATIC);
    expect(blue.startLocation).toBe(config.red.start);
    expect(blue.endLocation).toBe(config.red.start);
  });

  it("builds explicit blue motion when config.blue is present", () => {
    const config = GUIDE_MOTION_CONFIGS.find((c) => c.id === "t1-split-same")!;
    const blue = buildGuideMotionSequence(config).steps[0].motions.blue;
    expect(blue.startLocation).toBe(GridLocation.WEST);
    expect(blue.endLocation).toBe(GridLocation.SOUTH);
    expect(blue.motionType).toBe(MotionType.PRO);
  });

  it("start position holds both hands static", () => {
    const config = GUIDE_MOTION_CONFIGS.find((c) => c.id === "t1-split-same")!;
    const sp = buildGuideMotionSequence(config).startPosition!;
    expect(sp.motions.red.motionType).toBe(MotionType.STATIC);
    expect(sp.motions.blue.motionType).toBe(MotionType.STATIC);
  });
});

describe("isKnownMotionId", () => {
  it("accepts every known id", () => {
    for (const c of GUIDE_MOTION_CONFIGS) {
      expect(isKnownMotionId(c.id)).toBe(true);
    }
  });

  it("rejects unknown ids and traversal attempts", () => {
    expect(isKnownMotionId("nope")).toBe(false);
    expect(isKnownMotionId("../secret")).toBe(false);
    expect(isKnownMotionId("hm-start/../../etc")).toBe(false);
    expect(isKnownMotionId("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:ci -- guide-motion-configs`
Expected: FAIL — `Cannot find module '…/guide-motion-configs'`.

- [ ] **Step 3: Create the config module**

Create `src/routes/(public)/guide/level-1/_components/guide-motion-configs.ts`:

```ts
/**
 * Single source of truth for the Level 1 Guide hand-motion demos.
 *
 * GENERATED ASSETS: the mp4 loops under `static/guide/level-1/motions/{id}.mp4`
 * are baked from these configs, NOT hand-authored. To change a demo:
 *   1. Edit the relevant entry below.
 *   2. `npm run dev`, open `/test/guide-motion-bake`, click "Bake all".
 *   3. Eyeball the preview grid.
 *   4. Commit the changed `static/guide/level-1/motions/*.mp4`.
 *
 * `buildGuideMotionSequence` is the shared builder (extracted from the old
 * GuideMotionDemo.svelte). Only the bake route and the dev write endpoint
 * import this module — the runtime guide page imports nothing from here.
 */
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  MotionColor,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createSequenceData, type SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";

export interface GuideMotionLeg {
  start: GridLocation;
  end: GridLocation;
  motionType: MotionType;
}

export interface GuideMotionConfig {
  /** Stable kebab slug → mp4 filename + runtime lookup key. */
  id: string;
  /** Accessibility description (aria-label on the rendered <video>). */
  label: string;
  /** Right hand (rendered as the red motion). */
  red: GuideMotionLeg;
  /** Left hand (rendered as the blue motion). Absent → static hold at red.start. */
  blue?: GuideMotionLeg;
  /** Whether the blue (left) hand is visible in this demo. */
  showBlue: boolean;
}

export const GUIDE_MOTION_CONFIGS: GuideMotionConfig[] = [
  // --- HandMotions.svelte (5) ---
  { id: "hm-start", label: "Hand resting static at west (starting position)", showBlue: false,
    red: { start: GridLocation.WEST, end: GridLocation.WEST, motionType: MotionType.STATIC } },
  { id: "hm-shift-wn", label: "Hand shifts from west to north", showBlue: false,
    red: { start: GridLocation.WEST, end: GridLocation.NORTH, motionType: MotionType.PRO } },
  { id: "hm-shift-ws", label: "Hand shifts from west to south", showBlue: false,
    red: { start: GridLocation.WEST, end: GridLocation.SOUTH, motionType: MotionType.PRO } },
  { id: "hm-dash-we", label: "Hand dashes straight across from west to east", showBlue: false,
    red: { start: GridLocation.WEST, end: GridLocation.EAST, motionType: MotionType.DASH } },
  { id: "hm-static-w", label: "Hand stays static at west", showBlue: false,
    red: { start: GridLocation.WEST, end: GridLocation.WEST, motionType: MotionType.STATIC } },

  // --- Type1AlphaBeta.svelte (4) ---
  { id: "t1-split-same", label: "Dual-shift: both hands shift in parallel, alpha to alpha", showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.NORTH, motionType: MotionType.PRO },
    blue: { start: GridLocation.WEST, end: GridLocation.SOUTH, motionType: MotionType.PRO } },
  { id: "t1-together-same", label: "Dual-shift: both hands shift from south, beta to beta", showBlue: true,
    red: { start: GridLocation.SOUTH, end: GridLocation.EAST, motionType: MotionType.PRO },
    blue: { start: GridLocation.SOUTH, end: GridLocation.WEST, motionType: MotionType.PRO } },
  { id: "t1-split-to-together", label: "Dual-shift: hands start apart and end together", showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.SOUTH, motionType: MotionType.PRO },
    blue: { start: GridLocation.WEST, end: GridLocation.SOUTH, motionType: MotionType.PRO } },
  { id: "t1-together-to-split", label: "Dual-shift: hands start together and end apart", showBlue: true,
    red: { start: GridLocation.SOUTH, end: GridLocation.EAST, motionType: MotionType.PRO },
    blue: { start: GridLocation.SOUTH, end: GridLocation.WEST, motionType: MotionType.PRO } },

  // --- Type1Gamma.svelte (2) ---
  { id: "t1-gamma-to-gamma", label: "Dual-shift from gamma to gamma", showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.SOUTH, motionType: MotionType.PRO },
    blue: { start: GridLocation.SOUTH, end: GridLocation.WEST, motionType: MotionType.PRO } },
  { id: "t1-gamma-opposite", label: "Dual-shift at gamma, hands moving in opposite directions", showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.NORTH, motionType: MotionType.PRO },
    blue: { start: GridLocation.SOUTH, end: GridLocation.EAST, motionType: MotionType.PRO } },

  // --- Type2Shifts.svelte (2) ---
  { id: "t2-red-shifts", label: "Shift: right hand shifts while left hand stays static", showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.SOUTH, motionType: MotionType.PRO },
    blue: { start: GridLocation.WEST, end: GridLocation.WEST, motionType: MotionType.STATIC } },
  { id: "t2-blue-shifts", label: "Shift: left hand shifts while right hand stays static", showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.EAST, motionType: MotionType.STATIC },
    blue: { start: GridLocation.WEST, end: GridLocation.NORTH, motionType: MotionType.PRO } },

  // --- Type3CrossShifts.svelte (1) ---
  { id: "t3-cross-shift", label: "Cross-shift: right hand shifts while left hand dashes across", showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.SOUTH, motionType: MotionType.PRO },
    blue: { start: GridLocation.WEST, end: GridLocation.EAST, motionType: MotionType.DASH } },

  // --- Type4Dash.svelte (1) ---
  { id: "t4-dash", label: "Dash: right hand dashes across while left hand stays static", showBlue: true,
    red: { start: GridLocation.SOUTH, end: GridLocation.NORTH, motionType: MotionType.DASH },
    blue: { start: GridLocation.WEST, end: GridLocation.WEST, motionType: MotionType.STATIC } },

  // --- Type5DualDash.svelte (1) ---
  { id: "t5-dual-dash", label: "Dual-dash: both hands dash across the center", showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.WEST, motionType: MotionType.DASH },
    blue: { start: GridLocation.WEST, end: GridLocation.EAST, motionType: MotionType.DASH } },

  // --- Type6Static.svelte (3) ---
  { id: "t6-static-alpha", label: "Static: both hands hold at alpha (opposite points)", showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.EAST, motionType: MotionType.STATIC },
    blue: { start: GridLocation.WEST, end: GridLocation.WEST, motionType: MotionType.STATIC } },
  { id: "t6-static-beta", label: "Static: both hands hold at beta (same point)", showBlue: true,
    red: { start: GridLocation.SOUTH, end: GridLocation.SOUTH, motionType: MotionType.STATIC },
    blue: { start: GridLocation.SOUTH, end: GridLocation.SOUTH, motionType: MotionType.STATIC } },
  { id: "t6-static-gamma", label: "Static: both hands hold at gamma (right angle)", showBlue: true,
    red: { start: GridLocation.EAST, end: GridLocation.EAST, motionType: MotionType.STATIC },
    blue: { start: GridLocation.SOUTH, end: GridLocation.SOUTH, motionType: MotionType.STATIC } },
];

export const GUIDE_MOTION_IDS: ReadonlySet<string> = new Set(
  GUIDE_MOTION_CONFIGS.map((c) => c.id)
);

/** True only for an exact, known config id — guards the dev write endpoint against path traversal. */
export function isKnownMotionId(id: string): boolean {
  return GUIDE_MOTION_IDS.has(id);
}

function makeMotion(
  color: MotionColor,
  startLoc: GridLocation,
  endLoc: GridLocation,
  type: MotionType
): MotionData {
  // Shifts (pro/anti) arc along the perimeter — the curved arc is what
  // distinguishes a shift from a dash. Dashes cut straight across the center.
  const pathShape = type === MotionType.DASH ? "linear" : "arc";
  return {
    motionType: type,
    rotationDirection: RotationDirection.NO_ROTATION,
    startLocation: startLoc,
    endLocation: endLoc,
    color,
    turns: 0,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    isVisible: true,
    propType: PropType.HAND,
    gridMode: GridMode.DIAMOND,
    pathShape,
    arrowLocation: startLoc,
    arrowPlacementData: {
      positionX: 0, positionY: 0, rotationAngle: 0,
      coordinates: null, svgCenter: null, svgMirrored: false,
      manualAdjustmentX: 0, manualAdjustmentY: 0,
    },
    propPlacementData: { positionX: 0, positionY: 0, rotationAngle: 0 },
  };
}

/** Build the same single-step SequenceData the old GuideMotionDemo built. */
export function buildGuideMotionSequence(config: GuideMotionConfig): SequenceData {
  const { red, blue } = config;
  const bStart = blue?.start ?? red.start;
  const bEnd = blue?.end ?? bStart;
  const bMotion = blue?.motionType ?? MotionType.STATIC;

  const startPosition: StartPositionData = {
    isStartPosition: true as const,
    id: `guide-${config.id}-start`,
    gridMode: GridMode.DIAMOND,
    motions: {
      blue: makeMotion(MotionColor.BLUE, bStart, bStart, MotionType.STATIC),
      red: makeMotion(MotionColor.RED, red.start, red.start, MotionType.STATIC),
    },
  };

  const step: StepData = {
    isStep: true as const,
    id: `guide-${config.id}-step1`,
    stepNumber: 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    gridMode: GridMode.DIAMOND,
    motions: {
      blue: makeMotion(MotionColor.BLUE, bStart, bEnd, bMotion),
      red: makeMotion(MotionColor.RED, red.start, red.end, red.motionType),
    },
  };

  return createSequenceData({
    id: `guide-motion-${config.id}`,
    name: config.id,
    word: config.id,
    steps: [step],
    startPosition,
    gridMode: GridMode.DIAMOND,
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:ci -- guide-motion-configs`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Typecheck**

Run: `npm run check`
Expected: no new errors from `guide-motion-configs.ts`. (If `StepData`/`StartPositionData`/`MotionData` field names drift from the snapshot above, fix them against the real model files — they were copied verbatim from the working `GuideMotionDemo.svelte`.)

- [ ] **Step 6: Commit**

```bash
git add "src/routes/(public)/guide/level-1/_components/guide-motion-configs.ts" tests/unit/guide/guide-motion-configs.test.ts
git commit -m "feat(guide): add guide-motion-configs source of truth + builder"
```

---

### Task 2: Bake helper — `bake-motion.ts`

**Files:**
- Create: `src/routes/test/guide-motion-bake/bake-motion.ts`

This helper is browser-only (WebCodecs/canvas) and is not unit-testable in jsdom; it is verified visually via the bake route (Task 4). The frame loop mirrors the proven loop in `VideoPreRenderer.ts:344-411`, swapping MediaRecorder for `VideoExporter` and threading hand/dark/visibility instead of the hardcoded staff/light/all-visible values.

- [ ] **Step 1: Create the helper**

Create `src/routes/test/guide-motion-bake/bake-motion.ts`:

```ts
/**
 * Browser-only bake helper for the Level 1 Guide motion demos.
 *
 * Drives Canvas2DAnimationRenderer (the live AnimatorCanvas renderer) frame by
 * frame and feeds each frame to VideoExporter (WebCodecs H.264). Output is
 * pixel-identical to the live demo. Dev-bake use only.
 */
import { Canvas2DAnimationRenderer } from "$lib/shared/animation-engine/services/implementations/Canvas2DAnimationRenderer";
import { getSequenceAnimationOrchestrator } from "$lib/shared/animation-engine/getSequenceAnimationOrchestrator";
import { getVideoExporter } from "$lib/shared/animation-engine/getVideoExporter";
import { generateBluePropSvg, generateRedPropSvg } from "$lib/shared/animation-engine/services/svg-generator";
import { DEFAULT_TRAIL_SETTINGS } from "$lib/shared/animation-engine/domain/types/TrailTypes";
import {
  buildGuideMotionSequence,
  type GuideMotionConfig,
} from "../../(public)/guide/level-1/_components/guide-motion-configs";

export interface BakeMotionOptions {
  /** Output square size in px (default 512 = 2× the ~256 display ceiling). */
  size?: number;
  /** Frames per animation step (default 30). */
  fps?: number;
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

/** Bake one config to an H.264 mp4 Blob. Throws on failure (caller reports it). */
export async function bakeGuideMotion(
  config: GuideMotionConfig,
  options: BakeMotionOptions = {}
): Promise<Blob> {
  const size = options.size ?? 512;
  const fps = options.fps ?? 30;
  const sequence = buildGuideMotionSequence(config);

  const container = document.createElement("div");
  container.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;opacity:0;pointer-events:none;z-index:-9999;`;
  document.body.appendChild(container);

  const renderer = new Canvas2DAnimationRenderer();
  const exporter = getVideoExporter();
  let manual: Awaited<ReturnType<typeof exporter.createManualExporter>> | null = null;

  try {
    await renderer.initialize(container, size, 1, true);
    renderer.setDarkMode(true, false);
    await Promise.all([
      renderer.loadGridTexture("diamond", false), // no nonradial points
      renderer.loadPerColorPropTextures("hand", "hand", true), // dark-mode hand textures
    ]);

    const [blueProp, redProp] = await Promise.all([
      generateBluePropSvg("hand", true),
      generateRedPropSvg("hand", true),
    ]);
    const bluePropDimensions = { width: blueProp.width, height: blueProp.height };
    const redPropDimensions = { width: redProp.width, height: redProp.height };

    const orchestrator = getSequenceAnimationOrchestrator();
    if (!orchestrator.initializeWithDomainData(sequence)) {
      throw new Error(`orchestrator init failed for ${config.id}`);
    }

    const canvas = renderer.getCanvas();
    if (!canvas) throw new Error(`no canvas for ${config.id}`);

    manual = await exporter.createManualExporter(size, size, {
      format: "mp4",
      fps,
      autoDownload: false,
    });

    const totalSteps = sequence.steps.length || 1;
    const totalFrames = Math.ceil(totalSteps * fps);

    // Position 0 (start pose) → 1 (end pose); <video loop> snaps end→start,
    // exactly as the live GuideMotionDemo playback loop does today.
    for (let frameIndex = 0; frameIndex <= totalFrames; frameIndex++) {
      const playbackPosition = frameIndex / fps;
      orchestrator.calculateState(playbackPosition);
      renderer.renderScene({
        blueProp: orchestrator.getBluePropState(),
        redProp: orchestrator.getRedPropState(),
        gridVisible: true,
        gridMode: "diamond",
        letter: null,
        turnsTuple: null,
        bluePropDimensions,
        redPropDimensions,
        blueTrailPoints: [],
        redTrailPoints: [],
        trailSettings: { ...DEFAULT_TRAIL_SETTINGS },
        currentTime: performance.now(),
        visibility: {
          gridVisible: true,
          propsVisible: true,
          trailsVisible: false,
          blueMotionVisible: config.showBlue,
          redMotionVisible: true,
        },
        bluePropFlipped: false,
        redPropFlipped: false,
        bluePropType: "hand",
        redPropType: "hand",
      });
      await nextPaint();
      await manual.addFrame(canvas);
    }

    return await manual.finish();
  } catch (error) {
    manual?.cancel();
    throw error;
  } finally {
    renderer.destroy();
    container.remove();
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: no errors. The `renderScene({...})` object is copied field-for-field from `VideoPreRenderer.ts:367-391`, so it satisfies the same param type. If a field name mismatches, align it to the live `VideoPreRenderer` call (the canonical working invocation).

- [ ] **Step 3: Commit**

```bash
git add src/routes/test/guide-motion-bake/bake-motion.ts
git commit -m "feat(guide): add browser bake helper (Canvas2DAnimationRenderer + VideoExporter)"
```

---

### Task 3: Dev write endpoint — `+server.ts`

**Files:**
- Create: `src/routes/test/guide-motion-bake/+server.ts`

The `id` allowlist validator (`isKnownMotionId`) is already unit-tested in Task 1. The endpoint itself is verified by (a) the dev bake run writing files (Task 4) and (b) a curl prod-guard check below.

- [ ] **Step 1: Create the endpoint**

Create `src/routes/test/guide-motion-bake/+server.ts`:

```ts
import { error, json } from "@sveltejs/kit";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { RequestHandler } from "./$types";
import { isKnownMotionId } from "../../(public)/guide/level-1/_components/guide-motion-configs";

const MOTIONS_DIR = path.join(process.cwd(), "static", "guide", "level-1", "motions");

/** Dev-only: persist a baked mp4 to static/. Rejected in production builds. */
export const POST: RequestHandler = async ({ request, url }) => {
  if (!import.meta.env.DEV) {
    throw error(403, "Bake write endpoint is dev-only");
  }

  const id = url.searchParams.get("id") ?? "";
  if (!isKnownMotionId(id)) {
    throw error(400, `Unknown motion id: ${JSON.stringify(id)}`);
  }

  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw error(400, "Empty request body");
  }

  await mkdir(MOTIONS_DIR, { recursive: true });
  // id is allowlisted to a fixed slug set → no traversal possible.
  await writeFile(path.join(MOTIONS_DIR, `${id}.mp4`), buffer);

  return json({ ok: true, id, bytes: buffer.byteLength });
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: no errors. (`./$types` is generated by SvelteKit; if `npm run check` runs `svelte-kit sync` first it will exist. If the type is missing, run `npx svelte-kit sync` once.)

- [ ] **Step 3: Verify the prod guard + id validation (manual, after dev server is up in Task 4)**

With the dev server running, run:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://localhost:5173/test/guide-motion-bake?id=../evil" --data-binary "x"
```
Expected: `400` (unknown id rejected, no file written).

- [ ] **Step 4: Commit**

```bash
git add src/routes/test/guide-motion-bake/+server.ts
git commit -m "feat(guide): add dev-only bake write endpoint with id allowlist guard"
```

---

### Task 4: Bake UI route — `+page.svelte`

**Files:**
- Create: `src/routes/test/guide-motion-bake/+page.svelte`

Follows the `card-back-capture` capture-route pattern: render to blob, show a preview grid, POST on success. Verified visually (browser), not unit-tested.

- [ ] **Step 1: Create the page**

Create `src/routes/test/guide-motion-bake/+page.svelte`:

```svelte
<script lang="ts">
  import { GUIDE_MOTION_CONFIGS } from "../../(public)/guide/level-1/_components/guide-motion-configs";
  import { bakeGuideMotion } from "./bake-motion";

  type Row = {
    id: string;
    label: string;
    status: "pending" | "baking" | "done" | "error";
    url: string | null;
    bytes: number | null;
    error: string | null;
  };

  let rows = $state<Row[]>(
    GUIDE_MOTION_CONFIGS.map((c) => ({
      id: c.id, label: c.label, status: "pending", url: null, bytes: null, error: null,
    }))
  );
  let running = $state(false);
  let doneCount = $derived(rows.filter((r) => r.status === "done").length);

  async function bakeAll() {
    if (running) return;
    running = true;
    for (let i = 0; i < GUIDE_MOTION_CONFIGS.length; i++) {
      const config = GUIDE_MOTION_CONFIGS[i];
      rows[i] = { ...rows[i], status: "baking", error: null };
      try {
        const blob = await bakeGuideMotion(config);
        const res = await fetch(`/test/guide-motion-bake?id=${config.id}`, {
          method: "POST",
          body: blob,
        });
        if (!res.ok) throw new Error(`write failed: ${res.status} ${await res.text()}`);
        const { bytes } = await res.json();
        const prev = rows[i].url;
        if (prev) URL.revokeObjectURL(prev);
        rows[i] = { ...rows[i], status: "done", url: URL.createObjectURL(blob), bytes };
      } catch (e) {
        rows[i] = { ...rows[i], status: "error", error: e instanceof Error ? e.message : String(e) };
      }
    }
    running = false;
  }
</script>

<div class="bake-page">
  <header>
    <h1>Guide Motion Bake</h1>
    <p>Dev-only. Bakes the {GUIDE_MOTION_CONFIGS.length} Level 1 Guide hand-motion demos to
      <code>static/guide/level-1/motions/&lcub;id&rcub;.mp4</code>. Eyeball the grid, then commit the assets.</p>
    <button onclick={bakeAll} disabled={running}>
      {running ? `Baking… ${doneCount}/${rows.length}` : `Bake all (${rows.length})`}
    </button>
    <span class="progress">{doneCount} / {rows.length} baked</span>
  </header>

  <div class="grid">
    {#each rows as row (row.id)}
      <figure class="cell" data-status={row.status}>
        <div class="preview">
          {#if row.url}
            <video src={row.url} autoplay loop muted playsinline></video>
          {:else}
            <div class="placeholder">{row.status}</div>
          {/if}
        </div>
        <figcaption>
          <code>{row.id}</code>
          {#if row.bytes}<span class="bytes">{(row.bytes / 1024).toFixed(0)} KB</span>{/if}
          {#if row.error}<span class="err">{row.error}</span>{/if}
        </figcaption>
      </figure>
    {/each}
  </div>
</div>

<style>
  .bake-page { padding: 2rem; color: #eee; background: #1a1a1a; min-height: 100vh; }
  header { margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
  header h1 { width: 100%; margin: 0 0 0.5rem; }
  header p { width: 100%; margin: 0 0 0.5rem; opacity: 0.8; }
  button { padding: 0.6rem 1.2rem; font-size: 1rem; cursor: pointer; }
  button:disabled { opacity: 0.6; cursor: default; }
  .progress { opacity: 0.8; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; }
  .cell { margin: 0; background: #222; border: 1px solid #333; border-radius: 6px; overflow: hidden; }
  .cell[data-status="error"] { border-color: #b00; }
  .cell[data-status="done"] { border-color: #2a7; }
  .preview { aspect-ratio: 1; background: #000; }
  .preview video { width: 100%; height: 100%; object-fit: contain; }
  .placeholder { display: grid; place-items: center; width: 100%; height: 100%; opacity: 0.5; font-size: 0.85rem; }
  figcaption { padding: 0.5rem; font-size: 0.8rem; display: flex; flex-direction: column; gap: 0.25rem; }
  .bytes { opacity: 0.7; }
  .err { color: #f88; word-break: break-word; }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 3: Bake the assets (manual, requires the user)**

The dev server is the user's (port 5173). Ask the user to:
1. Open `http://localhost:5173/test/guide-motion-bake`.
2. Click **Bake all** and watch the grid fill to `19 / 19 baked`.
3. Eyeball: shifts arc to the adjacent point, dashes cut straight across, statics hold; blue hand hidden on the first five `hm-*` demos; dark grid, no nonradial points; loops are clean.
4. Confirm files exist:

```bash
ls -1 static/guide/level-1/motions/ | wc -l   # expect 19
du -sh static/guide/level-1/motions/          # expect well under 3MB
```

If any cell shows an error or wrong motion, fix the config/helper and re-bake that state before continuing. This is the quality gate — do not proceed to Task 7 swaps until the grid is correct.

- [ ] **Step 4: Commit the route + generated assets**

```bash
git add src/routes/test/guide-motion-bake/+page.svelte static/guide/level-1/motions/
git commit -m "feat(guide): add bake UI route and commit baked motion mp4 assets"
```

---

### Task 5: Runtime consumer — `GuideMotionVideo.svelte`

**Files:**
- Create: `src/routes/(public)/guide/level-1/_components/GuideMotionVideo.svelte`

Imports nothing from the configs/engine — keeps the guide page free of animation code.

- [ ] **Step 1: Create the component**

Create `src/routes/(public)/guide/level-1/_components/GuideMotionVideo.svelte`:

```svelte
<script lang="ts">
  // Plain looping video of a pre-baked guide motion demo.
  // Assets are generated by /test/guide-motion-bake — see guide-motion-configs.ts.
  let { id, label }: { id: string; label: string } = $props();
</script>

<video
  class="guide-motion-video"
  src={`/guide/level-1/motions/${id}.mp4`}
  autoplay
  loop
  muted
  playsinline
  preload="metadata"
  aria-label={label}
></video>

<style>
  .guide-motion-video {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    object-fit: contain;
  }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/routes/(public)/guide/level-1/_components/GuideMotionVideo.svelte"
git commit -m "feat(guide): add GuideMotionVideo consumer component"
```

---

### Task 6: Swap the 19 instances across 8 section files

Each file: (a) replace the script imports (drop `GuideMotionDemo`, `MotionType`, `GridLocation`; add `GuideMotionVideo`), (b) replace each `<GuideMotionDemo …/>` with `<GuideMotionVideo id="…" label="…" />`. The `id`/`label` come from `GUIDE_MOTION_CONFIGS` (Task 1). Verified by `npm run check` + visual page load.

**Files:**
- Modify: all 8 `src/routes/(public)/guide/level-1/_sections/ch10/*.svelte` listed below.

- [ ] **Step 1: HandMotions.svelte**

Replace the import block:

```svelte
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideMotionDemo from "../../_components/GuideMotionDemo.svelte";
  import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
```
with:
```svelte
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideMotionVideo from "../../_components/GuideMotionVideo.svelte";
```

Then replace each demo (match on the exact existing tag):

| Old `<GuideMotionDemo …>` | New |
|---|---|
| `<GuideMotionDemo start={GridLocation.WEST} end={GridLocation.WEST} motionType={MotionType.STATIC} />` (the Start cell, line ~18) | `<GuideMotionVideo id="hm-start" label="Hand resting static at west (starting position)" />` |
| `<GuideMotionDemo start={GridLocation.WEST} end={GridLocation.NORTH} motionType={MotionType.PRO} />` | `<GuideMotionVideo id="hm-shift-wn" label="Hand shifts from west to north" />` |
| `<GuideMotionDemo start={GridLocation.WEST} end={GridLocation.SOUTH} motionType={MotionType.PRO} />` | `<GuideMotionVideo id="hm-shift-ws" label="Hand shifts from west to south" />` |
| `<GuideMotionDemo start={GridLocation.WEST} end={GridLocation.EAST} motionType={MotionType.DASH} />` | `<GuideMotionVideo id="hm-dash-we" label="Hand dashes straight across from west to east" />` |
| `<GuideMotionDemo start={GridLocation.WEST} end={GridLocation.WEST} motionType={MotionType.STATIC} />` (the static branch, line ~68) | `<GuideMotionVideo id="hm-static-w" label="Hand stays static at west" />` |

Note: the Start cell (`hm-start`) and the static-branch cell (`hm-static-w`) have identical old markup. Replace the first occurrence (inside `.start-cell`) with `hm-start` and the second (inside the `static` branch) with `hm-static-w`. Use surrounding context to disambiguate.

- [ ] **Step 2: Type1AlphaBeta.svelte**

Import block → same swap (drop demo/MotionType/GridLocation, add `GuideMotionVideo`). Replace the 4 demos in document order:

1. `start=EAST end=NORTH PRO, blueStart=WEST blueEnd=SOUTH PRO` → `<GuideMotionVideo id="t1-split-same" label="Dual-shift: both hands shift in parallel, alpha to alpha" />`
2. `start=SOUTH end=EAST PRO, blueStart=SOUTH blueEnd=WEST PRO` → `<GuideMotionVideo id="t1-together-same" label="Dual-shift: both hands shift from south, beta to beta" />`
3. `start=EAST end=SOUTH PRO, blueStart=WEST blueEnd=SOUTH PRO` → `<GuideMotionVideo id="t1-split-to-together" label="Dual-shift: hands start apart and end together" />`
4. `start=SOUTH end=EAST PRO, blueStart=SOUTH blueEnd=WEST PRO` → `<GuideMotionVideo id="t1-together-to-split" label="Dual-shift: hands start together and end apart" />`

(Instances 2 and 4 have identical markup; disambiguate by order — 2 is under the "Together-Same" heading, 4 under "Together to split".)

- [ ] **Step 3: Type1Gamma.svelte**

Import swap. Replace 2 demos in order:

1. `start=EAST end=SOUTH PRO, blueStart=SOUTH blueEnd=WEST PRO` → `<GuideMotionVideo id="t1-gamma-to-gamma" label="Dual-shift from gamma to gamma" />`
2. `start=EAST end=NORTH PRO, blueStart=SOUTH blueEnd=EAST PRO` → `<GuideMotionVideo id="t1-gamma-opposite" label="Dual-shift at gamma, hands moving in opposite directions" />`

- [ ] **Step 4: Type2Shifts.svelte**

Import swap. Replace 2 demos in order:

1. `start=EAST end=SOUTH PRO, blueStart=WEST showBlue` → `<GuideMotionVideo id="t2-red-shifts" label="Shift: right hand shifts while left hand stays static" />`
2. `start=EAST end=EAST STATIC, blueStart=WEST blueEnd=NORTH PRO` → `<GuideMotionVideo id="t2-blue-shifts" label="Shift: left hand shifts while right hand stays static" />`

- [ ] **Step 5: Type3CrossShifts.svelte**

Import swap. Replace the 1 demo:

`start=EAST end=SOUTH PRO, blueStart=WEST blueEnd=EAST DASH` → `<GuideMotionVideo id="t3-cross-shift" label="Cross-shift: right hand shifts while left hand dashes across" />`

- [ ] **Step 6: Type4Dash.svelte**

Import swap. Replace the 1 demo:

`start=SOUTH end=NORTH DASH, blueStart=WEST showBlue` → `<GuideMotionVideo id="t4-dash" label="Dash: right hand dashes across while left hand stays static" />`

- [ ] **Step 7: Type5DualDash.svelte**

Import swap. Replace the 1 demo:

`start=EAST end=WEST DASH, blueStart=WEST blueEnd=EAST DASH` → `<GuideMotionVideo id="t5-dual-dash" label="Dual-dash: both hands dash across the center" />`

- [ ] **Step 8: Type6Static.svelte**

Import swap. Replace 3 demos in order:

1. `start=EAST end=EAST STATIC, blueStart=WEST blueEnd=WEST STATIC` → `<GuideMotionVideo id="t6-static-alpha" label="Static: both hands hold at alpha (opposite points)" />`
2. `start=SOUTH end=SOUTH STATIC, blueStart=SOUTH blueEnd=SOUTH STATIC` → `<GuideMotionVideo id="t6-static-beta" label="Static: both hands hold at beta (same point)" />`
3. `start=EAST end=EAST STATIC, blueStart=SOUTH blueEnd=SOUTH STATIC` → `<GuideMotionVideo id="t6-static-gamma" label="Static: both hands hold at gamma (right angle)" />`

- [ ] **Step 9: Verify zero leftover demo references in section files**

Run: `npm run check`
Expected: no errors, and in particular no "unused import" errors (every `GuideMotionDemo`/`MotionType`/`GridLocation` import must be gone from these 8 files).

Then grep:

```bash
grep -rl "GuideMotionDemo" src/routes/\(public\)/guide/level-1/_sections/
```
Expected: no output (zero matches).

- [ ] **Step 10: Commit**

```bash
git add "src/routes/(public)/guide/level-1/_sections/ch10/"
git commit -m "feat(guide): swap 19 live motion demos for baked GuideMotionVideo"
```

---

### Task 7: Remove `GuideMotionDemo.svelte` and verify the engine is gone

**Files:**
- Remove: `src/routes/(public)/guide/level-1/_components/GuideMotionDemo.svelte`

- [ ] **Step 1: Confirm no references remain anywhere**

Run:

```bash
grep -rl "GuideMotionDemo" src/
```
Expected: no output. (The builder logic now lives in `guide-motion-configs.ts`; nothing else should import the old component.)

- [ ] **Step 2: Delete the file**

```bash
git rm "src/routes/(public)/guide/level-1/_components/GuideMotionDemo.svelte"
```

- [ ] **Step 3: Verify the guide tree mounts zero animation engine**

Run:

```bash
grep -rE "AnimatorCanvas|AnimationPlaybackController" src/routes/\(public\)/guide/
```
Expected: no output (the guide no longer references the live animation engine).

- [ ] **Step 4: Typecheck**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 5: Visual verification (requires the user)**

Ask the user to open `http://localhost:5173/guide/level-1` (Chapter 10 sections), and confirm:
- All 19 demos play immediately on load — no blank boxes, no mount/unmount flicker while scrolling.
- Shifts arc, dashes cut straight, statics hold; the first five hand-motion demos show one hand only.
- DevTools Performance/console shows no `requestAnimationFrame` animation loop from the guide page.

(Per project rules: do not claim the visual result is correct without the user confirming or a screenshot.)

- [ ] **Step 6: Commit**

```bash
git add -A "src/routes/(public)/guide/level-1/"
git commit -m "refactor(guide): remove live GuideMotionDemo now that demos are baked video"
```

---

## Re-bake workflow (documented at the top of `guide-motion-configs.ts`)

1. Edit `guide-motion-configs.ts`.
2. `npm run dev`, open `/test/guide-motion-bake`, click **Bake all**.
3. Eyeball the preview grid.
4. Commit the changed `static/guide/level-1/motions/*.mp4`.

## Final verification checklist

- [ ] `npm run test:ci -- guide-motion-configs` green.
- [ ] `npm run check` clean.
- [ ] `static/guide/level-1/motions/` has 19 `.mp4` files, total < 3MB.
- [ ] `grep -rl "GuideMotionDemo" src/` → empty.
- [ ] `grep -rE "AnimatorCanvas|AnimationPlaybackController" src/routes/(public)/guide/` → empty.
- [ ] User confirms `/guide/level-1` Chapter 10 demos play instantly with no scroll churn.
