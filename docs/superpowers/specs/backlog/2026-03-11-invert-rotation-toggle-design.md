---
status: backlog
value: 3
effort: S
remaining: Single Invert button replacing CW/CCW pair
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-04-26
---
# Invert Rotation Toggle — Design Spec

**Date:** 2026-03-11
**Scope:** `PropTurnsControl.svelte` (step editor rotation controls)

## Problem

The step editor currently shows two separate CW/CCW buttons per hand for rotation direction. This requires the user to understand which direction they want and pick the right button. A single "Invert" toggle is simpler — fewer decisions, bigger touch target, and teaches the "invert" concept from the TKA domain.

## Design

### Button Behavior

- Single button per hand replaces the two CW/CCW buttons
- Label: always "Invert"
- Icon: shows **current** direction — `fa-rotate-right` when CW, `fa-rotate-left` when CCW
- Tap: flips to the opposite direction
- Disabled when `showRotation` is false (controlled by parent — covers float motions and any other case where rotation isn't applicable). The `showRotation` prop is the single source of truth for disable state; no internal `turns === "fl"` guard needed.

### Layout

**Normal mode (desktop):**
```
    [-]  [turns]  [+]
       [ ↻ Invert ]
```

**Compact mode (mobile):**
```
    [-]  [turns]  [+]
       [ ↻ Invert ]
```

Both modes become two rows. Note: compact mode was previously a single row (`[CW] [-] [turns] [+] [CCW]`). This is an intentional layout change — two compact rows with a centered invert button below is cleaner than cramming everything into one line.

### Interface

The component's `Props` interface is unchanged. `onRotationChange` callback stays the same — the component computes the opposite direction internally:

```typescript
function handleInvert(e: MouseEvent) {
  e.stopPropagation();
  const opposite = rotationDirection === RotationDirection.CLOCKWISE
    ? RotationDirection.COUNTER_CLOCKWISE
    : RotationDirection.CLOCKWISE;
  onRotationChange(opposite);
}
```

Disable state is handled by the `showRotation` prop on the button's `disabled` attribute, not by an internal guard.

No changes needed in `TurnsEditMode.svelte` or any parent component.

### Styling

- Uses existing `--prop-color-rgb` CSS custom properties from parent card
- Active/current state: same highlight treatment as the old `.active` rotation button (stronger background, visible border, box-shadow)
- The button always appears "active" since it always shows the current state — the visual treatment communicates "this is your current direction"
- Follows existing `min-height: var(--min-touch-target, 44px)` for accessibility

## Files Changed

| File | Change |
|------|--------|
| `src/lib/features/create/shared/components/sequence-actions/PropTurnsControl.svelte` | Replace two CW/CCW buttons with single Invert toggle in both normal and compact modes |

## Files NOT Changed

- `TurnsEditMode.svelte` — parent interface unchanged
- `SequenceActionsPanel.svelte` — no involvement, this is per-beat editing
- Rotation direction pattern system (drawer, templates) — separate feature, unrelated
