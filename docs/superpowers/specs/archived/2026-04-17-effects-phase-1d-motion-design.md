# Effects Phase 1d: Motion Vertical Slice Design

**Status:** Spec (2026-04-17). Follows Phase 1c (Sparkles, `phase-1c-sparkles-complete` tag).

**Goal:** Ship Motion as the third fully-wired tip effect through the unified intent layer (2D renderer + 3D wiring + presets + Customize), mirroring the proven Phase 1a/1b/1c pattern.

## Current state

- `MotionIntent` exists in `EffectsConfig.ts:122-129` with bare `blur`, `speedLines`, `threshold`.
- Defaults exist in `defaults.ts:64-68` with neutral values.
- Translator scaffolding (`Motion2DParams`, `Motion3DParams`, `resolveMotion2D`, `resolveMotion3D`) already present from Phase 1a infrastructure.
- 3D components exist:
  - `src/lib/shared/3d/effects/motion/MotionBlur.svelte` — ghost trail of semi-transparent prop copies + connecting line.
  - `src/lib/shared/3d/effects/motion/SpeedLines.svelte` — anime-style radiating lines backward from prop, scales with velocity.
- **Nothing else is wired.** No 2D renderer, no preset group, no Customize component, no `AnimationEngine` overlay sync, and no `EffectsLayer` mount. Selecting "Motion" in the chip row currently routes to `ComingSoonCustomize`.

## Differentiation from existing effects

Trails = continuous painted ribbon (always-on history record).
Sparkles = particle bursts at tips (ornamental).
**Motion = velocity-gated speed feedback** — only fires when prop moves above `threshold`. Goes silent when prop is still. The threshold gate is the visual contract.

## Architecture

Two groups of changes:

### Group A — Data model + translator (mirrors Phase 1c Tasks 1-4)

Extend `MotionIntent` with the four knobs needed to differentiate the planned presets, and bump `EFFECTS_CONFIG_VERSION` 4→5 with a v4→v5 migration that adds defaults to existing persisted configs.

**New shape (`EffectsConfig.ts`):**

```ts
export interface MotionIntent {
  /** 0-1 — trailing blur strength (ghost-stamps of the tip). */
  blur: number;
  /** 0-1 — anime speed-line streak strength. */
  speedLines: number;
  /** 0-1 — min normalized hand speed before effect kicks in. */
  threshold: number;
  /** Hex string — primary stroke/ghost tint when colorMode === "solid". */
  color: string;
  /** "solid" = use color, "rainbow" = HSL cycle, "velocity" = hue maps to speed (cool→hot), "prop-matched" = blue tip blue, red tip red. */
  colorMode: "solid" | "rainbow" | "velocity" | "prop-matched";
  /** 0-1 — trail/streak length multiplier (composes with renderer base length). */
  length: number;
  /** 3-12 — number of streak lines per tip. */
  count: number;
}
```

**Migration (`migrations.ts` — append v4→v5 case):**

```ts
if (version < 5 && input.motion) {
  const m = input.motion as any;
  m.color ??= "#ffffff";
  m.colorMode ??= "solid";
  m.length ??= 0.5;
  m.count ??= 6;
}
```

**Defaults (`defaults.ts`):**

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

**Translator types.** Existing `Motion2DParams` and `Motion3DParams` (in `canvas2d-types.ts`/`webgl3d-types.ts`) `extends MotionIntent` so they pick up new fields automatically. No changes needed to the type files. Resolver defaults stay valid because they only key off `blur`/`speedLines`/`threshold`.

**Resolvers.** Both `resolveMotion2D` and `resolveMotion3D` continue to compose the intent with backend extras — same shape as today.

### Group B — Rendering + UI (mirrors Phase 1a Tasks 8-15 / Phase 1c Tasks 5-10)

**2D renderer (new — `src/lib/shared/effects/renderers/Motion2DRenderer.ts`):**

Per-tip state machine. Each frame:
1. Compute velocity per tip (`distance(curr, prev) / dt`).
2. Skip rendering for tips where `velocity < threshold * 600` (600 px/s is the calibrated reference for "fast prop swing").
3. **Ghost stamps (blur sub-effect):** maintain a small ring buffer (length `floor(8 + blur * 12)`) per tip of recent positions. Draw soft circles at each history slot with alpha decaying linearly from `blur * 0.6` → 0.
4. **Speed lines (speedLines sub-effect):** at each frame, emit `count` short streak lines from the tip pointing OPPOSITE to the velocity vector. Length = `length * 24 + min(velocity, 1200) * length * 0.05` px. Stroke width = `1.5 + speedLines * 1.5`. Slight perpendicular jitter on side lines.
5. Color picked per-stamp/per-line by `colorMode`:
   - `solid` → `params.color`
   - `rainbow` → `hsl((Date.now() * 0.1) % 360, 80%, 60%)`
   - `velocity` → `hsl(220 - min(velocity, 1500) / 1500 * 220, 90%, 60%)` (blue → cyan → green → yellow → red as speed climbs)
   - `prop-matched` → caller passes a per-tip `tipColor` map (`bluePosA/B → blue color`, `redPosA/B → red color`). Renderer picks from that map per-spawn.
6. Additive blend (`globalCompositeOperation = "lighter"`) so overlapping streaks brighten.
7. Renderer holds its own state across frames (last positions, ring buffers). `dispose()` clears state.

The renderer takes `tipColors: { blue: string; red: string }` so `prop-matched` mode has access to the trails colors.

**3D wiring (`EffectsLayer.svelte`):** mount 4 instances of `MotionBlur` and 4 of `SpeedLines` (one of each per tip endpoint: bluePosA, bluePosB, redPosA, redPosB), passing translator-resolved props. Both 3D components already accept `currentPosition`, `previousPosition`, `enabled`, `intensity`, `threshold`, `color`, plus extras (`trailCount` / `lineCount`, `ghostSize` / `maxLength`, `spread`). Map:
- MotionBlur: `intensity = blur`, `trailCount = floor(3 + blur * 6)`, `color = colorFor(tip)`.
- SpeedLines: `intensity = speedLines`, `lineCount = count`, `maxLength = length * 1.2`, `color = colorFor(tip)`.

For `colorMode === "prop-matched"`, blue-tip components get blue, red-tip get red. For `velocity` mode in 3D, leave as `params.color` (deferred — velocity-based hue per-frame in Threlte requires a derived block per emitter and adds noise without much visual payoff in 3D where the tip already moves through space).

**AnimationEngine wiring (`AnimationEngine.svelte.ts`):**
1. Add `private motion2DRenderer: Motion2DRenderer | null = null` field.
2. Add `private prevMotionIntentRef: MotionIntent | null = null` cache (Phase 1b reference-identity pattern).
3. Add `private lastMotionFrameTime: number = 0` field (Phase 1c lesson — separate dt clock per overlay so it doesn't disappear when other overlays are inactive).
4. In the existing `getFrameParams`/intent-diff block, add a motion branch that resolves and triggers re-render on intent change.
5. In `syncMotionOverlay` (new method, mirror `syncSparklesOverlay`), invoke renderer with current tip data + per-tip color map (read from `state.trails.blueColor` / `state.trails.redColor`).
6. Add `motionActive` to the render-loop `hasActiveWork` set so the loop doesn't auto-stop when only Motion is active.

**Preset group (`src/lib/shared/animation-engine/components/effects-panel/presets/motion-presets.ts`):**

```ts
export const MOTION_PRESETS: EffectPreset[] = [
  {
    id: "motion-anime",
    name: "Anime",
    previewColor: "#ffffff",
    apply: (_vm, state) => applyMotion(state, "motion-anime", {
      blur: 0.1, speedLines: 0.9, threshold: 0.25,
      color: "#ffffff", colorMode: "solid",
      length: 0.7, count: 8,
    }),
  },
  {
    id: "motion-ghost",
    name: "Ghost",
    previewColor: "#a5b4fc",
    apply: (_vm, state) => applyMotion(state, "motion-ghost", {
      blur: 0.9, speedLines: 0, threshold: 0.1,
      color: "#a5b4fc", colorMode: "prop-matched",
      length: 0.6, count: 4,
    }),
  },
  {
    id: "motion-comet",
    name: "Comet",
    previewColor: "rainbow",
    apply: (_vm, state) => applyMotion(state, "motion-comet", {
      blur: 0.7, speedLines: 0.7, threshold: 0.15,
      color: "#ffffff", colorMode: "velocity",
      length: 1.0, count: 6,
    }),
  },
  {
    id: "motion-sonic-boom",
    name: "Sonic Boom",
    previewColor: "#fde047",
    apply: (_vm, state) => applyMotion(state, "motion-sonic-boom", {
      blur: 0.3, speedLines: 1.0, threshold: 0.55,
      color: "#fde047", colorMode: "solid",
      length: 1.0, count: 12,
    }),
  },
  {
    id: "motion-custom",
    name: "Custom",
    previewColor: "custom",
    apply: () => { /* opens Customize */ },
  },
];

export const MOTION_PRESET_GROUP: EffectPresetGroup = {
  effectType: "motion",
  presets: MOTION_PRESETS,
  getSummary: (_vm, state) => {
    if (!state) return "";
    const m = state.motion;
    return `${m.colorMode} · blur ${Math.round(m.blur * 100)}% · lines ${Math.round(m.speedLines * 100)}%`;
  },
};
```

**Customize component (`src/lib/shared/animation-engine/components/effects-panel/customize/MotionCustomize.svelte`):**

Inline the canonical patterns from `SparklesCustomize`. Layout, top-to-bottom:
- Color mode chip row (Solid / Rainbow / Velocity / Prop-Matched).
- Conditional: if `solid` → one circular color picker. Otherwise → no picker (prop-matched reads from trails colors, velocity is computed, rainbow is computed).
- Sliders: Blur, Speed Lines, Threshold, Length, Count (count is integer 3-12, others 0-1).

**EffectsPanel routing (`EffectsPanel.svelte`):** add `{:else if activeEffect === "motion"}` branch that mounts `MotionCustomize` instead of `ComingSoonCustomize`. Remove the motion branch from ComingSoon.

## Task breakdown (for writing-plans phase)

Ordered by dependency:

1. **Extend `MotionIntent`** (color, colorMode, length, count) + bump version 4→5 + migration v4→v5 + migration test.
2. **Update `defaults.ts`** with new fields.
3. **2D + 3D translator types and resolvers** — verify they pick up the new fields cleanly (no functional changes expected; just confirm/tweak).
4. **Implement `Motion2DRenderer`** + unit tests covering: threshold gating, ghost ring buffer length, speed-line direction opposite to velocity, palette/colorMode color picking.
5. **Wire renderer into `AnimationEngine`** — field, intent-diff cache, `syncMotionOverlay`, `lastMotionFrameTime` dt tracker, `motionActive` in `hasActiveWork`.
6. **Wire 3D `MotionBlur` + `SpeedLines` mounts in `EffectsLayer`** — 4+4 instances with per-tip color from colorMode + trails colors.
7. **Build preset group** (`motion-presets.ts`) — Anime / Ghost / Comet / Sonic Boom / Custom.
8. **Build `MotionCustomize.svelte`** — chip row + conditional picker + sliders.
9. **Wire `EffectsPanel` routing** — motion → MotionCustomize, remove from ComingSoon.
10. **Final visual verification** — Lab → Motion → click each preset, confirm distinct visual + summary.

## Test plan

- **Unit:** `migrations.test.ts` v4→v5 case (defaults injected). `Motion2DRenderer.test.ts` covering: threshold gating (no draw when slow), ring buffer length scales with `blur`, speed lines emitted in opposite direction to velocity.
- **Integration:** none beyond renderer tests — Phase 1a/1b/1c established the pattern works end-to-end.
- **Visual:** DevTools snapshot of Customize panel + each preset application via `evaluate_script` reading `state.motion` fields.

## Non-goals (deferred)

- Velocity-color mode in 3D (only 2D — 3D static color, deferred item).
- Per-tip independent threshold (use one global threshold).
- Motion-vector field visualization (different effect entirely).
- Doppler-style chromatic aberration (could be a future Phase polish).
- Motion in `EffectsSettingsPanel` (legacy) — Phase 3 retires that panel.

## References

- Phase 1c tag: `phase-1c-sparkles-complete`
- Phase 1c spec: `docs/superpowers/specs/2026-04-17-effects-phase-1c-sparkles-design.md`
- Phase 1c plan: `docs/superpowers/plans/2026-04-17-effects-phase-1c-sparkles.md`
- Overall unification spec: `docs/superpowers/specs/2026-04-15-effects-unification-design.md`
- Deferred items: `docs/superpowers/specs/effects-unification-deferred-items.md`
