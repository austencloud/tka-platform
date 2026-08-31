# Compact Stage Prop Audit

## Goal

Test whether size-only Big prop variants can become a regular prop rendered
against a smaller spatial stage. The prop keeps a comfortable visible size
while the grid, hand orbit, and mandala geometry contract beneath it.

## Ownership

- `/test/prop-size-audit` remains the visual owner for true 950-unit prop-scale
  comparisons.
- `prop-type-display-registry.ts` remains the owner of standard-to-Big pairs.
- The audit composes those owners. It does not create another prop pairing map
  or change production rendering.

## Comparison math

For base reach `b`, Big reach `B`, and the production hand orbit `H = 150`, the
matched compact scale is `b / B`. The proposed hand orbit is `H × b / B`, so
`b / proposedOrbit` equals `B / H`. This preserves the current prop-to-grid
ratio while displaying the regular prop artwork.

Line thickness, point size, labels, and controls stay constant. Only spatial
anchors move. The slider follows the pointer directly and carries no easing.

## Gate

The page presents one standard-to-Big family at a time:

1. Current Big artwork on the full production grid.
2. Base artwork on the compact grid.
3. A direct stage-scale scrubber with a matched-ratio reset.
4. Ratio drift and tracked-end counts.

A tracked-end change is a hard warning. Those props require a semantic identity
and cannot be replaced by spatial scale alone. A matching end count is necessary
but not sufficient; the visible silhouette still requires approval.

When the ratio would require a stage larger than 100%, the gate labels the
closest compact value and the unavailable required scale. It never describes a
clamped approximation as a match.

## Non-goals

- No production prop type is removed or renamed.
- No saved sequence is migrated.
- No renderer, arrow, effect, or trail geometry changes in this gate.

Production work begins only after the paired visual review identifies which
families are true scale variants.
