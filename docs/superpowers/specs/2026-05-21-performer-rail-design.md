# Performer Rail — Design Spec

**Date:** 2026-05-21
**Status:** APPROVED — Bottom center selector + morphing right rail
**Playground:** `playground-performer-rail.html`

## Goal

Two-mode performer editing system:

1. **Bird's Eye Mode** — Managing the ensemble. Add/remove/move performers, choose formations, control scene and camera. Right rail shows scene-level chips.
2. **Performer Mode** — Editing one performer. Right rail morphs to show per-performer chips (Effects, Prop, Effort). Selected performer gets a ground ring glow in 3D. Camera orbits to center on them.

The bottom-center performer rail is the mode switch. The right rail adapts to show contextually relevant actions.

## Architecture: Two Surfaces, One Interaction

### Bottom Center Rail (WHO)

Horizontal chip strip centered at bottom of viewport. Always visible. Answers: "Which performer(s) am I working with?"

```
[All] | [1] [2] [3] ... | [+]
```

### Right Rail (WHAT)

Vertical chip stack at top-right. Already exists. Morphs its chip set based on selection state. Answers: "What can I do right now?"

**Bird's Eye chips** (no performer selected / "All"):

| Chip | Icon | Popover Content |
|------|------|-----------------|
| Formation | fa-users | Formation selector grid (existing `FormationSelector`) |
| Tempo | fa-gauge | BPM control (existing `TempoPopover`) |
| Camera | fa-video | Camera presets (existing `CameraPopover`) |
| Scene | fa-mountain-sun | Environment picker (existing `SceneSelectorPopover`) |
| Export | fa-arrow-up-from-bracket | Export options (existing `ExportPopover`) |

**Performer Mode chips** (one performer selected):

| Chip | Icon | Popover Content | Tint |
|------|------|-----------------|------|
| Effects | fa-wand-magic-sparkles | Effect toggle grid (16 effects) | Performer color |
| Prop | fa-staff-snake | Prop family grid + size slider + plane selector | Performer color |
| Effort | fa-wave-square | Effort palette (8 efforts) | Performer color |
| Camera | fa-video | Camera presets (persists across modes) | Default |
| Export | fa-arrow-up-from-bracket | Export options (persists across modes) | Default |

**Mode transition**: Chips animate out/in using the existing `slide` transition on `chip-wrap` (220ms, y-axis). Performer-mode chips tint their icon to the selected performer's color as a reinforcement cue.

## Bottom Center Rail Spec

### Position & Layout

```
Position:        absolute
Bottom:          12px
Left:            50%
Transform:       translateX(-50%)
Display:         flex (row)
Gap:             8px
Z-index:         20
```

### Chip Spec (matches right rail exactly)

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

### Pressed States

**Per-Performer:**
```
Border-color:    var(--performer-color)
Box-shadow:      0 4px 20px color-mix(in srgb, var(--performer-color) 30%, transparent)
Number color:    var(--performer-color)
Dot glow:        0 0 8px var(--performer-color)
```

**"All":**
```
Background:      color-mix(in srgb, #4a9eff 18%, transparent)
Border-color:    color-mix(in srgb, #4a9eff 50%, transparent)
```

### Tooltips

Appear ABOVE chip. Hidden when that chip is pressed.

### Separators

1px x 32px vertical lines between All/performers and performers/Add.

### Selection Behavior

- Clicking a performer chip: selects that performer (enters Performer Mode), right rail morphs
- Clicking same chip again: deselects (returns to Bird's Eye), right rail morphs back
- Clicking "All": deselects any individual, enters Bird's Eye
- Clicking a different performer: switches selection, right rail stays in Performer Mode but scopes to new performer

## Right Rail Morphing Spec

### Current Structure (RightRail.svelte)

The right rail already context-switches between 2D and 3D chip sets via `renderMode`. Adding a third dimension — selection state:

```typescript
const chips = $derived.by(() => {
  if (renderMode === '2d') return CHIPS_2D;
  if (viewer.selectedPerformerIndex !== null) return CHIPS_PERFORMER;
  return CHIPS_BIRDS_EYE;
});
```

### Chip Tinting in Performer Mode

Performer-specific chips (Effects, Prop, Effort) get their icon tinted to the selected performer's color:

```css
.rail-chip.performer-scoped {
  --chip-tint: var(--selected-performer-color);
}
.rail-chip.performer-scoped i {
  color: var(--chip-tint, rgba(255, 255, 255, 0.62));
}
```

### Transition Between Modes

Chips that leave: `slide` out (220ms, y-axis, existing transition)
Chips that arrive: `slide` in (220ms, y-axis, existing transition)
Chips that persist (Camera, Export): stay in place, no transition

## Popover Content — Performer Mode

### Effects Popover

Grid of 16 effect toggles (4 columns). Each toggle = icon + label. Active state uses effect's own color.

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

### Prop Popover

**Prop Family Grid** (4 columns, sectioned with labels):

| Section | Props |
|---|---|
| Staves & Clubs | Staff, Club, Fan |
| Curved Props | Buugeng, Trigeng, Hoop, Triad, Triquetra |
| Novelty | Chicken, DoubleStar, EightRings, ContactBall, Torch |
| Singles | Hand, Sword, Quiad |

Source: `src/lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte`

**Staff Length Slider:**
- Range: 80–180cm, default 120cm
- Accent: performer color
- Label + slider + value readout

**Plane Mode Selector** (3 primary planes):
- Wall, Wheel, Floor
- Source: `@austencloud/scene-3d` Plane enum (L8 planes only; fusion planes are L9)

### Effort Popover

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

Source: `src/lib/shared/effort/domain/effort-types.ts`

## Popover Content — Bird's Eye Mode

### Formation Popover

Formation selector grid (replaces the current PerformerPopover's formation tab):

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

Formations disabled when current performer count isn't in their valid counts list.

Source: `@austencloud/scene-3d` FormationPreset type + PRESET_VALID_COUNTS

## Popover Spec (Shared)

All popovers use the same glass styling:

```
Width:           420px
Background:      rgba(20, 22, 32, 0.82)
Backdrop-filter: blur(24px) saturate(150%)
Border:          1px solid rgba(255, 255, 255, 0.18)
Border-radius:   18px
Box-shadow:      0 12px 40px rgba(0, 0, 0, 0.55)
Animation in:    scale 220ms cubic-bezier(0.34, 1.56, 0.64, 1) from 0.92
Animation out:   scale 160ms cubic-bezier(0.55, 0, 1, 0.45) to 0.95
Position:        left of right rail chips (existing pattern)
```

### Popover Header (Performer Mode only)

```
Padding:         14px 16px 10px
Border-bottom:   1px solid rgba(255, 255, 255, 0.1)
Title:           "Performer N" — 11px / 700 / uppercase / 0.08em tracking
Badge:           Performer color dot (8px) + color name in performer color
```

## 3D Selection Behavior

When a performer chip is pressed:
1. **Ground ring** appears under performer (existing `DraggablePerformer.svelte` — `RingGeometry`, performer color, 0.3 opacity)
2. **Camera smooth-orbits** to center on selected performer via `camera-controls` `setTarget()`
3. **Other performers** remain visible at normal opacity — formation context preserved
4. **Right rail** morphs to Performer Mode chips

When "All" or deselected:
- Ground rings hidden
- Camera returns to default orbit target (center of formation)
- Right rail morphs back to Bird's Eye chips

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
| `src/lib/shared/sequence-viewer/components/RightRail.svelte` | Add CHIPS_PERFORMER and CHIPS_BIRDS_EYE arrays, derive active chip set from selection state. Remove "performers" chip. Add performer-color tinting for performer-mode chips. |
| New: `src/lib/shared/3d/components/controls/PerformerRail.svelte` | Bottom-center horizontal chip strip |
| New: `src/lib/shared/3d/components/controls/EffectsPopover.svelte` | Per-performer effects toggle grid |
| New: `src/lib/shared/3d/components/controls/PropPopover.svelte` | Per-performer prop/size/plane surface |
| New: `src/lib/shared/3d/components/controls/EffortPopover.svelte` | Per-performer effort palette |
| `src/lib/shared/3d/components/Viewer3DCanvas.svelte` | Mount PerformerRail in viewport |
| `src/lib/shared/3d/context/viewer-3d-context.ts` | Extend PopoverId with 'effects' \| 'prop' \| 'effort' \| 'formation' |
| Retire: `src/lib/shared/sequence-viewer/components/PerformerPopover.svelte` | Absorbed into morphing right rail + bottom rail |
| Retire: `src/lib/shared/3d/components/controls/PerformerChipStrip.svelte` | Replaced by PerformerRail |

## Deferred (Phase 2)

- **Multi-select** — Select 2+ performers, bulk-edit shared properties. Significant UX challenge (conflicting settings display, visual indication). Not needed for MVP.
- **Planes popover in Performer Mode** — Currently planes chip exists in Bird's Eye. Per-performer plane editing is handled inside the Prop popover (simpler surface). A dedicated Planes chip in Performer Mode could be added later if the Prop popover feels overloaded.
- **Mobile layout** — Adaptive rail placement for narrow viewports.
