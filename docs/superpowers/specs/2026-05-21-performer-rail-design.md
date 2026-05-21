# Performer Rail — Design Spec

**Date:** 2026-05-21
**Status:** LAYOUT PENDING (user comparing A/B/C in playground)
**Playground:** `playground-performer-rail.html`

## Goal

Replace the in-popover PerformerChipStrip with a dedicated performer rail — a set of floating glassmorphic chips (one per performer + "All" + "+") that live outside the right rail. Each chip opens a per-performer editing surface (effects, prop type/size, plane, effort). The Sims-style vision: click a performer, see them highlighted in 3D, edit their properties.

## Layout Options (Under Exploration)

Three placement candidates — user comparing in playground:

| Layout | Position | Popover Direction | Notes |
|--------|----------|-------------------|-------|
| **A: Left Bottom** | Vertical stack, bottom-left corner, column-reverse (chips grow upward) | Flies right | Near playback controls. Mirror of right rail but on opposite side. |
| **B: Left Expanding** | Same position as A | Inline — panel slides out attached to chip's right edge | No floating popover. Chip + panel become one unit. Chip border-radius changes when open. |
| **C: Bottom Center** | Horizontal strip centered at bottom | Flies upward | Natural toolbar feel. Centered like playback controls. |

## Chip Spec (Identical Across All Layouts)

Matches existing right rail chips exactly:

```
Width:           56px
Height:          56px
Background:      rgba(20, 22, 32, 0.78)
Backdrop-filter: blur(20px) saturate(140%)
Border:          1px solid rgba(255, 255, 255, 0.1)
Border-radius:   14px
Box-shadow:      0 4px 16px rgba(0, 0, 0, 0.4)
Transition:      all 180ms cubic-bezier(0.2, 0, 0.13, 1.5)
Min touch target: 56px (exceeds 44px WCAG requirement)
```

### Chip Types

1. **"All" chip** — `fa-users` icon, accent blue (`#4a9eff`) pressed state
2. **Performer chips** — Bold number (1-8), performer-colored dot at top-right (12px)
3. **"+" chip** — `fa-plus` icon, dashed border, disabled at 8 performers

### Pressed State (Per-Performer)

```
Border-color:    var(--performer-color)
Box-shadow:      0 4px 20px color-mix(in srgb, var(--performer-color) 30%, transparent)
Number color:    var(--performer-color)
Dot glow:        0 0 8px var(--performer-color)
```

### Pressed State ("All")

```
Background:      color-mix(in srgb, #4a9eff 18%, transparent)
Border-color:    color-mix(in srgb, #4a9eff 50%, transparent)
```

### Tooltips

- Left/Expanding layouts: tooltip appears to the RIGHT of chip
- Bottom Center layout: tooltip appears ABOVE chip
- Hidden when popover is open

### Separators

- Vertical layouts: 32px x 1px horizontal line between All/performers and performers/Add
- Horizontal layout: 1px x 32px vertical line

## Popover Spec

Matches existing right rail popovers exactly:

```
Width:           420px
Background:      rgba(20, 22, 32, 0.82)
Backdrop-filter: blur(24px) saturate(150%)
Border:          1px solid rgba(255, 255, 255, 0.18)
Border-radius:   18px
Box-shadow:      0 12px 40px rgba(0, 0, 0, 0.55)
Animation in:    scale 220ms cubic-bezier(0.34, 1.56, 0.64, 1) from 0.92
Animation out:   scale 160ms cubic-bezier(0.55, 0, 1, 0.45) to 0.95
```

### Popover Header

```
Padding:         14px 16px 10px
Border-bottom:   1px solid rgba(255, 255, 255, 0.1)
Title:           11px / 700 / uppercase / 0.08em tracking / rgba(255,255,255,0.42)
Badge:           Performer color dot (8px) + performer name in performer color
```

### Tab Bar

Exact match of PerformerPopover tabs:

```
Container:       3px padding, 8px radius, rgba(0,0,0,0.45) bg, 1px border
Tab:             flex:1, 8px 10px padding, min-height 44px, 11px/600/0.04em
Active tab:      rgba(255,255,255,0.12) bg, rgba(255,255,255,0.2) border, white text
Transition:      140ms cubic-bezier(0.2, 0, 0.13, 1.5)
```

## Per-Performer Popover Tabs

### Effects Tab

Grid of 16 effect toggles (4 columns):

| ID | Label | Icon | Color |
|---|---|---|---|
| trails | Trails | fa-route | #60a5fa |
| fire | Fire | fa-fire | #f97316 |
| led | LED | fa-lightbulb | #22c55e |
| charcoal | Coal | fa-diamond | #a855f7 |
| zap | Zap | fa-bolt | #38bdf8 |
| sparkles | Sparkle | fa-star | #fbbf24 |
| echo | Echo | fa-clone | #22d3ee |
| bloom | Bloom | fa-sun | #f472b6 |
| water | Water | fa-droplet | #3a7fd9 |
| bubbles | Bubbles | fa-circle-notch | #c8e0ff |
| petals | Petals | fa-leaf | #ffc0d8 |
| smoke | Smoke | fa-smog | #c0c0c8 |
| ink | Ink | fa-paint-brush | #b8956a |
| frost | Frost | fa-snowflake | #a0d8ff |
| silk | Silk | fa-wind | #c0c0d0 |
| pulse | Pulse | fa-bullseye | #38bdf8 |

**Active state:** `border-color: effect.color; color: effect.color; background: color-mix(in srgb, effect.color 12%, transparent)`

Source: `src/lib/shared/animation-engine/components/effects-panel/effect-registry.ts`

### Prop Tab

**Prop Family Grid** (4 columns, sectioned):

| Section | Props |
|---|---|
| Staves & Clubs | Staff, Club, Fan |
| Curved Props | Buugeng, Trigeng, Hoop, Triad, Triquetra |
| Novelty | Chicken, DoubleStar, EightRings, ContactBall, Torch |
| Singles | Hand, Sword, Quiad |

Source: `src/lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte` (PROP_FAMILIES)

**Staff Length Slider:**
- Range: 80–180cm, default 120cm
- Accent: performer color
- Label + slider + value readout

**Plane Mode Selector** (3 primary planes, row of buttons):
- Wall, Wheel, Floor
- Source: `@austencloud/scene-3d` Plane enum (Wall/Wheel/Floor are L8; fusion planes are L9-only)

### Effort Tab

Grid of 8 efforts (4 columns), each showing label + subtitle:

| ID | Label | Subtitle | Color |
|---|---|---|---|
| linear | Linear | constant speed | #94a3b8 |
| glide | Glide | light, sustained | #34d399 |
| dab | Dab | light, sudden | #22d3ee |
| press | Press | strong, sustained | #a855f7 |
| punch | Punch | strong, sudden | #f43f5e |
| elastic | Elastic | overshoot, rebound | #f59e0b |
| bounce | Bounce | percussive rebounds | #ec4899 |
| anticipation | Anticipation | wind-up, release | #6366f1 |

**Active state:** `border-color: effort.color; color: effort.color; background: color-mix(in srgb, effort.color 12%, transparent)`

Source: `src/lib/shared/effort/domain/effort-types.ts` (EFFORTS array)

## "All" Popover

- Shows performer color dots for all active performers
- "Global controls" hint text
- Formation selector grid (4 columns):

| ID | Label | Icon | Valid Counts |
|---|---|---|---|
| circle | Circle | fa-circle | 1-8 |
| line | Line | fa-grip-lines | 1-8 |
| v-shape | V-Shape | fa-chevron-down | 1-8 |
| diagonal | Diagonal | fa-slash | 1-8 |
| grid-2x2 | Grid | fa-th | 1-4 |
| side-by-side | Side by Side | fa-grip-lines | 2-8 |
| tunnel-stack | Tunnel | fa-layer-group | 2-8 |
| back-to-back | Back to Back | fa-user-friends | 2 |
| facing-each-other | Facing | fa-people-arrows | 2 |
| stage-lr | Stage L/R | fa-arrows-alt-h | 2 |

Formations disabled (opacity 0.25, cursor not-allowed) when current performer count isn't in their valid counts list.

Source: `@austencloud/scene-3d` FormationPreset type + PRESET_VALID_COUNTS

## 3D Selection Behavior

When a performer chip is pressed:
1. **Ground ring** appears under performer (existing `DraggablePerformer.svelte` pattern — `RingGeometry`, performer color, 0.3 opacity)
2. **Camera smooth-orbits** to center on selected performer via `camera-controls` `setTarget()`
3. **Other performers** remain visible at normal opacity (not dimmed) — formation context preserved

When "All" or deselected:
- Ground rings hidden on all performers
- Camera returns to default orbit target (center of formation)

## Performer Colors (Canonical)

```
Index 0: #3b82f6 (Blue)
Index 1: #ef4444 (Red)
Index 2: #8b5cf6 (Purple)
Index 3: #f97316 (Orange)
Index 4: #10b981 (Emerald)
Index 5: #ec4899 (Pink)
Index 6: #06b6d4 (Cyan)
Index 7: #eab308 (Yellow)
```

Source: `src/lib/shared/3d/constants/performer-colors.ts`

## Existing State Infrastructure

All per-performer state already exists in `AvatarInstanceState`:

| Property | Type | Setter |
|---|---|---|
| `settings.effects` | `Set<EffectId>` | via Set mutation |
| `settings.prop` | `PropType` | `setProp(type)` |
| `settings.staffLengthCm` | `number \| null` | `setStaffLengthCm(cm)` |
| `settings.effortId` | `EffortId` | `setEffort(id)` |
| `customBluePlane` | `Plane` | `setHandPlane(hand, plane)` |
| `customRedPlane` | `Plane` | `setHandPlane(hand, plane)` |

Source: `src/lib/shared/3d/state/avatar-instance-state.svelte.ts`

Selection state: `viewer.selectedPerformerIndex` (null = All, number = individual)
Source: `src/lib/shared/3d/state/viewer-3d-state.svelte.ts`

## Key Files to Modify

| File | Change |
|---|---|
| `src/lib/shared/sequence-viewer/components/RightRail.svelte` | Remove "performers" chip from CHIPS_3D array |
| New: `src/lib/shared/3d/components/controls/PerformerRail.svelte` | The new rail component |
| New: `src/lib/shared/3d/components/controls/PerformerRailPopover.svelte` | Per-performer popover |
| `src/lib/shared/3d/components/Viewer3DCanvas.svelte` | Mount PerformerRail |
| `src/lib/shared/3d/context/viewer-3d-context.ts` | Add `selectedPerformerPopover` state if needed |
| Existing: `src/lib/shared/3d/components/controls/PerformerChipStrip.svelte` | May be retired or repurposed |

## Open Questions

1. **Layout choice** — User comparing A/B/C in playground. Decision pending.
2. **Chip strip retirement** — Does PerformerChipStrip inside the existing PerformerPopover get removed entirely, or does it remain as a secondary access point?
3. **Exclusive popover behavior** — Should opening a performer rail popover close any open right rail popover (and vice versa)?
4. **Mobile / narrow viewport** — Does the rail collapse or move on small screens?
