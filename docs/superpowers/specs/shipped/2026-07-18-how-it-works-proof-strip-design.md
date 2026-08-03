# How It Works Proof Strip

## Goal

Explain TKA in one glance without turning the landing page into a tutorial.

## Layout

The section keeps the existing heading and replaces the Assembly Table with one compact horizontal strip. The strip contains three equally weighted proofs:

1. **Pictograph** — one complete notation image.
2. **Sequence** — the same notation assembled into choreography.
3. **Playback** — the sequence moving in the existing animation renderer.

All three proofs remain visible at once. The strip has no step rail, auto-progression, numbered markers, instructional paragraphs, or selectable state. Vertical separators and a single shared shell make it read as one transformation rather than three generic cards.

## Scale

- Desktop section width remains capped at `1480px`, including 4K displays.
- Desktop proof height is capped at `360px`.
- Mobile preserves the three-column comparison instead of stacking it into a long section.
- Essential labels remain at least `14px`.
- `#how-it-works` clears the sticky navigation when targeted.

## Behavior

The pictograph and sequence are static. Playback uses the existing animation component and its intersection/document-visibility gate. Reduced motion keeps the strip static and prevents automatic animation playback through the existing playback gate.

## Loading and Failure

The lazy placeholder reserves the same heading and three-cell strip geometry. Existing sequence-loading failure copy remains concise and occupies the shared shell.

## Verification

- Contract test proves there is no ToggleGroup, assembly rail, or auto-advance language.
- Contract test proves exactly one pictograph, one sequence card, and one animation component are mounted.
- Browser review covers 390, 929, 1440, 1920, and 3840 widths, sticky-header clearance, and horizontal overflow.

