# Double Contact Ball 3D Rebuild Design

> **Superseded 2026-08-14.** The GLB remains a valid reusable asset, but the
> full-body spinner stage is the wrong interaction model for contact juggling.
> Product and runtime direction now lives in
> `2026-08-14-contact-juggling-viewer-design.md`.

## Goal

Replace the current Double Contact Ball fallback, which renders the same single
sphere used by Contact Ball, with a production GLB that visibly and physically
reads as two contact balls manipulated together in one hand.

## Ground truth

- The canonical artwork at
  `static/images/props/pictograph/doublecontactball.svg` contains two equal,
  tangent circles in a 2:1 footprint.
- `Double Contact Ball` is a standalone prop in the active Standard picker. It
  is not a size variant of the currently deactivated Contact Ball.
- The runtime currently routes both Contact Ball and Double Contact Ball to
  `Ball3D`, so the second sphere is silently omitted.
- Current stage and contact balls commonly use 80 to 100 mm soft or silicone
  spheres, a matte-to-satin surface, and enough mass for rolling and catching.
  The authored pair is slightly larger for stage readability.

## Form and dimensions

- Use two equal 115 mm spheres with their centers on local `+Y/-Y`.
- Compress the facing caps into a shallow elliptical contact zone with a tiny
  controlled overlap. Preserve the canonical 2:1 silhouette without a sharp
  boolean crease or visible gap.
- Put the hand origin at the contact point between the balls. The performer
  cradles the pair there; there is no rigid handle or axle.
- Keep both lobes balanced. Local `+Y` is the primary prop axis used by the
  scene rotation contract.
- Add a shallow fill port with a body-color recessed lip to each ball. These
  details should establish scale without competing with the two-ball read.

## Materials

- `TKA_DoubleContactBall_Recolor_Shell`: satin outer silicone and the two small
  fill-port lips. This is the main runtime recolor target.
- `TKA_DoubleContactBall_Port`: dark recessed fill ports at the two outer poles.

The prop should read as two soft weighted stage balls, not billiard balls,
metal bearings, balloons, or a dumbbell.

## Runtime contract

- Root node: `TKA_DoubleContactBall`
- Grip marker: `TKA_Hand_Pivot` at `0,0,0`
- Root metadata: prop type, authored span, sphere diameter, origin, local primary
  axis, canonical source, and recolor material.
- Registry URL: `/models/props/double-contact-ball.glb`
- Registry scale: `1`
- Grip offset: `0`
- Export contains no camera, lights, animation, or QA-only geometry.

## Verification

1. Run the structural GLB verifier for bounds, pivot, materials, normals, UVs,
   scene count, and mesh budgets.
2. Add a registry regression test proving Double Contact Ball resolves to its
   own model while Big Double Contact Ball reuses it at the existing multiplier.
3. Inspect front, three-quarter, profile, rear, top, and grip proof renders.
4. Run the production viewer with red and blue pairs through generated 16-count
   rotated LOOPs. Confirm both spheres remain readable and centered in the hand.
5. Sweep the seven required desktop, 4K, tablet, and phone viewports.
6. Give the proof and live views to an independent reviewer, apply the useful
   suggestions, and repeat the focused checks.
