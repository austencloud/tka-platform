# Viewer Settings Consolidation

## Goal

Eliminate duplicated controls across 3D and 2D viewers by removing all right-click context menus and consolidating settings into gear popovers. Both viewers use the same pattern: a gear icon that opens a tabbed popover.

## Architecture

Both viewers already have (or will get) a gear icon in their toolbar. The gear popover is a floating panel with chip-style tab navigation, consistent with the existing 3D `Viewer3DGearPopover`. Right-click context menus are deleted — no replacement, no "context menu as fallback." Every control has exactly one home.

## 3D Viewer Changes

### 1. Delete Right-Click Context Menu

Remove these files entirely:
- `src/lib/shared/3d/components/context-menu/Viewer3DContextMenuBuilder.ts` (196 lines)
- `src/lib/shared/3d/components/context-menu/Viewer3DContextMenuHost.svelte` (55 lines)

Remove all references to `Viewer3DContextMenuHost` and `openContextMenu` from parent components that wire up the `contextmenu` event listener on the 3D canvas.

"Exit 3D View" — already has a dedicated button in the viewer header. No replacement needed.

### 2. Add Visibility Tab to Gear Popover

New tab in `Viewer3DGearPopover.svelte` called **Visibility**. Contains chip-style toggles for:

- **Props** — show/hide prop meshes
- **Beat #s** — step number overlays
- **TKA Glyph** — TKA notation glyph overlay
- **Word Header** — sequence word display
- **Progress Bar** — playback progress indicator

These are the same controls from the deleted context menu's Visibility submenu. They read/write `AnimationVisibilityStateManager` — the same state the context menu was using.

Implementation: create `Viewer3DVisibilityToggles.svelte` following the same chip pattern as `SceneFeatureToggles.svelte`. The component gets the visibility manager and renders one chip per setting.

### 3. Remove Effects Stub Tab from Gear Popover

The gear popover currently has a disabled "Effects" tab placeholder. Remove it. Effects lives exclusively in the sidebar's Effects section (`EffectsSettingsPanel`), which already has the full chip + slider + preset UX.

### 4. Remove Grid Section from Sidebar

The sidebar's `Animation3DSidePanel.svelte` currently has a Grid collapsible section (`GridSettingsPanel`). Remove it — Grid is already covered by the Scene tab's Grid chip toggle (on/off) and the Planes tab (plane visibility). The sidebar's Diamond/Box mode toggle and plane visibility buttons are redundant with the gear popover's Planes tab.

### 3D Final State

**Gear Popover** (5 tabs):
| Tab | Controls | Status |
|-----|----------|--------|
| Camera | View presets | Unchanged |
| Planes | Wall/Wheel/Floor visibility + hand slot assignments | Unchanged |
| Performers | Formations, position nudge, facing angle | Unchanged |
| Scene | Stage, Audience, Environment, Campfire, Tent, Grid chips | Unchanged |
| Visibility | Props, Beat #s, TKA Glyph, Word Header, Progress Bar chips | **New** |

**Sidebar** (trimmed):
| Section | Controls | Status |
|---------|----------|--------|
| Load Sequence | Button + empty state | Unchanged |
| Avatar | Show/hide, avatar selection | Unchanged |
| Proportions | Body proportion sliders | Unchanged |
| Environment | Background/theme selection | Unchanged |
| Effects | Trails/Fire/Sparkles/Zap/Motion/Bloom chips + sliders + presets | Unchanged |
| Grid | ~~Diamond/Box + plane visibility~~ | **Removed** |
| Playback | FPS, step mode | Unchanged |
| Resolution | Resolution presets | Unchanged |
| Tiling | Tiling options | Unchanged |
| Loops | Loop count | Unchanged |
| Record | Record Scene button | Unchanged |

**Right-click context menu**: Deleted.

## 2D Viewer Changes

### 5. Add Gear Icon to Choreo Card Viewer

Add a small gear icon button to the top-right corner of the 2D choreo card viewer. Same visual style as the 3D gear icon — semi-transparent background, white gear icon, subtle hover effect. Positioned inside the viewer's existing toolbar/header area.

### 6. Create 2D Gear Popover

New component `ChoreoCardGearPopover.svelte` following the same tabbed popover pattern as `Viewer3DGearPopover.svelte`. Three tabs:

**Display tab** — chip-style toggles for:
- Blue Motion (show/hide)
- Red Motion (show/hide)
- Grid
- All Hand Points (cycles: all / active)
- Non-Radial Points
- Step Numbers

These read/write `VisibilityStateManager` from the pictograph visibility system.

**Glyphs tab** — chip-style toggles for:
- TKA
- VTG
- Elemental
- Positions
- Reversals

Glyph toggles are disabled when not all motions are visible (same behavior as the context menu had).

**Layout tab** — controls for:
- Column count chips: Auto, 2, 4, 6, 8 (only shown for 4+ step sequences, even numbers only up to step count)
- Card Settings button (opens existing Card Settings modal)

Column count reads/writes `ImageCompositionManager` — same state the context menu was using.

### 7. Delete 2D Context Menus

Remove these files:
- `src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuBuilder.ts` (173 lines)
- `src/lib/shared/pictograph/shared/components/context-menu/PictographContextMenuHost.svelte` (56 lines)
- `src/lib/shared/sequence-viewer/components/choreo-card-context-menu/ChoreoCardContextMenuHost.svelte` (50 lines)
- `src/lib/features/choreo-card/components/context-menu/CardDesignerContextMenuBuilder.ts` (109 lines)

Remove all `contextmenu` event listeners from parent components that opened these menus.

**Admin arrow adjustment** — the pictograph context menu had conditional "Adjust Blue/Red Arrow" items for admin users. These move into the 2D gear popover's Display tab, shown only when `showArrowAdjustment` is true and motions exist. They appear as a separated group at the bottom of the Display tab, visually distinct from the toggle chips (e.g., small icon buttons with blue/red color coding).

### 2D Final State

**Gear Popover** (3 tabs):
| Tab | Controls |
|-----|----------|
| Display | Blue/Red motion, Grid, Hand Points, Non-Radial, Step Numbers |
| Glyphs | TKA, VTG, Elemental, Positions, Reversals |
| Layout | Column count (Auto/2/4/6/8), Card Settings button |

**Right-click context menu**: Deleted.

## Shared Infrastructure

The existing `ContextMenu` component and `context-menu-types.ts` are shared infrastructure used by other parts of the app (not just these viewers). They stay — we're only deleting the viewer-specific builders and hosts.

Both gear popovers use chip-style toggles matching the pattern established in `SceneFeatureToggles.svelte`: pill-shaped buttons with `color-mix(in srgb, #8b8bff 15%, transparent)` active state.

## What Does NOT Change

- The generic `ContextMenu` component and types (used elsewhere)
- The sidebar's Effects section (stays as-is with full sliders + presets)
- The sidebar's Avatar, Proportions, Environment sections (stay as-is)
- The sidebar's recording workflow sections (Playback, Resolution, Tiling, Loops, Record)
- The gear popover's Camera, Planes, Performers, Scene tabs (unchanged)
- The `SceneFeatureToggles` and `SceneLoadingCurtain` (unchanged)

## Testing

- Unit test for the new `Viewer3DVisibilityToggles` component: verify chip state reflects visibility manager state, verify toggling updates the manager
- Unit test for the 2D popover tabs: verify Display/Glyphs/Layout tabs render correct controls and wire to the correct state managers
- Manual verification: confirm no right-click menu appears on either viewer, confirm all controls accessible via gear popover
