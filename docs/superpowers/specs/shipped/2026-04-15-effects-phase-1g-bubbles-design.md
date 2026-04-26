# Effects Phase 1g: Bubbles Effect Design

**Status:** Spec (2026-04-15). Queued as Phase **1g** — runs after 1f Water. Do not start before 1f lands; the palette + particle-pool patterns used here depend on 1f having proven them.

**Goal:** Add bubbles as the 10th unified effect (chip row grows to 11 including `none`). Bubbles ship iteratively as four sub-phases, each independently valuable and bail-able. Visually and behaviorally distinct from water: buoyant, hollow, delicate — not droplets that fall.

## Context

Requested 2026-04-15 alongside petals/smoke/ink/frost. Bubbles earned first spec after water because they're the most aesthetically distinct from anything shipped: buoyant rising motion (opposite of water's fall), hollow sphere silhouette (nothing else is hollow), pop-on-death signature moment (no other effect has a specific end-of-life burst). Soap bubbles and champagne fizz share structure but land in completely different emotional registers — palette handles that split.

## Intent shape

```ts
// src/lib/shared/effects/domain/EffectsConfig.ts

export interface BubblesIntent {
  /** 0-1. Continuous emission at rest. */
  ambientEmission: number;
  /** 0-1. Velocity-reactive multiplier. Spin rate drives this via tip speed. */
  motionEmission: number;
  /** 0-1. Overall size + brightness. */
  intensity: number;
  /** Named palette. "custom" uses customColor instead. */
  palette: "soap" | "champagne" | "oil" | "acid" | "spirit" | "custom";
  /** Hex string. Used only when palette === "custom". */
  customColor: string;
  /** 0-1. Size variance per bubble. 0 = uniform, 1 = wide mix. */
  sizeJitter: number;
  /** 0-1. Upward rise speed scalar. */
  buoyancy: number;
  /** Explicit tracking — adopts the clean trails/water pattern. */
  trackingMode: "left_end" | "right_end" | "both_ends";
}
```

Extend `EffectType`, `EffectsConfig`, `EffectsConfig.activePresets`, and `EffectsOverrides` to include `bubbles`. Bump `EFFECTS_CONFIG_VERSION`.

**Spin-rate emission is automatic.** TKA prop motion is dominantly rotational — a spinning prop produces high tip linear velocity. The emission formula (below) uses `tipSpeed`, which scales with angular velocity for a rotating prop. No separate angular-velocity input needed.

## Palette definitions

Each palette is a 4-slot color set (rim → highlight → fill → popBurst). Palettes live in:

```ts
// src/lib/shared/3d/effects/bubbles/BubblePalettes.ts (mirror in 2D renderer folder)

export interface BubblePalette {
  readonly id: BubblesIntent["palette"];
  readonly rim: string;        // hex — bubble outline color
  readonly highlight: string;  // hex — specular dot
  readonly fill: string;       // rgba — transparent interior tint
  readonly popBurst: string;   // hex — color of ring-burst on death
  readonly iridescent?: boolean; // oil palette flag — rim shifts over lifetime
}
```

Palette registry:

| id | rim | highlight | fill | popBurst | notes |
|----|-----|-----------|------|----------|-------|
| soap | `#c8e0ff` | `#ffffff` | `rgba(200,224,255,0.15)` | `#e8f4ff` | large, slow, dreamy |
| champagne | `#f4e8c8` | `#ffffff` | `rgba(244,232,200,0.2)` | `#fff8e0` | small, fast, fizzy |
| oil | hue-shift (see below) | `#ffffff` | `rgba(200,160,240,0.15)` | `#c080ff` | iridescent — rim animates over lifetime |
| acid | `#b8ff6f` | `#e8ffc0` | `rgba(184,255,111,0.15)` | `#98e860` | pairs with acid water palette |
| spirit | `#c0fff4` | `#ffffff` | `rgba(192,255,244,0.1)` | `#a0f8e0` | ethereal, translucent |
| custom | derived from `customColor` | | | | same hsl-shift rule as water |

**Oil iridescence rule:** when `palette === "oil"`, rim color is a 3-stop hue-over-lifetime gradient: magenta `#ff80d0` at spawn → cyan `#80d0ff` at mid-life → green-gold `#d0ff80` at pop. Renderer samples the gradient each frame based on the bubble's `age / lifetime` ratio.

**Custom derivation rule:** when `palette === "custom"`, derive 4 slots from `customColor`: `rim` = base, `highlight` = +40% L / -30% S, `fill` = base at 15% alpha, `popBurst` = +20% L.

## Presets

Six presets in `src/lib/shared/effects/domain/presets/built-in-bubbles-presets.ts`:

| id | palette | ambient | motion | intensity | sizeJitter | buoyancy | notes |
|----|---------|---------|--------|-----------|------------|----------|-------|
| classic | soap | 0.3 | 0.5 | 0.6 | 0.4 | 0.5 | default balanced soap |
| fizz | champagne | 0.6 | 0.5 | 0.5 | 0.2 | 0.9 | constant effervescence, small uniform bubbles |
| dream | soap | 0.5 | 0.2 | 0.9 | 0.7 | 0.3 | large slow swells, wide size range |
| iridescent | oil | 0.4 | 0.4 | 0.7 | 0.5 | 0.5 | oil-slick rainbow |
| acid_fizz | acid | 0.5 | 0.6 | 0.6 | 0.3 | 0.8 | corrosive fizz, pairs with acid water |
| spirit_mist | spirit | 0.6 | 0.3 | 0.4 | 0.6 | 0.4 | ghostly halos |

All presets ship with `trackingMode: "both_ends"`.

## Sub-phase delivery

Four sub-phases (fewer than water's five — no metaballs, no ground puddles). Each has a bail point.

### 1g.i — Bubble MVP

Ships the base effect. Proves bubbles read as bubbles.

- Pre-allocated particle pool per backend. Size: 512 particles (low), 1024 (medium), 2048 (high).
- Per-tip emitter samples tip position + velocity each frame. Spawn rate = `ambientEmission * AMBIENT_BASE_RATE + motionEmission * speedScalar * MOTION_BASE_RATE` where `speedScalar = clamp(tipSpeed / MOTION_REFERENCE_SPEED, 0, 1)`. Three tuning constants (defaults suggested, final values during implementation): `AMBIENT_BASE_RATE ≈ 6` bubbles/sec, `MOTION_BASE_RATE ≈ 30` bubbles/sec at full velocity, `MOTION_REFERENCE_SPEED ≈ 3.0` units/sec (same reference as water for behavioral consistency).
- Bubble lifetime: 1.0-3.0s with per-bubble jitter. Base size varies with `intensity`. Per-bubble size additionally varies with `sizeJitter`.
- Rise velocity: `+y` in world space (3D) or `+canvasUp` (2D), scaled by `buoyancy`. Small horizontal drift per-bubble for natural chaos.
- 2D shader: ringed circle — rim stroke in palette `rim`, highlight dot offset to upper-left quadrant in palette `highlight`, transparent fill tinted with palette `fill`.
- 3D shader: billboard sphere with fresnel rim-lighting + specular highlight lobe. Reads as a translucent hollow sphere.
- Timeout-only pop (hybrid size-pop lands in 1g.ii). Pop animation: rim expands 1.5× over 120ms while alpha fades, plus 4-8 tiny burst particles in palette `popBurst`.

**Bail point:** Do they read as bubbles?

### 1g.ii — Size-growth + hybrid pop

Activates the soap-vs-champagne behavior split.

- Bubbles grow during their lifetime. Growth rate per bubble ∝ `(1 - sizeJitter)` so low-jitter (champagne) bubbles barely grow and high-jitter (soap/dream) bubbles swell dramatically.
- Max radius is derived from `intensity × palette-specific-multiplier` (soap/dream palettes allow larger max sizes).
- Pop trigger: whichever comes first — timeout (from 1g.i) OR max radius reached.
- Soap's "swell before burst" signature emerges here. Champagne is unaffected visually (bubbles pop on timeout before they'd have grown meaningfully).

**Bail point:** Is the swell worth the extra shader/CPU work?

### 1g.iii — Oil palette iridescence

Activates `oil` palette's hue-shift-over-lifetime.

- Renderer branches on `palette === "oil"`: instead of static `rim` color, sample a 3-stop HSL gradient (magenta → cyan → green-gold) at `age / lifetime`.
- Cheap: one extra lerp per bubble per frame. No post pass, no render target.
- Other palettes unaffected.

**Bail point:** Is iridescence convincing without full refraction?

### 1g.iv — 3D refraction (3D-only polish)

Same refraction infrastructure water 1f.v introduced. If water shipped it, bubbles consume the existing scene-texture pass for free (rim sampling + normal distortion). If water deferred 1f.v, bubbles defer 1g.iv too.

- Bubble surface refracts the scene behind it, distorting based on sphere normal.
- Refraction strength fixed (no new intent param — bubbles are always transparent).
- Skipped on low tier, reduced-res scene texture on medium, full-res on high.
- 2D equivalent: none. The ringed-circle shader already captures what 2D can express.

**Bail point:** Polish-only. If tokens tight, defer.

## Architecture per backend

### 2D (canvas/WebGL2)

- `src/lib/shared/effects/renderers/Bubbles2DRenderer.ts` — owns pool, emitter state, ringed-circle draw calls, iridescence sampling for oil palette
- Reuses: water particle-pool pattern (identical structure, different shader)
- No ribbon needed. No post pass (metaballs are water-specific).

### 3D (Three.js)

- `src/lib/shared/3d/effects/bubbles/BubblesRenderer3D.ts` — owns the Three.js scene objects, instanced billboard mesh, pop-burst sub-pool
- `src/lib/shared/3d/effects/bubbles/BubbleParticleMesh.ts` — instanced billboard sphere pool
- `src/lib/shared/3d/effects/bubbles/BubblePopBurst.ts` — tiny burst-particle sub-pool (separate because pop bursts have different lifetime/physics than bubbles themselves)
- `src/lib/shared/3d/effects/bubbles/BubbleRefractionPass.ts` — 1g.iv only, or reuse `WaterRefractionPass` if architecturally shared

## Quality tiers

| Tier | 1g.i bubbles | 1g.ii size-growth | 1g.iii iridescence | 1g.iv refraction |
|------|--------------|-------------------|--------------------|------------------|
| low | 512 particles | on | on | **off** |
| medium | 1024 particles | on | on | reduced-res scene texture |
| high | 2048 particles | on | on | full-res scene texture |

Size-growth and iridescence stay on at low tier — they're per-particle math, not fullscreen passes.

## Files

### Modified

- `src/lib/shared/effects/domain/EffectsConfig.ts` — add `BubblesIntent`, extend `EffectType`, `EffectsConfig`, `activePresets`, `EffectsOverrides`; bump version
- `src/lib/shared/effects/domain/defaults.ts` — add bubbles defaults (classic preset values)
- `src/lib/shared/effects/domain/migrations.ts` — add version bump migration (no-op: bubbles absent → bubbles default)
- `src/lib/shared/effects/translators/canvas2d-types.ts` — add `Bubbles2DParams`
- `src/lib/shared/effects/translators/canvas2d-translator.ts` — add `resolveBubbles2D(intent, palette) → Bubbles2DParams`
- `src/lib/shared/effects/translators/webgl3d-types.ts` — add `Bubbles3DParams`
- `src/lib/shared/effects/translators/webgl3d-translator.ts` — add `resolveBubbles3D(intent, palette) → Bubbles3DParams`
- `src/lib/shared/animation-engine/components/effects-panel/EffectSelector.svelte` — extend chip row (11 chips including `none`)
- `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte` — route bubbles to BubblesCustomize

### New

- `src/lib/shared/effects/domain/presets/built-in-bubbles-presets.ts` — 6 presets
- `src/lib/shared/effects/renderers/Bubbles2DRenderer.ts` — 2D renderer
- `src/lib/shared/3d/effects/bubbles/BubblePalettes.ts` — palette registry (shared 2D/3D)
- `src/lib/shared/3d/effects/bubbles/BubblesRenderer3D.ts` + sub-components (see Architecture)
- `src/lib/shared/animation-engine/components/effects-panel/customize/BubblesCustomize.svelte` — intent editor
- `src/lib/shared/animation-engine/components/effects-panel/presets/BubblesPresets.svelte` — preset grid

## Testing

- Unit: palette derivation for `custom` palette, preset application, translator resolution, oil iridescence gradient sampling (given `age/lifetime` returns correct rim color)
- Integration: bubbles toggle on/off via chip row, presets apply visibly, per-sub-phase visual verification via Chrome DevTools MCP screenshots
- Verification per sub-phase: Austen confirms "yes that reads as bubbles" / "yes the swell is worth it" / "yes iridescence works" before advancing

## Known risks

- **Pattern rot.** Assumes 2D/3D translator patterns hardened by 1c-1f still look the way they do on 2026-04-15. Quick review before 1g.i starts.
- **Refraction pass coupling.** 1g.iv assumes water 1f.v shipped. If water deferred refraction, bubbles defer too — the shared `BubbleRefractionPass` + `WaterRefractionPass` investment is one unit of work, not two.
- **Oil palette is a branch in the shader.** Every other palette is static colors, oil is a per-frame hue lerp. Shader complexity creep if other palettes later want dynamic behavior — at that point, pull iridescence into a general `dynamicRim: HueGradient | null` palette field.
- **2D up-direction is canvas up, not world up.** If the canvas is rotated (shouldn't happen in current UI) bubbles would rise in screen space, not world space. Acceptable — no prop renderer rotates the canvas.

## Out of scope

- Bubble-bubble collision / merging (bubbles pass through each other — would require metaballs, which water has and bubbles don't need).
- Rainbow reflection maps on oil palette (iridescent rim is enough — a full environment-mapped reflection is post-1.0 polish).
- Audio (pop sounds) — separate feature.
- Stacking with other effects — architecture work, tracked separately.
- Bubble wands / trails that spawn bubbles along the tip path (vs at the tip) — emission-source variant not needed.
