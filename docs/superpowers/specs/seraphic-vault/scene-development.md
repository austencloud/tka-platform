# Seraphic Vault Phase 2 production contract

**Status:** Gate 2 graybox ready for review

**Scene ID:** `seraphic-vault`

**Gate manifest:** `./scene-gates.json`

**Creative provenance:** `9jdkCjal42M5pqkTUtfW`, `tC1HqVtMXpyDLxSb2Sol`, `EiR6GvhtzW1A3OEaZ9Zi`

## Outcome

The Celestial background should read as one inhabited sanctuary within a much
larger heavenly field. The current feather vault and centered sun remain the
first read. Four increasingly distant platforms establish depth and implied
world scale without entering the protected center or reducing the usable
performance floor.

This is also a trial of the museum scene-production gates for fixed-camera 3D
environments. Room-navigation evidence is translated into measured composition,
performance clearance, camera sightlines, adaptive runtime behavior, and the
required viewport sweep. The base gate sequence remains unchanged.

## Authority ledger

| Concern | Canonical owner | Evidence path | Current conflict |
|---|---|---|---|
| Creative direction | Museum tracker | Items listed above | The environment-gate standard remains an open tracker question. |
| Active visual spec | Seraphic Vault design | `../active/2026-08-09-seraphic-vault-celestial-design.md` | None |
| Current scene shell | Deterministic Blender builder | `scripts/build-celestial-environment.py` | None |
| Approved composition | Phase 2 layout contract | `scripts/seraphic-vault-phase2-layout.json` | Gate 1 approved; Gate 2 derives exact responsive transforms from it |
| Blender coordinates | Gate 2 coordinate manifest | `./seraphic-vault-gate2-coordinate-manifest.json` | Includes the real-feather clearance correction |
| Review drawing | Gate 1 generator | `scripts/generate-seraphic-vault-gate1.mjs` | None; consumes the layout contract |
| Blender output | Celestial Blend and clean exporter | `blender/celestial_environment.blend`, `scripts/blender-export-celestial-full.py` | Production file remains unchanged; Gate 2 uses a separate review blend and GLB |
| Runtime behavior | Celestial scene owner | `src/lib/shared/3d/environments/scenes/CelestialScene.svelte` | Runtime remains unchanged through Gate 2 |
| Gate progression | Evidence index | `./scene-gates.json` | None |

## Claim ledger

| ID | Class | Statement | Evidence or proposal source | Status |
|---|---|---|---|---|
| C-001 | literal | The current shell retains a 5.5 m clear performance radius and six mirrored feather ribs. | GLB verifier and Blender builder | verified |
| C-002 | invention | Four distant platforms use 30%, 18%, 10%, and 6% of the main deck's screen width. | Austen's direction plus Opus 5 review | Gate 1 approved |
| C-003 | invention | Each platform has a different silhouette while preserving the same stone-and-feather civilization. | Opus 5 review, refined in the layout contract | Gate 1 approved |
| C-004 | invention | The center 20% of the hero frame remains free of distant platforms. | Phase 2 layout contract | verified by projection report |
| C-005 | invention | The main floor becomes cooler weathered marble while feather edges receive warmer backlight. | Opus 5 material review | deferred to Gate 3 visual target |
| C-006 | invention | A restrained circular floor inlay and stronger contact shadows establish the performance center. | Opus 5 material review | deferred to Gate 3 visual target |

## Experience sentence

> The viewer enters through the default hero camera, reads the paired feather
> vault and centered sun first, discovers four cloud-wrapped sanctuaries outside
> the protected center, performs on the unchanged clear floor, and leaves through
> the normal environment transition with the sense that the vault continues far
> beyond the frame.

## Gate 0: Evidence preflight

### Sources and conflicts

- Room shell: current optimized Seraph GLB and deterministic Blender builder.
- Entry and exit: normal environment transition; this fixed-camera background
  has no architectural door.
- Adjacent transitions: owned by the shared environment transition system and
  unchanged in Phase 2.
- Performer roster: one centered performance zone; no performer asset changes.
- Exact sequences: not applicable because the environment does not encode a TKA
  sequence.
- Canon conflicts: the 2026-05 procedural Celestial spec is historical; the
  active 2026-08 Seraph spec controls.

### Live motion proof

Not required. The plan contains no motion-derived literal claim.

## Gate 1: Measured composition plan

### Attention route

| Stop | Viewer position and action | First focus | Environment response | Next cue |
|---|---|---|---|---|
| 1 | Default hero camera; no input required | Feather vault and centered sun | Main sanctuary holds the center | Broken silhouette at lower left |
| 2 | Same camera; eye moves left | Broken Vigil | Nearest distant platform establishes world scale | Alternating right-side platform |
| 3 | Same camera; eye crosses the frame | Twin Choir and Eroded Halo | Unique silhouettes prevent copy-paste repetition | Small high accent near the deep atmosphere |
| 4 | Same camera; eye resolves the farthest value | Cloud Crown | Architecture dissolves into cloud and blue haze | Eye returns to the centered performer and sun |

### Spatial artifacts

- Annotated floor plan: `./seraphic-vault-gate1-board-r2.png`
- Vertical section: `./seraphic-vault-gate1-board-r2.png`
- Attention-route storyboard: `./seraphic-vault-gate1-board-r2.png`
- Sightline study: `./seraphic-vault-gate1-board-r2.png`
- Plan contract: `scripts/seraphic-vault-phase2-layout.json`
- Automated report: `./seraphic-vault-gate1-report-r2.json`

### Measured platform schedule

| Platform | World position `(x, y, z)` | Main-deck world scale | Hero-frame width | Silhouette |
|---|---:|---:|---:|---|
| Broken Vigil | `(-32.97, -12.16, -18)` | 46% | 30% | Partial deck and one broken outer feather arc |
| Twin Choir | `(39.34, -9.80, -28)` | 33% | 18% | Narrow deck and two inner feather spires |
| Eroded Halo | `(-16.45, -4.61, -42)` | 22.2% | 10% | Weathered ring plinth without intact wings |
| Cloud Crown | `(18.94, 13.08, -56)` | 15.5% | 6% | Nearly abstract cloud-wrapped stone crown |

### Approval question

Before Gate 2, describe the picture back in four parts: what remains the first
read, where the four platforms sit relative to the center, how their detail
fades with distance, and what stays clear for the performer. A matching read is
the Gate 1 visual-comprehension approval.

### Independent review result

Opus 5 returned `revise` on 2026-08-09. The original projection check proved
frame fit and central-band clearance, but it did not prevent paired platforms
from occupying the same screen columns or three platforms from collapsing onto
one screen-height band. See `./2026-08-09-opus-gate1-review.md`.

Revision 2 authors the platform centers in camera NDC and back-solves the world
transforms for desktop, portrait phone, and landscape phone. The validator now
requires at least `0.15` NDC separation on both axes, central-band clearance,
desktop outer-feather-mask clearance, frame fit, and the 30/18/10/6 width
hierarchy. The rejected revision 1 evidence remains beside the active board.

The proposed portrait camera widens from 68 to 78 degrees so all four platforms
remain visible without shrinking the desktop composition.

Opus 5 reviewed revision 2 and returned `ready`. Gate 2 must nudge Eroded Halo
outward and check it against the real projected feather silhouette because the
planning mask leaves only a nominal margin. See
`./2026-08-09-opus-gate1-r2-review.md`.

Austen approved Gate 1 on 2026-08-09: “Looks fine to me, let's put it
together.” Tracker item: `EiR6GvhtzW1A3OEaZ9Zi`.

## Gate 2: Playable composition graybox

- Blender source: `blender/seraphic_vault_phase2_graybox.blend`
- Coordinate manifest: `./seraphic-vault-gate2-coordinate-manifest.json`
- Review GLB: `static/models/celestial/review/seraphic-vault-phase2-graybox.glb`
- First-person walk: replaced by registered orbit and hero-camera captures for
  this fixed-camera environment.
- Contact sheet: `./seraphic-vault-gate2-contact-sheet.png`
- Registered renders: `./seraphic-vault-gate2-desktop.png`,
  `./seraphic-vault-gate2-portrait.png`,
  `./seraphic-vault-gate2-landscape-phone.png`,
  `./seraphic-vault-gate2-overview.png`, and
  `./seraphic-vault-gate2-profile.png`
- Automated report: `./seraphic-vault-gate2-report.json`
- Blender projection proof: `./seraphic-vault-gate2-verification.json`

### Graybox result

The graybox reuses the real Seraph floor, Meshy feather ribs, QA clouds, sun,
and lighting. Only the four distant platform families are primitive massing:

| Platform | Graybox silhouette | Responsive correction |
|---|---|---|
| Broken Vigil | Irregular deck, cloud collar, and one broken feather arc | Keeps the approved lower-left position |
| Twin Choir | Narrow deck, cloud collar, and two tapered spires | Keeps the approved lower-right position |
| Eroded Halo | Narrow stone deck and a broken upright ring | Moves outward on desktop and landscape; drops below the ribs in portrait |
| Cloud Crown | Small deck, cloud collar, and five crown points | Moves outside the outer ribs; rises above them in portrait |

The first render exposed a handedness mismatch between Three.js and Blender,
which mirrored the left and right platform roles. The derived coordinate
contract now negates runtime X during Blender conversion. The next render
showed Eroded Halo and Cloud Crown hiding behind the real feather geometry, so
their responsive targets moved outward. Blender now projects every platform
mesh and every real feather vertex in all three registered cameras. No solid
platform silhouette overlaps a feather rib.

### Verification

- Every platform root lands within `0.0005` NDC of its registered target.
- Every responsive platform shell clears the main sanctuary envelope. The
  smallest calculated margin is `3.0 m` beyond the combined radii.
- The review GLB contains one scene, no cameras, all four platform families,
  and 46 tagged Gate 2 mesh nodes.
- SHA-256 digests cover the Blender source, coordinate contract, review GLB,
  five renders, verification report, and contact sheet.

### Approval question

In your read of the board, is the main sanctuary still clearly first, with
Broken Vigil and Twin Choir as the lower flanks, Eroded Halo as the smaller ring
ruin, and Cloud Crown as the high far accent? Gate 3 begins only after that
spatial relationship is approved.

## Gate 3: Registered visual target

- Locked cameras:
- Visual target board:
- Material and lighting brief:
- Registration report:

## Gate 4: Production slice

- Runtime slice:
- Interaction capture:
- Performance report:

## Gate 5: Integrated environment

- Integrated camera sweep:
- Transition captures:
- Audio review:
- State and performance report:

## Gate 6: Final acceptance

- Acceptance sweep:
- Seven-viewport evidence:
- Regression report:
- Known limitations:
