# Per-Scene Custom Stages — Design Spec

**Date:** 2026-05-20
**Status:** Draft

## Problem

7 of 10 scenes share a generic wooden Stage3D. The wooden stage fits Forest/Autumn but looks wrong in Ocean, Ember, Winter, etc. Cosmic and Celestial already have custom stages (StationPlatform, CloudPlatform) — the rest need the same treatment.

Additionally:
- Scene Lab only shows Stage3D in "compose" camera mode — most users never see a stage
- `hasOwnPlatform` in Viewer3DScene only exempts Cosmic, so Celestial gets a double stage (wooden + cloud)
- Stage ground offset calculation is a brittle two-branch conditional

## Architecture: Scene-Owned Stages

Each scene component renders its own stage internally. Viewer3DScene stops rendering Stage3D as a separate layer.

**Key changes:**
- Remove `hasOwnPlatform` check and conditional `<Stage3D>` from `Viewer3DScene.svelte`
- Remove conditional `<Stage3D>` from Scene Lab's `ScenePreview.svelte`
- Each `*Scene.svelte` component imports and renders its own `*Platform.svelte`
- `stageGroundOffset` becomes a per-scene constant exported from each scene or looked up from a map
- Stage3D.svelte remains as-is — Forest and Autumn scenes import it directly

**File layout pattern:**
```
src/lib/shared/3d/environments/scenes/
  winter/
    WinterScene.svelte        (existing)
    IcePlatform.svelte         (new)
  ocean/
    OceanScene.svelte          (existing)
    CoralPlatform.svelte       (new)
  ember/
    EmberScene.svelte          (existing)
    ObsidianPlatform.svelte    (new)
  cherry-blossom/
    CherryBlossomScene.svelte  (existing)
    EngawaPlatform.svelte      (new)
  rainbow/
    RainbowScene.svelte        (existing)
    PrismPlatform.svelte       (new)
  pure-black/
    VoidPlatform.svelte        (new)
```

Forest and Autumn continue using `Stage3D.svelte` from `src/lib/shared/3d/components/`.

## Config Interface

Each stage config is embedded in its parent scene config. Minimal tunable surface:

```ts
// Base fields every stage config shares
interface BasePlatformConfig {
  enabled: boolean;
  radius: number;         // width/depth for rectangular stages
  primaryColor: string;
  glowIntensity: number;
}
```

Scene-specific stages extend with 1-3 extra fields. Scene Lab gets a "Stage" ParamPanel per scene.

## Per-Scene Stage Designs

### Winter — IcePlatform

- **Shape:** Circular, ~5m radius
- **Material:** GLSL shader — translucent ice with frost patterns (fbm noise), faint blue tint
- **Surface:** Subtle crack/vein patterns, slight refraction distortion
- **Edges:** Rim frost glow (emissive edge falloff)
- **Orientation:** Downstage arrow in ice-blue emissive glow
- **Config:** `{ enabled, radius, primaryColor, glowIntensity, frostDensity }`

### Forest — Stage3D (existing)

- **No changes.** Forest is the wooden stage's home scene.
- Imported directly from `$lib/shared/3d/components/Stage3D.svelte`
- Full orientation system: footlights, side cues, torches, stairs

### Autumn — Stage3D (recolored)

- **Same structure as Forest** but with autumn-toned wood colors
- Plank colors: burnt orange, dark walnut, deep amber (replace the summer-brown palette)
- Footlights: warm amber instead of yellow
- Existing Stage3D already accepts `width`/`depth` props — add optional color overrides or create an AutumnStage3D wrapper that passes autumn palette
- **Config:** Stage3D props + color palette override

### Ocean — CoralPlatform

- **Shape:** Organic rounded (circle with uneven edge via displacement)
- **Material:** Sandy rock base with coral-colored rim accents
- **Surface:** Barnacle/coral texture via noise, subtle caustic light pattern from below
- **Edges:** Coral growth meshes at rim (small procedural cylinders/spheres)
- **Orientation:** Bioluminescent strip along downstage edge (cyan emissive)
- **Config:** `{ enabled, radius, primaryColor, glowIntensity, causticIntensity }`

### Ember — ObsidianPlatform

- **Shape:** Hexagonal
- **Material:** GLSL shader — dark obsidian base with animated lava-crack veins
- **Surface:** Voronoi crack pattern, lava glow in cracks pulses slowly
- **Edges:** Heat shimmer (emissive falloff at rim, warm orange)
- **Orientation:** Cracks glow brighter on downstage half
- **Config:** `{ enabled, radius, primaryColor, glowIntensity, crackIntensity, lavaSpeed }`

### Cherry Blossom — EngawaPlatform

- **Shape:** Circular with subtle raised rim (like a Japanese veranda disc)
- **Material:** Polished natural wood — warm honey tone, slight gloss (higher metalness than rustic)
- **Surface:** Clean wood grain via noise, thin rail/border at edge
- **Edges:** Subtle warm glow at rim
- **Orientation:** Faint downstage lantern glow (warm amber emissive dot)
- **Config:** `{ enabled, radius, primaryColor, glowIntensity }`

### Rainbow — PrismPlatform

- **Shape:** Circular
- **Material:** GLSL shader — translucent glass-like disc with rainbow gradient at rim
- **Surface:** Prismatic color shift based on view angle (simple iridescence)
- **Edges:** Rainbow spectral glow, smooth gradient cycling through hues
- **Orientation:** Spectral glow is brighter downstage
- **Config:** `{ enabled, radius, glowIntensity, spectrumSpeed }`

### Celestial — CloudPlatform (existing)

- **No changes.** Already custom. Fix the double-stage bug (remove wooden Stage3D underneath).

### Cosmic — StationPlatform (existing)

- **No changes.** Already custom.

### Pure Black — VoidPlatform

- **Shape:** Circular
- **Material:** Fully transparent surface (no visible disc) + glowing wireframe grid
- **Surface:** Concentric circle grid lines + radial lines, faint blue-white emissive
- **Edges:** Grid fades at outer radius
- **Orientation:** Grid lines glow brighter on downstage half
- **Config:** `{ enabled, radius, gridColor, glowIntensity, gridDensity }`

## Routing Changes

### Viewer3DScene.svelte

```diff
- const hasOwnPlatform = $derived(backgroundType === BackgroundType.NIGHT_SKY);
+ // All scenes now own their platform — no external Stage3D needed

- const stageGroundOffset = $derived(
-   hasOwnPlatform
-     ? COSMIC_PLATFORM_HEIGHT
-     : sceneFeatures.isEnabled("stage") ? STAGE.STAGE_DECK_HEIGHT : 0
- );
+ const stageGroundOffset = $derived(getStageGroundOffset(backgroundType));

- {#if sceneFeatures.isEnabled("stage") && !hasOwnPlatform}
-   <Stage3D width={stageWidth} depth={stageDepth} />
- {/if}
```

A `getStageGroundOffset(bg: BackgroundType): number` lookup returns per-scene deck heights. Forest/Autumn return `STAGE.STAGE_DECK_HEIGHT`, Cosmic returns its platform height, shader-based stages return a small value (~0.02), Pure Black returns 0.

### ScenePreview.svelte

```diff
- {#if camMode === "compose"}
-   <Stage3D />
- {/if}
```

Remove entirely. Stages render inside scene components now.

## Scene Lab Controls

Each scene that has a custom stage config gets a "Stage" ParamPanel section in its controls component (e.g. OceanControls, EmberControls). Knobs: enabled toggle, radius, primary color, glow intensity, plus 1-2 scene-specific params.

Forest and Autumn don't get stage controls since Stage3D has no config interface (its appearance is code-defined).

## Implementation Strategy

One parallel agent per new stage:
1. **IcePlatform** (Winter)
2. **CoralPlatform** (Ocean)
3. **ObsidianPlatform** (Ember)
4. **EngawaPlatform** (Cherry Blossom)
5. **PrismPlatform** (Rainbow)
6. **VoidPlatform** (Pure Black)

Then a routing agent to:
7. Wire scenes to their stages, remove Stage3D from Viewer3DScene/ScenePreview, fix ground offsets
8. Add Stage ParamPanel sections to each scene's controls component

Forest uses Stage3D as-is. Autumn gets a thin wrapper or color prop additions.
