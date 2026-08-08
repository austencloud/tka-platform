# Earth Root Chasm Blender Graybox

## Outcome

Replace the Earth room's rectangular procedural read with a Blender-authored root chasm while preserving the real museum walkthrough. The visitor leaves Fire through a green gully, loses the Fire sightline at the bend, reaches an overhead reveal, and sees G, H, and I performing together six metres below. The route continues around the rim to Air. There is no route down to the performers.

This is an isolated review build. It does not replace the live Earth room until the walk is approved.

## Ground truth

The authoring manifest is generated from:

- `buildVulcanCaveFloorPlan()` for the actual room, performers, and museum mount;
- `buildEarthCanyonLayout()` for the gully, chasm, elevations, overlook, and Air exit;
- `CAVE_MODE_ROOMS` for the three Earth performers and their sequences.

The room stages exactly three performers:

1. G on the west boss;
2. H on the centre boss;
3. I on the east boss.

The TypeScript contract owns coordinate conversion. The Blender script consumes its generated JSON and does not carry a second set of room measurements.

## Spatial redesign

The chasm is the room. An irregular ring of stone and root buttresses replaces the current rectangular stage read. A broken root crown frames the aven and pulls daylight onto the three boss tops. Layered canyon shelves continue below the performance floor so the drop does not terminate in a flat bowl.

The gully is compressed and green. Its floor falls in three measured segments while close rock banks, root ribs, and sparse vegetation hide Fire before the reveal. The final opening widens abruptly onto the chasm rim.

The fallen slab remains the strongest viewing position. Its fractured nose points at H while G and I remain visible on either side. The three performers form one composition from the arrival ledge and from the slab. Individual bosses remain legible without turning the room into three separate exhibits.

The Air exit climbs along the south-east edge. A cool sky cue at the landing distinguishes forward progress from the warmer mineral light in the chasm.

## Blender package

The deterministic build produces:

- `blender/earth-root-chasm-graybox.blend`;
- review renders for the entry, reveal, overlook, trio, Air exit, and plan;
- `artifacts/earth-root-chasm-graybox-report.json` with source digest and anchor counts;
- an optimized web GLB at `static/models/museum/cave/earth-root-chasm-graybox.glb`;
- an isolated first-person route at `/test/earth-root-chasm-graybox`.

Only `EC_` mesh objects enter the GLB. Cameras, lights, reference markers, and QA labels remain in the `.blend` file.

## Acceptance checks

- The generated manifest matches the checked-in TypeScript contract digest.
- The `.blend` contains the named collection contract and three performer stations.
- The GLB contains no cameras, lights, locators, or QA objects.
- The GLB remains compressed and within its delivery budget.
- The isolated route uses the production museum terrain provider, so the real gully slopes, rim blocking, slab, and Air ramp govern the walk.
- Review frames prove the Fire entry, reveal, all three performers, overlook, and exit composition.
