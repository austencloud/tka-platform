# Canonical Capabilities — ENFORCED ROUTING INDEX

This is a short, searchable map of concepts that have repeatedly acquired
parallel implementations. Add a row when a capability becomes shared or when a
keep-separate decision prevents agents from merging different interaction
models. Do not turn this into an inventory of every component.

| Search vocabulary | Owner and routing | Allowed presentations or exceptions |
|---|---|---|
| filter, chip, pill, segmented selector, toggle row | `FilterChipBase` for independent toggles; `SegmentedControl` for exactly-one selection. Follow `chip-primitives.md`. | The focused rule names intentional exceptions such as `BpmChips`, `MotionColorChips`, and `MorphChipGroup`. |
| BPM, tempo, tap tempo, speed preset, custom BPM | Tempo behavior is not consolidated yet. Existing presentations are `BpmChips.svelte`, `TempoControl.svelte`, and `BpmQuickPopover.svelte`. Reuse one; do not create a fourth. A change to duplicated clamping, presets, or tap-tempo calculation must extract a shared behavior owner first. Timing bounds come from `shared/animation-engine/domain/constants/timing`. | Different compact, full, practice, and popover views may remain, but presentation differences do not justify duplicated tempo algorithms or constants. |

## Adding an Entry

Record:

- terms an agent is likely to search;
- the path that owns behavior, not merely the prettiest presentation;
- supported presentation variants;
- intentionally separate interaction models and why they differ.

If ownership is unresolved, say so and block another parallel implementation.
Do not invent a canonical owner to make the table look complete.
