# Cell Editor Visual Cohesion Pass

**Date:** 2026-04-05
**Feedback:** dA0zLT7i1QR5yrxR7HiJ
**Module:** compose / arrange
**Status:** Design approved

---

## Problem

The cell editor panel was built piecemeal across 12+ subagent tasks. Each section has its own visual language — different border radii, spacing rhythms, active state treatments, and button styles. The effects and effort sections require 2 clicks to reach the matrix (chips → "Customize per tip" → matrix drawer). The layer section looks like a SaaS dashboard — flat gray on darker gray with no personality.

## Decisions

### 1. Effects Flow: Merged Section (Option B)

Clicking the "Effects" chip in ChipGrid opens a single merged section containing:

1. **Effect pill chips** (None, Fire, Charcoal, LED, Trails) — same as current EffectsSection, acting as quick-apply. Clicking a chip applies that effect to all channels at the current scope.
2. **Scope selector** (Cell / Hand / Tip) — inline below the chips.
3. **Channel rows** — one row per channel at the current scope. Cell scope = 1 row ("Both"). Hand scope = 2 rows (Blue, Red). Tip scope = N rows (per tip point).

This replaces the current two-component flow (EffectsSection → EffectMatrixDrawer). One component, one click, progressive disclosure via scope toggle.

**Cell scope is the default.** At cell scope, there is one channel row — the section is barely larger than the current simple chips. Switching to Hand or Tip scope expands the channel rows. The pill chips always act as quick-apply-to-all regardless of scope.

**Trail mode sub-group** still appears when Trails is selected, same as current behavior.

### 2. Effort Flow: Same Merged Treatment

The EffortSection + EffortMatrixDrawer get the identical merged treatment:

1. **Effort pill chips** (the 8 effort types) — quick-apply.
2. **Scope selector** (Cell / Hand / Tip).
3. **Channel rows** with effort buttons in a 4x2 grid per channel.

Same component pattern, same progressive disclosure.

### 3. Layer Card: Horizontal Prop-Color Gradient

The layer card background changes from flat `rgba(255,255,255,0.04)` to a horizontal gradient derived from the layer's prop colors:

```css
background: linear-gradient(to right, rgba(leftColor, 0.08), rgba(rightColor, 0.08));
```

For the default blue/red pairing: `linear-gradient(to right, rgba(59,130,246,0.08), rgba(239,68,68,0.08))`.

Prop color dots get subtle matching glow: `box-shadow: 0 0 6px rgba(color, 0.25)`.

When there are multiple layers (tunnel mode), each layer card uses its own prop color pairing for the gradient, creating visual distinction between layers.

### 4. Unified Button System

All interactive elements across the panel use the same treatment hierarchy:

**Tier 1: Pill chips** (ChipGrid controls)
- `border-radius: 22px`
- `min-height: 44px`
- `background: rgba(255,255,255,0.05)`
- `border: 1px solid rgba(255,255,255,0.08)`
- Active state: `color-mix(in srgb, var(--chip-color) 12%, transparent)` background, `35%` border

**Tier 2: Card elements** (layer cards, action buttons, matrix channel rows, footer buttons, close button, Add Layer)
- `border-radius: 10px` (standardized — currently varies from 4px to 10px)
- Small icon buttons: `border-radius: 8px`, visual size `36px`, wrapped in a `44px` min touch target (padding or min-width/min-height on the clickable element itself)
- `background: rgba(255,255,255,0.03-0.04)`
- `border: 1px solid rgba(255,255,255,0.06)`
- Hover: `background: rgba(255,255,255,0.08)`, `border-color: rgba(255,255,255,0.12)`

**Semantic tinting** (same across both tiers):
- Danger/remove: red tint at 5-8% opacity
- Add/create: green tint at 4% opacity
- Accent/active: purple tint at 12% opacity

### 5. Add Layer Button

Drops the heavy dashed border and saturated green treatment. Uses the standard card system:

```css
background: rgba(16, 185, 129, 0.04);
border: 1px solid rgba(16, 185, 129, 0.1);
color: rgba(16, 185, 129, 0.55);
border-radius: 10px;
min-height: 44px;
```

No dashed borders anywhere in the panel.

### 6. Header Polish

- **Badge** (layer count): accent-tinted purple instead of generic gray. `background: rgba(139,92,246,0.12)`, `color: rgba(167,139,250,0.8)`.
- **Close button**: gets card-style background + border instead of floating transparent. Same 10px radius card treatment.
- **Header divider**: subtle accent tint. `border-bottom: 1px solid rgba(139,92,246,0.12)` instead of raw white.

### 7. Footer

Dialed back to match the quieter system:
- Copy All: `background: rgba(255,255,255,0.03)`, `border: 1px solid rgba(255,255,255,0.06)`, `color: rgba(255,255,255,0.6)`
- Clear All: `background: rgba(239,68,68,0.06)`, `border: 1px solid rgba(239,68,68,0.1)`, `color: rgba(239,68,68,0.6)`

---

## Component Changes

### New Component: `UnifiedEffectsSection.svelte`
Replaces both `EffectsSection.svelte` and `EffectMatrixDrawer.svelte`. Contains:
- Effect pill chips (quick-apply)
- Scope selector (Cell/Hand/Tip)
- Channel rows with effect buttons
- Trail mode sub-group (conditional)

### New Component: `UnifiedEffortSection.svelte`
Replaces both `EffortSection.svelte` and `EffortMatrixDrawer.svelte`. Contains:
- Effort pill chips (quick-apply)
- Scope selector (Cell/Hand/Tip)
- Channel rows with effort buttons (4x2 grid)

### Modified: `CellEditorPanel.svelte`
- Remove `effectMatrixOpen` and `effortMatrixOpen` state
- Replace conditional EffectsSection/EffectMatrixDrawer with single UnifiedEffectsSection
- Replace conditional EffortSection/EffortMatrixDrawer with single UnifiedEffortSection
- Update header badge styling
- Update close button styling
- Update footer button styling
- Update header divider color

### Modified: `LayerSection.svelte`
- Layer card: horizontal gradient background from prop colors
- Prop dots: add glow effect
- Action buttons: standardize to 8px radius card treatment
- Add Layer button: drop dashed border, use solid card system
- Paste button: same card system with purple tint

### Modified: `ChipGrid.svelte`
- No structural changes — chips already use the right pattern
- Verify min-height: 44px on all chips

### Removed after migration:
- `EffectsSection.svelte` (merged into UnifiedEffectsSection)
- `EffectMatrixDrawer.svelte` (merged into UnifiedEffectsSection)
- `EffortSection.svelte` (merged into UnifiedEffortSection)
- `EffortMatrixDrawer.svelte` (merged into UnifiedEffortSection)

---

## Files Touched

| File | Change |
|------|--------|
| `cell-editor/sections/UnifiedEffectsSection.svelte` | **New** — merged effects + matrix |
| `cell-editor/sections/UnifiedEffortSection.svelte` | **New** — merged effort + matrix |
| `cell-editor/CellEditorPanel.svelte` | Header, footer, section wiring |
| `cell-editor/LayerSection.svelte` | Gradient card, button styling |
| `cell-editor/ChipGrid.svelte` | Touch target verification |
| `cell-editor/sections/EffectsSection.svelte` | **Delete** |
| `cell-editor/sections/EffectMatrixDrawer.svelte` | **Delete** |
| `cell-editor/sections/EffortSection.svelte` | **Delete** |
| `cell-editor/sections/EffortMatrixDrawer.svelte` | **Delete** |

---

## What's NOT Changing

- ChipGrid structure and chip definitions (already work well)
- TransformSection, SpeedSection, ColorsSection, OffsetSection, DisplaySection (not part of this pass)
- Cell editor panel state management (expandedSection toggle pattern stays)
- Any business logic — this is purely visual/UX

---

## Verification

- All interactive elements meet 44px minimum touch target
- All transitions respect `prefers-reduced-motion`
- Effects/effort assignments produce the same data model output (TipEffectMap, TipEffortMap)
- Scope switching preserves existing collapse/expand logic from the current matrix drawers
- Layer card gradient adapts to custom prop color pairings (not just blue/red)
