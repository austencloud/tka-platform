# Effects Engine Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the legacy 3D effects state, migrate the 3D UI + remaining 3D renderers onto the shared `EffectsConfig`. No visible UI change — the 3D viewer keeps its current 8-tile behavior through Phase 2 and becomes 11 effects in 2d; deeper preset/Customize work is Phase 3.

**Architecture:** The unification is already ~60% done — LED, Charcoal, Bloom, Sparkles, Zap, Echo, Water, Bubbles, Petals route through the unified `EffectsConfig` today. This plan migrates the three remaining legacy paths (Trails, Fire, Motion), with Motion extracted to a new `Scene3DRenderConfig` slice because scene-wide render modifiers don't belong in a per-tip effect enum. After the migration, the legacy file `src/lib/shared/3d/effects/state/effects-config-state.svelte.ts` is deleted in a single commit.

> **Spec note:** the Phase 2 design lists "5 renderers to migrate (trails/fire/led/charcoal/bloom)". Audit found LED and Charcoal are mounted in `EffectOrchestrator3D.svelte` and already read unified state via `getEffectsConfigContext()` + `resolveLed3D` / `resolveCharcoal3D`. Bloom in `EffectsLayer.svelte` is already unified via `resolveBloom3D`. So the actual 2c surface is just Trails + Fire. This is a shrink, not a gap.

**Tech Stack:** Svelte 5 runes (`$state`, `$derived`, `$effect`), TypeScript, Vitest, Three.js via Threlte, existing `webgl3d-translator.ts` resolvers.

---

## File Structure

**Created:**
- `src/lib/shared/3d/scene-features/state/scene-3d-render-state.svelte.ts` — Scene3DRenderConfig factory (motion blur + speed lines + intensity), ~90 lines.
- `src/lib/shared/3d/scene-features/state/scene-3d-render-context.ts` — Svelte context getter/setter, ~20 lines.
- `tests/unit/scene-3d-render-state.test.ts` — unit tests for the new state, ~60 lines.
- `docs/superpowers/notes/2026-04-19-phase-2a-inventory.md` — audit findings committed alongside code.

**Modified:**
- `src/lib/shared/3d/effects/EffectsLayer.svelte` — Trails/Fire/Motion reads swap from legacy to unified/Scene3DRender; drop legacy import in 2e.
- `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte` — reads `getEffectsConfigContext()` for effect toggles + `Scene3DRenderConfig` for motion; grid expands 8→11 tiles; intensity slider uses `effect-primary-param` adapter.
- `src/lib/shared/3d/components/Viewer3DFullscreen.svelte` — sets `Scene3DRenderConfig` context alongside the existing `EffectsConfigContext`.
- `src/lib/shared/3d/effects/types.ts` — delete legacy config interfaces + DEFAULT_* constants (keep `TrackingMode`, `TrailStyle`, `TrailPoint`, `QualityTier`, `TIER_CONFIGS`, `PropId`, `TipPositionData3D`, `PropTipPositions3D`, `EffectConfig`, `ParticleConfig`, `AllEffectConfigs`).

**Deleted:**
- `src/lib/shared/3d/effects/state/effects-config-state.svelte.ts`

---

## Task 1: Inventory + type alignment (2a)

**Files:**
- Create: `docs/superpowers/notes/2026-04-19-phase-2a-inventory.md`

Purely a documentation commit that captures the audit the plan is built on. No behavior change. Re-exporting `EffectType` from `performer-settings-types.ts` is explicitly deferred — `EffectId` diverges too much (`electricity` vs `zap`; includes `motion`) and alignment needs its own migration path for persisted per-performer sets. That's flagged as a Phase 2.5 risk in the inventory.

- [ ] **Step 1: Write the inventory doc**

Create `docs/superpowers/notes/2026-04-19-phase-2a-inventory.md`:

```markdown
# Phase 2a — Effects Engine Unification Inventory

Audit date: 2026-04-19. Baseline for the migration described in `docs/superpowers/specs/2026-04-19-effects-engine-unification-design.md`.

## Legacy consumers of `3d/effects/state/effects-config-state.svelte.ts`

Full grep (`getEffectsConfigState` + import path):

- `src/lib/shared/3d/effects/EffectsLayer.svelte` — reads `configState.trails.*`, `configState.fire.*`, `configState.motion.*`.
- `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte` — reads every branch of legacy config for the effect chip grid.

LED + Charcoal renderers (`EffectOrchestrator3D.svelte`) already read the unified state via `getEffectsConfigContext()` and resolve through `resolveLed3D` / `resolveCharcoal3D`. Bloom, Sparkles, Zap, Echo, Water, Bubbles, Petals in `EffectsLayer.svelte` are also unified.

## Per-performer scope (out of Phase 2)

`src/lib/shared/3d/state/performer-settings-types.ts` defines `EffectId`:

    "trails" | "fire" | "charcoal" | "led" | "electricity" | "sparkles" | "motion" | "bloom"

This diverges from canonical `EffectType` in `src/lib/shared/effects/domain/EffectsConfig.ts`:

- `electricity` needs to become `zap` (rename).
- `motion` drops out (Phase 2b moves it to `Scene3DRenderConfig`).
- Missing: `echo`, `water`, `bubbles`, `petals` (additions).

Aligning requires a localStorage migration for saved per-performer effect sets. Flag as **Phase 2.5**: do it after 2e lands, in its own branch, so the migration can be reverted cleanly if it breaks saved performer data.

## Legacy type deletions (Phase 2e)

In `src/lib/shared/3d/effects/types.ts` the following types are only referenced by the legacy state file — safe to delete in 2e:

- `TrailConfig`, `DEFAULT_TRAIL_CONFIG`
- `FireConfig`, `DEFAULT_FIRE_CONFIG`
- `SparkleConfig`, `DEFAULT_SPARKLE_CONFIG`
- `ElectricityConfig`, `DEFAULT_ELECTRICITY_CONFIG`
- `GlowConfig`, `DEFAULT_GLOW_CONFIG`
- `BloomConfig`, `MotionEffectsConfig` (defined in the legacy state file directly, disappear with it)

`effects-lab` and `video-trails` reference the string `TrailConfig` only as a method/variable name; the actual type is a local `TrailPointConfig`. No consumer impact.

Keep in `types.ts` (used by 2D + 3D):

- `TrackingMode`, `TrailStyle`, `TrailPoint`, `PropPositionHistory`
- `EffectConfig`, `ParticleConfig`, `AllEffectConfigs`, `DEFAULT_PARTICLE_CONFIG`
- `QualityTier`, `QualityTierConfig`, `TIER_CONFIGS`
- `PropId`, `TipPositionData3D`, `PropTipPositions3D`
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/notes/2026-04-19-phase-2a-inventory.md
git commit -m "docs(effects-unification): Phase 2a inventory — legacy consumers + migration scope"
```

---

## Task 2: Create Scene3DRenderConfig state + tests (2b.i)

**Files:**
- Create: `src/lib/shared/3d/scene-features/state/scene-3d-render-state.svelte.ts`
- Create: `src/lib/shared/3d/scene-features/state/scene-3d-render-context.ts`
- Create: `tests/unit/scene-3d-render-state.test.ts`

New state slice for scene-wide 3D render modifiers. Starts with Motion (blur + speed lines + intensity). Independent of the per-tip effect enum.

Pattern mirrors the unified `effects-config-state.svelte.ts` — pure factory + separate context file — so the state is instance-scoped rather than a module singleton.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/scene-3d-render-state.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createScene3DRenderState } from "../../src/lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";

describe("scene-3d-render-state", () => {
  it("defaults motion to disabled with intensity 0.5", () => {
    const s = createScene3DRenderState();
    expect(s.motion.blur).toBe(false);
    expect(s.motion.speedLines).toBe(false);
    expect(s.motion.intensity).toBeCloseTo(0.5);
  });

  it("toggles blur independently of speedLines", () => {
    const s = createScene3DRenderState();
    s.updateMotion({ blur: true });
    expect(s.motion.blur).toBe(true);
    expect(s.motion.speedLines).toBe(false);

    s.updateMotion({ speedLines: true });
    expect(s.motion.blur).toBe(true);
    expect(s.motion.speedLines).toBe(true);
  });

  it("clamps intensity to [0, 1]", () => {
    const s = createScene3DRenderState();
    s.updateMotion({ intensity: 1.5 });
    expect(s.motion.intensity).toBe(1);
    s.updateMotion({ intensity: -0.2 });
    expect(s.motion.intensity).toBe(0);
  });

  it("round-trips through replace()", () => {
    const s = createScene3DRenderState();
    s.replace({ motion: { blur: true, speedLines: true, intensity: 0.8 } });
    expect(s.motion).toEqual({ blur: true, speedLines: true, intensity: 0.8 });
  });

  it("accepts an initial config in the factory", () => {
    const s = createScene3DRenderState({
      motion: { blur: true, speedLines: false, intensity: 0.3 },
    });
    expect(s.motion.blur).toBe(true);
    expect(s.motion.intensity).toBeCloseTo(0.3);
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

Run: `npx vitest run tests/unit/scene-3d-render-state.test.ts`
Expected: FAIL with a module-not-found error pointing at `scene-3d-render-state.svelte`.

- [ ] **Step 3: Create the state factory**

Create `src/lib/shared/3d/scene-features/state/scene-3d-render-state.svelte.ts`:

```typescript
/**
 * Scene3DRenderConfig — scene-wide 3D render modifiers.
 *
 * Lives alongside the per-tip unified EffectsConfig. Motion (blur +
 * speed lines) is a whole-scene post modifier, not a per-tip effect,
 * so it doesn't belong in the effect enum that both 2D and 3D share.
 *
 * Phase 2 of the 2D/3D effects unification (see
 * docs/superpowers/specs/2026-04-19-effects-engine-unification-design.md).
 */

export interface MotionRenderConfig {
  /** Enable motion blur pass. */
  blur: boolean;
  /** Enable speed-line overlay. */
  speedLines: boolean;
  /** 0-1. Shared intensity scalar for both blur and speed lines. */
  intensity: number;
}

export interface Scene3DRenderConfig {
  motion: MotionRenderConfig;
}

export const DEFAULT_SCENE_3D_RENDER_CONFIG: Scene3DRenderConfig = {
  motion: {
    blur: false,
    speedLines: false,
    intensity: 0.5,
  },
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function createScene3DRenderState(
  initial: Scene3DRenderConfig = DEFAULT_SCENE_3D_RENDER_CONFIG,
) {
  let config = $state<Scene3DRenderConfig>({
    motion: { ...initial.motion },
  });

  function updateMotion(patch: Partial<MotionRenderConfig>) {
    const next: MotionRenderConfig = { ...config.motion, ...patch };
    if (patch.intensity !== undefined) {
      next.intensity = clamp01(patch.intensity);
    }
    config.motion = next;
  }

  function replace(next: Scene3DRenderConfig) {
    config = {
      motion: { ...next.motion, intensity: clamp01(next.motion.intensity) },
    };
  }

  return {
    get config() {
      return config;
    },
    get motion() {
      return config.motion;
    },
    updateMotion,
    replace,
  };
}

export type Scene3DRenderState = ReturnType<typeof createScene3DRenderState>;
```

- [ ] **Step 4: Run the test — verify it passes**

Run: `npx vitest run tests/unit/scene-3d-render-state.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Create the context helper**

Create `src/lib/shared/3d/scene-features/state/scene-3d-render-context.ts`:

```typescript
import { getContext, setContext } from "svelte";
import type { Scene3DRenderState } from "./scene-3d-render-state.svelte";

const SCENE_3D_RENDER_CONTEXT_KEY = Symbol("scene-3d-render-state");

export function setScene3DRenderContext(state: Scene3DRenderState): Scene3DRenderState {
  setContext(SCENE_3D_RENDER_CONTEXT_KEY, state);
  return state;
}

export function getScene3DRenderContext(): Scene3DRenderState | null {
  return getContext<Scene3DRenderState | null>(SCENE_3D_RENDER_CONTEXT_KEY) ?? null;
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/scene-features/state/scene-3d-render-state.svelte.ts
git add src/lib/shared/3d/scene-features/state/scene-3d-render-context.ts
git add tests/unit/scene-3d-render-state.test.ts
git commit -m "feat(effects-unification): Scene3DRenderConfig state + context for scene-wide render modifiers (Phase 2b.i)"
```

---

## Task 3: Wire Motion into Scene3DRenderConfig (2b.ii)

**Files:**
- Modify: `src/lib/shared/3d/components/Viewer3DFullscreen.svelte` (set Scene3DRenderContext)
- Modify: `src/lib/shared/3d/effects/EffectsLayer.svelte` (read Scene3DRender state for motion block)
- Modify: `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte` (motion toggle writes to new state)

Motion stops reading from the legacy `configState.motion` branch. EffectsSettingsPanel keeps the "Motion" chip visible — this preserves the UI exactly (per spec "no visible UI change in this phase"). Phase 3 moves the chip out of the Effects grid and into a Scene tab.

- [ ] **Step 1: Set the Scene3DRenderContext in Viewer3DFullscreen**

Open `src/lib/shared/3d/components/Viewer3DFullscreen.svelte` and locate the existing `setEffectsConfigContext` block (around line 32-34). Add alongside:

```svelte
<script lang="ts">
  // ... existing imports ...
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
  import { setScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";

  // ... existing state construction ...
  const effectsConfigState = createEffectsConfigState(snapshotConfigFromVm(effectsVm));
  setEffectsConfigContext(effectsConfigState);

  const scene3DRenderState = createScene3DRenderState();
  setScene3DRenderContext(scene3DRenderState);
</script>
```

Edit: find the line `setEffectsConfigContext(effectsConfigState);` (around line 34) and insert the two new lines directly after it. Keep all surrounding code unchanged. Add the two new `import` lines next to the existing `createEffectsConfigState` / `setEffectsConfigContext` imports at the top of `<script>`.

- [ ] **Step 2: Swap motion reads in EffectsLayer.svelte**

Open `src/lib/shared/3d/effects/EffectsLayer.svelte`. Near the top imports add:

```svelte
import { getScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
```

In the `<script>` body, alongside `const unifiedState = getUnifiedEffectsState();` (around line 67), add:

```svelte
const scene3DRender = getScene3DRenderContext();
```

Find the motion block (currently around lines 456-478):

```svelte
{#if (configState.motion.blur || configState.motion.speedLines) && isPlaying}
  {#if blueCenter}
    <PropMotionEffects
      position={blueCenter}
      color="blue"
      enableBlur={configState.motion.blur}
      enableSpeedLines={configState.motion.speedLines}
      intensity={configState.motion.intensity}
      threshold={configState.motion.threshold}
    />
  {/if}

  {#if redCenter}
    <PropMotionEffects
      position={redCenter}
      color="red"
      enableBlur={configState.motion.blur}
      enableSpeedLines={configState.motion.speedLines}
      intensity={configState.motion.intensity}
      threshold={configState.motion.threshold}
    />
  {/if}
{/if}
```

Replace with:

```svelte
{#if scene3DRender && (scene3DRender.motion.blur || scene3DRender.motion.speedLines) && isPlaying}
  {#if blueCenter}
    <PropMotionEffects
      position={blueCenter}
      color="blue"
      enableBlur={scene3DRender.motion.blur}
      enableSpeedLines={scene3DRender.motion.speedLines}
      intensity={scene3DRender.motion.intensity}
      threshold={2}
    />
  {/if}

  {#if redCenter}
    <PropMotionEffects
      position={redCenter}
      color="red"
      enableBlur={scene3DRender.motion.blur}
      enableSpeedLines={scene3DRender.motion.speedLines}
      intensity={scene3DRender.motion.intensity}
      threshold={2}
    />
  {/if}
{/if}
```

The `threshold={2}` literal matches the legacy `DEFAULT_MOTION_CONFIG.threshold` default. The new state drops this field — threshold wasn't exposed in any UI and no user ever customized it, so it becomes a fixed renderer param.

- [ ] **Step 3: Swap motion toggle in EffectsSettingsPanel.svelte**

Open `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte`.

Near the top imports (around line 14) add:

```svelte
import { getScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
```

In the `<script>` body, after `const config = getEffectsConfigState();` (around line 23), add:

```svelte
const scene3DRender = getScene3DRenderContext() ?? createScene3DRenderState();
```

In `isEnabled()` (around line 55), change the `motion` branch:

```typescript
case "motion":
  return scene3DRender.motion.blur || scene3DRender.motion.speedLines;
```

In `toggle()` (around line 88), change the `motion` branch:

```typescript
case "motion":
  const motionEnabled = scene3DRender.motion.blur || scene3DRender.motion.speedLines;
  scene3DRender.updateMotion({
    blur: !motionEnabled,
    speedLines: !motionEnabled,
  });
  break;
```

In `getIntensity()` (around line 130), change the `motion` branch:

```typescript
case "motion":
  return scene3DRender.motion.intensity;
```

In `setIntensity()` (around line 153), change the `motion` branch:

```typescript
case "motion":
  scene3DRender.updateMotion({ intensity: value });
  break;
```

- [ ] **Step 4: Verify tests still pass and build succeeds**

Run: `npx vitest run tests/unit/scene-3d-render-state.test.ts`
Expected: PASS.

Run: `npm run check 2>&1 | tail -30`
Expected: no new errors referencing `scene-3d-render-state` or the changed motion branches. Pre-existing errors unchanged.

- [ ] **Step 5: Visual verification**

Use Chrome DevTools MCP to open the 3D viewer. Toggle the Motion chip in `EffectsSettingsPanel`. Verify blur + speed-line visuals still appear during playback identically to pre-change.

If visuals regress: revert Task 3 commit and diagnose the threshold hardcoding or context wiring before retrying.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/components/Viewer3DFullscreen.svelte
git add src/lib/shared/3d/effects/EffectsLayer.svelte
git add src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte
git commit -m "feat(effects-unification): Motion reads Scene3DRenderConfig instead of legacy effects state (Phase 2b.ii)"
```

---

## Task 4: Migrate Trails3D reads in EffectsLayer to unified (2c.i)

**Files:**
- Modify: `src/lib/shared/3d/effects/EffectsLayer.svelte`

Trails3D stops reading `configState.trails.*`. Instead it reads `unifiedState.trails.*` and resolves through `resolveTrails3D`. Enable check uses the `tipEffectMap["*"]?.effect === "trails"` pattern already in use for echo/sparkles/zap/etc.

`configState.trails.length` (ribbon segment count), `configState.trails.gravity`, `configState.trails.drag` — these are not in the unified `TrailsIntent`. The Intent has `thickness`, `brightness`, `blueColor`, `redColor`, `rainbow`, `trackingMode`. Legacy defaults for the missing fields become `RibbonTrail3D` prop defaults (or literal values in the template) — the 3D UI never exposed them, so nothing changes for the user.

- [ ] **Step 1: Add the trails derived block**

Open `src/lib/shared/3d/effects/EffectsLayer.svelte`. Locate the block of unified `$derived` definitions (starts around line 68 with `const zap3D = $derived(...)`). After the existing `petalsShowRightEnd` derivation (around line 115), add:

```svelte
const trails3D = $derived(unifiedState ? resolveTrails3D(unifiedState.trails) : null);
const trailsEnabled = $derived(
  unifiedState ? unifiedState.config.tipEffectMap["*"]?.effect === "trails" : false,
);
const trailsShowLeftEnd = $derived(
  trails3D?.trackingMode === "left_end" || trails3D?.trackingMode === "both_ends",
);
const trailsShowRightEnd = $derived(
  trails3D?.trackingMode === "right_end" || trails3D?.trackingMode === "both_ends",
);
```

Extend the existing `resolveX3D` import at the top (around line 18) to include `resolveTrails3D`:

```svelte
import { resolveEcho3D, resolveSparkles3D, resolveZap3D, resolveWater3D, resolveBubbles3D, resolvePetals3D, resolveTrails3D } from "$lib/shared/effects/translators/webgl3d-translator";
```

- [ ] **Step 2: Replace the legacy trails `hasBlueTrailHistory` / trail positions derivations**

Locate (around lines 236-252):

```svelte
const hasBlueTrailHistory = $derived(
  effectState.hasEnoughHistory(
    "blue",
    configState.trails.length > 10 ? 10 : 2
  )
);
const hasRedTrailHistory = $derived(
  effectState.hasEnoughHistory("red", configState.trails.length > 10 ? 10 : 2)
);

const blueTrailPositions = $derived(
  effectState.getPositions("blue", configState.trails.length)
);
const redTrailPositions = $derived(
  effectState.getPositions("red", configState.trails.length)
);
```

These feed into the old tube trail path (`TrailRenderer`, not `RibbonTrail3D`) and are currently unused by the visible ribbon code below — ripgrep them to confirm. Inspect `hasBlueTrailHistory`, `hasRedTrailHistory`, `blueTrailPositions`, `redTrailPositions` usage in the template. If all references disappeared, delete all four derivations. If any remain, replace `configState.trails.length` with the literal `12` (legacy default) to keep behavior identical without touching the unified Intent shape.

Run: `grep -n "hasBlueTrailHistory\|hasRedTrailHistory\|blueTrailPositions\|redTrailPositions" src/lib/shared/3d/effects/EffectsLayer.svelte`

If the grep returns only the four definition lines (no additional consumers), delete those lines. Otherwise swap `configState.trails.length` → `12` and leave definitions in place.

- [ ] **Step 3: Replace the Trail Effects template block**

Locate the trails block (currently around lines 279-347):

```svelte
{#if configState.trails.enabled && isPlaying}
  {@const trackMode = configState.trails.trackingMode}
  {@const isRainbow = configState.trails.color === "rainbow"}
  {@const showLeftEnd =
    trackMode === TrackingMode.LEFT_END || trackMode === TrackingMode.BOTH_ENDS}
  {@const showRightEnd =
    trackMode === TrackingMode.RIGHT_END ||
    trackMode === TrackingMode.BOTH_ENDS}

  <!-- Blue prop ribbons -->
  {#if blueEnds}
    {#if showRightEnd}
      <RibbonTrail3D
        attachPoint={blueEnds.positive}
        color={isRainbow ? "rainbow" : "#3b82f6"}
        rainbow={isRainbow}
        segments={configState.trails.length}
        width={configState.trails.width}
        opacity={configState.trails.opacity}
        gravity={configState.trails.gravity}
        drag={configState.trails.drag}
        enabled={true}
      />
    {/if}
    {#if showLeftEnd}
      <RibbonTrail3D
        attachPoint={blueEnds.negative}
        color={isRainbow ? "rainbow" : "#60a5fa"}
        rainbow={isRainbow}
        segments={configState.trails.length}
        width={configState.trails.width * 0.8}
        opacity={configState.trails.opacity * 0.7}
        gravity={configState.trails.gravity}
        drag={configState.trails.drag}
        enabled={true}
      />
    {/if}
  {/if}

  <!-- Red prop ribbons -->
  {#if redEnds}
    {#if showRightEnd}
      <RibbonTrail3D
        attachPoint={redEnds.positive}
        color={isRainbow ? "rainbow" : "#ef4444"}
        rainbow={isRainbow}
        segments={configState.trails.length}
        width={configState.trails.width}
        opacity={configState.trails.opacity}
        gravity={configState.trails.gravity}
        drag={configState.trails.drag}
        enabled={true}
      />
    {/if}
    {#if showLeftEnd}
      <RibbonTrail3D
        attachPoint={redEnds.negative}
        color={isRainbow ? "rainbow" : "#f87171"}
        rainbow={isRainbow}
        segments={configState.trails.length}
        width={configState.trails.width * 0.8}
        opacity={configState.trails.opacity * 0.7}
        gravity={configState.trails.gravity}
        drag={configState.trails.drag}
        enabled={true}
      />
    {/if}
  {/if}
{/if}
```

Replace with:

```svelte
{#if trailsEnabled && trails3D && isPlaying}
  {@const isRainbow = trails3D.rainbow}
  {@const blueColor = trails3D.blueColor}
  {@const redColor = trails3D.redColor}
  {@const width = trails3D.thickness}
  {@const opacity = trails3D.brightness}

  <!-- Blue prop ribbons -->
  {#if blueEnds}
    {#if trailsShowRightEnd}
      <RibbonTrail3D
        attachPoint={blueEnds.positive}
        color={isRainbow ? "rainbow" : blueColor}
        rainbow={isRainbow}
        segments={12}
        width={width}
        opacity={opacity}
        enabled={true}
      />
    {/if}
    {#if trailsShowLeftEnd}
      <RibbonTrail3D
        attachPoint={blueEnds.negative}
        color={isRainbow ? "rainbow" : blueColor}
        rainbow={isRainbow}
        segments={12}
        width={width * 0.8}
        opacity={opacity * 0.7}
        enabled={true}
      />
    {/if}
  {/if}

  <!-- Red prop ribbons -->
  {#if redEnds}
    {#if trailsShowRightEnd}
      <RibbonTrail3D
        attachPoint={redEnds.positive}
        color={isRainbow ? "rainbow" : redColor}
        rainbow={isRainbow}
        segments={12}
        width={width}
        opacity={opacity}
        enabled={true}
      />
    {/if}
    {#if trailsShowLeftEnd}
      <RibbonTrail3D
        attachPoint={redEnds.negative}
        color={isRainbow ? "rainbow" : redColor}
        rainbow={isRainbow}
        segments={12}
        width={width * 0.8}
        opacity={opacity * 0.7}
        enabled={true}
      />
    {/if}
  {/if}
{/if}
```

Gravity + drag are dropped from the template — `RibbonTrail3D` defaults (`gravity = 50`, `drag = 0.03`) match the legacy `DEFAULT_TRAIL_CONFIG` values exactly, so the renderer behavior is unchanged.

- [ ] **Step 4: Verify build + visual behavior**

Run: `npm run check 2>&1 | grep -E "EffectsLayer|error" | head -20`
Expected: no new errors in EffectsLayer.svelte. Pre-existing errors elsewhere unchanged.

Use Chrome DevTools MCP: open 3D viewer, ensure trails render identically when enabled. Check rainbow toggle and L/R/B tracking mode. Side-by-side pre/post screenshot — any diff is a bug.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/effects/EffectsLayer.svelte
git commit -m "feat(effects-unification): Trails3D reads unified EffectsConfig via resolveTrails3D (Phase 2c.i)"
```

---

## Task 5: Migrate Fire3D reads in EffectsLayer to unified (2c.ii)

**Files:**
- Modify: `src/lib/shared/3d/effects/EffectsLayer.svelte`

Fire3D stops reading `configState.fire.*`. Enable via tipEffectMap, intensity via unified FireIntent, drop velocityReactive hook (legacy boolean, not in unified schema — pass fixed `velocityInfluence={0.3}` which matches `FireEmitter`'s default and legacy's `velocityReactive ? 0.3 : 0` upper branch).

- [ ] **Step 1: Add fire derived block**

In `src/lib/shared/3d/effects/EffectsLayer.svelte`, alongside the trails derived block (added in Task 4 Step 1), add:

```svelte
const fire3D = $derived(unifiedState ? resolveFire3D(unifiedState.fire) : null);
const fireEnabled = $derived(
  unifiedState ? unifiedState.config.tipEffectMap["*"]?.effect === "fire" : false,
);
```

Extend the `webgl3d-translator` import to include `resolveFire3D`:

```svelte
import { resolveEcho3D, resolveSparkles3D, resolveZap3D, resolveWater3D, resolveBubbles3D, resolvePetals3D, resolveTrails3D, resolveFire3D } from "$lib/shared/effects/translators/webgl3d-translator";
```

- [ ] **Step 2: Replace the Fire Effects template block**

Locate (currently around lines 352-388):

```svelte
{#if configState.fire.enabled && isPlaying}
  <!-- Blue prop fire -->
  {#if blueEnds}
    <FireEmitter
      position={blueEnds.positive}
      enabled={configState.fire.enabled}
      intensity={configState.fire.intensity}
      velocityInfluence={configState.fire.velocityReactive ? 0.3 : 0}
      propVelocity={blueVelocityVec}
    />
    <FireEmitter
      position={blueEnds.negative}
      enabled={configState.fire.enabled}
      intensity={configState.fire.intensity * 0.7}
      velocityInfluence={configState.fire.velocityReactive ? 0.3 : 0}
      propVelocity={blueVelocityVec}
    />
  {/if}

  <!-- Red prop fire -->
  {#if redEnds}
    <FireEmitter
      position={redEnds.positive}
      enabled={configState.fire.enabled}
      intensity={configState.fire.intensity}
      velocityInfluence={configState.fire.velocityReactive ? 0.3 : 0}
      propVelocity={redVelocityVec}
    />
    <FireEmitter
      position={redEnds.negative}
      enabled={configState.fire.enabled}
      intensity={configState.fire.intensity * 0.7}
      velocityInfluence={configState.fire.velocityReactive ? 0.3 : 0}
      propVelocity={redVelocityVec}
    />
  {/if}
{/if}
```

Replace with:

```svelte
{#if fireEnabled && fire3D && isPlaying}
  <!-- Blue prop fire -->
  {#if blueEnds}
    <FireEmitter
      position={blueEnds.positive}
      enabled={true}
      intensity={fire3D.intensity}
      velocityInfluence={0.3}
      propVelocity={blueVelocityVec}
    />
    <FireEmitter
      position={blueEnds.negative}
      enabled={true}
      intensity={fire3D.intensity * 0.7}
      velocityInfluence={0.3}
      propVelocity={blueVelocityVec}
    />
  {/if}

  <!-- Red prop fire -->
  {#if redEnds}
    <FireEmitter
      position={redEnds.positive}
      enabled={true}
      intensity={fire3D.intensity}
      velocityInfluence={0.3}
      propVelocity={redVelocityVec}
    />
    <FireEmitter
      position={redEnds.negative}
      enabled={true}
      intensity={fire3D.intensity * 0.7}
      velocityInfluence={0.3}
      propVelocity={redVelocityVec}
    />
  {/if}
{/if}
```

`velocityReactive` was only ever set to `true` by the default config — the false branch was dead. Hardcoding `0.3` matches observed behavior.

- [ ] **Step 3: Verify build + visual behavior**

Run: `npm run check 2>&1 | grep -E "EffectsLayer|error" | head -20`
Expected: no new errors in EffectsLayer.svelte.

Chrome DevTools MCP: verify Fire renders identically on enable + when intensity slider is adjusted.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/effects/EffectsLayer.svelte
git commit -m "feat(effects-unification): Fire3D reads unified EffectsConfig via resolveFire3D (Phase 2c.ii)"
```

---

## Task 6: Migrate EffectsSettingsPanel to unified state (2d)

**Files:**
- Modify: `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte`

Panel now reads the unified `EffectsConfig` for every non-motion branch. The 8-tile grid expands to 11 (drops motion from the effect grid — motion moves to a Scene section in Phase 3, but for Phase 2 we simply remove the motion chip; per-performer users lose the per-performer motion toggle, which was ambiguous anyway). The grid lists: `trails, fire, charcoal, led, zap, sparkles, echo, bloom, water, bubbles, petals`. The single intensity slider hooks to the `effect-primary-param` adapter from Phase 1.

Per-performer branch (`performer.toggleEffect()`) stays in place; only the global fallback rewires. `EffectId` divergence is accepted — `performer.settings.effects` still uses the legacy `EffectId` type, which means the per-performer grid shows `electricity` while the new global grid shows `zap`. Phase 2.5 aligns the per-performer type.

- [ ] **Step 1: Swap imports + state**

Open `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte`. Replace the existing imports (current lines 13-16):

```svelte
import { t } from "$lib/shared/i18n/i18n.svelte";
import { getEffectsConfigState } from "../../effects/state/effects-config-state.svelte";
import type { AvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";
import type { EffectId } from "$lib/shared/3d/state/performer-settings-types";
```

With:

```svelte
import { t } from "$lib/shared/i18n/i18n.svelte";
import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
import { getScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
import {
  getPrimaryParam,
  setPrimaryParam,
  PRIMARY_PARAMS,
} from "$lib/shared/animation-engine/components/effects-panel/effect-primary-param";
import { EFFECTS, EFFECT_COLORS, EFFECT_LABELS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
import type { AvatarInstanceState } from "$lib/shared/3d/state/avatar-instance-state.svelte";
import type { EffectId } from "$lib/shared/3d/state/performer-settings-types";
import type { EffectType } from "$lib/shared/effects/domain/EffectsConfig";
```

Replace `const config = getEffectsConfigState();` (current line 23) with:

```svelte
const config = getEffectsConfigContext() ?? createEffectsConfigState();
const scene3DRender = getScene3DRenderContext() ?? createScene3DRenderState();
```

- [ ] **Step 2: Replace the effectChips array**

Replace the existing `effectChips` array (current lines 26-35) with a derived list that sources from the shared registry. The registry's order (trails, fire, led, charcoal, zap, sparkles, echo, bloom, water, bubbles, petals) becomes the 3D grid order too. Also add back the Motion tile explicitly at the end so the UI stays functionally identical through Phase 2:

```svelte
type EffectKey = EffectType | "motion";

const effectChips: ReadonlyArray<{ key: EffectKey; label: string; icon: string; color: string }> = [
  ...EFFECTS.map((e) => ({
    key: e.id as EffectType,
    label: e.label,
    icon: e.icon.replace(/^fa-/, ""),
    color: e.color,
  })),
  { key: "motion" as const, label: "Motion", icon: "wind", color: "#22d3ee" },
];
```

- [ ] **Step 3: Rewrite `isEnabled()`**

Replace (current lines 40-62):

```typescript
function isEnabled(key: EffectKey): boolean {
  if (performer) {
    return performer.settings.effects.has(key as EffectId);
  }
  // ... switch
}
```

With:

```typescript
function isEnabled(key: EffectKey): boolean {
  if (performer) {
    // Per-performer still uses legacy EffectId union. Translate where they diverge.
    const perPerformerKey: EffectId | null = key === "zap"
      ? "electricity"
      : key === "echo" || key === "water" || key === "bubbles" || key === "petals"
        ? null // not representable in legacy EffectId — per-performer scope is Phase 2.5
        : (key as EffectId);
    return perPerformerKey !== null && performer.settings.effects.has(perPerformerKey);
  }
  if (key === "motion") {
    return scene3DRender.motion.blur || scene3DRender.motion.speedLines;
  }
  // Global fallback — unified EffectsConfig
  return config.config.tipEffectMap["*"]?.effect === key;
}
```

- [ ] **Step 4: Rewrite `toggle()`**

Replace (current lines 65-100):

```typescript
function toggle(key: EffectKey) {
  if (performer) {
    performer.toggleEffect(key as EffectId);
    return;
  }
  // Global fallback — switch
}
```

With:

```typescript
function toggle(key: EffectKey) {
  if (performer) {
    const perPerformerKey: EffectId | null = key === "zap"
      ? "electricity"
      : key === "echo" || key === "water" || key === "bubbles" || key === "petals"
        ? null
        : (key as EffectId);
    if (perPerformerKey !== null) performer.toggleEffect(perPerformerKey);
    return;
  }
  if (key === "motion") {
    const motionEnabled = scene3DRender.motion.blur || scene3DRender.motion.speedLines;
    scene3DRender.updateMotion({
      blur: !motionEnabled,
      speedLines: !motionEnabled,
    });
    return;
  }
  // Global fallback — set the wildcard tip map. Toggling the same effect off
  // returns to "none" so the grid has a consistent off-state semantic.
  const currentlyActive = config.config.tipEffectMap["*"]?.effect === key;
  config.setTipEffectMap({ "*": { effect: currentlyActive ? "none" : key } });
}
```

- [ ] **Step 5: Rewrite `getIntensity()` and `setIntensity()` via the adapter**

Replace both functions (current lines 120-160) with:

```typescript
function getIntensity(key: EffectKey): number {
  if (key === "motion") return scene3DRender.motion.intensity;
  const spec = PRIMARY_PARAMS[key as EffectType];
  if (!spec) return 0.5;
  const raw = getPrimaryParam(key as EffectType, config);
  // Normalize to 0-1 for the slider regardless of the effect's native range.
  return (raw - spec.min) / (spec.max - spec.min);
}

function setIntensity(key: EffectKey, value: number) {
  if (key === "motion") {
    scene3DRender.updateMotion({ intensity: value });
    return;
  }
  const spec = PRIMARY_PARAMS[key as EffectType];
  if (!spec) return;
  const raw = spec.min + value * (spec.max - spec.min);
  // Quantize to the spec's step to keep integer ranges (trails/led) intact.
  const snapped = Math.round(raw / spec.step) * spec.step;
  setPrimaryParam(key as EffectType, config, snapped);
}
```

- [ ] **Step 6: Keep trail-color + tracking sub-controls working**

The existing `{#if config.trails.enabled}` block (around lines 186-247) currently calls `config.setTrailMode("rainbow" | "color")`, `config.setTrackingMode("left" | "right" | "both")`, and reads `config.getTrackingModeLabel()`. The unified state has none of these methods. Rewrite the block to use `config.updateTrails()`.

Change the outer `{#if}` trigger — trails are "active" in the unified world when the tipEffectMap wildcard points at trails:

```svelte
{#if isEnabled("trails") && !performer}
  <div class="sub-control">
    <span class="sub-label">{t("viewer3d_color")}</span>
    <div class="mode-chips">
      <button
        class="mode-chip"
        class:active={config.trails.rainbow}
        onclick={() => config.updateTrails({ rainbow: true })}
        aria-label="Trail color: Rainbow"
        aria-pressed={config.trails.rainbow}
      >
        Rainbow
      </button>
      <button
        class="mode-chip"
        class:active={!config.trails.rainbow}
        onclick={() => config.updateTrails({ rainbow: false })}
        aria-label="Trail color: Solid"
        aria-pressed={!config.trails.rainbow}
      >
        Solid
      </button>
    </div>
  </div>

  <div class="sub-control">
    <span class="sub-label">{t("viewer3d_track")}</span>
    <div class="mode-chips triple">
      <button
        class="mode-chip"
        class:active={config.trails.trackingMode === "left_end"}
        onclick={() => config.updateTrails({ trackingMode: "left_end" })}
        aria-label="Track left end only"
        aria-pressed={config.trails.trackingMode === "left_end"}
        title="Track left end only"
      >
        Left
      </button>
      <button
        class="mode-chip"
        class:active={config.trails.trackingMode === "both_ends"}
        onclick={() => config.updateTrails({ trackingMode: "both_ends" })}
        aria-label="Track both ends"
        aria-pressed={config.trails.trackingMode === "both_ends"}
        title="Track both ends"
      >
        Both
      </button>
      <button
        class="mode-chip"
        class:active={config.trails.trackingMode === "right_end"}
        onclick={() => config.updateTrails({ trackingMode: "right_end" })}
        aria-label="Track right end only"
        aria-pressed={config.trails.trackingMode === "right_end"}
        title="Track right end only"
      >
        Right
      </button>
    </div>
  </div>
{/if}
```

The `!performer` guard means per-performer mode hides the rainbow/track sub-controls — acceptable because per-performer still writes into the legacy Set, which doesn't store rainbow/track. Phase 3 unifies these.

- [ ] **Step 7: Remove the active-count block's legacy call**

Locate (around line 277):

```svelte
{:else if config.enabledCount > 0}
  <div class="active-count">
    {config.enabledCount} effect{config.enabledCount > 1 ? "s" : ""} active
  </div>
{/if}
```

Replace with a unified derivation. Add alongside the `scene3DRender` declaration in `<script>`:

```svelte
const globalEnabledCount = $derived(
  (config.config.tipEffectMap["*"]?.effect && config.config.tipEffectMap["*"].effect !== "none" ? 1 : 0) +
  (scene3DRender.motion.blur || scene3DRender.motion.speedLines ? 1 : 0),
);
```

Replace the template block:

```svelte
{:else if globalEnabledCount > 0}
  <div class="active-count">
    {globalEnabledCount} effect{globalEnabledCount > 1 ? "s" : ""} active
  </div>
{/if}
```

- [ ] **Step 8: Build + visual verification**

Run: `npm run check 2>&1 | grep "EffectsSettingsPanel\|error TS" | head -20`
Expected: no new errors.

Chrome DevTools MCP — in 3D viewer:
1. Open the gear popover → Effects panel.
2. Toggle each effect chip: trails, fire, led, charcoal, zap, sparkles, echo, bloom, water, bubbles, petals, motion. Each should activate/deactivate in the 3D scene.
3. Trails: switch rainbow ↔ solid and Left/Both/Right tracking — verify visual change.
4. Double-click an active chip → intensity slider appears → adjust → scene reacts.
5. If a performer is selected: toggle per-performer effects still works for the 6 legacy-representable keys (trails/fire/charcoal/led/electricity/sparkles/motion/bloom).

- [ ] **Step 9: Commit**

```bash
git add src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte
git commit -m "feat(effects-unification): EffectsSettingsPanel reads unified EffectsConfig + Scene3DRenderConfig (Phase 2d)"
```

---

## Task 7: Delete legacy state file + legacy config types (2e)

**Files:**
- Modify: `src/lib/shared/3d/effects/EffectsLayer.svelte` (drop legacy import)
- Modify: `src/lib/shared/3d/effects/types.ts` (delete legacy config types only)
- Delete: `src/lib/shared/3d/effects/state/effects-config-state.svelte.ts`

The legacy store now has zero consumers except its own imports. Deleting it forces the build to flag any stragglers.

- [ ] **Step 1: Drop the legacy import from EffectsLayer.svelte**

Open `src/lib/shared/3d/effects/EffectsLayer.svelte`. Remove the legacy import (current line 16):

```svelte
import { getEffectsConfigState } from "./state/effects-config-state.svelte";
```

And remove the instantiation (current line 66):

```svelte
const configState = getEffectsConfigState();
```

Also remove the unused imports `TrackingMode, TrailStyle` from the `./types` import if they're no longer referenced anywhere in the file (they were used by the old trails block's `{@const trackMode === TrackingMode.LEFT_END}` logic — Task 4 replaced that with string literals so these should now be unused). Run:

```bash
grep -n "TrackingMode\|TrailStyle" src/lib/shared/3d/effects/EffectsLayer.svelte
```

If zero matches after removing the `configState` block, delete the `import { TrackingMode, TrailStyle } from "./types"` line too.

- [ ] **Step 2: Delete the legacy state file**

```bash
rm src/lib/shared/3d/effects/state/effects-config-state.svelte.ts
```

- [ ] **Step 3: Delete unused config types from 3d/effects/types.ts**

Open `src/lib/shared/3d/effects/types.ts`. Delete the following sections:

- `TrailConfig` interface + `DEFAULT_TRAIL_CONFIG` (lines ~71-109)
- `ParticleConfig` interface + `DEFAULT_PARTICLE_CONFIG` (lines ~116-145) — **keep if used elsewhere**
- `GlowConfig` interface + `DEFAULT_GLOW_CONFIG` (lines ~152-172)
- `FireConfig` interface + `DEFAULT_FIRE_CONFIG` (lines ~179-205)
- `SparkleConfig` interface + `DEFAULT_SPARKLE_CONFIG` (lines ~212-235)
- `ElectricityConfig` interface + `DEFAULT_ELECTRICITY_CONFIG` (lines ~242-265)
- `AllEffectConfigs` interface + `DEFAULT_ALL_EFFECTS` (lines ~273-293)

Before each deletion, verify outside consumers:

```bash
for name in TrailConfig ParticleConfig GlowConfig FireConfig SparkleConfig ElectricityConfig AllEffectConfigs DEFAULT_TRAIL_CONFIG DEFAULT_PARTICLE_CONFIG DEFAULT_GLOW_CONFIG DEFAULT_FIRE_CONFIG DEFAULT_SPARKLE_CONFIG DEFAULT_ELECTRICITY_CONFIG DEFAULT_ALL_EFFECTS; do
  echo "=== $name ==="
  grep -rln "\\b$name\\b" src/ 2>/dev/null | grep -v "3d/effects/types.ts"
done
```

For each name with zero remaining matches, delete it. For any with matches, leave the type in place and flag in the commit message as "kept — still referenced by X".

**Expected safe deletions (based on Phase 2a inventory):** all of `TrailConfig`, `GlowConfig`, `FireConfig` (legacy 3D — distinct from `FireOverlayConfig`), `SparkleConfig`, `ElectricityConfig`, `AllEffectConfigs`, plus their DEFAULTs.

**Expected retentions:** `TrackingMode`, `TrailStyle`, `TrailPoint`, `PropPositionHistory`, `EffectConfig`, `QualityTier`, `QualityTierConfig`, `TIER_CONFIGS`, `PropId`, `TipPositionData3D`, `PropTipPositions3D`. `ParticleConfig` — check; if unused outside types.ts, delete too.

- [ ] **Step 4: Build + full verification**

Run: `npm run check 2>&1 | tail -40`
Expected: no new errors referencing the deleted file or types. Pre-existing unrelated errors unchanged.

Run: `npx vitest run tests/unit/scene-3d-render-state.test.ts tests/unit/effect-registry.test.ts tests/unit/effect-primary-param.test.ts`
Expected: all pass.

Acceptance greps (must return zero matches):

```bash
grep -rn "getEffectsConfigState" src/lib/shared/3d/ 2>/dev/null; echo "exit=$?"
grep -rn "3d/effects/state/effects-config-state" src/ 2>/dev/null; echo "exit=$?"
```

Both commands should print `exit=1` (grep-no-match exit code).

Run: `NODE_OPTIONS=--max-old-space-size=8192 npm run build 2>&1 | tail -20`
Expected: build succeeds.

- [ ] **Step 5: Visual QA across 2D + 3D**

Chrome DevTools MCP:
1. 2D canvas (AnimatorCanvas) — toggle every effect + trails rainbow/tracking. All unchanged from pre-Phase-2.
2. 3D viewer — toggle every effect via `EffectsSettingsPanel`. Trails, fire, motion, LED, charcoal, bloom, sparkles, zap, echo, water, bubbles, petals all render correctly.
3. Per-performer — select a performer, toggle a legacy-representable effect (trails/fire/etc.). Renders on that performer only.

If any 3D effect regresses: revert Task 7 only — the legacy types staying an extra day is cheap, debugging a broken effects system is not.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/effects/EffectsLayer.svelte
git add src/lib/shared/3d/effects/types.ts
git rm src/lib/shared/3d/effects/state/effects-config-state.svelte.ts
git commit -m "refactor(effects-unification): delete legacy 3D effects state + unused config types (Phase 2e)

Closes the Phase 2 unification. All 3D effect consumers now read the
single source of truth at src/lib/shared/effects/state/effects-config-state.svelte.ts
with motion living in Scene3DRenderConfig.

Acceptance:
- grep -rn 'getEffectsConfigState' src/lib/shared/3d/ → zero matches
- grep -rn '3d/effects/state/effects-config-state' src/ → zero matches
- 2D + 3D visual QA: every effect renders identically to pre-Phase-2"
```

---

## Acceptance (full Phase 2)

After all 7 tasks:

- `grep -r "getEffectsConfigState" src/lib/shared/3d/` returns zero matches.
- `src/lib/shared/3d/effects/state/effects-config-state.svelte.ts` does not exist.
- 3D viewer renders every effect visible in 2D with identical behavior.
- Per-performer enable/disable still works for the legacy-representable effects; `echo`/`water`/`bubbles`/`petals` per-performer is deferred to Phase 2.5.
- Motion blur + speed lines still work (now driven by `Scene3DRenderConfig`).
- Desktop `EffectsPanel`, mobile `MobileEffectsPanel`, and 2D canvas rendering unchanged.
- All unit tests pass. `svelte-check` error count not worse than the Phase 1 baseline.
- Visual QA screenshots match pre-change for each migrated effect.

## Phase 2.5 Follow-up (separate plan)

Not part of this plan but flagged for next:

- Align `EffectId` in `performer-settings-types.ts` with canonical `EffectType`. Renames `electricity` → `zap`, drops `motion`, adds `echo`/`water`/`bubbles`/`petals`. Requires localStorage migration for saved per-performer effect sets. Own plan, own branch.
