---
paths:
  - "src/**/*.svelte"
---

# Chip and Selector Contract

| Interaction                          | Owner                                                      |
| ------------------------------------ | ---------------------------------------------------------- |
| Independent booleans or multi-select | `FilterChipBase` with `mode="toggle"`                      |
| Exactly one active option            | `SegmentedControl`                                         |
| At most one, with re-click to clear  | `FilterChipBase` toggles                                   |
| Popover or momentary chip action     | `FilterChipBase` with `mode="dropdown"` or `mode="action"` |

`FilterChipBase` lives at
`src/lib/shared/browse/components/filter-chips/FilterChipBase.svelte`.
`SegmentedControl` lives at
`src/lib/shared/ui/components/SegmentedControl.svelte`.

- Extend the matching owner when a reusable prop is missing. Do not create a
  local copy or raw chip/pill buttons for an owned interaction.
- Blue/red prop options use explicit `tone` values and retain a non-color label
  or accessible name. Do not infer prop identity from “left” or “right.”
- Keep distinct interaction models separate: `MorphChipGroup`, `BpmChips`,
  `MotionColorChips`, `PresetChip`, navigation pills, display-only badges, and
  dynamic colored lists with inline actions.
- Check changed interactive markup for raw chip buttons and checkbox inputs
  before completion.
