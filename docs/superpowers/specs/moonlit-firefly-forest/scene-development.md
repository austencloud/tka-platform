# Moonlit Firefly Forest production contract

**Status:** Gate 12 Night Master approved; Gate 13A registered atmosphere targets active

**Scene ID:** `forest-firefly`

**Gate manifest:** `./scene-gates.json`

**Controlling plan:**
`../../plans/active/2026-08-08-forest-environment-pass-one.md`

**Creative provenance:** `rSguQqdHHv8fKNbDnmPv`, `W8SPNRGyTmAbzoV1GvFR`,
`2mXvGcaruOaXMvBjZ3dd`, `PoPSyJvOcDbpppYKubmr`,
`DlJ4UAevLxMFd2jA3VTf`, `v7A3GRTREIH4OuohvBOX`,
`UFY4AuUL80NTJMojrRBN`, `cYHeDvPZV5zgbGyCTbh7`,
`Q9wYcOIrKi0DBs3srzgm`, `lTXVsp1LWwbWMTL02sQK`,
`2h40cRvXHIL9szNFxb8c`

This file is an evidence index for the scene-production gate contract. The
controlling plan remains the single creative and implementation owner.

## Outcome

The Forest should read as an intimate performance clearing discovered inside a
living woodland. The stage remains the first focal point, the inhabited camp is
second, and the forest depth is third. Four near-frame trees now stand upstage
of the audience and form an irregular natural proscenium around the performance
bowl. A worn northwest trail begins behind the stage and bends into the woods.
Rocks, deadwood, grass, and mushrooms belong to named habitat vignettes rather
than an even scatter. The underlying 30 m flat terrain survives as a geometry
budget, while widened-layout callers omit the near-frame layer.

## Authority ledger

| Concern                   | Canonical owner              | Evidence path                                                                                               | Current conflict                                                                |
| ------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Creative direction        | Museum tracker               | Tracker items above                                                                                         | None                                                                            |
| Story canon               | Museum story bible           | `docs/museum/story-bible.md`                                                                                | None                                                                            |
| Experience and gate order | Forest controlling plan      | Plan linked above                                                                                           | None                                                                            |
| Spatial geometry          | Forest layout contracts      | `scripts/forest-path-layout.json`, `scripts/forest-tree-layout.json`, `scripts/forest-campsite-layout.json` | Scene Lab and production now consume the same baked woodland placement          |
| Blender output            | Deterministic Forest builder | `scripts/build-forest-environment.py`                                                                       | Gate 10 scene layers remain isolated from the Coven-safe main GLB               |
| Runtime behavior          | Forest runtime scene         | `src/lib/shared/3d/environments/scenes/ForestScene.svelte`                                                  | No legacy procedural tree, tent, fire-ring, rock, bush, or log fallback remains |
| Cross-scene coordination  | Bramble and Elsa log         | `../active/2026-08-08-bramble-elsa-scene-coordination.md`                                                   | Optional shared-sky sun input announced before Gate 13A                         |

## Claim ledger

| ID    | Class     | Statement                                                                                                                                          | Evidence or proposal source                                        | Status                        |
| ----- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------- |
| C-001 | literal   | The terrain stays level through 30 m; the baked environment contract owns the woodland placement.                                                  | Forest path contract, tree layout, and Gate 10 verification        | locked                        |
| C-002 | literal   | Ground ecology is caused by named habitats rather than even scatter.                                                                               | Gate 7 metrics and Austen approval                                 | locked                        |
| C-003 | invention | Selected near trees create a smaller default visual clearing while widened-layout callers omit that layer.                                         | Austen Gate 8 approval and Gate 9 runtime proof                    | locked                        |
| C-004 | invention | The camp shelter is a hand-built moss-canvas lean-to with oak poles.                                                                               | Gate 8 revision 1 visual target                                    | rejected by Austen            |
| C-005 | literal   | Poly Haven boulder and rock sources are CC0 and already used by approved Autumn production.                                                        | Source asset pages and Autumn builder                              | verified                      |
| C-006 | invention | The camp uses a contemporary two-person dome, three-person tunnel, and one-person trekking-pole tent as one cohesive gear family.                  | Austen Gate 8 approval and production GLB                          | implemented; in visual review |
| C-007 | literal   | The production fire pocket provides a 3.05 m fuel-clear circle and at least 4.57 m from each tent edge and the stage.                              | Forest campsite contract, GLB verifier, and official fire guidance | verified                      |
| C-008 | invention | Four upstage trees form the natural audience-facing amphitheater without occupying the audience side of the clearing.                              | Austen direction and Gate 10 runtime proof                         | in visual review              |
| C-009 | invention | Grass, rocks, deadwood, fungi, and fireflies follow habitat fields; four rare bats stay high and peripheral at night.                              | Austen direction and Gate 10 runtime proof                         | in visual review              |
| C-010 | invention | The approved camp moves as one unit to a separate east-rim shelf while the central clearing becomes audience meadow and three named habitat zones. | Gate 10.1 measured contract and Gate 10.2 playable proof           | implemented; in visual review |
| C-011 | invention | Revision 36 is the canonical Forest Night Master; the same clearing will carry Dawn, Day, Golden Hour, Dusk, and Night atmosphere anchors.           | Austen Gate 12 and atmosphere-plan approval                       | locked; Gate 13A active        |
| C-012 | invention | A rare distant UFO may cross the night Forest without confirming any explanation.                                                                  | Austen atmosphere-plan approval and story-bible guardrail          | approved for Gate 13C          |

## Experience sentence

> The player enters along the south woodland path, follows the open ground
> because the stage and warm camp light establish the focal order, interacts by
> performing in the registered clearing, witnesses the forest respond through
> later atmosphere systems, reaches a framed view of camp and canopy, and exits
> through either authored forest route.

## Active registered visual target

- Contemporary tent target: `./forest-modern-tent-family-target.png`
- Final campsite overview: `./forest-campsite-final-overview.png`
- Final human-height tent check: `./forest-campsite-final-close.png`
- Final hero composition: `./forest-campsite-final-hero.png`
- Final tunnel ripstop check: `./forest-campsite-ripstop-tunnel-final.png`
- Final dome ripstop check: `./forest-campsite-ripstop-dome-final.png`
- Final trekking ripstop check: `./forest-campsite-ripstop-trekking-final.png`
- Gate 8 board: `./forest-gate8-review-board.png`
- Gate 9 board: `./forest-gate9-review-board.png`
- Gate 10.1 measured composition: `./forest-composition-revision-plan.png`
- Gate 10.1 verification: `./forest-composition-revision-verification.json`
- Gate 10.2 playable review board:
  `./evidence/gate10-2/forest-gate10-2-contact-sheet.png`
- Framing target: four approved Forest trees sit upstage of the audience and
  form asymmetric side and canopy walls around the stage. Coven Hub and other
  widened-layout callers omit this conditional layer.
- Campsite target: one modern smokeless fire pit at runtime `(34.0, 2.0)`, three
  durable tent pads in one north/east sleeping arc, five inward-facing chairs,
  and an open west arrival from the camp spur. The stage owns the central
  clearing; the camp occupies its eastern edge beneath the upstage-east elm.
- Rock target: CC0 photogrammetry family already proven in Autumn, adapted with
  Forest ground contact and moss rather than radial placement.
- Deadwood target: approved Autumn fallen log plus Forest-authored split and
  branch variants, each tied to nearby moss, fungi, roots, and litter.

The obsolete `forest-shelter-visual-target.png` is retained only as rejected
revision evidence. It is not an active target and must not enter production.

## Gate boundary

Gate 10.1 is approved. Austen accepted the measured board with “Perfect.” The
production pass keeps the stage at runtime `(0, 0)`, translates the approved
camp by `(17, 0.5)`, and moves the fire from `(17, 1.5)` to `(34, 2)`. The
stage-to-fire distance is now 34.059 m. Every approved tent-to-fire relationship
is preserved.

Gate 10.2 is approved. The camp occupies a 22 m by 19 m durable
east-rim shelf reached by the extended spur. The central field remains low
audience meadow. A fern-and-boulder threshold, a moss-and-deadwood threshold,
and a sedge-and-firefly hollow give the open ground three site-specific causes.
The live review exposes hero, world, arrival, camp, and walk cameras. Its review
board shows the stage clearing, stage-to-camp separation, east shelf, and arrival
threshold. Austen advanced to the next Forest pass on 2026-08-09. The accepted
playable decision is tracked as `lTXVsp1LWwbWMTL02sQK`; the measured-plan
decision remains `Q9wYcOIrKi0DBs3srzgm`.

Gate 12 lighting and depth is approved as the Night Master. `ForestLighting.svelte`
owns one moon-aligned cool key, camera-side canopy fill, low ambient floor, and
a bounded stage pool. The global hemisphere is cool blue over deep green rather
than campfire orange. Warm fire bounce now falls off inside the east campsite,
and blue-green fog preserves the far tree line. A bounded 2048 px moon-shadow
map lets the stage and campsite cast contact shadows onto terrain and the camp
shelf. The 295-tree environment stays out of that depth pass, avoiding another
render of roughly 49 million processed vertices. Locked hero, stage, and camp
targets live in `./evidence/gate12/`. Austen locked revision 36 and approved the
five-gate atmosphere plan on 2026-08-10. Gate 13A now authors registered Dawn,
Day, Golden Hour, Dusk, and Night targets without changing geometry or public
controls. Tracker decision: `2h40cRvXHIL9szNFxb8c`.

Gates 8 and 9 remain approved. Austen reopened their framing direction for the
Gate 10 composition revision: intimate trees move upstage, the northwest exit
becomes a legible trail, and habitat-led ecology fills the performance bowl.
The stage form, four tree anchors, eight static props, six grass patches, four
mushroom colonies, five firefly fields, four restrained canopy bats, and the
modern campsite are now implemented. The authored Forest mounts three distinct
Meshy tent models on durable pads, five inward-facing chairs, and a Meshy
smokeless steel fire pit at runtime `(34.0, 2.0)`. Existing volumetric flame,
smoke, and camp lights remain the runtime behavior owners. The tent build applies
the deterministic `forest-clean-ripstop-v3` material. It replaces the Meshy
color atlases completely with a neutral seamless ripstop source, then tints a
fresh copy for each shelter. No source luminance, studio highlight, dark-mask
classification, or emissive texture survives. The exported material is
nonmetallic with 0.94 roughness, 0.10 specular response, restrained normal
strength, and a small uniform night color floor. Both camp lights remain warm
and local while the global Forest rig stays cool. The day-to-night control
remains a later gate. The approved Meshy pass used 120 credits total; its
paid-generation phase is closed.

The revised near-frame layer is a separate 12,083,200-byte production GLB. It
contains the Forest camp shelf, two distinct habitat anchors, four frame trees,
the worn trail, grass, and fungi. The default Forest route and Scene Lab mount
this same layer. Widened-layout callers supplying `clearingRadius`, including
Coven Hub at 28 m, omit it and make no network request for it. The main
environment export is a separate 17,177,092-byte GLB containing 295 trees across
13 authored clusters and masses. The former four procedural
`FOREST_TREE_RINGS` no longer exist, so Lab and production cannot disagree about
the woodland.

The campsite is a separate 2,153,112-byte Meshopt-compressed production GLB with
three Meshy tents, three tent pads, one Meshy smokeless fire pit, and five
chairs. Layout version 5 fits the shelter bodies independently on each axis,
rather than scaling their generated bounding boxes from height alone: the dome
is 2.25 x 2.45 x 1.10 m, the tunnel is 2.40 x 4.40 x 1.05 m, and the trekking
tent is 1.65 x 2.54 x 1.19 m. Its verifier confirms those final dimensions,
pad containment, the approved item IDs, runtime feature roles, a 34.059 m
stage-to-fire center distance, three graded tent materials, and positive safety
margin beyond the required tent-to-fire clearance for every shelter. The former
canvas tent, procedural fire ring, and their load-failure fallback have been
removed from the Forest runtime entirely.

Placement checks preserve the stage as the unobstructed center, keep the west
side of the camp open to the authored spur, and place the sleeping arc on its
own shelf beyond the audience meadow. The nearest approved frame tree remains
24.593 m from the fire. The direction is recorded under tracker decision
`cYHeDvPZV5zgbGyCTbh7`; the Gate 10.2 runtime visual verdict is pending.

Safety references:

- USDA Forest Service: campfires at least 15 ft from tents and other flammables
  when an existing ring is unavailable and fires are permitted.
- National Park Service: clear burnable material within a 10 ft circle and keep
  the fire small.
- Leave No Trace Center: prefer an established fire ring and durable campsite
  surfaces.
