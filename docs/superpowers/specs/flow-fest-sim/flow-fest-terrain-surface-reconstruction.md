# Flow Fest Terrain Surface Reconstruction

## Outcome

The measured one-metre DTM remains the terrain and collision authority. The
registered aerial image remains geographic evidence, but it no longer has to
impersonate eye-level soil. Flow Fest composes Forest's established neutral,
meadow, litter, and damp detail families over a camp-specific mask derived from
the shared camp plan.

The lower campground's pale vehicle track is one continuous loop. Its
centerline is sampled from the pinned 2023 public-domain NAIP raster at 0.5
metres per runtime pixel and lives in `flow-fest-camp-plan.ts`. The road is an
imagery interpretation, not a surveyed edge. The minimap, 3D ribbon,
vegetation clearance, camp placement, and ground-family mask all consume that
same line.

## Source and behavior ownership

| Concern                 | Owner                                                                        |
| ----------------------- | ---------------------------------------------------------------------------- |
| Elevation and collision | Pinned USGS one-metre DTM                                                    |
| Public road centerline  | ODOT TIMS road inventory                                                     |
| Lower private road loop | Registered 2023 NAIP interpretation in the shared camp plan                  |
| Ground microdetail      | Forest ground-detail textures and shared masked-ground material primitive    |
| Ground-family placement | Flow Fest mask derived from camp-plan regions, routes, and LiDAR-led ecology |
| Camp dressing           | Flow Fest production geometry constrained by the same plan routes            |

No layer may silently move terrain vertices or relabel a private road as
official data.

## Material families

- **Packed:** public-road shoulders, private drives, the lower loop, footpaths,
  and parking circulation, with feathered contact into adjacent ground.
- **Meadow:** the registered upper, middle, and lower clearings and the broad
  agricultural-field context.
- **Litter:** woodland regions and contact zones beneath LiDAR-led tree crowns.
- **Damp:** localized sedge and low-ground contact, never a whole-site tint.

The orthophoto may contribute restrained macro color, but Forest detail owns
the human-scale color and normal response. Terrain and route materials use the
same family mask so road edges do not sit on an unrelated single-color plane.

## Performance budget

- One 512 × 512 RGBA family mask, generated once per production dressing.
- Four existing 1024 × 1024 Forest detail textures; no duplicate asset set.
- One shader patch per matching terrain/path material with shared textures.
- No new terrain draw batch and no collider rebuild.

## Acceptance gates

1. The north-up minimap and 3D scene both show a closed lower campground loop.
2. The loop connects to check-in and remains source-labelled as public-orthophoto interpretation.
3. Lower tent dressing sits along the loop's outer tree-line perimeter; the
   car-camping cluster remains in the interior.
4. Ground reads as meadow, packed track, woodland litter, and localized damp
   contact at eye level instead of a flat global tint.
5. The terrain render mesh and collider continue to use the same measured DTM.
6. Fixed lower-loop, interior-field, perimeter, entrance, and aerial views pass
   at desktop, wide, and compact viewports without console or shader errors.
