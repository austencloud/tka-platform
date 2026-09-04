# Third Order Composer

Status: implementation contract

## Purpose

Third Order turns a complete Flow Arts Composer sequence into a moving coordinate system. The sequence still animates its own one-prop or two-prop relationship. Its grid center is then carried by one lane of a larger sequence, as if the larger sequence belonged to a higher-dimensional performer moving the entire child grid with one hand.

The feature lives in Compose as the **Third Order** tab. It is composition behavior, not a new letter level and not an extension of the Kinetic Alphabet notation model.

## Product contract

The first complete workspace contains:

- one carrier sequence with blue and red carrier lanes;
- two child sequence slots, called Blue grid and Red grid;
- real FAC animation canvases for the carrier and each child;
- a master transport and tempo control;
- child controls for carrier lane, frame orientation, timing, playback rate, and visibility;
- the shared sequence picker for replacing any source;
- desktop source rail, stage, and inspector panels;
- compact source and inspector drawers at narrow widths and short landscape heights.

The initial composition duplicates one circular 16-count demonstration sequence into all three slots. This gives the feature a moving result on first open without creating a second renderer or a special fixture format.

## Coordinate hierarchy

The carrier and child canvases use the canonical 950-unit FAC view box.

1. A carrier prop center is sampled with the production animation orchestrator.
2. That prop center becomes the center of the assigned child grid.
3. The child canvas is scaled to 0.5.
4. The child outer radius therefore equals the carrier hand radius.
5. The parent outer radius is twice its hand radius, so the parent grid spans twice the child grid.

At radial alignment, three landmarks share one line:

```text
parent center  <->  child inward outer point
parent hand    <->  child center
parent outer   <->  child outward outer point
```

Child centers ride the carrier hand path. They do not ride the carrier outer ring.

## Orientation modes

- **World locked:** the child grid keeps one fixed screen orientation while its center travels.
- **Radial to center:** the child north axis points toward the parent center.
- **Follow path tangent:** the child north axis faces the instantaneous travel direction of its center.
- **Follow carrier direction:** the child north axis inherits the carrier prop's staff rotation.

Radial and tangent are deliberately separate. Radial describes where the parent center is. Tangent describes where the child center is going. On a circular route they remain perpendicular.

## Timing modes

- **Phrase per count:** one complete child phrase plays during each carrier count. This is the default because it makes the nested unit legible immediately.
- **Shared counts:** child count 1 advances with carrier count 1 and wraps at the child's own length.
- **Independent clock:** the child advances from the master clock at an editable rate from 0.1x to 4x.

The carrier owns the master duration. Child sequences loop inside it. Seeking, stepping, restart, and play all operate on the same master clock.

## Data ownership

Third Order does not add fields to `SequenceData`. A separately versioned `ThirdOrderComposition` owns:

- carrier sequence reference;
- an array of child coordinate systems;
- each child's source, carrier lane, orientation mode, timing mode, rate, and visibility;
- master BPM.

The UI currently edits an in-memory version 1 draft. Persistence, sharing, export, and import should serialize this composition object later without changing the sequence schema.

## Architecture ownership

Existing owners remain authoritative:

- `SequenceAnimationOrchestrator` samples all carrier and child prop states.
- `AnimatorCanvas` renders every grid and prop.
- `calculatePropCenter` owns the mapping from animated prop state to carrier hand position.
- `PanelGroup`, `Drawer`, `SegmentedControl`, `TransportControls`, `TempoControl`, and `SequencePickerModal` own their established UI behavior.

The only new behavior owner is `ThirdOrderCompositionSampler`. It maps one master beat into carrier state, child state, and each child coordinate-frame transform.

## SpiroAnim analogue

SpiroAnim already demonstrates the conceptual seed: a prop has its own motion while the containing motion group is translated as a unit. Its current Third Order pane is a placeholder, so the transferable concept is the nested transform hierarchy rather than a finished editor implementation.

Reference: `src/features/third-order/components/ThirdOrderPane.vue` at SpiroAnim commit `6bd56cde61c82bd9a047727ceff70d22428113d3`.

## Non-goals for version 1

- Third-order letters or pictograph notation
- mutation of source sequences
- arbitrary-depth recursive nesting
- keyframed child scale or free Cartesian paths
- video export or SpiroAnim file import
- more than two editable child slots in the initial UI

The domain shape uses a child array so more simultaneous grids can be added without replacing the sampler or file format.

## Acceptance criteria

- Opening Compose > Third Order immediately displays a moving carrier and two nested real FAC canvases.
- Play, pause, seek, half-count step, full-count step, restart, and BPM changes operate without desynchronizing the three sequences.
- Blue and Red child systems may load distinct source sequences.
- A child can follow either carrier lane.
- World, radial, tangent, and carrier orientation modes are visually distinct.
- Phrase, shared, and independent timing modes produce the defined count mapping.
- At 0.5 scale, a child grid's outer radius equals the parent hand radius.
- The stage remains usable from 375 px mobile through 3840 px desktop and at 200% zoom.
- Reduced-motion preferences remove disclosure and selection transitions without disabling playback requested by the user.
