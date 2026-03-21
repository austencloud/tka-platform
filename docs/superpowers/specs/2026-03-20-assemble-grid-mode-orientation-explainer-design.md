# Assemble Grid Mode Toggle & Orientation Explainer Enhancement

**Date:** 2026-03-20
**Status:** Draft
**Feedback:** HwbV44FcMguxtfhy5kUF

## Problem

1. The orientation explainer shows a made-up staff SVG at a fixed south position with incorrect rotation angles — it doesn't match what users see in real pictographs
2. Grid mode in the assemble flow is hardcoded to diamond — users can't build sequences using box or merged grids
3. The center position is never available as a starting point

## Design

Three related enhancements that share state and UI patterns.

---

### 1. Grid Mode & Center Controls in Assemble Flow

**New controls in the "tap starting point" phase:**

- **Grid mode pills**: Diamond / Box / Merged
  - Diamond: N/E/S/W (4 cardinal hand points)
  - Box: NE/SE/SW/NW (4 intercardinal hand points)
  - Merged: all 8 perimeter hand points (maps to existing `GridMode.SKEWED` enum value)
- **Center toggle**: independent chip/switch that adds the center point to any mode
  - Can be enabled with Diamond, Box, or Merged
  - Adds the center hand point at (475, 475)
  - Hit target entry: `{ location: GridLocation.CENTER, x: 475, y: 475, label: "Center" }`

**Mobile layout:**
- Grid mode pills in the header area alongside "Tap a starting point"
- Center toggle as a small chip below the grid mode pills
- Both controls hidden once a starting point is placed (phase transitions past "idle")

**Desktop layout:**
- Grid mode pills in the `BuilderInstructionHeader` area above the grid
- Center toggle as a chip beside or below the pills
- Same visibility rules as mobile

**State changes in `assemble-state.svelte.ts`:**
- `gridMode` already exists as `$state<GridMode>(GridMode.DIAMOND)` — just needs UI exposure
- Add `showCenter` as `$state<boolean>(false)`
- Add `setGridMode(mode: GridMode)` method — only callable when no steps exist (frozen once building starts)
- Add `setShowCenter(show: boolean)` method — same freeze rule
- `GridHitTargetCalculator.getHitTargets()` already supports DIAMOND/BOX/SKEWED — SKEWED maps to "Merged"
- Add center point to hit targets when `showCenter` is true

**Behavior:**
- Changing grid mode while in "idle" phase updates visible hand points immediately
- During "placing" phase (first point placed, no steps yet): grid mode can still change, but only if the current position is valid in the new mode. If not, reset to idle.
- Once any steps are recorded, grid mode and center toggle are frozen (hidden/disabled). Changing grid mid-sequence would invalidate existing step positions.
- `GridSvg.svelte` already handles diamond/box rendering. For merged mode, pass `GridMode.SKEWED` — the component already loads `skewed_grid.svg` which shows all 8 points. No overlay needed.

---

### 2. Enhanced Orientation Explainer

**The explainer drawer becomes a full interactive grid demo.**

**Layout (top to bottom):**
1. Title: "Orientation"
2. Description: "Orientation is which direction the prop faces relative to the center of the grid. Tap a point on the grid, then pick an orientation to see the prop rotate."
3. Grid mode pills (Diamond / Box / Merged) + center toggle — mirrors assemble controls
4. Full grid visualization:
   - Center point (ring + dot marker, always visible as reference)
   - Grid lines from center through hand points to outer boundary (thin strokes)
   - Hand point dots at correct positions from `grid-coordinates.ts`
   - The user's blue prop rendered at the selected location
   - Hand points are tappable to select location (min 44px touch targets at rendered size)
   - Selected hand point highlighted with accent ring
5. Orientation pills (in / out / clock / counter) — hidden when center location is selected (see center orientation note below)
6. "Got it" button

**ViewBox strategy:**
- Show the full 950x950 grid: `viewBox="0 0 950 950"` with padding
- The drawer is a bottom sheet — the grid renders at roughly 240-280px square on mobile, which is enough to tap individual hand points
- All hand points and outer boundary visible at all times regardless of selected location

**Prop rendering:**
- Fetch SVG directly from `/images/props/pictograph/{propType}.svg` where `propType = getSettings().bluePropType`
- Simple async fetch + inline SVG, with a circle fallback while loading
- Apply blue motion color by replacing `#2e3192` (staff base color) and `#000000` with the blue color
- No need for the full `PropSvgLoader` pipeline — the explainer doesn't need motion data or placement calculation

**Rotation calculation:**
- Import angle maps from `src/lib/shared/render/core/constants/rotation-maps.ts` (canonical source)
- Read directly: `DIAMOND_PROP_ANGLES[orientation][location]` and `BOX_PROP_ANGLES[orientation][location]`
- For merged mode: cardinal locations use diamond angles, intercardinal use box angles (same as skewed mode logic in `prop-placement.ts`)
- Type compatibility: cast scribe enum values to render-package string types when indexing into the maps (e.g., `orientation as string as RenderOrientation`). The string values are identical at runtime.
- CSS `transform: rotate(Xdeg)` applied to the prop group, where X comes from the angle map
- SVG convention: 0=east, 90=south, 180=west, 270=north (clockwise)

**Center location behavior:**
- When center is selected, the orientation pills (in/out/clock/counter) are hidden
- The angle maps return 0° for all four cardinal orientations at center — they'd all look the same
- Center uses centric orientations (centerN, centerE, etc.) which are a Level 4 concept
- For now, when center is selected: show the prop at 0° rotation with a note "Center orientation uses a different system (centric directions)" — no interactive rotation at center
- Full centric orientation support can be added later as a Level 4 unlock

**Description text adaptation:**
- Default: "Tap a point on the grid, then pick an orientation to see the prop rotate."
- The text should NOT reference "crossbar" or "thumb end" since different prop types have different reference indicators. Keep it generic.

**Default state:**
- Grid mode: Diamond
- Location: South (first hand point)
- Orientation: IN
- Center: off

---

### 3. Data Flow

```
Settings (bluePropType)
    ↓
fetch(`/images/props/pictograph/${propType}.svg`) → SVG content
    ↓
OrientationExplainer
    ├── gridMode state → which hand points to show
    ├── showCenter state → whether center point is available
    ├── selectedLocation state → which hand point has the prop
    ├── selectedOrientation state → in/out/clock/counter
    └── rotation = ANGLE_MAP[orientation][location]
```

**Shared between assemble flow and explainer:**
- Grid mode pills and center toggle are the same UI pattern in both places
- The explainer reads `gridMode` from its own local state (not the assemble state) since it's educational
- The assemble flow's grid mode is stored in `assemble-state.svelte.ts` and controls actual sequence building

---

## Files to Modify

| File | Change |
|------|--------|
| `assemble-state.svelte.ts` | Expose `gridMode` setter, add `showCenter` state, freeze logic |
| `InteractiveGrid.svelte` | Show center hit target when `showCenter` is true |
| `GridHitTargetCalculator.ts` | Add center point support to hit target generation |
| `BuilderControls.svelte` | Add grid mode pills + center toggle (mobile) during idle phase |
| `BuilderInstructionHeader.svelte` | Add grid mode pills + center toggle (desktop) during idle phase |
| `OrientationExplainer.svelte` | Full rewrite: grid viz, location picker, prop loader, angle maps |

## Files to Read (no changes)

| File | Used for |
|------|----------|
| `src/lib/shared/render/core/constants/rotation-maps.ts` | DIAMOND_PROP_ANGLES, BOX_PROP_ANGLES — rotation values |
| `src/lib/shared/render/core/constants/grid-coordinates.ts` | Hand point coordinates, outer points, center point |
| `src/lib/shared/application/state/app-state.svelte.ts` | `getSettings().bluePropType` |

## Edge Cases

- **Grid mode change with placed point**: If user placed at NORTH (diamond) and switches to Box, NORTH is invalid → reset to idle phase
- **Grid mode freeze**: Once `blueSteps.length > 0 || redSteps.length > 0`, grid mode and center toggle are disabled
- **Non-staff props**: Description text is generic (no "crossbar" references). The prop SVG itself shows whatever visual indicator that prop type has.
- **Touch targets in explainer**: Hand point tap areas must be at least 44px at rendered size. With a ~260px rendered grid for a 950-unit viewBox, each SVG unit ≈ 0.27px. Hit target circles need radius ≥ 80 SVG units (≈22px rendered). Supplement with invisible larger hit areas if needed.

## Out of Scope

- Interradial orientations (clockIn, clockOut, counterIn, counterOut) — Level 6 concept
- Full centric orientation picker (centerN, centerE, etc.) — Level 4 concept, noted as future addition
- Red prop display — explainer shows blue prop only
- Saving grid mode preference to Firebase settings — stays session-local for now
- `GridSvg.svelte` changes — merged mode uses existing `SKEWED` which already loads `skewed_grid.svg`
