# Olive Cloudbreak Gate 1 revision 3

Date: 2026-08-10

Status: ready for spatial review, no Meshy credits spent

Museum decision: `pHK4L3DvITTkhMyR6192`

Review route:

`https://127.0.0.1:5176/test/celestial-integration?view=assets`

## What remains locked

The accepted front composition remains the owner of the hero view:

- one continuous limestone shelf;
- a dry 5.75 metre performance radius;
- one right-edge lagoon;
- two foreground olive positions;
- four floating mesas at varied elevations;
- one far solar direction;
- performer clearance in every registered front camera.

The asset bench no longer hides the mesas in its Front view. Trees and Stone
remain isolated comparison views so asset quality can still be judged without
background competition.

## Rear hemisphere amendment

The approved layout contract now adds one reverse-camera relationship:

| Element               |                         Measurement | Read                                        |
| --------------------- | ----------------------------------: | ------------------------------------------- |
| Worn circulation band |                         5.25 m wide | Long-term foot traffic, not a paved road    |
| Threshold footprint   |             27 m wide by 7.5 m deep | Part of a much larger stone structure       |
| Threshold height      |                                18 m | Monumental beside a 1.75 m person           |
| Clear opening         |             9 m wide by 10.5 m high | Large enough for a group to emerge together |
| Reverse camera        | `[0, 4.8, 8]` toward `[0, 5.8, 47]` | Stage-to-threshold spatial proof            |

The current web background still begins inside the location. It does not stage
an arrival animation. The worn band and reverse view establish that the terrace
is used and connected to a larger sanctuary.

The threshold is an authored invention. It must read as old, inhabited, and
partly eroded. Classical columns, religious iconography, intact palace walls,
and castle battlements are excluded.

## Generation queue

### 1. Ancient olive, open crown

Method: Meshy multi-image, first priority

Target: 5.6 metres tall. Thick bifurcated trunk, exposed roots, sparse
silver-green leaves, broad negative space through the crown.

Reference-image prompt:

> One ancient Mediterranean olive tree, full tree visible from exposed roots to
> the highest leaf. A thick bifurcated trunk twists into a broad open crown with
> large areas of visible sky between branches. Pale silver-grey bark, restrained
> clusters of narrow silver-green leaves, wind-weathered asymmetry, no fruit,
> no flowers, no surrounding scenery. Photoreal botanical detail. Neutral
> mid-grey studio background, even diffuse lighting, no ground shadow merging
> into the roots, no text, no border.

Acceptance: reads as olive from the front camera and leaves the protected
performer band open.

### 2. Windswept olive, asymmetric crown

Method: Meshy multi-image, first priority

Target: 5.9 metres tall. Twisted pale trunk leaning away from the lagoon with
one clear directional canopy gesture.

Reference-image prompt:

> One old windswept Mediterranean olive tree, full tree visible. The trunk is
> pale, deeply twisted, and leans strongly to one side before dividing into an
> asymmetric crown. Sparse narrow silver-green leaves gather in broken pads,
> with visible branch structure and open air through the canopy. Exposed roots,
> no fruit, no flowers, no scenery. Photoreal botanical detail. Neutral mid-grey
> studio background, even diffuse lighting, no merged ground shadow, no text,
> no border.

Acceptance: pairs with the west olive without looking duplicated and keeps the
lagoon edge visible in portrait and phone cameras.

### 3. Lagoon limestone outcrop

Method: Meshy multi-image, second priority

Target: one low pale-limestone outcrop with undercut erosion, rounded fractures,
and shallow ledges that can meet the water without becoming a wall.

Reference-image prompt:

> One isolated weathered pale-limestone outcrop, low and horizontally spread,
> with rounded fractures, shallow ledges, small undercut cavities, and softened
> water erosion along one side. Warm ivory and muted sand colour, subtle mineral
> staining, no moss, no plants, no scenery. Entire rock fully visible on a
> neutral mid-grey studio background with even diffuse lighting. Photoreal
> geological detail, no text, no border.

Acceptance: holds a clean shoreline silhouette after optimization and accepts
the shared Cloudbreak limestone material without baked lighting.

### 4. Eroded shelf family

Method: Meshy multi-image, second priority

Target: one modular family containing a broad cap, broken shoulder, and narrow
overhang. It must dress the four floating mesas without repeating one profile.

Reference-image prompt:

> One isolated eroded limestone shelf formation with three connected readable
> masses: a broad flat cap, one broken sloping shoulder, and one narrow undercut
> overhang. Pale warm limestone with layered sediment, rounded wind erosion, and
> restrained fractures. No plants, no water, no scenery. Entire formation fully
> visible on a neutral mid-grey studio background with even diffuse lighting.
> Photoreal geological detail, no text, no border.

Acceptance: produces at least three distinct silhouettes through rotation and
cropping while sharing one material family.

## Authored and runtime work after spatial approval

- Build the 27 by 18 metre threshold as a modular Blender set. Meshy does not
  own its architectural proportions.
- Add path wear as a surface treatment plus a restrained edge-stone field.
- Compose `ReflectivePool` and `PlanarReflector` with the irregular lagoon mesh.
- Carry the camera-centred `SkyGradient` sun from this study into the production
  slice. Use the same normalized direction for the key light, cloud lighting,
  and lagoon glints.

## Review evidence

- Registered front: `./seraphic-vault-gate1-cloudbreak-r3-front.png`
- Reverse camera: `./seraphic-vault-gate1-cloudbreak-r3-rear.png`
- Measured overview: `./seraphic-vault-gate1-cloudbreak-r3-plan.png`

All three captures come from the in-app review route. The cloud field uses the
shared camera-centred sky owner and depth-tests against world geometry, so it
cannot ghost across the threshold, mesas, trees, or performers. The Plan view
adds a non-production route overlay to show the full path without changing the
front composition.

## Verification order

1. Approve the Front, Rear, and Plan tabs as one spatial amendment.
2. Generate consistent front, three-quarter, side, and back reference images
   for both olives. Generate at least three angles for each limestone target.
3. Run the existing image-to-3D Meshy pipeline, then optimize every result.
4. Place the optimized candidates back into this same bench.
5. Re-run the registered front, portrait, phone, reverse, and plan cameras
   before advancing to the Gate 2 graybox amendment.
