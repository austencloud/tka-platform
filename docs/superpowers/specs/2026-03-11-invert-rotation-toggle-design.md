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
- Disabled when `showRotation` is false (float motions / 0 turns)

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

Both modes are two rows. The invert button spans a comfortable width since it's the only button in its row.

### Interface

The component's `Props` interface is unchanged. `onRotationChange` callback stays the same — the component computes the opposite direction internally:

```typescript
function handleInvert(e: MouseEvent) {
  e.stopPropagation();
  if (turns === "fl") return;
  const opposite = rotationDirection === RotationDirection.CLOCKWISE
    ? RotationDirection.COUNTER_CLOCKWISE
    : RotationDirection.CLOCKWISE;
  onRotationChange(opposite);
}
```

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
