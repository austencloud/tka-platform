# Effects Phase 1c: Sparkles Vertical Slice Design

**Status:** Spec (2026-04-17). Follows Phase 1b (Zap polish, `phase-1b-zap-polish-complete` tag).

**Goal:** Ship Sparkles as the second fully-wired tip effect through the unified intent layer (2D renderer + 3D wiring + presets + Customize), mirroring the proven Phase 1a/1b pattern.

## Current state

- `SparklesIntent` exists in `EffectsConfig.ts:101-112` with `rate`, `size`, `lifetime`, `color`, `rainbow`.
- Defaults exist in `defaults.ts:52-58`.
- `SparkleEmitter.svelte` (3D) exists at `src/lib/shared/3d/effects/particles/SparkleEmitter.svelte` and accepts `position`, `enabled`, `intensity`, `color`, `spread`. Internal: `MAX_PARTICLES=50`, `BASE_SPAWN_RATE=15`, `GRAVITY=30`.
- **Nothing else is wired.** No 2D renderer, no translator entries, no preset group, no Customize component, no `AnimationEngine` overlay sync, and no `EffectsLayer` mount. Selecting "Sparkle" in the chip row currently routes to `ComingSoonCustomize`.

## Architecture

Two groups of changes:

### Group A — Data model + translator (mirrors Phase 1b Tasks 4-5)

Extend `SparklesIntent` with the four knobs the design needs to differentiate the planned presets, and add a `palette: string[]` field for multicolor presets (Confetti). Bump `EFFECTS_CONFIG_VERSION` 3→4 with a v3→v4 migration that adds defaults to existing persisted configs.

**New shape (`EffectsConfig.ts`):**

```ts
export interface SparklesIntent {
  /** 0-1 — particle spawn rate multiplier. */
  rate: number;
  /** 0-1 — particle scale multiplier. */
  size: number;
  /** 0.1-3.0 seconds. */
  lifetime: number;
  /** Hex string — primary tint when colorMode === "solid". */
  color: string;
  /** Multicolor palette (3-5 hex). Used when colorMode === "palette". */
  palette: string[];
  /** "solid" = use color, "rainbow" = HSL cycle, "palette" = pick random from palette. */
  colorMode: "solid" | "rainbow" | "palette";
  /** 0-30 px — radius around the tip particles spawn within. */
  spread: number;
  /** 0-1 — 0=floaty (low gravity), 1=fast fall (high gravity). */
  gravity: number;
  /** 'burst' = sudden bloom on motion, 'stream' = continuous, 'trail' = follows tip path. */
  mode: "burst" | "stream" | "trail";
}
```

**Migration (`migrations.ts` — append v3→v4 case):**

```ts
if (version < 4 && input.sparkles) {
  input.sparkles.palette ??= ["#fbbf24", "#f59e0b", "#fde047"];
  input.sparkles.colorMode ??= input.sparkles.rainbow ? "rainbow" : "solid";
  input.sparkles.spread ??= 8;
  input.sparkles.gravity ??= 0.3;
  input.sparkles.mode ??= "stream";
  delete input.sparkles.rainbow;
}
```

The `rainbow` boolean folds into `colorMode === "rainbow"` — cleaner than a parallel boolean. The migration writes the new fields in-place before the default-merge so existing persisted configs upgrade without losing user selections.

**Defaults (`defaults.ts`):**

```ts
sparkles: {
  rate: 0.5,
  size: 0.5,
  lifetime: 1.2,
  color: "#fbbf24",
  palette: ["#fbbf24", "#f59e0b", "#fde047"],
  colorMode: "solid",
  spread: 8,
  gravity: 0.3,
  mode: "stream",
},
```

**Translator types.** `Sparkles2DParams` and `Sparkles3DParams` both `extends SparklesIntent` (Phase 1b pattern — they pick up new fields automatically). Add to `canvas2d-types.ts` and `webgl3d-types.ts`.

**Resolvers.** `resolveSparkles2D` and `resolveSparkles3D` follow the Zap pattern — `{ ...intent, ...defaults, ...override }`.

### Group B — Rendering + UI (mirrors Phase 1a Tasks 8-15)

**2D renderer (new — `src/lib/shared/effects/renderers/Sparkles2DRenderer.ts`):**

Particle pool simulation. Key choices:
- Pool size `MAX_PARTICLES = 200` (4× 3D's pool — 2D is cheap).
- Each particle: `{x, y, vx, vy, life, maxLife, color, scale}`.
- Spawn per frame: `floor(params.rate * 8 * dt)` from each enabled tip, scattered within `spread` radius.
- Color picked per spawn: `solid` = `params.color`; `rainbow` = `hsl((Date.now()*0.1) % 360, 80%, 60%)`; `palette` = random pick from `params.palette`.
- Velocity: random unit direction × small initial speed. Apply `vy += gravity * 200 * dt`.
- Render: small filled circle with additive blend (`globalCompositeOperation = "lighter"`), alpha = `life/maxLife`.

Renderer holds its own particle state across frames — caller passes tips per frame, renderer manages pool. `dispose()` clears the pool.

**Mode behavior (renderer-internal):**
- `stream` — spawn each frame.
- `burst` — only spawn when tip velocity exceeds a small threshold (renderer tracks last position per tip).
- `trail` — spawn at tips and along the path between last and current tip position.

**3D wiring (`EffectsLayer.svelte`):** mount four `SparkleEmitter` instances (one per tip endpoint: bluePosA, bluePosB, redPosA, redPosB). Pass `intensity = params.rate`, `spread = params.spread`, `color` derived per-frame from `colorMode` (solid uses `params.color`; palette/rainbow could use index-based selection — keep palette as `params.palette[index % palette.length]`). The 3D `SparkleEmitter` already implements gravity internally — for Phase 1c, leave its hardcoded `GRAVITY=30` alone (deferred item: wire `params.gravity` into emitter).

**AnimationEngine wiring (`AnimationEngine.svelte.ts`):**
1. Add `private sparkles2DRenderer: Sparkles2DRenderer | null = null` field.
2. Add `prevSparklesIntentRef: SparklesIntent | null = null` cache (Phase 1b pattern, reference identity).
3. In the existing `getFrameParams`/intent-diff block (around line 2280-2310), add a sparkles branch that resolves and triggers re-render on intent change.
4. In `syncSparklesOverlay` (new method, mirror `syncZapOverlay`), invoke renderer with current tip data.

**Preset group (`src/lib/shared/animation-engine/components/effects-panel/presets/sparkles-presets.ts`):**

```ts
export const SPARKLES_PRESETS: EffectPreset[] = [
  {
    id: "sparkles-fairy-dust",
    name: "Fairy Dust",
    previewColor: "#fde047",
    apply: (_vm, state) => applySparkles(state, "sparkles-fairy-dust", {
      rate: 0.4, size: 0.4, lifetime: 1.8,
      color: "#fde047", colorMode: "solid",
      spread: 10, gravity: 0.1, mode: "stream",
    }),
  },
  {
    id: "sparkles-pixie",
    name: "Pixie Sparks",
    previewColor: "#67e8f9",
    apply: (_vm, state) => applySparkles(state, "sparkles-pixie", {
      rate: 0.8, size: 0.3, lifetime: 0.6,
      color: "#67e8f9", colorMode: "solid",
      spread: 6, gravity: 0.5, mode: "burst",
    }),
  },
  {
    id: "sparkles-confetti",
    name: "Confetti",
    previewColor: "rainbow",
    apply: (_vm, state) => applySparkles(state, "sparkles-confetti", {
      rate: 0.7, size: 0.6, lifetime: 2.0,
      colorMode: "palette",
      palette: ["#ec4899", "#22d3ee", "#fbbf24", "#22c55e", "#a855f7"],
      spread: 12, gravity: 0.8, mode: "burst",
    }),
  },
  {
    id: "sparkles-custom",
    name: "Custom",
    previewColor: "custom",
    apply: () => { /* opens Customize */ },
  },
];

export const SPARKLES_PRESET_GROUP: EffectPresetGroup = {
  effectType: "sparkles",
  presets: SPARKLES_PRESETS,
  getSummary: (_vm, state) => {
    if (!state) return "";
    const s = state.sparkles;
    return `${s.mode} · ${Math.round(s.rate * 100)}% · ${s.lifetime}s`;
  },
};
```

**Customize component (`src/lib/shared/animation-engine/components/effects-panel/customize/SparklesCustomize.svelte`):**

Inline the canonical patterns from `ZapCustomize` (chip row + sliders + circular color picker). Layout, top-to-bottom:
- Mode chip row (Burst / Stream / Trail).
- Color mode chip row (Solid / Rainbow / Palette).
- Conditional: if `solid` → one circular color picker. If `palette` → row of N circular pickers (one per palette entry; for v1, fixed at 5 with add/remove deferred). If `rainbow` → no picker.
- Sliders: Rate, Size, Lifetime, Spread, Gravity.

**EffectsPanel routing (`EffectsPanel.svelte:228-244`):** add `{:else if activeEffect === "sparkles"}` branch that mounts `SparklesCustomize` instead of `ComingSoonCustomize`. Remove the sparkles branch from ComingSoon.

## Task breakdown (for writing-plans phase)

Ordered by dependency:

1. **Extend `SparklesIntent`** (palette, colorMode, spread, gravity, mode) + bump version 3→4 + migration v3→v4 + migration test.
2. **Update defaults.ts** with new fields.
3. **Add 2D translator types + resolver** (`Sparkles2DParams`, `resolveSparkles2D`).
4. **Add 3D translator types + resolver** (`Sparkles3DParams`, `resolveSparkles3D`).
5. **Implement `Sparkles2DRenderer`** + unit tests covering pool spawn cap, lifetime decay, mode behavior (stream vs burst).
6. **Wire renderer into `AnimationEngine`** — field, intent-diff cache, syncSparklesOverlay invoked from render loop.
7. **Wire 3D `SparkleEmitter` mounts in `EffectsLayer`** — four instances with per-tip color from palette/colorMode.
8. **Build preset group** (`sparkles-presets.ts`) — Fairy Dust / Pixie Sparks / Confetti / Custom.
9. **Build `SparklesCustomize.svelte`** — chip rows + sliders + conditional pickers.
10. **Wire `EffectsPanel` routing** — sparkles → SparklesCustomize, remove from ComingSoon.
11. **Final visual verification** — Lab → Sparkle → click each preset, confirm distinct visual + summary.

## Test plan

- **Unit:** `migrations.test.ts` v3→v4 case (color → colorMode collapse). `canvas2d-translator.test.ts` per-field passthrough. `Sparkles2DRenderer.test.ts` covering: pool size cap, life decrement, palette color cycling.
- **Integration:** none beyond renderer tests — Phase 1a/1b established the pattern works end-to-end.
- **Visual:** DevTools snapshot of Customize panel + each preset application via `evaluate_script` reading state.sparkles fields.

## Non-goals (deferred)

- Wire `params.gravity` into the 3D `SparkleEmitter` (it currently hardcodes `GRAVITY=30`). Add to deferred items.
- Add/remove buttons on the palette swatch row in Customize (fixed at 5 swatches for v1).
- Velocity-aware burst mode in 3D (3D emitter already always-spawns; 2D burst-mode is a 2D-only differentiation).
- Sparkles in `EffectsSettingsPanel` (legacy) — Phase 3 retires that panel.

## References

- Phase 1b tag: `phase-1b-zap-polish-complete`
- Phase 1a plan: `docs/superpowers/plans/2026-04-15-effects-phase-1a.md`
- Phase 1b plan: `docs/superpowers/plans/2026-04-16-effects-phase-1b-zap-polish.md`
- Overall unification spec: `docs/superpowers/specs/2026-04-15-effects-unification-design.md`
- Deferred items: `docs/superpowers/specs/effects-unification-deferred-items.md`
