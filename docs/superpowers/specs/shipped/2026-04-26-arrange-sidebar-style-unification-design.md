# Arrange Sidebar Style Unification

## Problem

The CellEditorPanel in the Arrange tab sidebar has 3 components (ChipGrid, LayerSection, CellEditorPanel footer) each with independently-designed button styles. This produces:

- 3 `border-radius` values (22px pills, 10px rects, 8px squares)
- 6+ background alpha recipes with no shared tokens
- No visual grouping between chip categories (9 chips in a flat grid)
- Inconsistent active states (blue chip nearly invisible on dark BG vs orange/red popping)
- Chevron present on expandable chips but not toggles, with no other visual cue to distinguish them

## Approach: Unified Pill System + Labeled Groups

Two-tier button system with shared design tokens and container-query-driven responsive layout.

## Design Token System

Shared CSS custom properties on `.cell-editor-panel`, inherited by all children. Replaces scattered `rgba()` recipes across 3 components.

```
Shape:
  --chip-radius: 22px          (pills: all chips)
  --action-radius: 10px        (full-width action buttons)
  --badge-radius: 4px          (header badges)

Surfaces (3 intensities):
  --surface-idle:   rgba(255,255,255, 0.05)
  --surface-hover:  rgba(255,255,255, 0.08)
  --surface-active: 12%        (color-mix percentage with chip color)

Strokes (3 intensities):
  --stroke-idle:    rgba(255,255,255, 0.08)
  --stroke-hover:   rgba(255,255,255, 0.15)
  --stroke-active:  35%        (color-mix percentage with chip color)

Spacing (cqi-based):
  --chip-gap:     clamp(6px, 1.5cqi, 8px)
  --chip-py:      8px
  --chip-px:      clamp(12px, 3cqi, 14px)
  --group-gap:    clamp(10px, 2.5cqi, 14px)
  --section-gap:  clamp(12px, 3cqi, 20px)
```

## Two-Tier Button System

### Tier 1: Chips (pill shape)

All property controls use the same pill shape. Two behavioral subtypes distinguished by a chevron:

| Subtype | Chevron | Behavior | Examples |
|---------|---------|----------|----------|
| Expandable | Yes (`>`, rotates on expand) | Opens a section below | Transform, Speed, Effects, Colors, Effort, Offset, Display |
| Toggle | No chevron | Immediate action | Blue visibility, Red visibility |

Shared base styles (idle, hover, active, muted, expanded). Active state uses `color-mix(in srgb, var(--chip-color) var(--surface-active), transparent)` for background and stroke — same formula everywhere.

Blue chip fix: bump `--chip-color` from `#2563eb` to `#60a5fa` (Tailwind blue-400) so it reads at 35% opacity on dark backgrounds, matching the visibility of orange and red chips.

### Tier 2: Action buttons (full-width rounded rect)

Three action buttons, all using `--action-radius` and full-width layout:

| Button | Color | Purpose |
|--------|-------|---------|
| Add Layer | Emerald tint | Primary creative action |
| Copy All | Neutral (white alpha) | Non-destructive bulk action |
| Clear All | Red tint | Destructive bulk action |

These keep their current color semantics but adopt shared token values for background/stroke alphas instead of custom recipes.

## Chip Grouping

Chips grouped into 3 labeled categories with micro-headers. Each group is a flex-wrap row with a small uppercase label above it.

### Groups

1. **View** — Effects, Blue, Red
   - What you see in the viewport
   - Effects chip expands to UnifiedEffectsSection; Blue/Red are toggles

2. **Timing** — Speed, Offset
   - Playback timing controls
   - Both expand to their respective sections

3. **Style** — Transform, Colors, Effort, Display
   - Properties of the sequence/cell
   - All expand to their respective sections

### Micro-header styling

Same style as existing `LAYERS` header in LayerSection:
- Font: `clamp(0.65rem, 2cqi, 0.75rem)`
- Weight: 600
- Color: `var(--theme-text-dim)`
- Transform: uppercase
- Letter-spacing: 0.5px

No extra border or background — just the label text with standard `--chip-gap` below it before the chips.

## Responsive Layout

### Container query setup

CellEditorPanel already has `container-type: inline-size` with `container-name: celleditorpanel`. Children already use `cqi` units for some values.

### Breakpoint behavior

The sidebar ranges from 260px to 360px. At the narrowest widths, the chip grid needs to gracefully reflow.

```
@container celleditorpanel (max-width: 280px):
  - Chips: min-width increases so they stack 1 per row instead of wrapping awkwardly
  - Action buttons: padding reduces
  - Group labels: font-size drops to minimum clamp value

Default (280px+):
  - Chips: flex-wrap, natural sizing, 2-3 per row depending on label length
  - Current layout, but with consistent tokens
```

### Mobile

Currently hidden behind a placeholder (`<768px`). This spec does not change mobile layout — it's scoped to the sidebar panel at its actual rendered widths (260–360px). When mobile Arrange is built (Phase B per ArrangeTab comment), these container-query-based styles will adapt automatically since they're width-driven, not viewport-driven.

## Files Changed

| File | Change |
|------|--------|
| `CellEditorPanel.svelte` | Add token custom properties to `.cell-editor-panel`. Update footer button styles to use tokens. |
| `ChipGrid.svelte` | Restructure flat chip list into 3 grouped sections with micro-headers. Update all chip styles to use tokens. Fix blue chip color. |
| `LayerSection.svelte` | Update Add Layer / Paste button styles to use shared tokens. |
| `UnifiedEffectsSection.svelte` | Update `.chip` and `.chip-grid` styles to inherit tokens instead of re-declaring. |
| `UnifiedEffortSection.svelte` | Same as above — inherit tokens. |
| `DisplaySection.svelte` | Same — inherit tokens for any pill-style controls. |

## Files NOT Changed

- `ArrangeSidebar.svelte` — wrapper layout is fine
- `TransformSection.svelte` — internal transform buttons are a different UI pattern (icon grid), not part of this unification
- `SpeedSection.svelte`, `ColorsSection.svelte`, `OffsetSection.svelte` — expanded section internals are out of scope unless they use chip-style pills (check during implementation)

## Success Criteria

1. Panel uses exactly 2 `border-radius` values: 22px (chips) and 10px (action buttons)
2. Zero hard-coded `rgba(255,255,255, 0.0X)` background/stroke values in chip or action button styles — all reference tokens
3. Chips visually grouped into 3 labeled categories
4. Blue visibility chip reads as clearly active as red and orange chips
5. Consistent at 260px, 300px, and 360px sidebar widths
