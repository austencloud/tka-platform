# Canonical Capabilities — ENFORCED ROUTING INDEX

This is a short, searchable map of concepts that have repeatedly acquired
parallel implementations. Add a row when a capability becomes shared or when a
keep-separate decision prevents agents from merging different interaction
models. Do not turn this into an inventory of every component.

| Search vocabulary                                                                   | Owner and routing                                                                                                                                                                                                                                                                                                                                                       | Allowed presentations or exceptions                                                                                                                                                                       |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| filter, chip, pill, segmented selector, toggle row                                  | `FilterChipBase` for independent toggles; `SegmentedControl` for exactly-one selection. Follow `chip-primitives.md`.                                                                                                                                                                                                                                                    | The focused rule names intentional exceptions such as `BpmChips`, `MotionColorChips`, and `MorphChipGroup`.                                                                                               |
| BPM, tempo, tap tempo, speed preset, custom BPM                                     | `shared/animation-engine/domain/tempo-behavior.ts` owns preset values, clamping, tap history, and tap-tempo calculation. Timing bounds remain in `shared/animation-engine/domain/constants/timing`. Existing presentations are `BpmChips.svelte`, `TempoControl.svelte`, and `BpmQuickPopover.svelte`; reuse one rather than creating a fourth.                                                        | Different compact, full, practice, and popover views may remain, but they delegate tempo algorithms and constants to the shared owner.                                                                   |
| effect preview, preset lab, renderer comparison, infinite sequence, continuous demo | `InfiniteSequenceGenerator` owns generated preview LOOPs; `isEffectPreviewLoop` owns the minimum-length and seamless-seam gate. Follow `sequence-generation.md`.                                                                                                                                                                                                        | A user-selected sequence may replace generation only when the surface is explicitly a sequence picker. Effect tuning and comparison defaults remain generated 16-count LOOPs.                             |
| sequence transform, Actions, Mirror, Flip, Invert, Rotate, First Step, Reset        | Transform behavior is owned by `shared/create/services/sequence-transformer.ts`; the canonical action-tile presentation is `shared/create/components/SequenceTransformActions.svelte`. Consumers configure the capabilities valid in their context.                                                                                                                     | Create exposes the full action set with 45-degree rotation. Fuse composes the same tiles for one-hand LOOPs with 90-degree rotation and omits pair, pattern, timing, extension, and beat-edit operations. |

## Adding an Entry

Record:

- terms an agent is likely to search;
- the path that owns behavior, not merely the prettiest presentation;
- supported presentation variants;
- intentionally separate interaction models and why they differ.

If ownership is unresolved, say so and block another parallel implementation.
Do not invent a canonical owner to make the table look complete.
