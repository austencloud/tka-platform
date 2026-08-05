---
date: 2026-08-04
status: active
area: create/generate
---

# LOOP Single-Mode Responsive Morph

## Outcome

Single mode applies a LOOP type as soon as it is selected. On desktop, the
selected Rotated, Inverted, or Reflection card stays in place and expands
around its settings. The other LOOP cards slide down, preserving the physical
relationship between the choice and its controls while keeping the drawer
occupied. Compact drawers use a focused settings screen with Back because the
full list and controls do not fit together there.

Swapped and Rewound have no settings, so they continue to apply and close the
panel. Combo remains a transactional multi-select flow with an Apply button.

## Interaction

1. The panel opens with every LOOP type visible.
2. Selecting a configurable Single LOOP applies any valid type immediately.
3. A desktop card expands in place. A compact drawer pushes into a focused
   settings screen.
4. Setting changes apply live. No Apply button appears in Single mode.
5. If the current rhythm is invalid for the sequence length, the settings
   screen stays open and explains the conflict. A valid setting commits the
   selected LOOP.
6. Back on compact drawers returns focus to the selected type in the root list.
7. Selecting another desktop type collapses the previous card and expands the
   new owner.
8. Close keeps the current committed LOOP and rhythm.

## Reuse

The existing `LOOPComponentGrid` and `LOOPComponentButton` already provide the
desktop expansion: the selected card remains mounted, its controls reveal
inside the same shell, and the grid track animation moves its siblings. Reuse
that path for Single mode instead of replacing the card with a separate header.

The compact flow follows `SettingsDrillPanel.svelte`: one keyed layer, an
intro-only directional push, and no outgoing layer. This removes the old
crossfade and prevents duplicate interactive content during the transition.

`SettingsDrillPanel.svelte` is the closest shared pattern, but its root is a
list of `SettingsDrillRow` entries. LOOP needs its existing colored type grid,
guest locks, selection badges, and Combo compatibility rules, so replacing the
root with that primitive would discard more than it reuses.

## Scope

- `LOOPExpandedOverlay.svelte`: desktop in-place expansion, compact detail
  stage, focus, live validation, and responsive composition.
- `LOOPExpandedOverlay.svelte.test.ts`: desktop expansion, compact push and
  Back, invalid-to-valid rhythm, non-configurable close, and Combo transaction
  coverage.

No LOOP domain logic, generation service, drawer geometry, or shared primitive
changes are required.

## Responsive Invariants

- Desktop keeps every type visible. The selected card owns its controls and the
  list fills the drawer height.
- Compact settings contain Back, the selected LOOP identity, and only that
  LOOP's controls and validation.
- The compact picker and detail occupy the same fixed or flex-grown stage, so
  changing screens does not resize the panel.
- The compact five-tile grid remains centered on bottom sheets and short
  landscape drawers.
- Desktop Combo keeps its attached configurators and sticky Apply dock.

## Verification

- Focused component tests for state transitions and callback order.
- Runtime proof that the desktop Rotated card remains the same DOM node while
  its height grows and the next card moves down.
- Runtime proof that compact Back restores the selected type button's focus.
- Screenshot and overflow measurements at 1920x1080, 2560x1440, 3840x2160,
  1440x900, 820x1180, 960x412, and 375x667.
- Reduced-motion verification that expansion and pushes complete without
  animation.
