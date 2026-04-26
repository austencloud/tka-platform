# Effects Unification

## Problem

Two effects systems coexist.

1. **Unified intent layer** (`src/lib/shared/effects/`) — backend-agnostic `EffectsConfig` with per-effect Intent types. Pure translator functions produce `canvas2d` / `webgl3d` parameter bundles. The shared `EffectsPanel.svelte` (chips + presets + customize + transport) is mounted by the Effects Lab, the sequence-viewer Export drawer, and the Animation Settings Modal. Knows 4 effects: **trails, fire, led, charcoal**.

2. **Legacy 3D-only** (`src/lib/shared/3d/effects/`) — `AllEffectConfigs` types, `effects-config-state.svelte.ts` for state, and a parallel UI component `EffectsSettingsPanel.svelte` that writes directly to that state. Mounted in `Animation3DSidePanel.svelte`. Knows 6 effects: trails, fire, **sparkles, electricity (zap), motion, bloom**.

Consequences today:

- Four effects (zap, sparkles, motion, bloom) are invisible in the Effects Lab. The user can't tune them in the same surface as trails/fire/led/charcoal.
- Zap has no 2D implementation. Only way to see lightning is with the 3D scene open.
- The Effects Lab runs 2D only — there's no way to preview an effect in 3D without leaving the Lab and opening a 3D viewer with completely different controls.
- `EffectsSettingsPanel` duplicates control-panel UX (chips, intensity sliders) in a second style that's drifted from the unified one.
- Two parallel state stores hold "which effects are enabled" — easy for them to disagree during export.

## Goal

1. Extend the unified intent layer to speak all 4 missing effects with both 2D and 3D translators + renderers.
2. Let the Effects Lab toggle between 2D and 3D preview on the same intent config.
3. Retire `EffectsSettingsPanel` by swapping the shared `EffectsPanel` into the 3D viewer's control surface.

After landing all three phases, `EffectsConfig` is the single source of truth, `EffectsPanel` is the single control surface, and every mount point (Lab, Export drawer, 3D viewer sidebar/popover, Animation Settings modal) consumes the same shape.

## Not in scope

- Re-designing any of the 4 legacy 3D renderers (`ElectricityArc`, `SparkleEmitter`, `MotionBlur`, `SpeedLines`, `BloomEffect`). They become consumers of translator output; their internals don't change.
- The in-flight LED ribbon refactor (`LedRibbonGeometry3D.ts`, `LedRibbonMaterial3D.ts`). Phase 1 does not touch `led/` renderers.
- The in-flight Gear Popover redesign. Phase 3 may land against the popover's future Effects tab instead of `Animation3DSidePanel`, whichever is current at the time.
- New effects beyond the four being migrated.
- Changing the `EffectsConfig` persistence format (version stays at 1 or bumps to 2 with a migration, not a rewrite).
- Export pipeline changes.

## Phase 1 — Extend the unified intent layer

### 1.1 Intent types + defaults

Add to `src/lib/shared/effects/domain/EffectsConfig.ts`:

```ts
export type EffectType =
  | "none" | "trails" | "fire" | "led" | "charcoal"
  | "zap" | "sparkles" | "motion" | "bloom";

export interface ZapIntent {
  intensity: number;          // 0-1 — overall arc brightness + branch count
  color: string;              // hex, e.g. "#88ccff"
  frequency: number;          // 1-30 strikes/sec
  mode: "arc" | "crackle";    // arc = tip-to-tip, crackle = radiate from tip
  branching: number;          // 0-1 — probability of sub-branches
}

export interface SparklesIntent {
  rate: number;               // 0-1 — particle spawn rate multiplier
  size: number;               // 0-1 — particle scale
  lifetime: number;           // 0.1-3.0 seconds
  color: string;              // hex, primary sparkle tint
  rainbow: boolean;           // hue-cycle override
}

export interface MotionIntent {
  blur: number;               // 0-1 — trailing blur strength
  speedLines: number;         // 0-1 — velocity-based streak strength
  threshold: number;          // 0-1 — min hand speed before effect kicks in
}

export interface BloomIntent {
  intensity: number;          // 0-1 — overall glow
  threshold: number;          // 0-1 — luminance cutoff
  radius: number;             // 0-1 — blur spread (2D) / kernel size (3D)
}
```

Extend `EffectsConfig`:

```ts
export interface EffectsConfig {
  version: number;
  tipEffectMap: TipEffectMap;
  trails: TrailsIntent;
  fire: FireIntent;
  led: LedIntent;
  charcoal: CharcoalIntent;
  zap: ZapIntent;
  sparkles: SparklesIntent;
  motion: MotionIntent;
  bloom: BloomIntent;
  activePresets: {
    trails: string | null;
    fire: string | null;
    led: string | null;
    charcoal: string | null;
    zap: string | null;
    sparkles: string | null;
    motion: string | null;
    bloom: string | null;
  };
  overrides?: EffectsOverrides;
}
```

Extend `EffectsOverrides` with `zap2D/zap3D/sparkles2D/sparkles3D/motion2D/motion3D/bloom2D/bloom3D` slots.

Bump `EFFECTS_CONFIG_VERSION` to 2 and add a migration in `src/lib/shared/effects/domain/defaults.ts` that injects the 4 new intent blocks with defaults when loading a v1 config from localStorage.

### 1.2 Translators

Extend `canvas2d-types.ts` with `Zap2DParams`, `Sparkles2DParams`, `Motion2DParams`, `Bloom2DParams`. Each extends its Intent with canvas-specific fields (e.g. Zap2D adds `segments: number`, `jitterAmount: number`, `glowBlur: number`).

Extend `canvas2d-translator.ts` with `resolveZap2D`, `resolveSparkles2D`, `resolveMotion2D`, `resolveBloom2D` — each pure functions matching the existing pattern.

Mirror these in `webgl3d-types.ts` + `webgl3d-translator.ts`. 3D variants map to existing renderer props:
- Zap3D → `ElectricityArc` props (`intensity`, `color`, `mode`, `segments`)
- Sparkles3D → `SparkleEmitter` props (rate, size, lifetime, color)
- Motion3D → split into `MotionBlur` + `SpeedLines` props
- Bloom3D → `BloomEffect` props

### 1.3 2D renderers

New renderer components in `src/lib/shared/animation-engine/renderers/effects/`:

- **`Zap2DRenderer.ts`** — port of the midpoint-displacement algorithm from `ElectricityArc.svelte`'s `generateLightningPath` to a 2D canvas draw function. Operates per-frame on tip positions supplied by the animation engine. Glow = `shadowBlur` passes with additive blend.
- **`Sparkles2DRenderer.ts`** — particle pool. Each sparkle = position + velocity + lifetime. Spawn at tip positions at `rate * dt`. Render as radial gradient circles with additive blend.
- **`Motion2DRenderer.ts`** — two parts: trailing-blur (persistent canvas with fade alpha each frame) + speed lines (short streaks drawn along velocity vectors when `|v| > threshold`).
- **`Bloom2DRenderer.ts`** — post-process the animation canvas: threshold-extract bright pixels to an offscreen canvas, blur, composite back with `screen` blend. Use `OffscreenCanvas` when available. Only runs when `bloom.enabled`.

Each renderer implements the same contract as existing effect renderers (`init`, `update(dt)`, `render(ctx)`, `dispose`).

### 1.4 Panel surface

- Restructure `EffectSelector.svelte` from a 5-chip single row (None + 4) to an **8-chip 4×2 grid**. Drop the "None" chip entirely.
  - New interaction: clicking the active chip **deselects it** (returns to no-effect state). Active chip gets a subtle `aria-pressed` style + tooltip hint ("Click again to disable") on first hover per session.
  - Grid contents (row 1 / row 2): Trails · Fire · LED · Charcoal / Zap · Sparkles · Motion · Bloom. Icons/colors for the new four match the legacy panel: bolt/star/wind/sun.
  - `handleEffectSelect` in `EffectsPanel.svelte` updated to toggle off when the selected effect equals the active effect.
- Add preset groups in `src/lib/shared/animation-engine/components/effects-panel/presets/`:
  - `zap-presets.ts` — Thunder, Tesla, Plasma, Custom
  - `sparkles-presets.ts` — Fairy Dust, Fireworks, Stars, Custom
  - `motion-presets.ts` — Gentle Trail, Speedster, Ghost, Custom
  - `bloom-presets.ts` — Subtle Glow, Heavy Dreamy, Neon Pop, Custom
- Add Customize components in `customize/`:
  - `ZapCustomize.svelte` — intensity, frequency, color, mode, branching
  - `SparklesCustomize.svelte` — rate, size, lifetime, color, rainbow
  - `MotionCustomize.svelte` — blur, speedLines, threshold
  - `BloomCustomize.svelte` — intensity, threshold, radius
- Wire them in `EffectsPanel.svelte`'s switch blocks (preset group resolution, customize mount).

### 1.5 Wire into 2D animator

The 2D animator (`AnimatorCanvas.svelte` → `Canvas2DAnimationRenderer`) must pick up the new renderers based on `tipEffectMap` + intent. Register the 4 new renderers alongside trails/fire/led/charcoal.

Bloom is a post-process, not per-tip — it needs a second pass after all other renderers finish drawing the frame. Add a `postProcessRenderers` slot to the animator render loop for this.

### 1.6 Exit criteria

- Effects Lab: all 8 chips render in a 4×2 grid. Clicking a chip activates it; clicking the active chip deactivates it. Each chip applies in 2D immediately.
- Persisted v1 configs load without error; new fields fill from defaults.
- Typecheck + unit tests for new translator functions pass.
- `EffectsSettingsPanel.svelte` still works unchanged (we haven't touched it).

## Phase 2 — Effects Lab 2D/3D mode toggle

### 2.1 Render mode state

Add to Effects Lab VM (`src/lib/features/effects-lab/state/` — verify exact location):

```ts
type RenderMode = "2d" | "3d";
let renderMode = $state<RenderMode>("2d");
```

Persist to localStorage so the Lab remembers last choice.

### 2.2 Canvas swap

In `EffectsLabPlaybackHost.svelte`:

```svelte
{#if renderMode === "2d"}
  <AnimatorCanvas ... />     <!-- existing -->
{:else}
  <EffectsLab3DPreview ... />  <!-- new -->
{/if}
```

`EffectsLab3DPreview.svelte` is a new, minimal Threlte `<Canvas>`:
- Single performer rig (reuse `PerformerRig.svelte`)
- `OrbitControls` (shared `OrbitControls.svelte` — project convention)
- `EffectOrchestrator3D` mounted with the unified `EffectsConfig` translated via `webgl3d-translator`
- Neutral lighting, no scene chrome

The 3D renderers for the 4 new effects already exist; Phase 1 wires them through translator → props. Here we just host them.

### 2.3 Mode toggle UI

Add a compact toggle (`2D | 3D`) in the Lab header or at top of the controls panel. Matches existing toggle patterns in the codebase (segmented control, not dropdown).

### 2.4 Shared config

Both renderers read from the same Effects Lab VM. Changing a chip, preset, or slider immediately affects whichever renderer is mounted. When the user flips modes, the effect state persists — they see the same visual intent, just rendered differently.

### 2.5 Exit criteria

- Lab opens in 2D by default (or whatever was saved).
- Flipping to 3D mounts the Threlte canvas, applies the same active effect to a preview performer, renders without errors.
- All 8 non-"none" effects render in both modes (visual fidelity will vary — that's the point of the A/B rig).
- No regression in 2D-only Lab behavior.

## Phase 3 — Retire `EffectsSettingsPanel`

### 3.1 Migrate state consumers

`src/lib/shared/3d/effects/state/effects-config-state.svelte.ts` currently holds the legacy `AllEffectConfigs`. Audit everything that reads/writes it. Most reads are already in legacy renderer components that can be rewired to read from the unified `animation-visibility-state.svelte.ts` + translator output.

Mechanical steps:
1. Grep `effects-config-state` for consumers.
2. For each consumer, replace the read with the unified `EffectsConfig` shape (via translator where 3D-specific params are needed).
3. Delete `effects-config-state.svelte.ts` once it has zero consumers.

### 3.2 Swap the mount point

In `Animation3DSidePanel.svelte` (or whatever host is current after the Gear Popover refactor settles — check git log before starting Phase 3):

```svelte
<!-- Before -->
<EffectsSettingsPanel />
<!-- After -->
<EffectsPanel
  {bpm} onBpmChange={...} {isPlaying}
  onPlaybackToggle={...}
  {/* 3D sidebar doesn't need step controls */}
/>
```

The `EffectsPanel` is already width-agnostic; it fits the sidebar.

### 3.3 Delete legacy UI components

Once the swap lands:
- `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte`
- Any chip-specific sub-components only used by it (check the imports)

Keep all renderer components under `src/lib/shared/3d/effects/` (energy/, particles/, motion/, post-processing/, etc.) — they're still consumed by `EffectOrchestrator3D` and the new `EffectsLab3DPreview`.

### 3.4 Exit criteria

- Opening a 3D viewer sequence: sidebar/popover shows the same 9-chip `EffectsPanel` as Effects Lab.
- All 8 non-"none" effects toggle correctly.
- No references to `EffectsSettingsPanel` remain.
- `effects-config-state.svelte.ts` deleted or reduced to a renderer-internal cache.
- One state store (`animation-visibility-state.svelte.ts`), one control surface (`EffectsPanel`), one intent shape (`EffectsConfig`).

## Coordination risks

- **Gear Popover refactor (in progress).** Phase 3 needs to know whether effects live in the sidebar or the popover's Effects tab at the time it lands. Re-check `docs/superpowers/specs/2026-04-15-sequence-viewer-redesign-design.md` and current git log before starting Phase 3. If the popover has an Effects tab slot, drop `EffectsPanel` there instead of `Animation3DSidePanel`.
- **LED ribbon refactor (in progress).** Phase 1 must not touch `src/lib/shared/3d/effects/led/`. LED renderer is being rewritten in parallel. Intent layer's LED entry stays unchanged.
- **Export drawer stability.** `ExportVideoDrawer.svelte` mounts `EffectsPanel` in `inline-settings-body`. The 4×2 chip grid must render in both the Lab's wide panel and the Export drawer's narrower sidebar — min chip width ~72px, grid wraps if needed.

## Verification plan

**Phase 1:** Unit tests for each new translator function (pure, input→output). Storybook-style story for each new renderer in Effects Lab (DevTools screenshot for each chip selected, proves rendering works). Persist + reload localStorage to prove migration.

**Phase 2:** DevTools snapshot of both modes rendering the same effect. Playback test — toggle mode mid-playback, verify no state desync.

**Phase 3:** Mount a 3D viewer, toggle each effect, compare rendering to pre-Phase-3 baseline (should be identical — same underlying renderers, different input path). Grep for surviving `effects-config-state` / `EffectsSettingsPanel` imports.

## Rough effort estimate

- Phase 1: ~60% of total work. Intent types + translators = mechanical. 2D renderers for 4 effects = the real content. Bloom 2D post-process is the hardest.
- Phase 2: ~25% of total. Threlte preview canvas + mode toggle.
- Phase 3: ~15% of total. Mostly grep-migrate-delete.

Total: multi-day, phased across separate implementation plans.
