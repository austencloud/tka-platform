---
status: archived
---
# 3D Effect Parameter Parity — Design

**Date:** 2026-04-11
**Status:** Draft — awaiting user review
**Author:** Claude (Opus 4.6) with Austen Cloud

---

## 1. Summary

The effect sliders in the 2D animation export panel (fire intensity, trail color, LED pattern, charcoal spread, etc.) have zero effect on the 3D viewer's rendered output. Changing "Fire Intensity" from 0.7 to 1.0 updates the 2D canvas but does nothing in 3D. LED colors in 3D are hardcoded constants at the top of `EffectOrchestrator3D.svelte`. Trail colors in 3D are hardcoded defaults in a component prop.

This spec unifies the parameter surface so every slider that affects 2D also drives 3D, without forcing both backends into a lowest-common-denominator straitjacket. The design uses a **semantic intent layer** that's shared across backends, plus **optional per-backend override layers** that let 2D and 3D grow independently where their physics genuinely diverge.

As a side benefit, effect parameters become part of the sequence artifact — a sequence saved with "Ember Trail" preset and 80% fire intensity carries that visual identity forever instead of losing it to localStorage.

## 2. Problem

### 2.1 Observed bug

Sliders in `src/lib/shared/animation-engine/components/effects-panel/` (FireCategory, TrailsCategory, CharcoalCategory, LedSection) drive the 2D animator but not the 3D viewer. The 3D viewer is what the user now wants to focus on. Every slider is currently a dead input for that viewer.

### 2.2 Root causes

**Two parallel state stores for "effects," and they don't know about each other.**

| Current location | What it holds |
|---|---|
| `animation-engine/state/animation-visibility-state.svelte.ts` | Fire, charcoal, LED params, `tipEffectMap`, plus grid/numbers/dark mode/speed/playback |
| `animation-engine/state/animation-settings-state.svelte.ts` | Trail appearance (lineWidth, maxOpacity, minOpacity, glowBlur, blueColor, redColor), tracking mode |
| `3d/effects/state/effects-config-state.svelte.ts` | Separate 3D-only config: TrailConfig, FireConfig, SparkleConfig, ElectricityConfig, BloomConfig, GlowConfig |

The 2D renderers read from stores 1 and 2. The 3D viewer's gear popover reads from store 3. None of the 3D renderers read from stores 1 or 2.

**Hardcoded values in the 3D renderers.** `EffectOrchestrator3D.svelte` has `LED_BLUE_COLOR = { r: 0.23, g: 0.51, b: 0.96 }` and `LED_RED_COLOR = { r: 0.94, g: 0.27, b: 0.27 }` as module-level constants. Trail colors default to `#3b82f6` / `#ef4444` as component prop defaults. The 3D fire renderer uses tier-config defaults.

**Effects don't save with sequences.** A sequence saved to the library, shared via QR, or exported doesn't carry its effect configuration. Effect params live in localStorage keys (`animation-visibility-settings`, `tka_active_effect_presets`, `tka_custom_fire_colors`, `tka_custom_trail_colors`, `tka-3d-effects-config`). Open the sequence on a new device → lose the look. Share with a student → they see default effects, not what you designed.

**Preset data is fragmented across four locations.** Built-in presets live in `animation-engine/components/effects-panel/presets/*.ts` as imperative `apply(vm)` functions. LED user presets live as `userPresets: LedColorPreset[]` on `AnimationVisibilityStateManager`. Fire and trail "custom" presets live in loose localStorage keys read from inside preset `apply()` functions. There is no single preset concept.

## 3. Goals and non-goals

### 3.1 Goals

- **The existing 2D effect sliders drive the 3D renderers.** Change fire intensity in the animation panel and the 3D fire responds. Change trail color and the 3D trail responds. This is the user-facing win.
- **A single canonical schema** for effect parameters, owned by neither 2D nor 3D, that both backends translate from.
- **Semantic intent, not backend internals.** The shared layer describes what the user meant ("intense," "blue-tinted," "fast-flickering"), not how a particular backend implements it.
- **Per-backend freedom.** Either backend can add parameters that have no equivalent in the other (volumetric density for 3D fire, canvas shadow blur for 2D trails) without polluting the shared layer.
- **Effect config saves with sequences.** A sequence's visual identity travels with its data. Opening a 2024 sequence restores its effects. Sharing a sequence shares its look.
- **Unified preset library.** Built-in and user-created presets live under one `EffectsPreset` type, syncable per-user via Firestore.
- **Hardcoded LED and trail constants deleted.** The 3D renderers read user-configurable colors, not module-level `const` blocks.

### 3.2 Non-goals

- **Not forcing identical rendering between 2D and 3D.** A 2D trail and a 3D trail with the same intent will look similar-but-not-identical, and that's fine. Trying to make them pixel-match would cap both backends at the weaker one's capabilities.
- **Not replacing the 3D post-processing stack.** Bloom, motion blur, speed lines, and depth-of-field stay 3D-only and out of the shared schema (see §8).
- **Not rewriting renderer implementations.** The existing `Trail3D`, `LedRenderer3D`, `FireRenderer3D`, `CharcoalRenderer3D`, `PovStripRenderer3D`, and their 2D counterparts keep their current shapes. Only the parameter-feeding wiring changes.
- **Not adding new effect types in this pass.** Sparkles, electricity, and glow (which currently exist as dead config in the 3D effects state) are cut; they're not being ported or redesigned.
- **Not touching visibility or playback state.** Grid mode, dark mode, step numbers, speed, and playback mode stay in `AnimationVisibilityStateManager` where the existing 81 call sites already read them from.

## 4. Architecture overview

Three layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                    EffectsConfig (canonical)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Intent layer: TrailsIntent, FireIntent, LedIntent,       │   │
│  │               CharcoalIntent, tipEffectMap, activePresets│   │
│  │               (what the user meant, backend-agnostic)    │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Optional overrides:                                       │   │
│  │   trails2D?, trails3D?, fire2D?, fire3D?,                │   │
│  │   led2D?, led3D?, charcoal2D?, charcoal3D?               │   │
│  │   (backend-specific extras; only populated on demand)    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
   ┌──────────────────────┐         ┌──────────────────────┐
   │ canvas2d-translator  │         │ webgl3d-translator   │
   │ resolveTrails2D()    │         │ resolveTrails3D()    │
   │ resolveFire2D()      │         │ resolveFire3D()      │
   │ resolveLed2D()       │         │ resolveLed3D()       │
   │ resolveCharcoal2D()  │         │ resolveCharcoal3D()  │
   └──────────┬───────────┘         └──────────┬───────────┘
              │                                │
              ▼                                ▼
   ┌──────────────────────┐         ┌──────────────────────┐
   │ Existing 2D canvas   │         │ EffectOrchestrator3D │
   │ renderers (unchanged │         │ + its child renderers│
   │ internal shape)      │         │ (unchanged shape)    │
   └──────────────────────┘         └──────────────────────┘
```

**Key principle:** the intent layer is the thing users drag sliders in. Translators are pure functions that convert intent (plus any override) into a renderer's native parameter shape. Renderers themselves stay exactly as they are today.

Future backends (LED hardware, video export, print) become additional translators consuming the same schema. No central code needs to change to add one.

## 5. The canonical schema

**Location:** `src/lib/shared/effects/domain/EffectsConfig.ts` (new module, owned by neither `animation-engine` nor `3d`).

```ts
export const EFFECTS_CONFIG_VERSION = 1;

export type EffectType = "none" | "trails" | "fire" | "led" | "charcoal";

export interface EffectsConfig {
  version: number;

  /** Sole authority for which effect is active per tip. */
  tipEffectMap: TipEffectMap;

  // Intent layer — shared semantic core
  trails: TrailsIntent;
  fire: FireIntent;
  led: LedIntent;
  charcoal: CharcoalIntent;

  /** Reference to currently-applied preset per effect. Null = custom. */
  activePresets: {
    trails: string | null;
    fire: string | null;
    led: string | null;
    charcoal: string | null;
  };

  /**
   * Optional backend-specific overrides. Only present when the user
   * has opened an Advanced panel and explicitly edited a backend-only
   * parameter. Travels with the sequence.
   */
  overrides?: EffectsOverrides;
}

export interface EffectsOverrides {
  trails2D?: Partial<Omit<Trails2DParams, keyof TrailsIntent>>;
  trails3D?: Partial<Omit<Trails3DParams, keyof TrailsIntent>>;
  fire2D?: Partial<Omit<Fire2DParams, keyof FireIntent>>;
  fire3D?: Partial<Omit<Fire3DParams, keyof FireIntent>>;
  led2D?: Partial<Omit<Led2DParams, keyof LedIntent>>;
  led3D?: Partial<Omit<Led3DParams, keyof LedIntent>>;
  charcoal2D?: Partial<Omit<Charcoal2DParams, keyof CharcoalIntent>>;
  charcoal3D?: Partial<Omit<Charcoal3DParams, keyof CharcoalIntent>>;
}
```

### 5.1 Intent layer shapes

```ts
export interface TrailsIntent {
  trackingMode: "left_end" | "right_end" | "both_ends";
  thickness: number;          // 1-12 abstract units
  brightness: number;         // 0.3-1.0
  blueColor: string;          // hex
  redColor: string;           // hex
  rainbow: boolean;           // overrides blueColor/redColor when true
}

export interface FireIntent {
  intensity: number;          // 0.45-1.0
  colorBlend: number;         // 0-1 (natural → prop-colored)
  turbulence: number;         // 0-1
  colorCurve: FireColorCurve | null;
  propColors: [PropFlameColor, PropFlameColor] | null;
  customColors: { left: string; right: string } | null;
}

export interface LedIntent {
  brightness: number;         // 1-5 discrete
  patternId: string;          // pattern registry id
  patternSpeed: number;       // 0.1-5.0
  primaryColor: string;       // hex
  secondaryColor: string;     // hex
  colorMode: "unified" | "per-hand" | "prop-matched";
}

export interface CharcoalIntent {
  intensity: number;          // 0-1
  spread: number;             // 0-1
  glow: number;               // 0-1
}
```

### 5.2 Design decisions, justified

- **`tipEffectMap` is the sole authority** for which effect is active. No top-level `enabled` booleans. The existing `"trails enabled"` + `tipEffectMap["*"].effect === "fire"` split-brain gets deleted.
- **Semantic names, not implementation names.** `thickness` not `lineWidth` (2D-specific). `brightness` not `maxOpacity` (2D-specific) or `emissiveIntensity` (3D-specific).
- **No derived values stored.** The existing `CharcoalSparkParams` RGB blob computed by `semanticToCharcoalParams()` is NOT stored here. Renderers derive from semantic intensity/spread/glow on demand. If the RGB formula changes, the schema doesn't.
- **`glowBlur` is NOT in `TrailsIntent`.** It's a 2D canvas concept with no clean 3D analog. It lives in `Trails2DParams` as a backend-specific extra. 3D trails get their "glow" from emissive material + bloom, which is controlled separately.
- **`minOpacity` is NOT in the schema.** The current 2D code derives it as `brightness * 0.3`. That's a renderer-side formula, not a user-facing knob. The canvas2d translator computes it.
- **LED user presets are NOT stored in `LedIntent`.** They're preset library entries, not per-sequence config (§7).
- **Fire custom colors ARE stored in `FireIntent`.** Today they live in loose localStorage (`tka_custom_fire_colors`). Moving them into the schema means they travel with the sequence, which is the right behavior: the "Custom" preset is meaningless if its colors don't save.

## 6. Per-backend params and the override layer

Each backend has its own full params interface that extends the intent. These live alongside the translators.

### 6.1 Example: Fire

```ts
// src/lib/shared/effects/translators/canvas2d-types.ts
export interface Fire2DParams extends FireIntent {
  flickerRate?: number;        // Hz
  canvasBlendMode?: "screen" | "add" | "normal";
  shadowBlur?: number;         // pixels
}

// src/lib/shared/effects/translators/webgl3d-types.ts
export interface Fire3DParams extends FireIntent {
  volumetricDensity?: number;  // 0-1, controls alpha accumulation
  emissionRate?: number;       // particles/second
  buoyancy?: number;           // upward force
  dragCoefficient?: number;    // 0-1
  vortexStrength?: number;     // 0-5
  shadowCasting?: boolean;
  bloomContribution?: number;  // 0-1, weight into post-process bloom
}
```

### 6.2 When overrides exist

The default case is **no overrides** — `config.overrides` is `undefined`, and translators fall back to backend-native defaults derived from the intent. Overrides only appear when the user has explicitly opened an Advanced panel and edited a backend-specific field.

Once populated, overrides persist and travel with the sequence. A sequence saved with `overrides.fire3D.volumetricDensity = 0.9` reloads with that value forever; 2D never sees the field.

### 6.3 Per-effect override expectations

- **Trails:** 2D adds `glowBlur`, `blendMode`, `shadowBlur`. 3D adds `tubeRadius`, `maxPoints`, `emissive`, `bloomWeight`, `taperCurve`.
- **Fire:** 2D adds `flickerRate`, `canvasBlendMode`, `shadowBlur`. 3D adds the volumetric params above plus future GPU-compute knobs.
- **LED:** 2D adds nothing meaningful (LED is primarily a 3D concept). 3D adds `segmentCount`, `povPersistenceDuration`, `stripLength`, future LED-hardware bridging params.
- **Charcoal:** 2D adds `particleCount`, `canvasBlendMode`. 3D adds `particleLifetime`, `gravity`, `sparkSizeJitter`.

## 7. The translator pattern

**Location:** `src/lib/shared/effects/translators/`

```
effects/
  domain/
    EffectsConfig.ts
    presets/
      built-in-trail-presets.ts
      built-in-fire-presets.ts
      built-in-led-presets.ts
      built-in-charcoal-presets.ts
  translators/
    canvas2d-translator.ts
    canvas2d-types.ts
    webgl3d-translator.ts
    webgl3d-types.ts
  state/
    effects-config-state.svelte.ts
    effects-config-context.ts
```

Each translator exports one pure function per effect type.

```ts
// src/lib/shared/effects/translators/webgl3d-translator.ts

export function resolveFire3D(
  intent: FireIntent,
  override?: Partial<Fire3DParams>,
): Fire3DParams {
  const defaults: Partial<Fire3DParams> = {
    volumetricDensity: 0.3 + intent.intensity * 0.7,
    emissionRate: 200 + intent.intensity * 800,
    buoyancy: 1.2 + intent.intensity * 0.8,
    dragCoefficient: 0.15,
    vortexStrength: intent.turbulence * 3.0,
    shadowCasting: false,
    bloomContribution: intent.intensity * 0.6,
  };
  return { ...intent, ...defaults, ...override };
}

export function resolveTrails3D(
  intent: TrailsIntent,
  override?: Partial<Trails3DParams>,
): Trails3DParams {
  const defaults: Partial<Trails3DParams> = {
    tubeRadius: intent.thickness * 0.008,        // 0.008-0.096 world units
    maxPoints: 256,
    emissive: intent.brightness * 2.0,           // HDR intensity > 1.0
    bloomWeight: intent.brightness * 0.4,
    taperCurve: "exponential",
  };
  return { ...intent, ...defaults, ...override };
}

// ... resolveLed3D, resolveCharcoal3D
```

The canvas2d translator follows the same pattern.

### 7.1 Why translators instead of renderer-reads-schema

- **Renderer internals don't leak into the canonical schema.** `Trail3D.svelte`'s existing prop shape is unchanged; it still takes `width`, `opacity`, `color`, `rainbow`, etc.
- **Pure and testable.** `expect(resolveTrails3D({ thickness: 6, ... }).tubeRadius).toBe(0.048)`. No rendering, no DOM, no WebGL context.
- **Localized change surface.** Adding a new backend is one new file; tweaking the 3D tube-radius formula is one line. The intent layer and the renderers both stay untouched.
- **Presets are backend-agnostic.** A preset patches the intent; each backend resolves it independently. "Neon Trails" works in 2D, 3D, and future LED export.

### 7.2 `EffectOrchestrator3D.svelte` after

It stops taking a `trailConfig` prop. It reads `EffectsConfig` from Svelte context, calls `resolveTrails3D(config.trails, config.overrides?.trails3D)`, and passes the result to `Trail3D`. Same for fire, LED, charcoal. The hardcoded `LED_BLUE_COLOR` and `LED_RED_COLOR` constants are deleted — LED colors come from `resolveLed3D(config.led, ...)`.

## 8. State ownership and the slice-up

### 8.1 Before/after

| State store | Effect fields today | Effect fields after |
|---|---|---|
| `animation-visibility-state.svelte.ts` (`vm`) | fire params, charcoal params, LED params, `tipEffectMap`, `tipEffortMap` | NONE — moved to new state |
| `animation-settings-state.svelte.ts` (`animationSettings`) | `trail.{lineWidth, maxOpacity, minOpacity, glowBlur, blueColor, redColor}`, `trail.trackingMode` | NONE — moved to new state |
| `3d/effects/state/effects-config-state.svelte.ts` | TrailConfig, FireConfig, SparkleConfig, ElectricityConfig, BloomConfig, GlowConfig, MotionEffectsConfig | DELETED (bloom + motion move to `PostProcessingConfig`; sparkles/electricity/glow cut) |
| **NEW** `effects/state/effects-config-state.svelte.ts` | — | Canonical `EffectsConfig`. Sole source of truth for effect params. |
| **NEW** `3d/post-processing/state/post-processing-config.svelte.ts` | — | Bloom, motion blur, speed lines. 3D-only, device preference, not saved with sequence. |

`AnimationVisibilityStateManager` keeps: grid mode, step numbers, dark mode, speed, playback mode, tkaGlyph, reversal indicators, blue/red motion visibility, effort preset, pathShape. That's everything the 81 reader files currently consume that is NOT effect-related, so they keep working without any change.

`animationSettings` keeps: whatever non-trail settings it has (audited during implementation).

### 8.2 The new state module

```ts
// src/lib/shared/effects/state/effects-config-state.svelte.ts

export function createEffectsConfigState(initial: EffectsConfig = DEFAULT_EFFECTS_CONFIG) {
  let config = $state<EffectsConfig>(initial);

  return {
    get config() { return config; },
    get tipEffectMap() { return config.tipEffectMap; },
    get trails() { return config.trails; },
    get fire() { return config.fire; },
    get led() { return config.led; },
    get charcoal() { return config.charcoal; },
    get overrides() { return config.overrides; },
    get activePresets() { return config.activePresets; },

    updateTrails(patch: Partial<TrailsIntent>) {
      config.trails = { ...config.trails, ...patch };
      config.activePresets.trails = null; // user dragged a slider → leave preset
    },
    updateFire(patch: Partial<FireIntent>) {
      config.fire = { ...config.fire, ...patch };
      config.activePresets.fire = null;
    },
    // ... updateLed, updateCharcoal

    updateOverride<K extends keyof EffectsOverrides>(
      key: K,
      patch: NonNullable<EffectsOverrides[K]>,
    ) {
      config.overrides = config.overrides ?? {};
      config.overrides[key] = { ...(config.overrides[key] ?? {}), ...patch };
    },

    setTipEffectMap(map: TipEffectMap) { config.tipEffectMap = map; },

    applyPreset(preset: EffectsPreset) {
      config = deepMerge(config, preset.patch);
      config.activePresets[preset.effectType] = preset.id;
    },

    replace(next: EffectsConfig) { config = next; },
  };
}

export type EffectsConfigState = ReturnType<typeof createEffectsConfigState>;
```

Distributed via Svelte context — set by the component that owns the sequence currently being played (sequence-viewer, export-panel, compose canvas, promo generator). Descendants read with `getEffectsConfigContext()`.

### 8.3 Phase A: compatibility shim

During Phase A, the existing 81 reader files haven't been updated yet. To avoid a big-bang rewrite, the shim works both directions:

1. **Writes shimmed:** Panel writes to `vm.setFireIntensity(...)` are intercepted by a small adapter that also writes the canonical state. Same for `animationSettings.setTrailAppearance(...)`.
2. **Reads shimmed:** The canonical `createEffectsConfigState` factory, on construction, seeds itself from `vm` and `animationSettings` so it starts in sync. A `$effect` keeps it in sync when the old stores mutate from non-panel sources.
3. **3D reads new state directly** via the context — no shim on the 3D side.

The shim lives in `effects/compat/` and is deleted in Phase B.

## 9. The preset model

Replaces the current imperative `apply(vm)` pattern with pure-data patches.

```ts
// src/lib/shared/effects/domain/EffectsPreset.ts

export interface EffectsPreset {
  id: string;
  name: string;
  description: string;
  effectType: EffectType;         // "trails" | "fire" | "led" | "charcoal"
  /** Pure data patch applied over current config. No setters, no side effects. */
  patch: DeepPartial<EffectsConfig>;
  builtIn: boolean;
  createdBy?: string;             // uid
  createdAt?: number;             // epoch ms
  previewColors?: [string, string]; // for swatch thumbnail
}
```

### 9.1 Built-in presets

All existing built-ins (`fire-classic`, `trail-neon`, `led-green-glow`, `charcoal-hot-coal`, etc.) get pure-data equivalents in `src/lib/shared/effects/domain/presets/` during Phase A. These are what the 3D side reads. The existing imperative `apply(vm)` preset files under `animation-engine/components/effects-panel/presets/` are left alone in Phase A — they still drive the 2D panels, and the shim mirrors their effects into the canonical state via intercepted `vm.setXxx()` calls.

In Phase B, the 2D panels are rewritten to use the new pure-data presets directly via `state.applyPreset(preset)`. At that point the old imperative preset files are deleted. Applying a preset everywhere becomes `config = deepMerge(config, preset.patch)`.

### 9.2 User presets

The LED "+" swatch flow, the fire "Custom" color pair, and the trail "Custom" color pair are all three instances of the same concept: a user-saved preset. They collapse into `EffectsPreset` instances stored in the user's preset library (§10).

### 9.3 Naming and descriptions

Presets have `name` and `description` at the top of this section. Users save presets with a name ("Festival fire") and an optional description ("80% intensity, prop-colored, custom curve for the Dubstep set"). This is what the user agreed to in brainstorming — the description surfaces in the preset picker and the sequence metadata panel.

## 10. Persistence strategy

Three layers:

### 10.1 Per-sequence — travels with the artifact

```ts
interface SequenceData {
  // existing fields...
  effectsConfig?: EffectsConfig;   // NEW, optional for backwards compat
}
```

On save → snapshot current `EffectsConfig` into the sequence.
On load → if `effectsConfig` is present, use it. Otherwise, fall through to per-user defaults.

This is what makes sequences carry their visual identity across devices, shares, and years.

### 10.2 Per-user — Firestore

```
users/{uid}/
  effectsDefaults (EffectsConfig)   — applied to sequences without their own config
  effectsPresets/
    {presetId} (EffectsPreset)      — user's preset library
```

On app start: read both, cache in localStorage (`tka_effects_cache`) for offline. On slider drag: update local state → debounced Firestore write. On another device opening: presets already there.

### 10.3 Device-level — localStorage as cache only

The old localStorage keys (`animation-visibility-settings`, `tka_active_effect_presets`, `tka_custom_fire_colors`, `tka_custom_trail_colors`, `tka-3d-effects-config`) are read once during migration (§11), then decommissioned. After migration, localStorage holds only `tka_effects_cache` as a Firestore mirror.

## 11. Post-processing as a separate concern

Bloom, motion blur, and speed lines are cut from the shared schema and moved to their own 3D-only config:

```ts
// src/lib/shared/3d/post-processing/state/post-processing-config.svelte.ts

export interface PostProcessingConfig {
  bloom: { enabled: boolean; intensity: number; threshold: number };
  motionBlur: { enabled: boolean; intensity: number; threshold: number };
  speedLines: { enabled: boolean; intensity: number; threshold: number };
}
```

- **Backend-specific by nature.** 2D canvas cannot do bloom, motion blur, or speed lines the same way. Pretending they're shared semantic knobs is dishonest.
- **Device preference, not sequence identity.** Whether you want bloom on your phone viewer is not the same as "this sequence has bloom baked in." Post-processing is cinema-style presentation, not creative intent.
- **3D gear popover keeps a small panel** for these — the `EffectsSettingsPanel.svelte` gets rewritten to expose only post-processing, not the effect chips.
- **Not saved with sequence.** Lives in localStorage per-device. If a later need emerges to save it with sequences, easy to add; much harder to remove once baked in.

**Cut with no migration:** sparkles, electricity, glow. They exist in the current System B as placeholder configs with no UI, no presets, and no users. Deleted entirely.

## 12. Migration story

This is the part that will break things if we get it wrong.

### 12.1 First app load after Phase C deploy

Read every existing effect-related localStorage key:
- `animation-visibility-settings` → fire params, charcoal params, LED params, `tipEffectMap`, `tipEffortMap`
- `tka_active_effect_presets` → `activePresets.*`
- `tka_custom_fire_colors` → `fire.customColors`
- `tka_custom_trail_colors` → `trails.blueColor/redColor` under a "user-custom" preset
- `tka-3d-effects-config` → mostly ignored; bloom/motion settings copied to new `PostProcessingConfig`
- `animation-settings-state` trail fields → `trails.thickness/brightness/etc`

Build a canonical `EffectsConfig` from the pieces. Write to `tka_effects_cache`. Push to Firestore as `users/{uid}/effectsDefaults`. Leave the old keys in place for one release as read-only fallback, then delete.

### 12.2 Loading old sequences

Sequences without `effectsConfig` field → apply user's `effectsDefaults`. User sees their old sequence with whatever effects they had globally configured. A subtle "Bake in current look" button in the sequence menu writes the current config into the sequence and re-saves, so the user can lock in a look on a sequence-by-sequence basis.

### 12.3 Loading new sequences

Sequences with `effectsConfig` → use it directly. Visual identity preserved exactly as authored.

### 12.4 Version migration

`EFFECTS_CONFIG_VERSION` starts at 1. If the schema evolves (e.g., adding a new intent field), a migration function runs on load:

```ts
function migrateEffectsConfig(raw: unknown): EffectsConfig {
  if (!isRecord(raw)) return DEFAULT_EFFECTS_CONFIG;
  let config = raw as Partial<EffectsConfig>;
  const v = config.version ?? 0;
  if (v < 1) config = { ...DEFAULT_EFFECTS_CONFIG, ...config, version: 1 };
  // future migrations fall through here
  return config as EffectsConfig;
}
```

## 13. Rollout phases

### Phase A — Canonical schema + translators + 3D parity (ship-first milestone)

- New `effects/domain/` module with schema.
- New `effects/translators/` module for canvas2d + webgl3d.
- New `effects/state/` module.
- New `effects/domain/presets/` with built-ins converted to pure data.
- `EffectOrchestrator3D` reads from canonical state via context + translator.
- Compatibility shim keeps existing 2D panels writing to both old stores and new state.
- Hardcoded `LED_BLUE_COLOR`, `LED_RED_COLOR`, default trail colors deleted from 3D.
- **User-visible result: the 2D sliders finally drive the 3D viewer.** This is the ship-first milestone.

No UI changes. No migration yet. Phase A is reversible by reverting the PR.

### Phase B — Slice and delete old state stores

- Effect fields removed from `AnimationVisibilityStateManager`.
- Trail appearance removed from `animationSettings`.
- Old `3d/effects/state/effects-config-state.svelte.ts` deleted.
- Sparkles, electricity, glow deleted.
- `PostProcessingConfig` created; bloom + motion blur migrated to it.
- `3d/components/controls/EffectsSettingsPanel.svelte` rewritten: only post-processing, no effect chips.
- Compatibility shim deleted.
- Existing `FireCategory`, `TrailsCategory`, `CharcoalCategory`, `LedSection` rewritten to read from canonical state via context.

### Phase C — Save with sequence

- `effectsConfig` added to `SequenceData`.
- Save path writes it.
- Load path reads it or falls back to per-user defaults.
- Migration function handles old sequences.
- "Bake in current look" UI action in sequence menu.

### Phase D — Firestore sync + Advanced panels

- User preset library moves to Firestore.
- Per-user `effectsDefaults` syncs across devices.
- "Advanced" panel UIs for `overrides.*2D` and `overrides.*3D`. Opt-in, collapsed by default.
- Old localStorage keys deleted.

Each phase gets its own implementation plan written by writing-plans after this spec is signed off.

## 14. Testing strategy

- **Pure translator tests.** `expect(resolveFire3D({ intensity: 0.7, ... }).volumetricDensity).toBe(0.79)` and similar. These are unit tests with no rendering — they catch formula regressions without needing a GPU.
- **Schema round-trip tests.** Serialize `EffectsConfig` → parse → assert deep equality. Catches JSON-breaking field types (functions, class instances, `undefined` vs missing).
- **Preset application tests.** Apply each built-in preset to default config, assert key fields changed as expected. Catches preset patches that silently drop fields.
- **Migration tests.** Feed fixture localStorage blobs through the migration function, assert the resulting `EffectsConfig`. Catches migration regressions.
- **Silent-bug risks per CLAUDE.md testing philosophy:** translator math, preset patches, and migration are silent if wrong — wrong output looks plausible. These all earn tests. Rendering and wiring are NOT tested here; your eyes will catch those during Phase A verification.
- **Phase A verification specifically** requires visual confirmation of 3D slider response. "I cannot verify this without you checking" per verification-protocol — after Phase A ships, Austen drags a slider and confirms the 3D viewer responds, or it's not shipped.

## 15. Risks

- **Migration drops user data.** If the one-shot localStorage migration has a bug, users lose their existing presets and colors. Mitigation: one-release fallback keeping old keys read-only; migration tests with real localStorage fixtures; "restore from localStorage" action available for one release.
- **Visual regression in 2D.** Phase B rewrites existing panels to read from canonical state. If the shim or the field mapping is subtly wrong, 2D looks different after Phase B. Mitigation: `resolveTrails2D`, `resolveFire2D` etc. are pure functions tested to produce identical output to the current 2D state reads, for the set of built-in presets.
- **3D visual diverges from 2D in confusing ways.** Users drag the same slider and expect pixel-matching output. Reality: backends diverge where physics diverge. Mitigation: UI copy in the panel makes clear this is intent, not exact replication. Advanced panels (Phase D) give power users full control when that matters.
- **Two layers confuse contributors.** Intent + override is more sophisticated than "one struct." New developers may try to add 3D-only knobs to the intent layer because they don't know the split exists. Mitigation: doc-comments on every intent interface and a brief CONTRIBUTING note in the `effects/` directory.
- **Context propagation gaps.** Effect context must be set in every component tree that renders effects — sequence-viewer, export-panel, compose canvas, promo generator, landing page animations, effects-lab, endless-spinner, browse sequence detail. Mitigation: Phase A audits these and sets context in each; a thrown error from `getEffectsConfigContext()` makes unset contexts loud not silent.

## 16. Open questions

Flagged for the user to decide before writing-plans:

1. **Phase A scope question — do we also touch compose/promo/landing/browse animation sites in Phase A?** These currently render effects via the 2D system. The shim makes Phase A work without touching them, but if we want the 3D viewer to work in those contexts too, they need context set. **Recommendation:** Phase A touches only sequence-viewer and export-panel 3D surfaces. Other sites inherit the shim and get migrated in Phase B when the old stores are deleted. Lets Phase A ship fast with clear scope.
2. **Is `PostProcessingConfig` per-device or per-sequence?** Current spec says per-device, not saved with sequence. If a sequence's visual identity should include "this one needs heavy bloom," `PostProcessingConfig` moves into `EffectsConfig` or becomes a sibling field in `SequenceData`. **Recommendation:** per-device for the first pass. Easy to promote later if users ask; hard to remove once baked in.
3. **Does the "Advanced" panel (Phase D) live in the main animation panel or the 3D gear popover?** The 3D gear popover is the natural home for 3D-advanced overrides, but 2D-advanced overrides don't have an obvious home. **Recommendation:** Per-effect "Advanced" disclosure at the bottom of each customize panel (FireCategory → Advanced → 2D Advanced / 3D Advanced tabs). Keeps everything in one place and avoids a hidden third UI.

---

## Appendix A — File-level diff summary

**New files (Phase A):**
- `src/lib/shared/effects/domain/EffectsConfig.ts`
- `src/lib/shared/effects/domain/EffectsPreset.ts`
- `src/lib/shared/effects/domain/defaults.ts`
- `src/lib/shared/effects/domain/presets/built-in-trail-presets.ts`
- `src/lib/shared/effects/domain/presets/built-in-fire-presets.ts`
- `src/lib/shared/effects/domain/presets/built-in-led-presets.ts`
- `src/lib/shared/effects/domain/presets/built-in-charcoal-presets.ts`
- `src/lib/shared/effects/translators/canvas2d-translator.ts`
- `src/lib/shared/effects/translators/canvas2d-types.ts`
- `src/lib/shared/effects/translators/webgl3d-translator.ts`
- `src/lib/shared/effects/translators/webgl3d-types.ts`
- `src/lib/shared/effects/state/effects-config-state.svelte.ts`
- `src/lib/shared/effects/state/effects-config-context.ts`
- `src/lib/shared/effects/compat/vm-shim.ts`
- `src/lib/shared/effects/compat/animation-settings-shim.ts`

**Modified files (Phase A):**
- `src/lib/shared/3d/effects/EffectOrchestrator3D.svelte` — reads canonical config via context, uses webgl3d-translator, hardcoded color constants deleted
- `src/lib/shared/3d/components/PerformerRig.svelte` — sets canonical config context if not already set by parent
- `src/lib/shared/sequence-viewer/components/SequenceViewer.svelte` — sets context
- `src/lib/shared/export-panel/components/single-media/AnimationExportView.svelte` — sets context
- `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts` — write-shim on effect setters mirrors canonical state (reverted in Phase B when readers migrate)
- `src/lib/shared/animation-engine/state/animation-settings-state.svelte.ts` — write-shim on `setTrailAppearance` mirrors canonical state (reverted in Phase B)

Note: existing preset files under `animation-engine/components/effects-panel/presets/*.ts` are NOT modified in Phase A. They keep their imperative `apply(vm)` shape; the shim catches their effects at the state-store level.

**New files (Phase B):**
- `src/lib/shared/3d/post-processing/state/post-processing-config.svelte.ts`

**Deleted files (Phase B):**
- `src/lib/shared/3d/effects/state/effects-config-state.svelte.ts` (the old one)
- `src/lib/shared/effects/compat/vm-shim.ts`
- `src/lib/shared/effects/compat/animation-settings-shim.ts`

**Modified files (Phase B, major):**
- `src/lib/shared/animation-engine/state/animation-visibility-state.svelte.ts` — effect fields removed
- `src/lib/shared/animation-engine/state/animation-settings-state.svelte.ts` — trail fields removed
- `src/lib/shared/3d/components/controls/EffectsSettingsPanel.svelte` — rewrites for post-processing only
- All four `animation-settings-modal/categories/*Category.svelte` — read from canonical state
- `src/lib/shared/animation-engine/components/animation-settings-modal/LedSection.svelte` — read from canonical state

**Modified files (Phase C):**
- `SequenceData` type definition and all save/load paths
- Sequence migration runner

## Appendix B — Decision log

- **Intent + override architecture chosen over flat shared schema** after user pushback that flat schema would straitjacket future 3D-specific features. Section 4, Section 6.
- **`glowBlur` moved to `Trails2DParams` override** rather than shared intent because it has no clean 3D analog; 3D gets glow via emissive + bloom.
- **Fire custom colors moved into schema** (`fire.customColors`) from loose localStorage so they save with sequences.
- **Sparkles, electricity, glow cut** from the parity scope — they exist only as placeholder configs in the 3D state, have no UI, and would dilute the migration effort.
- **Bloom, motion blur, speed lines kept as 3D-only `PostProcessingConfig`** — they are backend-specific by nature and represent device/presentation preference, not creative intent.
- **Preset `apply(vm)` functions become pure data patches.** Necessary for serialization, composition, and Firestore sync.
- **Compatibility shim in Phase A** instead of migrating all reader panels in Phase A. Chosen for scope — Phase A exists to make sliders work in 3D, not to rewrite every panel.
