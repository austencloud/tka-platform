# Theme Lab Unification

Merge the 2D Background Builder and 3D Scene Lab into a single "Themes" lab tab.

## Problem

Two separate labs do overlapping work:
- **Background Builder** (`2d-backgrounds` tab): 9 tabs for 2D canvas backgrounds. Production-connected — updates `settingsService.backgroundType`, which drives the main 3D viewer via `Environment3D`.
- **Scene Lab** (`scene-lab` tab): 10 scenes with full 3D parameter tuning. Isolated — configs stay in localStorage, developers copy-paste to source.

They share 8 themes with different names (Night Sky vs Cosmic, Snowfall vs Winter, Pride vs Rainbow). Celestial and Pure Black have 3D scenes but no 2D backgrounds. Users have no unified mental model.

## Design Decisions

| Decision | Choice |
|---|---|
| Mode toggle behavior | Lab preview only — main viewer always renders 3D |
| Tab replacement | Replace both with one "Themes" tab in Lab module |
| Rename depth | Full rename (Phase 2) — `BackgroundType` + `SceneId` → `ThemeId` |
| 3D controls | Progressive disclosure — presets at top, advanced sliders expandable |
| 3D preview | Reuse `ScenePreview.svelte` from Scene Lab |
| State management | `settingsService` stays primary; scene configs migrate into it |

## Theme Data Model

### ThemeId (Phase 1: mapping layer; Phase 2: canonical type)

```typescript
type ThemeId =
  | "ocean" | "cosmic" | "forest" | "blossom"
  | "pride" | "ember" | "winter" | "autumn"
  | "celestial" | "pure-black";

interface ThemeOption {
  id: ThemeId;
  label: string;
  icon: string;          // FA icon name with fa- prefix (for ThemeStrip buttons)
  color: string;         // Theme accent color (hex)
  backgroundType: BackgroundType;  // Phase 1 mapping to npm package enum
  sceneId: SceneId;                // Phase 1 mapping to scene-lab type
}
```

### THEME_OPTIONS

Every theme has both a 2D canvas background and a 3D scene. No exceptions.

| ThemeId | Label | Icon | Color | BackgroundType | SceneId |
|---|---|---|---|---|---|
| `ocean` | Ocean | `fa-water` | `#0ea5e9` | `DEEP_OCEAN` | `ocean` |
| `cosmic` | Cosmic | `fa-moon` | `#8b5cf6` | `NIGHT_SKY` | `cosmic` |
| `forest` | Forest | `fa-tree` | `#22c55e` | `FIREFLY_FOREST` | `forest` |
| `blossom` | Blossom | `fa-spa` | `#f472b6` | `CHERRY_BLOSSOM` | `cherry-blossom` |
| `pride` | Pride | `fa-rainbow` | `#f59e0b` | `PRIDE` | `rainbow` |
| `ember` | Ember | `fa-fire` | `#ef4444` | `EMBER_GLOW` | `ember` |
| `winter` | Winter | `fa-snowflake` | `#67e8f9` | `SNOWFALL` | `winter` |
| `autumn` | Autumn | `fa-leaf` | `#d97706` | `AUTUMN_DRIFT` | `autumn` |
| `celestial` | Celestial | `fa-star` | `#e2e8f0` | `CELESTIAL` | `celestial` |
| `pure-black` | Pure Black | `fa-square` | `#6b7280` | `PURE_BLACK` (new) | `pure-black` |

### New 2D backgrounds required

Two themes lack 2D canvas implementations. Both must be built as part of Phase 1:

**Celestial 2D** — `BackgroundType.CELESTIAL` already exists in the enum but has no canvas implementation in `@austencloud/backgrounds`. Needs:
- `CelestialBackgroundSystem` in the npm package (layered cloud fields, animated god rays, golden warm light, floating island silhouettes)
- `CelestialLab.svelte` in `background-builder/components/` (layer toggles: clouds, god rays, islands, pillars; quality slider)

**Pure Black 2D** — `BackgroundType.PURE_BLACK` does not exist yet. Needs:
- Add `PURE_BLACK` to the `BackgroundType` enum in `@austencloud/backgrounds`
- `PureBlackBackgroundSystem` in the npm package (solid black canvas with optional subtle grid lines and vignette — minimal, matching the 3D void aesthetic)
- `PureBlackLab.svelte` in `background-builder/components/` (toggles: grid overlay, vignette; grid opacity/spacing sliders)
- Add `PURE_BLACK` entries to `BACKGROUND_THEME_COLORS`, `THEME_TO_FAMILY`, `THEME_TO_GRADIENT` in settings utils

## Component Architecture

### Layout

```
ThemesLab.svelte
├── ThemeStrip.svelte              ← horizontal scrolling chip strip
│   └── 10 theme chips (dot + label, active = accent border + tinted bg)
├── ThemeHeader.svelte             ← between strip and content
│   ├── Theme name + color dot + mode badge ("2D" / "3D")
│   └── Pill segmented control: [2D | 3D]
└── Content area (flex row)
    ├── 2D mode → existing *Lab.svelte
    │   (self-contained: canvas preview + controls, fills content area)
    └── 3D mode → split layout
        ├── ScenePreview.svelte (left, flex-1)
        └── ThemeControlsPanel.svelte (right, 280px)
            ├── Preset chips row (per-theme, defined during implementation)
            └── CollapsibleLabSection per parameter group
                └── existing *Controls.svelte sliders
```

### ThemeId → 2D Lab Component Mapping

| ThemeId | 2D Lab Component | Status |
|---|---|---|
| `ocean` | `DeepOceanLab.svelte` | exists |
| `cosmic` | `NightSkyLab.svelte` | exists |
| `forest` | `FireflyForestLab.svelte` | exists |
| `blossom` | `CherryBlossomLab.svelte` | exists |
| `pride` | `PrideLab.svelte` | exists |
| `ember` | `EmberGlowLab.svelte` | exists |
| `winter` | `SnowfallLab.svelte` | exists |
| `autumn` | `AutumnDriftLab.svelte` | exists |
| `celestial` | `CelestialLab.svelte` | **new** |
| `pure-black` | `PureBlackLab.svelte` | **new** |

### ThemeId → 3D Controls Component Mapping

| ThemeId | 3D Controls Component |
|---|---|
| `ocean` | `OceanControls.svelte` |
| `cosmic` | `CosmicControls.svelte` |
| `forest` | `ForestControls.svelte` |
| `blossom` | `CherryBlossomControls.svelte` |
| `pride` | `RainbowControls.svelte` |
| `ember` | `EmberControls.svelte` |
| `winter` | `WinterControls.svelte` |
| `autumn` | `AutumnControls.svelte` |
| `celestial` | `CelestialControls.svelte` |
| `pure-black` | `PureBlackControls.svelte` |

### ThemeStrip

Horizontal scrolling chip strip. Each chip:
- Color dot (8px circle, theme accent color)
- Label text
- Active state: accent-colored border + tinted background

### ThemeHeader

Row between strip and content:
- **Left:** Theme label (bold) + color dot + mode badge (`<span class="mode-badge">2D</span>`)
- **Right:** Pill segmented control `[2D | 3D]`
- Both modes always available for every theme

### ThemeControlsPanel (3D mode)

Progressive disclosure wrapper around existing scene control components:

```
┌─ Preset Chips ────────────────────┐
│ [Dramatic] [Serene] [Vibrant]     │
│ [Minimal]  [Default]              │
└───────────────────────────────────┘
▸ Water (collapsed)
  Surface Height  ▬▬▬▬●▬▬
  Wave Intensity  ▬▬●▬▬▬▬
▸ Lighting (collapsed)
  ...
▸ Life (collapsed)
  ...
┌─ Actions ─────────────────────────┐
│ [Reset] [Copy Config]             │
└───────────────────────────────────┘
```

Presets are per-theme. Each preset is a named snapshot of config values that applies all sliders at once. The existing `createDefault*Config()` factory functions serve as the "Default" preset. Additional preset names and values are defined per-scene during implementation (e.g., Ocean might have "Abyss", "Reef", "Mystical" matching its existing factory variants).

## State Management

### New fields on AppSettings

```typescript
interface AppSettings {
  // ... existing fields ...
  themeMode?: "2d" | "3d";               // Lab preview mode (default: "2d")
  sceneLabSettings?: SceneLabSettings;    // 3D configs migrated from localStorage
}

interface SceneLabSettings {
  winterConfig?: WinterSceneConfig;
  forestConfig?: ForestSceneConfig;
  autumnConfig?: AutumnSceneConfig;
  cosmicNightConfig?: CosmicSceneConfig;
  cosmicAuroraConfig?: CosmicSceneConfig;
  oceanConfig?: OceanSceneConfig;
  emberConfig?: EmberSceneConfig;
  cherryBlossomConfig?: CherryBlossomSceneConfig;
  celestialConfig?: CelestialSceneConfig;
  rainbowConfig?: RainbowSceneConfig;
  pureBlackConfig?: PureBlackSceneConfig;
}
```

### State flow

```
User picks theme
  → themes-lab-state.setTheme(themeId)
  → maps ThemeId → BackgroundType via THEME_OPTIONS
  → settingsService.updateSetting("backgroundType", mapped)
  → main viewer updates (existing flow)
  → applyThemeForBackground() fires (existing flow)

User toggles 2D/3D
  → themes-lab-state.setMode(mode)
  → settingsService.updateSetting("themeMode", mode)
  → content area swaps between 2D lab and 3D preview

2D controls change
  → existing backgroundLabSettings path (unchanged)

3D controls change
  → themes-lab-state mutates config
  → debounced save to settingsService.sceneLabSettings
  → ScenePreview re-renders via Svelte reactivity
```

### Migration from scene-lab localStorage

On first load of ThemesLab, check `localStorage.getItem("scene-lab-state")`. If found, parse and migrate into `settingsService.sceneLabSettings`, then delete the localStorage key.

## Tab Registration

### Remove from `tab-definitions.ts` LAB_TABS:
- `{ id: "2d-backgrounds", ... }`
- `{ id: "scene-lab", ... }`

### Add to LAB_TABS:
```typescript
{ id: "themes", label: "Themes", icon: "fa-palette" }
```

### LabModule.svelte tabComponents:
```typescript
// Remove:
"2d-backgrounds": () => import("$lib/features/background-builder/BackgroundBuilder.svelte"),
"scene-lab": () => import("./tabs/scene-lab/SceneLab.svelte"),

// Add:
"themes": () => import("$lib/features/themes-lab/ThemesLab.svelte"),
```

## File Structure

```
src/lib/features/themes-lab/
├── ThemesLab.svelte
├── domain/
│   └── theme-types.ts                  # ThemeId, ThemeOption, THEME_OPTIONS
├── state/
│   └── themes-lab-state.svelte.ts      # Unified state wrapping settingsService
└── components/
    ├── ThemeStrip.svelte               # Scrolling chip strip
    ├── ThemeHeader.svelte              # Name + dot + badge + pill toggle
    └── ThemeControlsPanel.svelte       # Progressive disclosure for 3D
```

### Reused unchanged (imported, not moved):
- `background-builder/components/*Lab.svelte` — 8 existing + 2 new 2D labs
- `lab/tabs/scene-lab/components/ScenePreview.svelte` — 3D preview
- `lab/tabs/scene-lab/components/*Controls.svelte` — 10 scene control panels
- `lab/tabs/scene-lab/state/scene-lab-state.svelte.ts` — scene config state (read by ScenePreview)

### Not deleted yet:
- `background-builder/BackgroundBuilder.svelte` — old shell, unused after themes tab ships
- `lab/tabs/scene-lab/SceneLab.svelte` — old shell, unused after themes tab ships
- Cleanup happens in Phase 2 alongside type rename

## Phasing

### Phase 1 (this spec)
1. Add `PURE_BLACK` to `BackgroundType` enum in `@austencloud/backgrounds`, implement `CelestialBackgroundSystem` and `PureBlackBackgroundSystem` canvas renderers, publish new package version
2. Build `CelestialLab.svelte` and `PureBlackLab.svelte` 2D lab components
3. Add `PURE_BLACK` entries to theme color maps, avatar gradients, and background preloader
4. Build ThemesLab with mapping layer — theme strip, header, content routing
5. Wire tab registration, remove old tabs
6. Migrate scene-lab localStorage into settingsService

### Phase 2 (separate spec)
1. Update `@austencloud/backgrounds` npm package: export `ThemeId` type, deprecate `BackgroundType`
2. Migrate all 51 files importing `BackgroundType` to use `ThemeId`
3. Rename `SceneId` values where they differ from `ThemeId` (`rainbow` → `pride`, `cherry-blossom` → `blossom`)
4. Remove mapping layer from ThemesLab
5. Delete old BackgroundBuilder.svelte and SceneLab.svelte shells
6. Clean up unused imports and dead code

## Edge Cases

- **Gradient tab:** Dropped. Was a placeholder ("Coming Soon"). Not a theme.
- **SOLID_COLOR BackgroundType:** Not a theme. Settings panel keeps its own solid-color picker.
- **LINEAR_GRADIENT BackgroundType:** Not a theme. Settings panel keeps its own gradient picker.
- **ScenePreview context:** ScenePreview expects `SceneLabContext`. `themes-lab-state.svelte.ts` creates a compatible context object (with `state` and `composerState` properties). ThemesLab calls `setContext()` with the same key used by `scene-lab-context.ts`. Composer state can be a no-op stub since composer mode is excluded.
- **Scene composer mode:** Not included in ThemesLab. Composer is a development tool that stays accessible from Scene Lab if needed (or moves to a separate dev-tools area later).
- **localStorage migration:** One-time migration of `scene-lab-state` key into settingsService. Idempotent — skip if `sceneLabSettings` already populated.
