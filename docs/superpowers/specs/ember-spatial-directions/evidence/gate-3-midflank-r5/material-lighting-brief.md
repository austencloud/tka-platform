# Ember R5: cooled flank and crusted flow

Status: Gate 3 material candidate ready for visual review. Gate 2 geometry is
approved under `3XyhXLyzv8ASNl2fLoCo`; this proposal is
`n37Lcgy1czQrqITMnB8f`. No Gate 3 approval is recorded.

## The proposed finish

The performer stands on an old, cold lava contact within the slanted mountain.
Its surface is denser and slightly darker than the loose rubble around it. The
footing has an irregular transition, with no illuminated border or separate
platform. The small audience continues downhill and laterally along the
approved contour. The active flow is the source of visible heat.

The close paintover is the surface-detail target. The native Blender renders
are a registered material study and spatial reference, not a finished scene.

| Family            | Intended appearance                                                                         | Native study / production gap                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Older cooled flow | Dense charcoal basalt, subdued shallow fractures; cold underfoot                            | Darker, smoother shader on the existing full contact; coarse material boundaries still need natural blending |
| Flank and rib     | Broken angular basalt, rough faces, small rubble, ash in sheltered hollows                  | Existing CC0 rock-height scan and metre-space bump; rib and upper outcrops retain graybox facets             |
| Active lava       | Mostly solid dark crust, interrupted by uneven incandescent gaps and a few hotter breakouts | Heat restricted to simulator deposit; metre-cell edges and an overly uniform seam network are still visible  |
| Atmosphere        | Ash-filtered daylight and restrained warm light close to exposed lava                       | Thin volume, neutral-cool sky fill, local warm lights; no moving plume or runtime cost proof                 |

### Light and attention

The pale performer marker remains distinct against a dark cold surface. Warm
light stays near the lava-facing banks; it does not wash the whole mountain
orange. Rock detail should remain legible in the uphill view. Atmospheric
separation must not hide the slope, river path, or audience. The downstream
views deliberately retain the approved open sky instead of adding another
mountain to fill the frame.

The native study uses AgX, 0.4 exposure, 48 Cycles samples and 1600 by 900 output.
These are offline look-development settings, not a runtime lighting budget.

### Bench comparison

Recommendation: keep the bench cold. The alternate image adds a sparse static
ember peak to the same peripheral shader fractures. Those bright slashes draw
attention onto the old contact and weaken its distinction from the active
flow. This comparison is an authored visual invention, not a geological claim.
No pulse cadence, performance response, or audio response has been implemented.
The saved Blender target defaults to zero bench emission.

## What is exact, and what is illustrative

- `registered-target-report.json` locks all eleven approved Blender cameras:
  default audience, eight orbit stops, oblique and director overview.
- The verifier independently reopens source and target Blender files and
  compares all nine source meshes: vertex/topology bytes, world transforms,
  render visibility, collision flags and modifier names/types. These match.
- One volume-only haze box and lighting are added. No terrain, performer,
  audience, lava-footprint or collision geometry is replaced.
- `paintover-default-audience.png` is a built-in image-generation edit of the
  exact default-audience render. It is an illustration of finish, not a
  pixel-exact geometry check or a runtime screenshot. The three visible proxies
  and their relative placement are retained, including the cropped foreground
  marker. Surface relief in that image is not yet implemented.
- Two generated wide-view attempts were excluded: both showed six markers
  where the approved Blender wide view has five. The exact native wide view
  is supplied instead. Full prompts and rejection reasons are recorded in
  `imagegen-provenance.json`.

## Review evidence

1. `ember-r5-material-target-board.png`: close finish target, its native input,
   exact oblique view and exact downhill view. Panel labels distinguish media.
2. `ember-r5-orbit-board.png`: all eight native orbit stops with unchanged
   camera settings and figure positions.
3. `ember-r5-ember-comparison.png`: cold bench beside the static peripheral
   ember alternative, rendered from the same camera.
4. `target-director-overview.png`: complete registered overview.
5. `blender/ember-midflank-fire-pilgrimage-visual-target-r5.blend` at repository
   root: editable study, with the rock-height texture packed.

Direct visual inspection: the pale performer is visible in every orbit panel;
the uphill flank continues out of frame, and the downhill views expose the
open lower-country direction. Captions and framing are intact. The native
material study remains visibly coarse: the rib has planar faces, the lava has
regular cell boundaries, and ground detail stretches in some oblique views.
Passing geometry registration does not count as resolving these art defects.

## Production obligations after target approval

Keep the measured terrain, source, drainage footprint, bench size and approved
camera relationships. Refine local surface geometry and the lava crust within
that contract; blend the cooled contact into surrounding rubble. The close
paintover sets a detail target but cannot certify appearance around the orbit.
Recheck all views in the actual viewer, including rear views and performance
at the relevant viewports. Do not hide unresolved surfaces with bloom or haze.

Existing Meshy assets may be reused where they fit the approved geology.
No new Meshy call or credit spend occurred in this study. A generated prop
must fit an assigned geological role; it cannot redefine the mountain.
Runtime materials, transport animation, audio, frame cost and pulse behavior
remain unimplemented here. The fictional action clearance is not a real-world
safety assessment for standing near lava.

## Ownership and reproduction

The owner search found the existing look-development matrix, geology graybox
builder, production slice builder and contact-sheet builder. This revision
extends `scripts/build-ember-lookdev-matrix.py` with an R5 dispatch to
`scripts/ember-midflank-lookdev.py`; the legacy matrix remains available.
It extends `scripts/build-ember-atmosphere-contact-sheets.mjs` with an R5 board
mode. It consumes the approved Gate 2 Blender source and manifest directly.
No runtime scene owner or alternative terrain generator was introduced.

Run from the repository root, substituting the installed Blender executable:

```powershell
blender --background --factory-startup --python-exit-code 1 --python scripts/build-ember-lookdev-matrix.py -- --midflank-r5
blender --background --factory-startup --python-exit-code 1 --python scripts/build-ember-lookdev-matrix.py -- --midflank-r5 --verify
node scripts/build-ember-atmosphere-contact-sheets.mjs --midflank-r5
node .agents/skills/museum-scene-production/scripts/validate-scene-gates.mjs docs/superpowers/specs/ember-spatial-directions/scene-gates.json
```

The board builder consumes the checked-in paintover. It does not regenerate it;
the image-generation tool is nondeterministic. Native inputs, Blender source
and rendered outputs have SHA-256 locks in `registered-target-report.json`.
The gate manifest separately hashes the review board, brief and provenance.

## Research basis

The crust-over-hot-interior material logic follows the
[USGS explanation of lava-flow cooling](https://www.usgs.gov/observatories/hvo/news/volcano-watch-how-do-lava-flows-cool-and-how-long-does-it-take).
Colour is variable with rock composition, weathering and surface processes;
see [USGS on lava-rock colours](https://www.usgs.gov/news/volcano-watch-lava-rocks-come-many-colors).
These references inform the appearance, not a claim that this invented site
has been geologically validated.

The existing rock-height asset is reused from
`static/textures/ember-surface-r11/rock-ground-height.jpg`. Its adjacent README
records the original Poly Haven Rock Ground scan, checksum and CC0 license.
No new asset license or external dependency was introduced.

## Review question

Does this read as a cold, naturally widened foothold in a continuing mountain,
with the dangerous heat passing beside it rather than coming from a stage?
The requested Gate 3 judgment is the surface finish and lighting direction,
not acceptance of the remaining graybox facets or the optional bench glow.
