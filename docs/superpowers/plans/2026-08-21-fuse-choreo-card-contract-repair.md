# Fuse Choreo Card Contract Repair

**Status:** Approved

**Approved:** 2026-08-21
**Governing specs:**

- `docs/superpowers/specs/active/2026-08-11-fuse-shape-matrix-design.md`
- `docs/superpowers/specs/active/2026-08-12-fuse-4k-workspace-redesign.md`

## Outcome

Fuse keeps its live SVG source grid so path transforms can move arrows and
props in place. That presentation still behaves like every other Choreo Card:
its sequence data carries truthful reversal flags, reversal dots are visible,
and right-click opens the canonical card menu.

## Ownership

- `deriveReversals` remains the only reversal algorithm.
- The app reversal adapter decides whether a `SequenceData` is cyclic from its
  canonical `isCircular` signal as well as its legacy LOOP label.
- Fuse source orchestration applies that detector after adapting a verified
  one-hand LOOP into `SequenceData`.
- The Fuse fuser measures circularity, applies the detector once, and keeps the
  persisted pairing flags aligned with the rendered steps.
- `PictographContainer` remains the live glyph renderer.
- `ChoreoCardContextMenuHost` remains the card-menu owner. Fuse composes it
  without the global pictograph toggles because its one-hand path presentation
  intentionally fixes those visibility choices.

## Scope

1. Treat `SequenceData.isCircular` as cyclic reversal context even when a
   one-hand artifact has no two-hand `loopType` label.
2. Derive source reversal flags after `soloPropToSequence` materializes a Fuse
   source.
3. Measure the fused result with `isSeamlesslyLoopable`, derive its reversal
   flags, and copy those flags into `stepPairings`.
4. Stop suppressing reversal dots in both the full live grid and the compact
   current-step pictograph.
5. Open the canonical card menu from the visible Fuse notation stage and route
   its Save to Library action through Fuse's solo-LOOP save owner.

## Verification

- Focused unit coverage for circular reversal context, an internal reversal,
  a seam reversal, and fused step/pairing agreement.
- Project TypeScript/Svelte check scoped through the normal repository command.
- Browser proof on `/create/fuse`: visible reversal dot and working right-click
  menu at the approved desktop, 4K, tablet, short-landscape, and phone sizes.

## Risks

- The Choreo Card menu is shared infrastructure. Fuse must configure the
  existing host, not fork its builders.
- A menu visibility control that Fuse ignores would be misleading, so the Fuse
  host presents only the canonical Card section.
- A fused result is marked circular only after the shared position-and-
  orientation checker confirms the seam.
