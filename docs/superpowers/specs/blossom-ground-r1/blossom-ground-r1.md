# Blossom Ground R1

## Approval

Austen approved this ground rebuild on 2026-08-21 with: “Send it brotha.”
The approval covers the terrain, ground materials, grass ecology, stage contact,
and riverbank integration described here. The previously approved trees,
lanterns, bridge, river centerline, torii, and protected performer sightline
remain governed by `blossom-recomposition-r1`.

## Ground thesis

Blossom has one living garden floor. The performance deck sits in a maintained
opening inside that ecology; it does not sit on a circular texture island.
Compacted traffic, meadow cover, petal litter, and damp river soil transition
through soft habitat weights and physical vegetation density rather than
separate visible terrain shapes.

## Surface contract

- One continuous height-field terrain owns the complete walkable garden.
- The rejected `Garden_Clearing` / `Moon Garden Gravel Clearing Mesh` does not
  exist in the authored asset.
- The terrain is level beneath the canonical deck, rises gently into the outer
  garden, and carves a shallow river channel below the reflective ribbon.
- Small root islands keep both PlantFactory trunks physically connected to the
  bank even where the approved river passes close to them.
- The runtime stage dimensions drive an irregular compacted-earth contact zone.
  No perfect circle or ellipse is used as a stage border.

## Habitat families

The ground-detail mask stores compacted earth, living meadow, and petal litter
in RGB. The remaining weight is damp river soil. These weights blend four
world-space texture families at runtime so texture scale and orientation do not
reveal the terrain topology.

Physical grass follows the same habitat logic:

- low turf and moss form the continuous base read;
- medium blades create broken meadow colonies;
- high-tier arching blades and seed heads concentrate at the outer garden and
  damp bank;
- the deck, circulation apron, bridge, water, and maintained paths remain clear;
- river clearance is measured against the same smoothed centerline used to
  author the water, and includes the complete 0.72 m leaning-blade footprint;
- all grass uses shared rooted-wind behavior and respects reduced motion.

## Acceptance gate

The ground passes only when front, top, left/right, and three-quarter review
views show no circular clearing, no stage halo, no river/terrain collision, and
no grass root or blade inside the river footprint, and no uniform grass carpet.
The stage must read as embedded in one garden ecology.
Forest and Autumn must retain their existing ground appearance. The optimized
Blossom GLB remains under 20 MiB and keeps repeated grass geometry GPU-instanced.
