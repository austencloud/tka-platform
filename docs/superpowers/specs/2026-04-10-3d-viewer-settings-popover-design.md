# 3D Viewer Settings Popover Redesign

**Date:** 2026-04-10
**Status:** Design approved, ready for implementation plan
**Target file:** `src/lib/shared/3d/components/Viewer3DGearPopover.svelte`
**Related files:** `src/lib/shared/3d/components/Viewer3DViewPresets.svelte`, `src/lib/shared/3d/components/controls/PlaneModeToggle.svelte`

## Problem

The existing popover has three visual issues and one structural one:

1. **Inconsistent typography.** Different font sizes, weights, and treatments across sections — some 9px, some 10px, some 14px. The Hand Planes section in particular used 14px/44px controls designed for standalone UI, oversized for a popover.
2. **Dropdown selectors.** The hand plane pickers used native `<select>` dropdowns, which the user dislikes.
3. **Wasted horizontal space.** Grid Planes were stacked vertically as three rows despite having plenty of horizontal room.
4. **Repetition and conceptual overlap.** The same three plane names (Wall, Wheel, Floor) appeared in three different places: Grid Planes (visibility), Blue Hand Planes (assignment), Red Hand Planes (assignment). Three copies of the same vocabulary doing related but distinct things.

## Design Decisions

### 1. Merge Grid Planes and Hand Planes into one unified Planes matrix

Visibility and hand assignment were previously separate sections. They now share a single three-row matrix — one row per plane. Each row contains all the controls for that plane (visibility + blue hand assignment + red hand assignment).

**Why:** Eliminates the three-copies-of-the-same-vocabulary problem. One row per plane means "Wall" appears exactly once, and everything about the Wall plane lives in that row.

### 2. Visibility follows hand assignment (with escape hatch)

If a hand is assigned to a plane, that plane is visible automatically — the user shouldn't have to remember to also toggle visibility. But the user can still force-show a plane that has no hand on it, for reference.

**Why:** The user confirmed this behavior is the logical default. It removes the need to coordinate two separate controls that are usually in sync.

### 3. The plane color dot IS the visibility toggle

Rather than a separate visibility column with an eye icon or switch, the plane color dot on the left of each row is itself the clickable toggle. This eliminates a whole column and puts the control right where the user identifies the plane.

**Why:** The round dot matches the round hand slots visually (consistent language), eliminates a column, and removes ambiguity about what the control does. The user specifically rejected square buttons and iOS-style switches.

### 4. Remove the DW (Dual Wheel) toggle entirely

DW is derived from hand plane assignments, not configured:
- Both hands on Wheel → dual lateral rendering (the only spatially coherent interpretation — both hands can't occupy a single wheel plane without overlapping inside the avatar)
- Both hands on Wall → single wall plane (hands at different positions)
- Both hands on Floor → single floor plane
- Mixed → each hand renders on its assigned plane

**Why:** DW isn't a user choice — it's a rendering consequence. Making it a derived state rather than a manual toggle is strictly cleaner.

### 5. Remove the ALL beats / This beat scope toggle from the popover

Per-beat plane editing through a popover is awkward: open, toggle scope, change plane, close, navigate to next beat, repeat. The popover is not the right channel for per-beat work. This popover controls sequence-wide plane assignments only. If per-beat plane overrides become important, they'll need their own dedicated UI at the beat-editing level.

**Why:** Correct channel for the interaction. Simplifies the popover. Removes a control that had touch-target problems.

### 6. Camera presets become a 2×3 grid

Six presets in one row felt cramped; each button was too narrow. A 2×3 grid gives each button more room and creates a visual rhythm that matches the three-row plane matrix below it — the whole popover feels grid-consistent.

### 7. Typography normalized — title case, consistent sizes

All section labels use the same treatment (10px, uppercase, 1.2px letter-spacing, 60% white). All body labels use the same treatment (13px, medium weight, 88% white). Title case for plane names.

## Visual Design

### Overall structure

```
┌──────────────────────────────┐
│ CAMERA                        │
│ ┌──────┬──────┬──────┐        │
│ │Front │ Back │ Top  │        │
│ ├──────┼──────┼──────┤        │
│ │ Left │Right │ 3/4  │        │
│ └──────┴──────┴──────┘        │
│                               │
│ ─────────────────────────     │
│                               │
│ PLANES                        │
│ ┌─────────────────────────┐   │
│ │ ● Wall       ●B   ●R    │   │
│ ├─────────────────────────┤   │
│ │ ○ Wheel      ○    ○     │   │  (dimmed — hidden)
│ ├─────────────────────────┤   │
│ │ ● Floor      ○    ○     │   │
│ └─────────────────────────┘   │
│                        [↺]    │
└──────────────────────────────┘
```

### Popover container

- Width: 288px
- Padding: 12px
- Border-radius: 10px
- Background: `rgba(14, 14, 24, 0.95)`
- Border: 1px solid `rgba(255, 255, 255, 0.12)`
- Backdrop filter: blur(12px)

### Camera section

- Section label: "Camera" — 10px uppercase, 1.2px letter-spacing, `rgba(255,255,255,0.4)`
- Preset grid container: 3-column CSS grid, 3px gap, 4px padding, rounded 8px with dark background + faint border
- Preset order (row-major): Front, Back, Top, Left, Right, 3/4
- Button: min-height 36px, 13px font, 500 weight, transparent background
- Active button: white text, `rgba(255,255,255,0.12)` background, `rgba(255,255,255,0.2)` border

### Planes section

Separated from Camera by a 1px divider (`rgba(255,255,255,0.08)`) with 12px margin + 10px top padding.

- Section label: "Planes"
- Rows: Wall / Wheel / Floor (in that order)
- Matrix container: flex column, 4px gap between rows
- Each row: flex row, align center, padding `6px 12px`, min-height 48px, gap 10px
- Row background: `rgba(0,0,0,0.45)` default, `rgba(255,255,255,0.04)` when a hand is on the plane ("with-hand" state)
- Row border: 1px, `rgba(255,255,255,0.08)` default, `rgba(255,255,255,0.14)` with-hand
- Row border-radius: 8px
- Hidden rows (no hand, not force-shown) have `opacity: 0.55`

### Row internal layout

Two flex groups with flex-grow on the spacer between them:

- **Left group** (`.plane-left`, flex: 1): plane toggle (32px round) + plane label (13px), 10px gap
- **Right group** (`.plane-right`, flex-shrink: 0): blue hand slot + red hand slot, 6px gap

### Plane toggle (replaces the old color dot + separate visibility control)

- Size: 32×32px
- Round, 2px solid border
- `--dot-color` CSS variable per plane:
  - Wall: `#b366ff` (purple)
  - Wheel: `#4a90d9` (blue)
  - Floor: `#4ad99d` (green)

**Three states:**

1. **Visible (force-shown).** Radial-gradient fill using the plane color (55% color center, 60%-darkened color edge), border matches color, 12px soft box-shadow glow in the plane color at 50% opacity. Clickable. Hover: `transform: scale(1.08)`.
2. **Hidden.** Transparent background, border is the plane color at 50% opacity. No shadow. Clickable. Hover: `transform: scale(1.08)`.
3. **Implicit (locked by hand assignment).** Visually identical to Visible, but with a small 7px white dot in the center at 65% opacity (communicates "this is locked by a hand being on this plane"). Not clickable — `cursor: default`, no hover effect.

### Hand slots (blue / red)

- Size: 32×32px
- Round, 2px dashed border when empty
- Empty state colors:
  - Blue: `rgba(74, 144, 217, 0.4)` border
  - Red: `rgba(217, 74, 74, 0.4)` border
- Filled state: radial gradient, 2px solid matching color border, 10px box-shadow glow
  - Blue filled: `radial-gradient(circle, #5aa0e0 55%, #3a7ac0)` + glow
  - Red filled: `radial-gradient(circle, #e95959 55%, #c93939)` + glow
- Hover (empty): border `rgba(255,255,255,0.5)`
- Click semantics: clicking an empty slot moves the matching hand to this plane; that hand leaves its previous plane

### Reset button

- 32×32px round icon button, lucide-style undo icon, 13px icon size
- Transparent background, 1px `rgba(255,255,255,0.08)` border
- Default color `rgba(255,255,255,0.35)`, hover `0.7`
- Bottom-right of the Planes section, 6px top margin
- **Only rendered when state is non-default** (any hand not on Wall, or any plane force-shown that wouldn't be visible by default)
- Resets all hand assignments to Wall and clears force-shown state

## Interaction Behavior

### Clicking a plane toggle

| Current state | Click → | New state |
|---|---|---|
| Hidden (no hand) | → | Force-shown |
| Force-shown (no hand) | → | Hidden |
| Implicit (hand on plane) | → | No-op (locked) |

### Clicking a hand slot

| Target state | Click action |
|---|---|
| Empty hand slot on a different plane | Move that hand from its current plane to this one |
| Filled hand slot on its current plane | No-op (can't unassign a hand from all planes — it has to be somewhere) |

**Side effect:** When a hand leaves a plane, if that plane has no other hand AND is not force-shown, it becomes hidden and its row dims to 55%. When a hand arrives on a plane, that plane becomes implicit/visible and its row brightens.

### Clicking the reset button

Sets all hand assignments to Wall (both blue and red). Clears force-shown state. The button hides itself (because state is now default).

## Derived State: DW / PlaneMode

The existing `PlaneMode` enum stays in the underlying state model but is no longer directly controlled from this popover. It is derived:

```
if (bluePlane === Wheel && redPlane === Wheel) → PlaneMode.DUAL_WHEEL
else → PlaneMode.WALL (or whatever single-plane mode the renderer defaults to)
```

Any code that reads `PlaneMode` to decide rendering should continue to work. The popover no longer exposes this as a user-facing toggle.

## Removed Features

This redesign removes three user-facing controls from the popover. Their state is either derived, sequence-wide-only, or punted to a future UI:

1. **DW button** — derived from hand plane assignments.
2. **ALL beats / This beat (beatEditMode) toggle** — popover is sequence-wide only. Per-beat editing is out of scope for this popover.
3. **Reset's "undo beat overrides" behavior** — without beat scope, the reset button only resets sequence-wide state.

**Compatibility note:** The underlying state model (`avatarState.beatEditMode`, `avatarState.setBeatHandPlane`, `avatarState.hasBeatOverrides`) still exists. Removing these from the popover does not delete them from the model — it just means no control in this popover exposes them. If a beat with per-beat overrides is loaded, the popover will display the sequence-wide defaults, not the beat overrides. Any beat overrides persist in the model until cleared by other means.

**Open question for the implementation plan:** when the user changes a sequence-wide plane assignment via this popover, what should happen to existing per-beat overrides for that hand?

- **Option A (preserve overrides):** Sequence-wide becomes the new default, but beats that explicitly overrode this hand's plane keep their overrides. This respects the mental model that beat overrides are intentional exceptions.
- **Option B (clear overrides):** Changing sequence-wide wipes all beat overrides for that hand. Simpler mental model ("the popover controls everything") but destroys deliberate per-beat work.
- **Option C (indicator + preserve, with a way to clear):** Preserve overrides (Option A), but if any beats have overrides, show a subtle indicator on the popover (e.g., a badge on the reset button) and have the reset button clear sequence-wide AND beat overrides.

Recommend Option C — preserve by default (safest), indicate their existence so the user knows they're there, and make reset the explicit "clear everything" action.

## Out of Scope

The following came up during brainstorming but are explicitly not part of this redesign:

- **Per-beat plane editing UI.** If this becomes a priority, it deserves a dedicated interface at the beat-editing level (e.g., right-click a beat to open a plane editor, or a beat-level sidebar). Not this popover.
- **Continuous plane transitions driven by body rotation.** Austen's insight that planes are inherently performer-relative and shift continuously as the body turns is captured in `memory/project_performer_relative_planes.md`. This would fundamentally change how planes are modeled in the sequence engine and is worth exploring in a separate session with a dedicated prompt.

## Implementation Notes

### Component changes

- **`Viewer3DGearPopover.svelte`** — heavy rewrite. New layout, new plane matrix, remove DW-related controls, remove scope toggle, remove Grid Planes section (merged into unified Planes section).
- **`Viewer3DViewPresets.svelte`** — update to 2×3 grid layout (currently a single horizontal bar). Needs a `grid` variant alongside the existing `compact` and `flat` variants, or the bar layout can be switched to 2×3 when inside the popover.
- **`PlaneModeToggle.svelte`** — this component becomes much smaller. Most of its current surface area (dropdowns, DW, beat-mode toggle, override badge) goes away. It might not even need to exist anymore — the logic can fold directly into `Viewer3DGearPopover.svelte` as a single matrix component. **Decision for implementation plan:** probably inline the matrix into the gear popover and delete `PlaneModeToggle.svelte` (or reduce it to a minimal hand-assignment helper).
- **Other consumers of `PlaneModeToggle.svelte`.** There is a separate usage in `src/lib/shared/3d/components/panels/SceneOverlayControls.svelte` that was already failing type checks during earlier edits (`bluePlane, redPlane, sequenceBluePlane...` missing). The implementation plan needs to either update that consumer to match the new shape or decide whether it should use a different component entirely.

### State model

No new state is required. Existing state on `avatarState`:
- `customBluePlane`, `customRedPlane` — sequence-wide plane assignments per hand (already exists)
- `visiblePlanes` on `viewer3DState` — the set of planes currently shown (already exists)
- `setHandPlane(hand, plane)` — sequence-wide assignment (already exists)
- `togglePlane(plane)` — visibility toggle (already exists)

New derived state on `viewer3DState` or a selector:
- `isImplicitlyVisible(plane: Plane): boolean` — true if either hand is on that plane
- `isForceShown(plane: Plane): boolean` — true if the plane is in `visiblePlanes` AND no hand is on it
- `displayPlaneMode`: derived PlaneMode based on hand assignments (for renderer consumption if needed)

### CSS

All new styles scoped to the component. Uses project CSS variables where available:
- `--min-touch-target-compact` (32px fallback) — used for hand slots, plane toggles, reset button
- Plane colors should come from `PLANE_COLORS` constant (already defined in `src/lib/shared/3d/domain/enums/Plane.ts`) rather than being hardcoded

### Accessibility

- All interactive elements are `<button>` elements
- `aria-label` on each: e.g., "Wall plane — visible, blue hand assigned, red hand assigned"
- `aria-pressed` on plane toggles and hand slots to reflect state
- The implicit (locked) state uses `aria-disabled="true"` on the plane toggle
- Keyboard navigation via native tab order; Enter/Space activates buttons
- Escape closes the popover (already implemented)

## Success Criteria

- Visual consistency: all typography sized/weighted identically within the popover
- No dropdowns anywhere
- All interactive elements ≥ 32px touch target
- No repeated vocabulary — "Wall" / "Wheel" / "Floor" each appear exactly once in the popover
- DW toggle is gone from the UI
- Beat scope toggle is gone from the UI
- Clicking a hand slot moves that hand; clicking a plane toggle toggles force-show (when no hand is on the plane)
- Hidden planes are visually obvious (55% row opacity)
- The whole popover fits in ~290px wide and renders cleanly

## Testing Plan

- **Manual visual verification** via Chrome DevTools MCP or a browser session — compare to the final mockup at `.superpowers/brainstorm/*/content/final-tight.html`. The mockup is the source of truth for spacing, sizing, and visual states.
- **Interaction testing** — click each plane toggle in each state, click each hand slot to confirm movement + plane visibility updates, click reset to confirm it restores defaults and hides itself.
- **State transitions** — assign both hands to Wheel and verify the renderer switches to dual-lateral mode (derived PlaneMode = DUAL_WHEEL). Move one hand away and verify it switches back.
- **No automated tests** required for this redesign — it's a UI component with no silent-bug risk.
