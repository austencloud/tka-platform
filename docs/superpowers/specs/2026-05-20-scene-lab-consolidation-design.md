# Scene Lab Consolidation

Consolidate the Scene Lab picker from 9 variant-based flat buttons to 10 category-based icon buttons, add toggle-first controls for all scene elements, rename "Night Sky" to "Cosmic" across the app, and integrate all missing scenes (Ember, Cherry Blossom, Rainbow, Celestial, Pure Black) into the Scene Lab.

## Scene Picker Strip

Single horizontal row of 10 icon buttons. Same glassmorphic `.scene-strip` styling, horizontal scroll on narrow viewports.

| Icon | Label | FA Class | SceneId |
|------|-------|----------|---------|
| ❄️ | Winter | `fa-snowflake` | `winter` |
| 🌲 | Forest | `fa-tree` | `forest` |
| 🍂 | Autumn | `fa-leaf` | `autumn` |
| 🌌 | Cosmic | `fa-moon` | `cosmic` |
| 🌊 | Ocean | `fa-water` | `ocean` |
| 🔥 | Ember | `fa-fire` | `ember` |
| 🌸 | Blossom | `fa-spa` | `cherry-blossom` |
| 🌈 | Rainbow | `fa-rainbow` | `rainbow` |
| ✨ | Celestial | `fa-star` | `celestial` |
| ⬛ | Black | `fa-square` | `pure-black` |

Each button renders: `<i class="fas {icon}">` + label text.

### SceneId Type

Replace the current 9-variant union:

```ts
// BEFORE
type SceneId =
  | "winter" | "forest-firefly" | "forest-autumn"
  | "cosmic-night" | "cosmic-aurora"
  | "ocean-abyss" | "ocean-reef" | "ocean-mystical" | "ocean-cinematic";

// AFTER
type SceneId =
  | "winter" | "forest" | "autumn" | "cosmic" | "ocean"
  | "ember" | "cherry-blossom" | "rainbow" | "celestial" | "pure-black";
```

### SceneOption Type

Add `icon` field:

```ts
interface SceneOption {
  id: SceneId;
  label: string;
  icon: string;
  description: string;
}
```

## Toggle-First Controls

### ParamPanel Enhancement

Add optional `enabled` / `onToggle` props to `ParamPanel`:

```ts
interface Props {
  title: string;
  defaultOpen?: boolean;
  enabled?: boolean;       // undefined = no toggle (always-on section)
  onToggle?: (v: boolean) => void;
  children: Snippet;
}
```

Behavior:
- When `enabled` is provided, render a small pill-switch toggle indicator (button + `aria-pressed`) right-aligned in the header.
- Toggle OFF → panel auto-collapses, title dims to 40% opacity, children hidden, chevron hidden.
- Toggle ON → panel expandable/collapsible normally with chevron.
- Clicking the toggle fires `onToggle`. Clicking the title/chevron area controls expand/collapse (only when enabled).
- Panels without `enabled` prop (Sky, Fog, Ground, Hemisphere Light) behave exactly as today.

Toggle indicator is a `<button>` with visual pill-switch states, not `<input type="checkbox">`. Follows project toggle pattern.

### Migration of Enabled Hacks

All existing `<ParamSlider label="Enabled" value={cfg.X.enabled ? 1 : 0} min={0} max={1} step={1}>` calls are replaced with `ParamPanel`'s `enabled` / `onToggle` props. Affected sections across all controls:

- Ocean: Coral, Kelp, Fish, Decorations, Jellyfish, Caustics, God Rays
- Cosmic: Platform, Earth, Nebula (and all particle/crystal/god-ray sections)
- Winter: any toggleable elements
- Forest: any toggleable elements

## Cosmic Variant Handling

Night vs Aurora is an ambient color preset, not a separate scene. Inside `CosmicControls`, add a segmented control or toggle at the top:

```
[Night] [Aurora]
```

Switching changes the active config preset (night or aurora colors). The Scene Lab state tracks `cosmicVariant: "night" | "aurora"` internally, separate from `SceneId`.

## Ocean Simplification

Ocean is locked to the reef config. Remove `ocean-abyss`, `ocean-mystical`, `ocean-cinematic` from `SceneId` and `SCENE_OPTIONS`. The config factory functions (`createDefaultOceanAbyssConfig`, etc.) remain in `scene-configs.ts` for reference but are not wired to the picker or state.

`OceanControls` simplifies to always read/write the single ocean (reef) config.

## New Scene Integration

### Scenes with Config Factories (tuneable)

**Ember** (`createDefaultEmberGlowConfig`), **Cherry Blossom** (`createDefaultCherryBlossomConfig`), **Celestial** (`createDefaultCelestialConfig`):

- Add new control components: `EmberControls.svelte`, `CherryBlossomControls.svelte`, `CelestialControls.svelte`
- Wire each config factory's element groups to `ParamPanel` sections with toggles where applicable
- Add corresponding config state in `scene-lab-state.svelte.ts`

### Scenes without Config Factories (minimal controls)

**Rainbow** and **Pure Black**:
- Show "No tunable parameters" empty state in the controls pane
- Rainbow renders `RainbowScene.svelte` in the preview
- Pure Black renders nothing (empty 3D scene, solid black background)

## Scene Preview Mapping

`ScenePreview.svelte` maps each `SceneId` to the correct scene component and `BackgroundType`:

| SceneId | BackgroundType | Scene Component |
|---------|---------------|-----------------|
| `winter` | `SNOWFALL` | `WinterScene` |
| `forest` | `FIREFLY_FOREST` | `ForestScene` (variant: firefly) |
| `autumn` | `AUTUMN_DRIFT` | `AutumnScene` |
| `cosmic` | `NIGHT_SKY` | `CosmicScene` (variant from state) |
| `ocean` | `DEEP_OCEAN` | `OceanScene` (variant: reef) |
| `ember` | `EMBER_GLOW` | `EmberScene` |
| `cherry-blossom` | `CHERRY_BLOSSOM` | `CherryBlossomScene` |
| `rainbow` | `PRIDE` | `RainbowScene` |
| `celestial` | `CELESTIAL` | `CelestialScene` |
| `pure-black` | `SOLID_COLOR` | none |

## EnvironmentSettingsPanel Rename

In `EnvironmentSettingsPanel.svelte`, change the Night Sky entry:

```ts
// BEFORE
{ type: BackgroundType.NIGHT_SKY, name: "Night Sky", icon: "fa-moon", has3DScene: true }

// AFTER
{ type: BackgroundType.NIGHT_SKY, name: "Cosmic", icon: "fa-moon", has3DScene: true }
```

No structural changes to this panel.

## Scene Lab State Changes

### Removed State

- `oceanAbyssConfig`, `oceanMysticalConfig`, `oceanCinematicConfig` — ocean simplifies to single config
- `cosmicNightConfig`, `cosmicAuroraConfig` as separate scene entries — replaced by single `cosmicConfig` with internal variant

### Added State

- `cosmicVariant: "night" | "aurora"` — controls which color preset is active
- `emberConfig` — mutable state for Ember scene
- `cherryBlossomConfig` — mutable state for Cherry Blossom scene
- `celestialConfig` — mutable state for Celestial scene

### localStorage Migration

Existing saved configs use old keys (`ocean-abyss`, `cosmic-night`, etc.). On load:
- Map `ocean-reef` → `ocean`
- Map `cosmic-night` → `cosmic` (variant: night)
- Map `cosmic-aurora` → `cosmic` (variant: aurora)
- Map `forest-firefly` → `forest`
- Map `forest-autumn` → `autumn`
- Discard `ocean-abyss`, `ocean-mystical`, `ocean-cinematic`

## SceneLab.svelte Controls Routing

Update the conditional rendering in the controls pane:

```svelte
{#if sceneState.sceneId === "winter"}
  <WinterControls />
{:else if sceneState.sceneId === "cosmic"}
  <CosmicControls />
{:else if sceneState.sceneId === "ocean"}
  <OceanControls />
{:else if sceneState.sceneId === "forest"}
  <ForestControls />
{:else if sceneState.sceneId === "autumn"}
  <AutumnControls />
{:else if sceneState.sceneId === "ember"}
  <EmberControls />
{:else if sceneState.sceneId === "cherry-blossom"}
  <CherryBlossomControls />
{:else if sceneState.sceneId === "celestial"}
  <CelestialControls />
{:else}
  <p class="no-controls">No tunable parameters</p>
{/if}
```

## Files Changed

### Modified
- `src/lib/features/lab/tabs/scene-lab/domain/scene-lab-types.ts` — SceneId, SceneOption, SCENE_OPTIONS
- `src/lib/features/lab/tabs/scene-lab/SceneLab.svelte` — icon buttons, controls routing
- `src/lib/features/lab/tabs/scene-lab/components/ParamPanel.svelte` — toggle support
- `src/lib/features/lab/tabs/scene-lab/components/OceanControls.svelte` — simplify to reef-only, use toggles
- `src/lib/features/lab/tabs/scene-lab/components/CosmicControls.svelte` — variant toggle, use panel toggles
- `src/lib/features/lab/tabs/scene-lab/components/ForestControls.svelte` — use panel toggles
- `src/lib/features/lab/tabs/scene-lab/components/WinterControls.svelte` — use panel toggles
- `src/lib/features/lab/tabs/scene-lab/components/ScenePreview.svelte` — map new SceneIds to scenes
- `src/lib/features/lab/tabs/scene-lab/state/scene-lab-state.svelte.ts` — new configs, variant state, migration
- `src/lib/shared/3d/components/controls/EnvironmentSettingsPanel.svelte` — rename Night Sky → Cosmic

### New
- `src/lib/features/lab/tabs/scene-lab/components/AutumnControls.svelte`
- `src/lib/features/lab/tabs/scene-lab/components/EmberControls.svelte`
- `src/lib/features/lab/tabs/scene-lab/components/CherryBlossomControls.svelte`
- `src/lib/features/lab/tabs/scene-lab/components/CelestialControls.svelte`
