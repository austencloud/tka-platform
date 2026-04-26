# Effects Phase 1d — Motion Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Motion as the third fully-wired tip effect through the unified intent layer (2D renderer + 3D wiring + presets + Customize), mirroring the proven Phase 1a/1b/1c pattern.

**Architecture:** Two groups. Group A (Tasks 1-3) extends the data model and translator layer. Group B (Tasks 4-9) builds the renderer, engine wiring, 3D mounts, presets and Customize panel. Each task commits ONLY its named files.

**Spec:** `docs/superpowers/specs/2026-04-17-effects-phase-1d-motion-design.md`
**Resumes from:** tag `phase-1c-sparkles-complete`
**Project guardrails:** project CLAUDE.md bans worktrees and branches — work on `main`. Never run `npm run dev` (port 5173 is the user's dev server). Verification = `curl localhost:5173`, `npm run build`, or `npm run check`. Never use `--no-verify`.

---

## Reference templates (copy these patterns)

- **Migration:** Phase 1c v3→v4 case in `src/lib/shared/effects/domain/migrations.ts:29-37` — mutate input shape before the default-merge.
- **2D renderer:** `src/lib/shared/effects/renderers/Sparkles2DRenderer.ts` — internal state across frames, `dispose()`, additive blend, per-tip processing.
- **AnimationEngine wiring:** search for `sparkles` references in `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts` — every place sparkles touch (field declaration, `prevSparklesIntentRef`, `syncSparklesOverlay`, `resize`, `dispose`, intent diff in getFrameParams) needs an equivalent `motion` line.
- **AnimationRenderLoop wiring:** `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts` — fields at lines 96/100/110/114, initialize/updateConfig at 187/223, dispose at 335, hasActiveWork at 401-414, render block at 799-863. Every sparkles line gets a motion sibling.
- **Contract:** `src/lib/shared/animation-engine/services/contracts/ISparklesOverlayRenderer.ts` — copy structure for `IMotionOverlayRenderer.ts`.
- **OverlayRenderer wrapper:** the file that implements `ISparklesOverlayRenderer` and wraps `Sparkles2DRenderer` (search `class SparklesOverlayRenderer`). Copy its shape.
- **3D mount:** `EffectsLayer.svelte:310-344` (sparkles block) — copy the conditional + 4-instance mount pattern. Replace `SparkleEmitter` with `MotionBlur` + `SpeedLines`.
- **Preset:** `src/lib/shared/animation-engine/components/effects-panel/presets/sparkles-presets.ts`.
- **Customize:** `src/lib/shared/animation-engine/components/effects-panel/customize/SparklesCustomize.svelte`.
- **EffectsPanel routing:** `EffectsPanel.svelte:233-253` — replace the motion `ComingSoonCustomize` line with `<MotionCustomize ... />`. Also extend `getPresetGroup` switch at line 163 with `case "motion": return MOTION_PRESET_GROUP;`.

---

## Scope discipline notes

- **Each task commits ONLY its named change.** Find unrelated bug → file in `docs/superpowers/specs/effects-unification-deferred-items.md` and keep moving.
- **Do not** wire `colorMode === "velocity"` into 3D — leave 3D using `params.color` directly. Note in deferred items.
- **Do not** modify `MotionBlur.svelte` or `SpeedLines.svelte`. Mount them from `EffectsLayer.svelte` with the right props.
- **Do not** delete the legacy `PropMotionEffects` mount in `EffectsLayer.svelte` (driven by `configState.motion.*`). Phase 3 retires that. The new unified-state mount lives alongside it.

---

## Task 1: Extend `MotionIntent` + bump version 4→5 + v4→v5 migration

**Files:**
- Modify: `src/lib/shared/effects/domain/EffectsConfig.ts:19, 122-129`
- Modify: `src/lib/shared/effects/domain/migrations.ts`
- Modify: `src/lib/shared/effects/domain/migrations.test.ts` (extend)

- [ ] **Step 1: Write failing migration test cases.** Append to `migrations.test.ts`:

```ts
  it("migrates v4 motion to v5 with default color/colorMode/length/count", () => {
    const v4 = {
      version: 4,
      motion: { blur: 0.6, speedLines: 0.8, threshold: 0.3 },
    };
    const out = migrateEffectsConfig(v4);
    expect(out.version).toBe(EFFECTS_CONFIG_VERSION);
    expect(out.motion.blur).toBe(0.6);
    expect(out.motion.speedLines).toBe(0.8);
    expect(out.motion.threshold).toBe(0.3);
    expect(out.motion.color).toBe("#ffffff");
    expect(out.motion.colorMode).toBe("solid");
    expect(out.motion.length).toBe(0.5);
    expect(out.motion.count).toBe(6);
  });

  it("preserves user motion fields when already at v5", () => {
    const v5 = {
      version: EFFECTS_CONFIG_VERSION,
      motion: {
        blur: 0.2, speedLines: 0.9, threshold: 0.5,
        color: "#ff00ff", colorMode: "velocity" as const,
        length: 1.0, count: 10,
      },
    };
    const out = migrateEffectsConfig(v5);
    expect(out.motion.colorMode).toBe("velocity");
    expect(out.motion.color).toBe("#ff00ff");
    expect(out.motion.count).toBe(10);
  });
```

- [ ] **Step 2: Run test — confirm failure** (`npx vitest run src/lib/shared/effects/domain/migrations.test.ts`).

- [ ] **Step 3: Update `EffectsConfig.ts`:**
  - Bump `EFFECTS_CONFIG_VERSION = 5`.
  - Replace `MotionIntent` (lines 122-129) with the spec's expanded shape (`color`, `colorMode`, `length`, `count` added).

- [ ] **Step 4: Update `migrations.ts`:** append v4→v5 case after the v3→v4 sparkles case:

```ts
if (version < 5 && input.motion) {
  const m = input.motion as any;
  m.color ??= "#ffffff";
  m.colorMode ??= "solid";
  m.length ??= 0.5;
  m.count ??= 6;
}
```

- [ ] **Step 5: Re-run tests — confirm green.** Also re-run the full migrations test file to verify v3→v4 cases still pass.

- [ ] **Step 6: Commit.** `chore(effects): bump v4→v5 and extend MotionIntent with color/colorMode/length/count`.

---

## Task 2: Update `defaults.ts` + verify translator types

**Files:**
- Modify: `src/lib/shared/effects/domain/defaults.ts:64-68`
- Verify (read-only, no edits expected): `src/lib/shared/effects/translators/canvas2d-types.ts:75-80`, `webgl3d-types.ts:89-94`, `canvas2d-translator.ts:87-96`, `webgl3d-translator.ts:102-111`.

- [ ] **Step 1:** Replace the `motion:` block in `defaults.ts` with:

```ts
motion: {
  blur: 0.4,
  speedLines: 0.5,
  threshold: 0.2,
  color: "#ffffff",
  colorMode: "solid",
  length: 0.5,
  count: 6,
},
```

- [ ] **Step 2:** `npm run check` — confirm zero errors. Existing translator types already extend `MotionIntent` so they pick up new fields automatically.

- [ ] **Step 3: Commit.** `chore(effects): default values for new MotionIntent fields`.

---

## Task 3: Add `IMotionOverlayRenderer` contract + skeleton wrapper

**Files:**
- Create: `src/lib/shared/animation-engine/services/contracts/IMotionOverlayRenderer.ts` (copy `ISparklesOverlayRenderer.ts` shape — replace Sparkles → Motion, Sparkles2DParams → Motion2DParams, SparklesTipInput → MotionTipInput).
- Create: `src/lib/shared/effects/renderers/Motion2DRenderer.ts` (skeleton — full impl in Task 4).

- [ ] **Step 1: Read `ISparklesOverlayRenderer.ts`** to get the exact shape (initialize/dispose/renderFrame/resize/clear/isInitialized).

- [ ] **Step 2: Create `IMotionOverlayRenderer.ts`** with the same methods, but `renderFrame` accepts `Motion2DParams` and a new `MotionTipInput` type:

```ts
export interface MotionTipInput {
  bluePosA: { x: number; y: number } | null;
  bluePosB: { x: number; y: number } | null;
  redPosA: { x: number; y: number } | null;
  redPosB: { x: number; y: number } | null;
  /** Per-prop trail colors for prop-matched colorMode. Hex strings. */
  blueColor: string;
  redColor: string;
}
```

- [ ] **Step 3: Create `Motion2DRenderer.ts` skeleton** with class shell + `dispose()` + empty `render()` (full impl in Task 4). Export `MotionTipInput` re-export from `IMotionOverlayRenderer.ts`.

- [ ] **Step 4: Commit.** `chore(effects): IMotionOverlayRenderer contract + Motion2DRenderer skeleton`.

---

## Task 4: Implement `Motion2DRenderer` + unit tests

**Files:**
- Modify: `src/lib/shared/effects/renderers/Motion2DRenderer.ts` (full implementation).
- Create: `src/lib/shared/effects/renderers/Motion2DRenderer.test.ts`.

The renderer is per-tip state (last position + ring buffer of recent positions). Each frame:

1. For each tip in `tips`, if null → delete state and skip.
2. Compute `velocity = distance(tip, lastPos) / dt` (px/s). If `< params.threshold * 600` → skip drawing for this tip but DO update lastPos.
3. **Ghost stamps (blur):** push current pos to a ring buffer; trim to `floor(8 + params.blur * 12)`. Draw soft alpha-faded circles at each history slot. Skip if `params.blur === 0`.
4. **Speed lines (speedLines):** unit-vector-back = `-velocityVector / speed`. Emit `params.count` short lines from the tip pointing along that vector. Length = `params.length * 24 + min(speed, 1200) * params.length * 0.05` px. Side lines are offset perpendicular by ±`(i + 1) * 4` px. Skip if `params.speedLines === 0`.
5. Color picked per-stroke by `colorMode`:
   - `solid` → `params.color`
   - `rainbow` → `hsl((Date.now() * 0.1) % 360, 80%, 60%)`
   - `velocity` → `hsl(220 - min(velocity, 1500) / 1500 * 220, 90%, 60%)`
   - `prop-matched` → `tipColors.blue` for blue tips, `tipColors.red` for red tips.
6. Use `ctx.globalCompositeOperation = params.blendMode ?? "lighter"` for additive blend; restore in `finally`.
7. `dispose()` clears state.

- [ ] **Step 1: Write failing tests.** Mirror the Sparkles2DRenderer test mock-ctx pattern. Cover:
  - Below threshold = no draw calls (count `_strokeCalls` array).
  - Above threshold + blur > 0 = `arc()` called for ghost stamps.
  - Above threshold + speedLines > 0 = `moveTo`/`lineTo`/`stroke` called `params.count` times per tip.
  - `dispose()` clears internal state.
- [ ] **Step 2: Run — confirm failures.**
- [ ] **Step 3: Implement renderer** per the spec/loop above.
- [ ] **Step 4: Tests green** (`npx vitest run src/lib/shared/effects/renderers/Motion2DRenderer.test.ts`).
- [ ] **Step 5: Commit.** `feat(effects): Motion2DRenderer with velocity-gated ghost stamps + speed lines`.

---

## Task 5: Wire renderer into `AnimationEngine` + `AnimationRenderLoop`

**Files:**
- Modify: `src/lib/shared/animation-engine/services/contracts/IAnimationRenderLoop.ts` — add `motionConfig?: Motion2DParams | null` to `RenderFrameParams` and `motionRenderer?: IMotionOverlayRenderer | null` to `RenderLoopConfig`.
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationRenderLoop.ts`:
  - Add field `private motionRenderer: IMotionOverlayRenderer | null = null` near sparkles.
  - Add `private lastMotionFrameTime: number = 0` near `lastSparklesFrameTime`.
  - Add `private consecutiveMotionErrors: number = 0` and `private motionDisabledByError: boolean = false`.
  - Wire in `initialize()` and `updateConfig()`.
  - Wire `motionRenderer?.dispose()` in `dispose()`.
  - Add `motionActive` to `hasActiveWork` (line ~401-414).
  - Add motion render block immediately after the sparkles block (line ~861), structured identically: build `MotionTipInput` (with `blueColor`/`redColor` from params), compute dt with `lastMotionFrameTime`, call `renderFrame`, error-recovery copy.
  - Add `motionRenderer.clear()` in the suppress-2D-overlays clear block (line ~554).
- Modify: `src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts`:
  - Add `private motion2DRenderer: ... ` field, `private prevMotionIntentRef: MotionIntent | null = null`.
  - Add `private syncMotionOverlay()` method — mirrors `syncSparklesOverlay` exactly, lazy-init MotionOverlayRenderer (need to create that wrapper class — see step below), pass through `renderLoopService.updateConfig({ motionRenderer: ... })`.
  - In the intent diff block (lines ~2370-2378 area), add motion branch: resolve `Motion2DParams` from `intent.motion`, set `fp.motionConfig`, gate by `prevHasMotionTips`.
  - Need `prevHasMotionTips` tracking — mirror `prevHasSparklesTips`. Likely tip-effect-map walk to detect "any tip currently set to motion".
  - Hook `syncMotionOverlay()` from the same callsites that call `syncSparklesOverlay()` (around line 652 + 871).
  - Resize hook: `motion2DRenderer?.resize(...)` in line ~2094 area.
  - Dispose hook: `motion2DRenderer?.dispose()` near line 1423-1424.

- Create: a new file (or extend an existing one) implementing `IMotionOverlayRenderer` that wraps `Motion2DRenderer`. Search for where `SparklesOverlayRenderer` class is defined — colocate this `MotionOverlayRenderer` there or in a parallel file.

The MotionOverlayRenderer wrapper exposes: `initialize(canvasOrCtx, size)` to create a 2D canvas overlay (same pattern as SparklesOverlayRenderer), `renderFrame(params, tipInput, dt)`, `clear()`, `dispose()`, `resize()`, `isInitialized()`.

- [ ] **Step 1:** Read the SparklesOverlayRenderer wrapper (find via `grep -rn "class SparklesOverlayRenderer"`).
- [ ] **Step 2:** Mirror it for Motion (mostly s/Sparkles/Motion/g, swap renderer instance type, swap params type).
- [ ] **Step 3:** Wire AnimationRenderLoop fields + initialize/updateConfig + dispose + hasActiveWork + render block + clear block.
- [ ] **Step 4:** Wire AnimationEngine fields + syncMotionOverlay + intent diff + resize + dispose + prevHasMotionTips tracking.
- [ ] **Step 5:** `npm run check` — green.
- [ ] **Step 6: Commit.** `feat(effects): wire Motion overlay through AnimationEngine + RenderLoop`.

---

## Task 6: 3D wiring in `EffectsLayer.svelte`

**Files:**
- Modify: `src/lib/shared/3d/effects/EffectsLayer.svelte`.

Add a `motion3D` derived from `unifiedState.motion` via `resolveMotion3D`, and `motionEnabled` derived from `tipEffectMap["*"]?.effect === "motion"`. Then mount 4 × `MotionBlur` + 4 × `SpeedLines` (one set per tip endpoint), gated by `motionEnabled && motion3D && isPlaying`.

For per-tip color, helper `pickMotionColor(tipIndex /* 0=blueA,1=blueB,2=redA,3=redB */)`:
- `solid` → `motion3D.color`
- `prop-matched` → blue tips → trails.blueColor, red tips → trails.redColor (read via `unifiedState.trails.blueColor` / `redColor`)
- `rainbow` → `hsl((Date.now()*0.05 + tipIndex*90) % 360, 80%, 60%)`
- `velocity` → fallback to `motion3D.color` (deferred — note in deferred items)

Imports needed: `MotionBlur` from `./motion/MotionBlur.svelte`, `SpeedLines` from `./motion/SpeedLines.svelte`, `resolveMotion3D` from `$lib/shared/effects/translators/webgl3d-translator`.

Track previous positions for each tip via `effectState.getTrailPoints(...)` (already used by fire/sparkles). MotionBlur and SpeedLines need both `currentPosition` and `previousPosition` `Vector3` — use `blueEnds.positive`, `effectState.getTrailPoints("blue", 2)[1]?.position` etc.

- [ ] **Step 1:** Add derived `motion3D`, `motionEnabled`, `pickMotionColor`.
- [ ] **Step 2:** Add the 4×2 mount block right after the existing legacy `PropMotionEffects` block.
- [ ] **Step 3:** `npm run check` green.
- [ ] **Step 4: Commit.** `feat(effects/3d): mount MotionBlur+SpeedLines per tip from unified Motion intent`.

---

## Task 7: Build preset group (`motion-presets.ts`)

**Files:**
- Create: `src/lib/shared/animation-engine/components/effects-panel/presets/motion-presets.ts`.

Copy `sparkles-presets.ts` shape exactly. Use the 5 preset definitions from the spec (Anime / Ghost / Comet / Sonic Boom / Custom). The `applyMotion` helper is the same shape as `applySparkles` — calls `state.updateMotion(patch)` then `state.applyPreset({...})`. (If `state.updateMotion` doesn't exist yet, add it to `effects-config-state.svelte.ts` mirroring `updateSparkles`.)

- [ ] **Step 1: Verify `state.updateMotion` exists** (`grep -n "updateMotion" src/lib/shared/effects/state/effects-config-state.svelte.ts`). If not, add it.
- [ ] **Step 2: Create `motion-presets.ts`** with `MOTION_PRESETS` and `MOTION_PRESET_GROUP` exports.
- [ ] **Step 3: Commit.** `feat(effects): Motion preset group — Anime / Ghost / Comet / Sonic Boom`.

---

## Task 8: Build `MotionCustomize.svelte`

**Files:**
- Create: `src/lib/shared/animation-engine/components/effects-panel/customize/MotionCustomize.svelte`.

Copy `SparklesCustomize.svelte` whole, then transform:
- Remove the Mode chip row entirely (no burst/stream/trail).
- Color mode chip row: 4 chips — Solid / Rainbow / Velocity / Prop-Matched.
- Conditional picker: show one circular color picker only when `colorMode === "solid"`.
- Sliders (replace sparkles sliders): Blur (0-1 step 0.05), Speed Lines (0-1 step 0.05), Threshold (0-1 step 0.05), Length (0-1 step 0.05), Count (3-12 step 1).
- Read/write via `state.motion` and `state.updateMotion(...)`.
- Keep all the inline styles unchanged.

- [ ] **Step 1: Copy SparklesCustomize → MotionCustomize, do the transforms.**
- [ ] **Step 2: `npm run check` green.**
- [ ] **Step 3: Commit.** `feat(effects): MotionCustomize panel — colorMode chips + 5 sliders`.

---

## Task 9: Wire `EffectsPanel` routing

**Files:**
- Modify: `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte`.

Three edits:
1. Import `MOTION_PRESET_GROUP` from `./presets/motion-presets`.
2. Import `MotionCustomize` from `./customize/MotionCustomize.svelte`.
3. Add `case "motion": return MOTION_PRESET_GROUP;` to `getPresetGroup` switch (line 163).
4. Replace the motion ComingSoonCustomize line (~248) with `<MotionCustomize onBack={() => (customizeOpen = false)} />`.

- [ ] **Step 1: Apply edits.**
- [ ] **Step 2: `npm run check` green.**
- [ ] **Step 3: Commit.** `feat(effects): route Motion to MotionCustomize + MOTION_PRESET_GROUP`.

---

## Task 10: Visual verification

- [ ] **Step 1:** `npm run build` — clean build.
- [ ] **Step 2:** `npx vitest run src/lib/shared/effects/` — all green.
- [ ] **Step 3:** Launch Chrome via the project Bash recipe; navigate to `localhost:5173/effects-lab` (verify exact path from EffectsLab module).
- [ ] **Step 4:** Click Motion chip → confirm preset row shows Anime/Ghost/Comet/Sonic Boom/Custom.
- [ ] **Step 5:** Click Anime → take screenshot to `.claude/screenshots/motion-anime.png`. Repeat for Ghost, Comet, Sonic Boom.
- [ ] **Step 6:** Open Customize → confirm all sliders respond.
- [ ] **Step 7:** Tag the head commit `phase-1d-motion-complete`.
- [ ] **Step 8:** Update memory: append "Phase 1d Status: COMPLETE" section to `project_effects_unification.md`; update queue to advance Phase 1e to next.

---

## Test plan recap

- Unit: `migrations.test.ts` v4→v5 (Task 1). `Motion2DRenderer.test.ts` threshold/blur/speedLines/dispose (Task 4).
- Integration: build + check pass at every commit boundary.
- Visual: 4 preset screenshots + customize panel screenshot (Task 10).

## Non-goals (deferred)

- Velocity-color mode in 3D (3D uses static color).
- Per-tip independent threshold.
- Doppler chromatic aberration.
- Removing the legacy `PropMotionEffects` mount in `EffectsLayer.svelte` (Phase 3).

Add these to `docs/superpowers/specs/effects-unification-deferred-items.md` if not already there.
