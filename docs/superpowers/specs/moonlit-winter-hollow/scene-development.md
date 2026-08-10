# Moonlit Winter Hollow production contract

**Status:** Fire-court revision Gate 1 approved; Gate 2 graybox ready for visual review

**Scene ID:** `moonlit-winter-hollow`

**Gate manifest:** `./scene-gates.json`

**Controlling plan:**
`../../plans/active/2026-08-08-winter-environment-pass-three.md`

**Creative provenance:** retreat-triangle approval `nXwi8yYiKJRSBi3rgAZs`;
fire-court intimacy approval `ZIy3eIKYhqXkcrXffhik`; left-clearing placement
revision `Uc9pWzGSfjfWI25LVQt7`; grounded live-performer revision
`Mu1MpX08ohPIVqCOj1fL`

This file is the evidence index for the Winter settlement composition pass.
The controlling plan remains the owner of the wider environment production.
Revision 5 replaces the separate ice performance deck and hearth with Austen's
approved intimate fire court, then shifts that entire gathering seven metres
farther left into the broad clearing he identified as the intended spinning
area. The production snow is now regraded beneath that placement instead of
burying the gathering. The three spinner proxies are replaced at runtime by
detailed animated avatars using poi, staff, and fans with the canonical 3D fire
effect. The natural pond stays fully frozen on the other side of the arrival
path. A modest indoor practice wing attaches to the lodge so the same ten
friends have somewhere to juggle when the weather closes in.

## Outcome

Moonlit Winter Hollow should read as a maintained seasonal practice retreat,
not an uninhabited asset field or public festival. The first destination is a
low, irregular fire-safe court for three spinners. Four friends sit on a short
informal bench crescent, two stand nearby, and one tends the prop rack. The
packed route passes between this gathering and the quiet frozen pond before it
reaches the lodge and attached indoor practice wing.

## Authority ledger

| Concern                        | Canonical owner                   | Evidence path                                                                                      | Current conflict                                              |
| ------------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Creative direction             | Museum decisions                  | `nXwi8yYiKJRSBi3rgAZs`, `ZIy3eIKYhqXkcrXffhik`                                                     | None                                                          |
| Experience and pass order      | Winter controlling plan           | `../../plans/active/2026-08-08-winter-environment-pass-three.md`                                   | None                                                          |
| Approved spatial geometry      | Fire-court revision 1 contract    | `../../../../scripts/winter-fire-court-graybox-r1.json`                                            | None                                                          |
| Underlying production geometry | Winter settlement contract        | `../../../../scripts/winter-settlement-layout.json`                                                | Old ice deck remains hidden only in the revision review route |
| Tree composition               | Winter tree contract              | `../../../../scripts/winter-tree-layout.json`                                                      | Settlement exclusions invalidate the earlier open tree review |
| Blender graybox                | Isolated fire-court builder       | `../../../../scripts/build-winter-fire-court-graybox.py`                                           | Graybox geometry is not a final asset                         |
| Underlying Blender output      | Deterministic Winter builder      | `../../../../scripts/build-winter-environment.py`                                                  | Regraded beneath the approved court contract                  |
| Runtime performers and fire    | Canonical performer/effect owners | `../../../../src/lib/shared/3d/environments/scenes/winter/graybox/WinterFireCourtPerformer.svelte` | Review choreography is not final authored content             |
| Sky, moon, and stars           | Shared sky primitives             | `../../../../src/lib/shared/3d/environments/scenes/WinterScene.svelte`                             | Moon scale is a later gate                                    |

## Claim ledger

| ID    | Class     | Statement                                                                                                                                 | Evidence or proposal source                                                                        | Status                      |
| ----- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------- |
| C-001 | invention | An unnamed seasonal caretaker maintains a warming lodge for four or five visiting performers.                                             | `nXwi8yYiKJRSBi3rgAZs`                                                                             | approved                    |
| C-002 | invention | The ice stage is a low timber-and-stone deck deliberately flooded into a level illuminated floor.                                         | `nXwi8yYiKJRSBi3rgAZs`                                                                             | approved                    |
| C-003 | literal   | Revision 2 places the lodge 44.9 m from the stage and the hearth 12.8 m from the lodge in a 3.1 m cleared pocket.                         | `../../../../scripts/winter-composition-gate1-r2.json`                                             | built and verified          |
| C-004 | literal   | A broad snow ramp and packed route connect the south entry, performance deck, and lodge while the hearth stays out of the traffic lane.   | `../../../../scripts/winter-settlement-layout.json`                                                | built and verified          |
| C-005 | invention | The pond is natural and fully frozen; open water is a visual defect rather than story canon.                                              | `nXwi8yYiKJRSBi3rgAZs`                                                                             | approved                    |
| C-006 | invention | The outdoor gathering is exactly ten friends rather than a public audience.                                                               | `ZIy3eIKYhqXkcrXffhik`                                                                             | approved                    |
| C-007 | literal   | The graybox places three spinners inside a 5.2 x 4.1 m fire court, with four seated, two standing, and one rack-tending friend outside.   | `../../../../scripts/winter-fire-court-graybox-r1.json`                                            | built and verified          |
| C-008 | invention | A double-height practice wing is physically attached to the keeper's lodge for cold-weather juggling.                                     | Austen's approved fire-court concept                                                               | approved                    |
| C-009 | literal   | The production snow continues the zero-metre clearing grade beneath the shallow court inset, preventing snow from burying the performers. | `../../../../scripts/build-winter-environment.py`                                                  | built and verified          |
| C-010 | literal   | Three detailed runtime avatars perform simultaneously with poi, staff, and fans, each using the shared 3D fire effect.                    | `../../../../src/lib/shared/3d/environments/scenes/winter/graybox/WinterFireCourtPerformer.svelte` | built and visually verified |

## Experience sentence

> The player enters through the south snow corridor with an intimate fire jam
> on the left and a quiet frozen pond on the right, then follows the shared path
> to the keeper's lodge and its warm indoor practice wing.

## Active settlement target

- Entry center: runtime `(8, 38)`.
- Fire-court center: runtime `(-13, -7)`, 5.2 x 4.1 m radii, 0.12 m
  surface elevation, with a 1.2 m fire-safety apron.
- Lodge center: runtime `(-24, -38)`, 7.8 x 6.4 m footprint on a
  2.6 m target pad.
- Practice-wing center: runtime `(-29.2, -39)`, 4.2 x 5.4 m footprint,
  attached to the lodge with 0.8 m measured overlap.
- Natural pond center: runtime `(16, -10)`, 6 x 4.4 m radii, fully frozen.
- Gathering: three spinners, four seated friends, two standing friends, and one
  rack tender. Two lanterns mark the court entry.
- Access: one 2.2 m packed-snow arrival spine passes between court and pond,
  with a 1.6 m social spur through the court's east-side opening.
- Negative space: the spinner core, fire-safety apron, lodge yard, pond bank,
  and route shoulders remain free of trees.
- Hero camera: runtime position `(7, 5.2, 30)`, target `(-13, 1.2, -9)`,
  44-degree field of view.

## Current gate boundary

The fire-court Gate 1 revision is locked at the left-clearing placement Austen
directed. Gate 2 is an isolated editable
Blender graybox mounted over the regraded live Winter terrain. It hides the old ice
platform only when `asset=fire-court-graybox-r1`, leaving production behavior
unchanged elsewhere. The overlay contains the court, exact ten-person social
layout, short bench crescent, prop rack, two entry lanterns, revised path
ribbon, lodge wood stack, attached practice wing, and three canonical runtime
performer rigs. The underlying frozen pond, lodge, terrain, sky, and forest
remain their existing runtime owners.

Gate 2 remains a composition and walkability review. Seven audience people
remain proxies; court materials, practice-wing architecture, path surface, and
the three demo choreography loops are not final authored content. Final pond
modeling, atmospheric lighting, wildlife, bundled audience models, and
interaction polish remain later gates.

## Gate 2 approval question

From the live hero, court, walk, and world views, does this feel like ten
friends sharing a winter fire jam, with the court clearly left of the arrival
path, the frozen pond clearly right of it, and the lodge practice wing reading
as the warm destination beyond?
