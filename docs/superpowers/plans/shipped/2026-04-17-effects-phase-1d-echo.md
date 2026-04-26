# Effects Phase 1d (Revised) — Echo Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Replace the shipped (but rejected) Motion effect with **Echo** — beat-onset phantoms of the staff that dissolve over N beats. Reuses the entire Phase 1d scaffolding (chip slot, contract, renderer wiring, Customize layout); replaces internals + fields + names.

**Spec:** `docs/superpowers/specs/2026-04-17-effects-phase-1d-echo-design.md`
**Resumes from:** tag `phase-1d-motion-complete` (the Motion implementation that's being replaced in-place)
**Project guardrails:** project CLAUDE.md bans worktrees/branches — work on `main`. Never run `npm run dev` (port 5173 is the user's dev server). Never use `--no-verify` on commits.

---

## Critical architecture notes

**Two `EffectType` enums must change:**
1. `src/lib/shared/effects/domain/EffectsConfig.ts` (intent layer)
2. `src/lib/shared/animation-engine/domain/types/TipEffectTypes.ts` (tip assignment)

Both must add `"echo"` and remove `"motion"`. The migration walks `tipEffectMap` and rewrites any `effect: "motion"` assignment to `effect: "echo"`.

**Phantom aging uses `currentStep`, not dt.** `currentStep` is already in `RenderFrameParams` (line 99 of IAnimationRenderLoop.ts) and advances continuously during playback. Each phantom stores the `currentStep` value at capture. Age = `(current - captured) / interval`. No bpm needed.

**Naming rename scope (use these search-replace pairs):**
- `motion` → `echo` (word boundary)
- `Motion` → `Echo`
- `MOTION` → `ECHO`
- Files: `Motion2DRenderer*` → `Echo2DRenderer*`; `MotionCustomize` → `EchoCustomize`; `motion-presets` → `echo-presets`; `IMotionOverlayRenderer` → `IEchoOverlayRenderer`; `MotionOverlayRenderer` → `EchoOverlayRenderer`; `MotionTipInput` → `EchoTipInput`.
- Svelte: `EFFECT_COLORS.motion` → `EFFECT_COLORS.echo`; `EFFECT_LABELS.motion = "Motion"` → `EFFECT_LABELS.echo = "Echo"`; chip icon `fa-wind` → `fa-clone`.
- DO NOT rename the legacy `configState.motion` references in `EffectsLayer.svelte` that drive the legacy `PropMotionEffects` mount. Those are a DIFFERENT motion subsystem (Phase 3 retires them). Only the unified-intent-layer `motion` → `echo`. If in doubt: only touch code that passes through `getUnifiedEffectsState()` / `unifiedState.motion` / `resolveMotion*D`.

---

## Task 1: Rename EffectType + bump v5→v6 migration + EchoIntent

**Files:**
- Modify: `src/lib/shared/effects/domain/EffectsConfig.ts` (intent EffectType + MotionIntent → EchoIntent; bump version)
- Modify: `src/lib/shared/animation-engine/domain/types/TipEffectTypes.ts` (tip-assignment EffectType)
- Modify: `src/lib/shared/effects/domain/defaults.ts` (motion key → echo key + new defaults)
- Modify: `src/lib/shared/effects/domain/migrations.ts` (v5→v6 case)
- Modify: `src/lib/shared/effects/domain/migrations.test.ts` (new test cases)
- Modify: `src/lib/shared/effects/domain/EffectsConfig.ts` `EffectsOverrides` — `motion2D`/`motion3D` → `echo2D`/`echo3D`; `EffectsConfig.motion` → `echo`; `activePresets.motion` → `echo`.

**EchoIntent shape:**
```ts
export interface EchoIntent {
  intensity: number;
  decay: number;
  interval: number;
  shape: "staff" | "tips" | "both";
  colorMode: "solid" | "rainbow" | "prop-matched" | "gradient";
  color: string;
  thickness: number;
}
```

**Defaults:**
```ts
echo: {
  intensity: 0.7,
  decay: 4,
  interval: 1,
  shape: "staff",
  colorMode: "solid",
  color: "#ffffff",
  thickness: 3,
},
```

**Migration v5→v6:**
```ts
if (version < 6) {
  // Rename the top-level 'motion' block to 'echo' with fresh defaults.
  // The old motion fields (blur/speedLines/threshold/color/colorMode/length/count)
  // don't map — discard and reseed defaults.
  if ((input as any).motion) {
    (input as any).echo = {
      intensity: 0.7,
      decay: 4,
      interval: 1,
      shape: "staff",
      colorMode: "solid",
      color: "#ffffff",
      thickness: 3,
    };
    delete (input as any).motion;
  }
  // Walk tipEffectMap entries and rewrite any "motion" assignment to "echo".
  if (input.tipEffectMap) {
    for (const key of Object.keys(input.tipEffectMap)) {
      const entry: any = (input.tipEffectMap as any)[key];
      if (entry?.effect === "motion") entry.effect = "echo";
    }
  }
  // activePresets rename.
  if (input.activePresets && "motion" in input.activePresets) {
    (input.activePresets as any).echo = (input.activePresets as any).motion;
    delete (input.activePresets as any).motion;
  }
}
```

**Test cases to add:**
```ts
  it("migrates v5 motion field to v6 echo with fresh defaults", () => {
    const v5 = {
      version: 5,
      motion: { blur: 0.6, speedLines: 0.8, threshold: 0.3, color: "#ff0", colorMode: "solid", length: 0.7, count: 8 },
    };
    const out = migrateEffectsConfig(v5);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect((out as any).motion).toBeUndefined();
    expect(out.echo.intensity).toBe(0.7);
    expect(out.echo.shape).toBe("staff");
    expect(out.echo.color).toBe("#ffffff");
  });

  it("migrates v5 tipEffectMap motion entries to echo", () => {
    const v5 = {
      version: 5,
      tipEffectMap: { "*": { effect: "motion" }, "0": { effect: "motion" }, "1-0": { effect: "sparkles" } },
    };
    const out = migrateEffectsConfig(v5);
    expect(out.tipEffectMap["*"]?.effect).toBe("echo");
    expect(out.tipEffectMap["0"]?.effect).toBe("echo");
    expect(out.tipEffectMap["1-0"]?.effect).toBe("sparkles");
  });

  it("migrates v5 activePresets.motion → v6 activePresets.echo", () => {
    const v5 = {
      version: 5,
      activePresets: { motion: "motion-anime", sparkles: "sparkles-fairy-dust" },
    };
    const out = migrateEffectsConfig(v5);
    expect((out.activePresets as any).motion).toBeUndefined();
    expect(out.activePresets.echo).toBe("motion-anime");
  });
```

- [ ] **Step 1:** Write failing tests.
- [ ] **Step 2:** Bump `EFFECTS_CONFIG_VERSION = 6`.
- [ ] **Step 3:** In `EffectsConfig.ts`: replace `EffectType` `"motion"` → `"echo"`; replace `MotionIntent` with `EchoIntent`; `motion: MotionIntent` → `echo: EchoIntent` in `EffectsConfig`; `activePresets.motion` → `activePresets.echo`; `motion2D`/`motion3D` → `echo2D`/`echo3D` in `EffectsOverrides`.
- [ ] **Step 4:** In `TipEffectTypes.ts` (`src/lib/shared/animation-engine/domain/types/TipEffectTypes.ts`): replace `"motion"` with `"echo"` in the `EffectType` union.
- [ ] **Step 5:** In `defaults.ts`: `motion:` block → `echo:` block with new defaults; `activePresets.motion: null` → `activePresets.echo: null`.
- [ ] **Step 6:** Update `migrations.ts` with the v5→v6 case; also update the spread-merge block to reference `echo` instead of `motion`.
- [ ] **Step 7:** Run tests green. Run `npm run check` — expect many red-line errors in downstream files (will be fixed in later tasks). Accept that; commit this task as a contained unit anyway — verify the migration tests pass and the domain files themselves compile clean.

Expected state after Task 1: migration tests green, `EffectsConfig.ts` + `TipEffectTypes.ts` + `defaults.ts` + `migrations.ts` all compile; downstream consumers (`canvas2d-types.ts`, `webgl3d-types.ts`, `canvas2d-translator.ts`, `webgl3d-translator.ts`) now have red errors referencing `MotionIntent` — those get fixed in Task 2.

- [ ] **Step 8: Commit.** `refactor(effects): rename motion→echo + bump v5→v6 with tipEffectMap migration`

---

## Task 2: Rename translator types + resolvers

**Files:**
- Modify: `src/lib/shared/effects/translators/canvas2d-types.ts` (Motion2DParams → Echo2DParams, MotionIntent import → EchoIntent)
- Modify: `src/lib/shared/effects/translators/canvas2d-translator.ts` (resolveMotion2D → resolveEcho2D)
- Modify: `src/lib/shared/effects/translators/webgl3d-types.ts` (Motion3DParams → Echo3DParams)
- Modify: `src/lib/shared/effects/translators/webgl3d-translator.ts` (resolveMotion3D → resolveEcho3D)
- Modify: `src/lib/shared/effects/translators/canvas2d-translator.test.ts` (if it references Motion)

**Revised Echo2DParams** (drop motion-specific `fadeAlpha`/`streakLength`):
```ts
export interface Echo2DParams extends EchoIntent {
  /** Canvas composite op. Default 'lighter' for additive brighten. */
  blendMode?: GlobalCompositeOperation;
}
```

**Echo3DParams** (drop motion-specific `blurSamples`/`streakLength`):
```ts
export interface Echo3DParams extends EchoIntent {
  /** Max phantom mesh count per prop (ring buffer). Derived from decay. */
  poolSize: number;
}
```

**Resolvers:**
```ts
export function resolveEcho2D(intent: EchoIntent, override: Partial<Echo2DParams> = {}): Echo2DParams {
  return { ...intent, blendMode: "lighter", ...override };
}
export function resolveEcho3D(intent: EchoIntent, override: Partial<Echo3DParams> = {}): Echo3DParams {
  return { ...intent, poolSize: Math.max(2, Math.ceil(intent.decay / intent.interval) + 2), ...override };
}
```

- [ ] **Step 1:** Update canvas2d-types.ts (Motion→Echo, drop motion-specific fields, add blendMode).
- [ ] **Step 2:** Update webgl3d-types.ts (Motion→Echo, poolSize derived from decay).
- [ ] **Step 3:** Update canvas2d-translator.ts (resolveMotion2D → resolveEcho2D).
- [ ] **Step 4:** Update webgl3d-translator.ts (resolveMotion3D → resolveEcho3D).
- [ ] **Step 5:** `npm run check` — expect further red in AnimationEngine/RenderLoop/EffectsLayer (fixed in later tasks). OK to commit.
- [ ] **Step 6: Commit.** `refactor(effects): rename Motion translators to Echo + simplify params`

---

## Task 3: Rename contract + wrapper class + renderer skeleton

**Files:**
- Rename file: `src/lib/shared/animation-engine/services/contracts/IMotionOverlayRenderer.ts` → `IEchoOverlayRenderer.ts`
- Rename file: `src/lib/shared/effects/renderers/Motion2DRenderer.ts` → `Echo2DRenderer.ts`
- Rename file: `src/lib/shared/effects/renderers/Motion2DRenderer.test.ts` → `Echo2DRenderer.test.ts` (will be rewritten in Task 4)
- Locate MotionOverlayRenderer wrapper (grep `class MotionOverlayRenderer`), rename file + class → EchoOverlayRenderer.

Inside each renamed file: update class name, type imports (MotionIntent → EchoIntent, Motion2DParams → Echo2DParams, MotionTipInput → EchoTipInput), method params, comments. Replace `MotionTipInput` interface:

```ts
export interface EchoTipInput {
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
  /** Current animation step index (fractional). Used for beat-onset detection. */
  currentStep: number;
  /** Hex per prop for prop-matched colorMode. */
  blueColor: string;
  redColor: string;
}
```

**Echo2DRenderer skeleton:**
```ts
export class Echo2DRenderer {
  private phantomsBlue: Array<{ posA: Vec2; posB: Vec2; capturedStep: number }> = [];
  private phantomsRed: Array<{ posA: Vec2; posB: Vec2; capturedStep: number }> = [];
  private lastBeatIndex: number = -1;

  render(ctx: CanvasRenderingContext2D, params: Echo2DParams, tips: EchoTipInput): void {
    // Implementation in Task 4
  }

  dispose(): void {
    this.phantomsBlue = [];
    this.phantomsRed = [];
    this.lastBeatIndex = -1;
  }
}
```

- [ ] **Step 1:** Delete old MotionBlur wrapper + test. Git-rename (use `git mv` or just `rm` + create new).
- [ ] **Step 2:** Create IEchoOverlayRenderer contract (copy ISparklesOverlayRenderer but with Echo types + `renderFrame(params, tips)` — NO dt parameter, since we use currentStep).
- [ ] **Step 3:** Create Echo2DRenderer skeleton (class + dispose + empty render).
- [ ] **Step 4:** Create EchoOverlayRenderer wrapper (mirror whatever SparklesOverlayRenderer does — acquire canvas context, call renderer, etc., but WITHOUT dt since echo doesn't need it).
- [ ] **Step 5:** `npm run check` — expect errors in AnimationEngine/RenderLoop (Task 6 fixes those).
- [ ] **Step 6: Commit.** `refactor(effects): rename Motion renderer + contract → Echo (skeleton)`

---

## Task 4: Implement Echo2DRenderer + unit tests

Replace the skeleton with the real beat-onset phantom logic.

**Files:**
- Modify: `src/lib/shared/effects/renderers/Echo2DRenderer.ts`
- Modify: `src/lib/shared/effects/renderers/Echo2DRenderer.test.ts`

**Render logic:**
```ts
render(ctx, params, tips) {
  // 1. Beat onset detection.
  const beatIndex = Math.floor(tips.currentStep / params.interval);
  if (beatIndex > this.lastBeatIndex) {
    // Capture phantom(s) at current tips.
    if (tips.bluePosA && tips.bluePosB) {
      this.phantomsBlue.push({ posA: {...tips.bluePosA}, posB: {...tips.bluePosB}, capturedStep: tips.currentStep });
    }
    if (tips.redPosA && tips.redPosB) {
      this.phantomsRed.push({ posA: {...tips.redPosA}, posB: {...tips.redPosB}, capturedStep: tips.currentStep });
    }
    this.lastBeatIndex = beatIndex;
  }

  // 2. Cull phantoms whose age >= decay.
  const cullAge = params.decay;
  const ageInIntervals = (p: {capturedStep: number}) =>
    (tips.currentStep - p.capturedStep) / params.interval;
  this.phantomsBlue = this.phantomsBlue.filter(p => ageInIntervals(p) < cullAge);
  this.phantomsRed = this.phantomsRed.filter(p => ageInIntervals(p) < cullAge);

  // 3. Render each phantom.
  if (!this.phantomsBlue.length && !this.phantomsRed.length) return;
  const prevComposite = ctx.globalCompositeOperation;
  const prevAlpha = ctx.globalAlpha;
  const prevLineCap = ctx.lineCap;
  try {
    ctx.globalCompositeOperation = params.blendMode ?? "lighter";
    ctx.lineCap = "round";
    ctx.lineWidth = params.thickness;
    for (const phantom of this.phantomsBlue) {
      const age = ageInIntervals(phantom);
      const alpha = params.intensity * Math.max(0, 1 - age / cullAge);
      const color = this.pickColor(params, Math.floor(phantom.capturedStep / params.interval), age, "blue", tips.blueColor);
      this.drawPhantom(ctx, phantom, params, alpha, color);
    }
    for (const phantom of this.phantomsRed) {
      const age = ageInIntervals(phantom);
      const alpha = params.intensity * Math.max(0, 1 - age / cullAge);
      const color = this.pickColor(params, Math.floor(phantom.capturedStep / params.interval), age, "red", tips.redColor);
      this.drawPhantom(ctx, phantom, params, alpha, color);
    }
  } finally {
    ctx.globalCompositeOperation = prevComposite;
    ctx.globalAlpha = prevAlpha;
    ctx.lineCap = prevLineCap;
  }
}

private pickColor(params, beatIdx, age, prop, propColor) {
  switch (params.colorMode) {
    case "rainbow":
      return `hsl(${(beatIdx * 47) % 360}, 80%, 60%)`;
    case "gradient":
      return `hsl(${(age / params.decay) * 240}, 80%, 60%)`;
    case "prop-matched":
      return propColor;
    default:
      return params.color;
  }
}

private drawPhantom(ctx, phantom, params, alpha, color) {
  ctx.globalAlpha = alpha;
  if (params.shape === "staff" || params.shape === "both") {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(phantom.posA.x, phantom.posA.y);
    ctx.lineTo(phantom.posB.x, phantom.posB.y);
    ctx.stroke();
  }
  if (params.shape === "tips" || params.shape === "both") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(phantom.posA.x, phantom.posA.y, params.thickness, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(phantom.posB.x, phantom.posB.y, params.thickness, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

**Tests (TDD — write failing first):**
1. Crossing a beat boundary captures phantoms at the tips.
2. Phantoms are NOT captured when `currentStep` increments within the same beat.
3. Phantoms older than `decay` beats are culled.
4. With shape=`staff`, `moveTo`/`lineTo`/`stroke` are called.
5. With shape=`tips`, `arc`/`fill` are called and stroke is NOT.
6. `dispose()` empties both phantom arrays.

- [ ] **Step 1:** Write tests first.
- [ ] **Step 2:** Run — see fail.
- [ ] **Step 3:** Implement render() per the logic above.
- [ ] **Step 4:** Tests green.
- [ ] **Step 5: Commit.** `feat(effects): Echo2DRenderer — beat-onset phantom capture + decay`

---

## Task 5: Thread `currentStep` through the render path

**Files:**
- Modify: `src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts` — `RenderLoopConfig.motionRenderer` → `echoRenderer` (type `IEchoOverlayRenderer`); `RenderFrameParams.motionConfig` → `echoConfig` (type `Echo2DParams`).
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts` — all `motionRenderer`/`motionConfig`/`consecutiveMotionErrors`/`motionDisabledByError`/`lastMotionFrameTime`/`motionActive` references renamed. Pass `currentStep` into the echo input (already a local variable from the destructure at line 472). Remove dt tracking for echo — it doesn't need dt.
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts` — all `motion2DRenderer`/`motionRenderer`/`syncMotionOverlay`/`prevMotionIntentRef`/`prevHasMotionTips`/`motionConfig` references renamed. Intent-diff block references `intent.motion` → `intent.echo` via `resolveEcho2D`.

Specific: in the echo render block (formerly motion render block, immediately after sparkles), replace `MotionTipInput` build with `EchoTipInput`: add `currentStep: params.currentStep` and `blueColor`/`redColor` from `params.trailSettings.blueColor`/`redColor` (or wherever the motion wrapper was reading them). Call `activeEchoRenderer.renderFrame(params.echoConfig!, echoInput)` with NO `dt` parameter.

- [ ] **Step 1:** Rename types + fields + methods in IAnimationRenderLoop.ts, AnimationRenderLoop.ts, AnimationEngine.svelte.ts (comprehensive motion→echo).
- [ ] **Step 2:** Update echo render block: EchoTipInput build with currentStep, no dt.
- [ ] **Step 3:** Remove `lastMotionFrameTime` field (echo doesn't need it).
- [ ] **Step 4:** `npm run check` — zero new errors (pre-existing VirtualKeyboard errors OK).
- [ ] **Step 5: Commit.** `refactor(effects): thread currentStep via EchoTipInput + rename motion→echo in engine`

---

## Task 6: Replace 3D mount — delete MotionBlur+SpeedLines mount, add GhostStaff3D

**Files:**
- Create: `src/lib/shared/3d/effects/motion/GhostStaff3D.svelte`
- Modify: `src/lib/shared/3d/effects/EffectsLayer.svelte` (remove MotionBlur+SpeedLines import+mounts for the UNIFIED motion mount added in Task 6 of the previous plan; replace with GhostStaff3D mounts. DO NOT touch the legacy `configState.motion` PropMotionEffects block.)

**GhostStaff3D.svelte** (new component):

Takes `propState` reactive object (`{ worldPosition: Vector3; worldRotation: Quaternion } | null`), `enabled`, `intensity`, `decay`, `interval`, `color`, `staffLength`, `currentStep`, plus `shape` ("staff" / "tips" / "both") and `colorMode` + `propColor` for the color picker.

Maintains `phantoms: Array<{ pos: Vector3; quat: Quaternion; capturedStep: number }>`. On `currentStep` change, if `floor(currentStep/interval) > lastBeatIndex`, capture `{ pos: propState.worldPosition.clone(), quat: propState.worldRotation.clone(), capturedStep: currentStep }`.

Renders each phantom as a `<T.Mesh>` with `T.CylinderGeometry args={[staffLength * 0.015, staffLength * 0.015, staffLength, 8]}` and `<T.MeshBasicMaterial {color} transparent opacity={alpha} depthWrite={false} />`. Rotation: clone `quat` then multiply by `new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 2))` (matches `Staff3D` horizontal orientation).

For `shape === "tips"` or `"both"`, additionally render small spheres at the two staff ends (compute via `calculatePropEnds`-equivalent in the component or pass ends in as props).

**EffectsLayer.svelte changes:**
1. Remove imports of `MotionBlur` and `SpeedLines` (the Task-6-of-motion unified mounts). DO NOT remove `PropMotionEffects` — that's legacy and stays.
2. Import `GhostStaff3D`.
3. Replace the `motionEnabled && motion3D && isPlaying` block with `echoEnabled && echo3D && isPlaying` — mount two `GhostStaff3D` instances (one per prop, blue + red). Pass `currentStep` from `effectState` or up through the `isPlaying` context (check what's available — if not, plumb it through).
4. Update derivations: `motion3D` → `echo3D` via `resolveEcho3D(unifiedState.echo)`; `motionEnabled` → `echoEnabled`.
5. Update `pickMotionColor` → `pickEchoColor`.

**`currentStep` plumbing:** if `EffectsLayer` doesn't currently have access to `currentStep`, look at how `TrailRenderer` or `EffectsLabPlaybackHost` passes it in. `animation-visibility-state` or the effect-state singleton may expose it. If absolutely necessary, add a prop to `EffectsLayer` (`currentStep?: number`) with reasonable default.

- [ ] **Step 1:** Read `Staff3D.svelte` to understand the mesh+material shape (see `calculatePropEnds` in EffectsLayer for rotation convention).
- [ ] **Step 2:** Build `GhostStaff3D.svelte` with the ring-buffer capture + mesh rendering.
- [ ] **Step 3:** Replace the Task-6-motion mount block in `EffectsLayer.svelte` with the echo GhostStaff3D mount block.
- [ ] **Step 4:** Plumb `currentStep` into EffectsLayer if not already.
- [ ] **Step 5:** `npm run check` green.
- [ ] **Step 6: Commit.** `feat(effects/3d): GhostStaff3D beat-onset phantom mount for Echo`

---

## Task 7: Echo presets — replace motion-presets.ts

**Files:**
- Delete: `src/lib/shared/animation-engine/components/effects-panel/presets/motion-presets.ts`
- Create: `src/lib/shared/animation-engine/components/effects-panel/presets/echo-presets.ts`
- Modify: `src/lib/shared/effects/state/effects-config-state.svelte.ts` — `updateMotion` → `updateEcho`; `state.motion` reads → `state.echo`.

**Preset definitions (copy shape from sparkles-presets.ts):**

```ts
export const ECHO_PRESETS: EffectPreset[] = [
  {
    id: "echo-stroboscope",
    name: "Stroboscope",
    previewColor: "#ffffff",
    apply: (_vm, state) => applyEcho(state, "echo-stroboscope", {
      intensity: 0.7, decay: 4, interval: 1,
      shape: "staff", colorMode: "solid", color: "#ffffff", thickness: 3,
    }),
  },
  {
    id: "echo-rainbow-trail",
    name: "Rainbow Trail",
    previewColor: "#ec4899",
    apply: (_vm, state) => applyEcho(state, "echo-rainbow-trail", {
      intensity: 0.75, decay: 6, interval: 1,
      shape: "staff", colorMode: "rainbow", color: "#ffffff", thickness: 3,
    }),
  },
  {
    id: "echo-twin-ghosts",
    name: "Twin Ghosts",
    previewColor: "#a5b4fc",
    apply: (_vm, state) => applyEcho(state, "echo-twin-ghosts", {
      intensity: 0.65, decay: 3, interval: 1,
      shape: "both", colorMode: "prop-matched", color: "#ffffff", thickness: 3,
    }),
  },
  {
    id: "echo-pulse",
    name: "Pulse",
    previewColor: "#22d3ee",
    apply: (_vm, state) => applyEcho(state, "echo-pulse", {
      intensity: 0.9, decay: 2, interval: 0.5,
      shape: "tips", colorMode: "solid", color: "#22d3ee", thickness: 5,
    }),
  },
  {
    id: "echo-custom",
    name: "Custom",
    previewColor: "custom",
    apply: () => { /* opens Customize */ },
  },
];

export const ECHO_PRESET_GROUP: EffectPresetGroup = {
  effectType: "echo",
  presets: ECHO_PRESETS,
  getSummary: (_vm, state) => {
    if (!state) return "";
    const e = state.echo;
    return `${e.shape} · decay ${e.decay}b · every ${e.interval}b`;
  },
};
```

- [ ] **Step 1:** Add `updateEcho` method to effects-config-state (mirror `updateSparkles` exactly).
- [ ] **Step 2:** Delete motion-presets.ts; create echo-presets.ts.
- [ ] **Step 3:** `npm run check` — remaining errors should only be in files that still reference motion (fixed in Task 8/9).
- [ ] **Step 4: Commit.** `feat(effects): Echo preset group — Stroboscope / Rainbow Trail / Twin Ghosts / Pulse`

---

## Task 8: EchoCustomize — replace MotionCustomize

**Files:**
- Delete: `src/lib/shared/animation-engine/components/effects-panel/customize/MotionCustomize.svelte`
- Create: `src/lib/shared/animation-engine/components/effects-panel/customize/EchoCustomize.svelte`

Copy MotionCustomize → EchoCustomize, then transform:

- Shape chip row (new, above color mode): Staff (`fa-ruler`) / Tips (`fa-circle`) / Both (`fa-layer-group`)
- Color mode chip row: Solid / Rainbow / Prop-Matched / Gradient (4 chips — don't include Velocity)
- Conditional color picker: only when `colorMode === "solid"`
- Replace sliders with:
  - Intensity: 0-1 step 0.05
  - Decay: 1-8 step 0.5 (display as `{N}b` — beats)
  - Interval: 0.25-2 step 0.25 (display as `{N}b`)
  - Thickness: 1-8 step 1 (display as `{N}px`)
- Reads/writes `state.echo` via `state.updateEcho(...)`.

- [ ] **Step 1:** Delete MotionCustomize.svelte; create EchoCustomize.svelte per above.
- [ ] **Step 2:** `npm run check` green.
- [ ] **Step 3: Commit.** `feat(effects): EchoCustomize panel — Shape/Color chips + 4 sliders`

---

## Task 9: EffectsPanel routing + EffectSelector chip update

**Files:**
- Modify: `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte`
  - Import `ECHO_PRESET_GROUP` (replace MOTION_PRESET_GROUP import)
  - Import `EchoCustomize` (replace MotionCustomize import)
  - `EFFECT_COLORS.motion` → `EFFECT_COLORS.echo` (keep `#22d3ee`)
  - `EFFECT_LABELS.motion` → `EFFECT_LABELS.echo`, value `"Echo"`
  - `getPresetGroup` case `"motion"` → `"echo"` returns `ECHO_PRESET_GROUP`
  - `{:else if activeEffect === "motion"}` → `{:else if activeEffect === "echo"}` mounting `EchoCustomize`
- Modify: `src/lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte`
  - Chip id `"motion"` → `"echo"`
  - Label `"Motion"` → `"Echo"`
  - Icon `fa-wind` → `fa-clone`

- [ ] **Step 1:** Apply EffectsPanel.svelte edits.
- [ ] **Step 2:** Apply EffectSelector.svelte edits.
- [ ] **Step 3:** `npm run check` green (all motion references now removed from unified layer).
- [ ] **Step 4: Commit.** `feat(effects): route Echo in EffectsPanel + chip label/icon/id update`

---

## Task 10: Verification

- [ ] **Step 1:** `npx vitest run src/lib/shared/effects/` — all green. Expect new Echo2DRenderer tests passing + migrations tests passing including v5→v6 cases.
- [ ] **Step 2:** `npm run build` — clean build.
- [ ] **Step 3:** Grep for any lingering `motion` references in the unified layer:
  ```
  grep -rn "motion" src/lib/shared/effects/ src/lib/shared/animation-engine/ | grep -v "legacy\|PropMotionEffects\|configState.motion\|AUSTEN_STAFF\|// " | head -30
  ```
  Should return nothing (except comments and legacy references to `configState.motion` / `PropMotionEffects`).
- [ ] **Step 4: Tag** `phase-1d-echo-complete` at HEAD. (Parent agent will decide whether to delete or keep the `phase-1d-motion-complete` tag.)

Report back at exit: commit hashes, test summary, final `npm run check` output, any lingering motion references, notable implementation deviations.

---

## Non-goals (deferred — add to deferred-items doc)

- Velocity-reactive decay (faster motion = longer persistence)
- Per-phantom subtle drift/sag
- "Burn-in" mode (phantoms never fade)
- Audio-reactive beat detection

Add these under a new section "7. Echo (Phase 1d revised) deferred items".
