# Moonlit Winter Hollow production contract

**Status:** Gate 1 revision 2 ready for visual review; production scene unchanged

**Scene ID:** `moonlit-winter-hollow`

**Gate manifest:** `./scene-gates.json`

**Controlling plan:**
`../../plans/active/2026-08-08-winter-environment-pass-three.md`

**Creative provenance:** `tZdDqKHsPqx8pQ7C5KC9`

This file is the evidence index for the Winter settlement composition pass.
The controlling plan remains the owner of the wider environment production.
Revision 2 replaces the unapproved straight stage-to-hearth-to-lodge chain with
a measured retreat triangle. No revision 2 coordinates enter the production
scene until Austen approves this visual gate.

## Outcome

Moonlit Winter Hollow should read as a maintained seasonal practice retreat,
not an uninhabited asset field. The stage remains the first focal point. A
packed route and broad snow ramp explain how performers reach it. A separate
five-seat hearth pocket and a nearby warming lodge make the clearing feel used
without turning it into a campsite. The natural pond remains a different,
fully frozen landmark.

## Authority ledger

| Concern                     | Canonical owner                   | Evidence path                                                          | Current conflict                                              |
| --------------------------- | --------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| Creative direction          | Museum proposal                   | `tZdDqKHsPqx8pQ7C5KC9`                                                 | Story remains provisional until visual acceptance             |
| Experience and pass order   | Winter controlling plan           | `../../plans/active/2026-08-08-winter-environment-pass-three.md`       | None                                                          |
| Proposed spatial geometry   | Winter Gate 1 revision 2 contract | `../../../../scripts/winter-composition-gate1-r2.json`                 | Production still uses the revision 1 settlement coordinates   |
| Current production geometry | Winter settlement contract        | `../../../../scripts/winter-settlement-layout.json`                    | Superseded for review, unchanged at runtime                   |
| Tree composition            | Winter tree contract              | `../../../../scripts/winter-tree-layout.json`                          | Settlement exclusions invalidate the earlier open tree review |
| Blender output              | Deterministic Winter builder      | `../../../../scripts/build-winter-environment.py`                      | Graybox geometry is not a final asset                         |
| Runtime fire                | Shared Winter scene owner         | `../../../../src/lib/shared/3d/environments/scenes/WinterScene.svelte` | Must consume the same hearth coordinate                       |
| Sky, moon, and stars        | Shared sky primitives             | `../../../../src/lib/shared/3d/environments/scenes/WinterScene.svelte` | Moon scale is a later gate                                    |

## Claim ledger

| ID    | Class     | Statement                                                                                                                               | Evidence or proposal source                            | Status            |
| ----- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------- |
| C-001 | invention | An unnamed seasonal caretaker maintains a warming lodge for four or five visiting performers.                                           | `tZdDqKHsPqx8pQ7C5KC9`                                 | proposed          |
| C-002 | invention | The ice stage is a low timber-and-stone deck deliberately flooded into a level illuminated floor.                                       | `tZdDqKHsPqx8pQ7C5KC9`                                 | proposed          |
| C-003 | literal   | Revision 2 places the lodge 44.9 m from the stage and the hearth 12.8 m from the lodge in a 3.1 m cleared pocket.                       | `../../../../scripts/winter-composition-gate1-r2.json` | measured proposal |
| C-004 | literal   | A broad snow ramp and packed route connect the south entry, performance deck, and lodge while the hearth stays out of the traffic lane. | `../../../../scripts/winter-composition-gate1-r2.json` | measured proposal |
| C-005 | invention | The pond is natural and fully frozen; open water is a visual defect rather than story canon.                                            | `tZdDqKHsPqx8pQ7C5KC9`                                 | proposed          |

## Experience sentence

> The player enters through the south snow corridor, meets the lit performance
> deck first, follows the packed route toward the lodge, and discovers the
> hearth in a separate lodge-side pocket. The natural frozen pond sits opposite
> the warm refuge as a quiet secondary landmark.

## Active settlement target

- Entry center: runtime `(8, 38)`.
- Stage center: runtime `(0, 0)`, 5 m radius, 0.45 m high.
- Lodge center: runtime `(-24, -38)`, 7.8 x 6.4 m footprint on a
  2.6 m target pad.
- Hearth center: runtime `(-34, -30)`, 3.1 m cleared radius on a
  2.45 m target pad.
- Natural pond center: runtime `(16, -10)`, 6 x 4.4 m radii, fully frozen.
- Seating: five inward-facing seats on a 3.05 m arc, with the stage-facing side
  open for arrival.
- Access: a broad stage ramp and packed route held to a 12% maximum grade.
- Negative space: stage performance core, hearth fuel-clear pocket, lodge yard,
  and the route shoulders remain free of trees.
- Hero camera: runtime position `(10, 5.2, 30)`, target `(-6, 1.8, -9)`,
  44-degree field of view.

## Current gate boundary

This pass stops at spatial composition. The review board and measured contract
are proposals; the lodge, hearth, pond, paths, and camera have not moved in the
production scene. No Meshy credits are authorized. Final furniture, wildlife,
bundled ambient people, and lighting polish remain later gates. Austen must
visually confirm the focal order and landmark relationships before the
revision enters the scene.

## Gate 1 approval question

Does the review board read as performance ice first, lodge second, hearth
beside the lodge but off the route, and a distinct frozen pond opposite them?
