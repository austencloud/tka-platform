# Moonlit Firefly Forest production contract

**Status:** Gates 0 through 8 approved; Gate 9 production slice awaiting visual verdict

**Scene ID:** `forest-firefly`

**Gate manifest:** `./scene-gates.json`

**Controlling plan:**
`../../plans/active/2026-08-08-forest-environment-pass-one.md`

**Creative provenance:** `rSguQqdHHv8fKNbDnmPv`, `W8SPNRGyTmAbzoV1GvFR`,
`2mXvGcaruOaXMvBjZ3dd`, `PoPSyJvOcDbpppYKubmr`,
`DlJ4UAevLxMFd2jA3VTf`, `v7A3GRTREIH4OuohvBOX`,
`UFY4AuUL80NTJMojrRBN`

This file is an evidence index for the scene-production gate contract. The
controlling plan remains the single creative and implementation owner.

## Outcome

The Forest should read as an intimate performance clearing grown into a living
woodland. The stage remains the first focal point, the inhabited camp is
second, and the forest depth is third. A mature southwest trunk at 13.20 m and
a southeast elm at 17.89 m compress the default hero view while leaving the
stage keep-clear zone and authored paths usable. The underlying 30 m flat
terrain survives as a geometry budget, while widened-layout callers omit the
near-frame layer.

## Authority ledger

| Concern                   | Canonical owner                | Evidence path                                                        | Current conflict                                           |
| ------------------------- | ------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| Creative direction        | Museum tracker                 | Tracker items above                                                  | None                                                       |
| Story canon               | Museum story bible             | `docs/museum/story-bible.md`                                         | None                                                       |
| Experience and gate order | Forest controlling plan        | Plan linked above                                                    | None                                                       |
| Spatial geometry          | Forest path and tree contracts | `scripts/forest-path-layout.json`, `scripts/forest-tree-layout.json` | None                                                       |
| Blender output            | Deterministic Forest builder   | `scripts/build-forest-environment.py`                                | Gate 9 near frame is isolated from the Coven-safe main GLB |
| Runtime behavior          | Forest runtime scene           | `src/lib/shared/3d/environments/scenes/ForestScene.svelte`           | Legacy tent and fire geometry remain until Gate 11         |
| Cross-scene coordination  | Bramble and Elsa log           | `../active/2026-08-08-bramble-elsa-scene-coordination.md`            | No shared owner in Gate 9                                  |

## Claim ledger

| ID    | Class     | Statement                                                                                                                         | Evidence or proposal source                                   | Status                   |
| ----- | --------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------ |
| C-001 | literal   | The terrain stays level through 30 m; the legacy runtime config declares a 14 m clearing radius.                                  | Forest path contract, runtime config, and Gate 1 verification | locked                   |
| C-002 | literal   | Ground ecology is caused by named habitats rather than even scatter.                                                              | Gate 7 metrics and Austen approval                            | locked                   |
| C-003 | invention | Selected near trees create a smaller default visual clearing while widened-layout callers omit that layer.                        | Austen Gate 8 approval and Gate 9 runtime proof               | locked                   |
| C-004 | invention | The camp shelter is a hand-built moss-canvas lean-to with oak poles.                                                              | Gate 8 revision 1 visual target                               | rejected by Austen       |
| C-005 | literal   | Poly Haven boulder and rock sources are CC0 and already used by approved Autumn production.                                       | Source asset pages and Autumn builder                         | verified                 |
| C-006 | invention | The camp uses a contemporary two-person dome, three-person tunnel, and one-person trekking-pole tent as one cohesive gear family. | Austen Gate 8 approval                                        | locked production target |
| C-007 | literal   | The proposed fire pocket provides a 3.05 m fuel-clear circle and at least 4.57 m from each tent edge and the stage.               | Forest campsite contract and official fire guidance           | verified                 |

## Experience sentence

> The player enters along the south woodland path, follows the open ground
> because the stage and warm camp light establish the focal order, interacts by
> performing in the registered clearing, witnesses the forest respond through
> later atmosphere systems, reaches a framed view of camp and canopy, and exits
> through either authored forest route.

## Active registered visual target

- Contemporary tent target: `./forest-modern-tent-family-target.png`
- Gate 8 board: `./forest-gate8-review-board.png`
- Gate 9 board: `./forest-gate9-review-board.png`
- Framing target: selected approved Forest trees move into the side and overhead
  picture edges with a visible southwest foreground trunk. Coven Hub and other
  widened-layout callers omit this conditional layer.
- Campsite target: one established fire bed at `(9.0, -4.5)`, three durable tent
  pads in one north/east sleeping arc, modern chairs around the communal center,
  and an open south arrival from the existing camp spur.
- Rock target: CC0 photogrammetry family already proven in Autumn, adapted with
  Forest ground contact and moss rather than radial placement.
- Deadwood target: approved Autumn fallen log plus Forest-authored split and
  branch variants, each tied to nearby moss, fungi, roots, and litter.

The obsolete `forest-shelter-visual-target.png` is retained only as rejected
revision evidence. It is not an active target and must not enter production.

## Gate boundary

Gate 8 is approved. Gate 9 places only the approved frame trees and static edge
props. Stage form, modern tents, fire-bed geometry, chairs, lighting, and
atmosphere remain blocked behind later gates. Paid Meshy work remains blocked
by the agreed 800-credit reserve unless Austen sets a new budget.

The Gate 9 slice exports two near-frame trees and six static props as a separate
5,646,416-byte production GLB. The default Forest route mounts the layer. Scene
Lab and any caller supplying `clearingRadius`, including Coven Hub at 28 m, do
not mount it. The Coven route also makes no network request for the layer. The
main environment export remains 17,175,916 bytes and contains no near-frame
nodes.

The west root shelf and east runoff shoulder have different causes and only one
hero log between them. Placement checks preserve 3.548 m of path-shoulder
margin, 8.043 m from the current campfire center, and a 5.595 m maximum distance
from prop to tree anchor. Browser review covers all seven required viewports.
The slice awaits Austen's Gate 9 visual verdict.

Safety references:

- USDA Forest Service: campfires at least 15 ft from tents and other flammables
  when an existing ring is unavailable and fires are permitted.
- National Park Service: clear burnable material within a 10 ft circle and keep
  the fire small.
- Leave No Trace Center: prefer an established fire ring and durable campsite
  surfaces.
