# Olive Cloudbreak celestial production contract

**Status:** Gate 1 revision 5 visual-integration pass ready for review

**Scene ID:** `seraphic-vault`

**Gate manifest:** `./scene-gates.json`

**Current creative provenance:** `zFBOeHQh11FPogHCOuQj`,
`gxtDuAKzjk0GEVbaIjrE`, `pHK4L3DvITTkhMyR6192`,
`YRzymqYQL7NHDnB2SSag`, `IhLgSyXG6tHNsFSDhv3H`

## Active outcome

The Celestial background becomes a sunlit natural refuge built from one broad
limestone landmass continuing behind the camera, a dry central terrace, two
olive trees, one peripheral lagoon, raised eroded mesas, thin waterfalls,
clouds, and one camera-centred angular sun. A weathered walking band connects
the terrace to a monumental rear limestone threshold, making the location feel
inhabited without turning it into a castle, temple, or arrival corridor. No
columns, feather vault, religious symbols, or disconnected display platform
survives into the new geometry.

## Active evidence

- Governing brief:
  `../active/2026-08-09-olive-cloudbreak-celestial-pivot.md`
- Gate 0 audit: `./gate0-cloudbreak-canon-audit.md`
- Measured layout: `scripts/seraphic-vault-cloudbreak-layout.json`
- Gate 1 revision 5 integration brief:
  `./seraphic-vault-gate1-r5-visual-integration.md`
- Gate 1 registered front:
  `./seraphic-vault-gate1-cloudbreak-r5-front.png`
- Gate 1 reverse camera:
  `./seraphic-vault-gate1-cloudbreak-r5-rear.png`
- Gate 1 measured overview:
  `./seraphic-vault-gate1-cloudbreak-r5-plan.png`
- Production olive comparison:
  `./seraphic-vault-gate1-cloudbreak-r5-trees.png`
- Optimized CC0 stone comparison:
  `./seraphic-vault-gate1-cloudbreak-r5-stone.png`
- In-app review route:
  `https://127.0.0.1:5176/test/celestial-asset-catalog`

The approved revision 2 front composition remains the starting point. Revision
5 integrates the revision 4 production assets into one material and atmospheric
language. The reflector is clipped to the lagoon's authored outline, two unique
CC0 clusters inherit the shelf limestone material, the overflow begins at the
waterline, the worn route is stronger, and the review uses the production cloud
panorama. The rear sanctuary remains an explicit spatial graybox until the
production-model pass. Gates 2 through 6 stay pending until this revised spatial
and asset read passes review.

---

# Superseded Seraphic Vault Phase 2 production history

**Status:** Gate 3.1 Sun-mode visual target ready for review

**Scene ID:** `seraphic-vault`

**Gate manifest:** `./scene-gates.json`

**Creative provenance:** `9jdkCjal42M5pqkTUtfW`, `tC1HqVtMXpyDLxSb2Sol`, `EiR6GvhtzW1A3OEaZ9Zi`, `n1v3Fdzxp8XZyuf5PQY0`, `7uC2ew1pteQ9fQDRapFJ`, `nRHSlTryZBPiIvGoK1w9`, `NqtbLpPGntxwmalkZDNL`, `JiBggDsnOzh9lY5S4wmU`

## Outcome

The Celestial background should read as Sun mode embodied by one inhabited
sanctuary within a much larger heavenly field. The feather vault and one
far-distant natural sun remain the first read. Four increasingly distant
platforms establish depth and implied
world scale without entering the protected center or reducing the usable
performance floor.

This is also a trial of the museum scene-production gates for fixed-camera 3D
environments. Room-navigation evidence is translated into measured composition,
performance clearance, camera sightlines, adaptive runtime behavior, and the
required viewport sweep. The base gate sequence remains unchanged.

## Authority ledger

| Concern              | Canonical owner                    | Evidence path                                                                     | Current conflict                                                                  |
| -------------------- | ---------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Creative direction   | Museum tracker                     | Items listed above                                                                | The environment-gate standard remains an open tracker question.                   |
| Active visual spec   | Seraphic Vault design              | `../active/2026-08-09-seraphic-vault-celestial-design.md`                         | None                                                                              |
| Current scene shell  | Deterministic Blender builder      | `scripts/build-celestial-environment.py`                                          | None                                                                              |
| Approved composition | Phase 2 layout contract            | `scripts/seraphic-vault-phase2-layout.json`                                       | Gate 1 approved; Gate 2 derives exact responsive transforms from it               |
| Blender coordinates  | Gate 2 coordinate manifest         | `./seraphic-vault-gate2-coordinate-manifest.json`                                 | Includes the real-feather clearance correction                                    |
| Review drawing       | Gate 1 generator                   | `scripts/generate-seraphic-vault-gate1.mjs`                                       | None; consumes the layout contract                                                |
| Blender output       | Celestial Blend and clean exporter | `blender/celestial_environment.blend`, `scripts/blender-export-celestial-full.py` | Production file remains unchanged; Gate 2 uses a separate review blend and GLB    |
| Runtime behavior     | Celestial scene owner              | `src/lib/shared/3d/environments/scenes/CelestialScene.svelte`                     | Gate 3.1 awaits approval before the unified solar owner and visual pass are built |
| Gate progression     | Evidence index                     | `./scene-gates.json`                                                              | Gate 5 revision 1 was rejected; Gate 3.1 is the active gate                       |

## Claim ledger

| ID    | Class     | Statement                                                                                                                 | Evidence or proposal source                         | Status                                               |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| C-001 | literal   | The current shell retains a 5.5 m clear performance radius and six mirrored feather ribs.                                 | GLB verifier and Blender builder                    | verified                                             |
| C-002 | invention | Four distant platforms use 30%, 18%, 10%, and 6% of the main deck's screen width.                                         | Austen's direction plus Opus 5 review               | Gate 1 approved                                      |
| C-003 | invention | Each platform has a different silhouette while preserving the same stone-and-feather civilization.                        | Opus 5 review, refined in the layout contract       | Gate 1 approved                                      |
| C-004 | invention | The center 20% of the hero frame remains free of distant platforms.                                                       | Phase 2 layout contract                             | verified by projection report                        |
| C-005 | invention | The main floor becomes cooler weathered marble while feather edges receive warmer backlight.                              | Opus 5 material review                              | renewed in Gate 3.1 target                           |
| C-006 | invention | A restrained circular floor inlay and stronger contact shadows establish the performance center.                          | Opus 5 material review                              | renewed in Gate 3.1 target                           |
| C-007 | invention | Layered cloud fields must reduce the severe open-blue gaps without hiding the sanctuary or distant platforms.             | Austen review, tracker `JHp6gIMCiG2cufT0j0GU`       | accepted direction; represented in Gate 2 massing    |
| C-008 | invention | The centered light needs a readable core and atmospheric corona so it reads as a sun rather than a plain ball.            | Austen review, superseded by `NqtbLpPGntxwmalkZDNL` | revised in Gate 3.1; graphic aureole rejected        |
| C-009 | invention | Eroded Halo occupies the upper-left field so the composition has two lower sanctuaries and two elevated sanctuaries.      | Austen direction, tracker `81biesVcUJSc9mqT8Dbl`    | accepted direction; represented in Gate 2 revision 3 |
| C-010 | invention | One natural white-gold sun governs the cloud glow, warm stone edges, floor reflection, and rays with no graphic ornament. | Austen review, tracker `NqtbLpPGntxwmalkZDNL`       | Gate 3.1 ready for review                            |

## Experience sentence

> The viewer enters through the default hero camera, reads the paired feather
> vault and natural far-distant sun first, discovers four cloud-wrapped sanctuaries outside
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

| Stop | Viewer position and action                   | First focus                    | Environment response                             | Next cue                                      |
| ---- | -------------------------------------------- | ------------------------------ | ------------------------------------------------ | --------------------------------------------- |
| 1    | Default hero camera; no input required       | Feather vault and centered sun | Main sanctuary holds the center                  | Broken silhouette at lower left               |
| 2    | Same camera; eye moves left                  | Broken Vigil                   | Nearest distant platform establishes world scale | Alternating right-side platform               |
| 3    | Same camera; eye crosses the frame           | Twin Choir and Eroded Halo     | Unique silhouettes prevent copy-paste repetition | Small high accent near the deep atmosphere    |
| 4    | Same camera; eye resolves the farthest value | Cloud Crown                    | Architecture dissolves into cloud and blue haze  | Eye returns to the centered performer and sun |

### Spatial artifacts

- Annotated floor plan: `./seraphic-vault-gate1-board-r2.png`
- Vertical section: `./seraphic-vault-gate1-board-r2.png`
- Attention-route storyboard: `./seraphic-vault-gate1-board-r2.png`
- Sightline study: `./seraphic-vault-gate1-board-r2.png`
- Plan contract: `scripts/seraphic-vault-phase2-layout.json`
- Automated report: `./seraphic-vault-gate1-report-r2.json`

### Measured platform schedule

| Platform     | World position `(x, y, z)` | Main-deck world scale | Hero-frame width | Silhouette                                    |
| ------------ | -------------------------: | --------------------: | ---------------: | --------------------------------------------- |
| Broken Vigil |    `(-32.97, -12.16, -18)` |                   46% |              30% | Partial deck and one broken outer feather arc |
| Twin Choir   |      `(39.34, -9.80, -28)` |                   33% |              18% | Narrow deck and two inner feather spires      |
| Eroded Halo  |     `(-16.45, -4.61, -42)` |                 22.2% |              10% | Weathered ring plinth without intact wings    |
| Cloud Crown  |      `(18.94, 13.08, -56)` |                 15.5% |               6% | Nearly abstract cloud-wrapped stone crown     |

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

| Platform     | Graybox silhouette                                       | Responsive correction                                        |
| ------------ | -------------------------------------------------------- | ------------------------------------------------------------ |
| Broken Vigil | Irregular deck, cloud collar, and one broken feather arc | Keeps the approved lower-left position                       |
| Twin Choir   | Narrow deck, cloud collar, and two tapered spires        | Keeps the approved lower-right position                      |
| Eroded Halo  | Narrow stone deck and a broken upright ring              | Moves into the upper-left field in every registered viewport |
| Cloud Crown  | Small deck, cloud collar, and five crown points          | Moves outside the outer ribs; rises above them in portrait   |

The first render exposed a handedness mismatch between Three.js and Blender,
which mirrored the left and right platform roles. The derived coordinate
contract now negates runtime X during Blender conversion. The next render
showed Eroded Halo and Cloud Crown hiding behind the real feather geometry, so
their responsive targets moved outward. Blender now projects every platform
mesh and every real feather vertex in all three registered cameras. No solid
platform silhouette overlaps a feather rib.

The first review packet remained hard to judge because its open blue field made
the scene feel unfinished and the unadorned sphere did not read as a sun.
Revision 2 keeps every platform transform locked and adds six responsive cloud
fields: two upper canopies, two middle banks, and two far shoulders. It also
replaces the review sphere with a brighter core, two aureole rings, and sixteen
short ray segments. These are still massing guides rather than production
cloud or lighting assets.

Revision 3 corrects the remaining vertical imbalance. Eroded Halo moves from
the lower field into the upper left while Broken Vigil and Twin Choir remain
below the main sanctuary. Cloud Crown remains the highest and farthest accent.
The result is a two-lower, two-upper field rather than three platforms hanging
below one tiny high ornament.

### Verification

- Every platform root lands within `0.0005` NDC of its registered target.
- Every responsive platform shell clears the main sanctuary envelope. The
  smallest calculated margin is `3.0 m` beyond the combined radii.
- The review GLB contains one scene, no cameras, all four platform families,
  six cloud-field guides, a complete solar proxy, and 113 tagged Gate 2 mesh
  nodes.
- SHA-256 digests cover the Blender source, coordinate contract, review GLB,
  five renders, verification report, and contact sheet.

### Approval

Austen approved Gate 2 on 2026-08-09 after reviewing revision 3: “gorgeous,
gate passed.” The two-lower, two-elevated geometry and all three registered hero
cameras are locked for Gate 3. Tracker item: `8gVDiuCU9YCztmsm3z1K`.

## Gate 3 revision 1: Registered visual target, superseded

- Locked cameras: `./seraphic-vault-gate3-camera-lock.json`
- Visual target board: `./seraphic-vault-gate3-visual-target-board.png`
- Desktop target: `./seraphic-vault-gate3-desktop-target.png`
- Portrait target: `./seraphic-vault-gate3-portrait-target.png`
- Landscape-phone target: `./seraphic-vault-gate3-landscape-phone-target.png`
- Material and lighting brief: `./seraphic-vault-gate3-material-lighting-brief.md`
- Image-generation record: `./seraphic-vault-gate3-imagegen-prompts.md`
- Registration report: `./seraphic-vault-gate3-registration-report.json`

### Visual target result

The registered targets turn the approved graybox into a dense cloud sea with
one centered white-gold sun. Cool weathered alabaster, a restrained marble
inlay, blue-gray cloud shadow, warm feather rims, and small iridescent mineral
seams form the production palette. The four sanctuary silhouettes retain their
approved left/right and vertical hierarchy across desktop, portrait, and
landscape-phone views.

The first desktop paint-over introduced a second solar hotspot above the
designed aureole. The corrected target removes it and makes the centered disc
the only source of warm light. All three final targets show one sun, six feather
ribs, four separated sanctuaries, and a clear central performer lane.

### Verification

- Each target preserves its registered Gate 2 aspect ratio within `0.15%`.
- The camera lock fingerprints the approved coordinate manifest and every Gate
  2 source render before pairing it with the corresponding Gate 3 target.
- The target board preserves Broken Vigil lower left, Twin Choir lower right,
  Eroded Halo upper left, and Cloud Crown highest at upper right.
- The material brief maps the target into the existing Blender, GLB, Threlte,
  and environment-selection owners without changing their responsibilities.

### Approval question

Does this board establish the material, light, cloud density, and visual
hierarchy that Gate 4 should build, with the centered disc as the only sun and
the approved four-sanctuary composition still intact?

### Approval

Austen approved Gate 3 on 2026-08-09 after reviewing the registered target:
“Let's proceed.” The visual target now governs the production slice. Tracker
item: `fifsjuE9ozKxErBHnSON`. This revision was later superseded because its
graphic aureole produced the wrong Sun-mode read in the integrated runtime.

## Gate 3.1: Sun-mode visual target

- Locked cameras: `./seraphic-vault-gate3-1-sun-mode-camera-lock.json`
- Visual target board: `./seraphic-vault-gate3-1-sun-mode-board.png`
- Desktop target: `./seraphic-vault-gate3-1-sun-mode-desktop-candidate.png`
- Portrait target: `./seraphic-vault-gate3-1-sun-mode-portrait-candidate.png`
- Horizontal-phone target:
  `./seraphic-vault-gate3-1-sun-mode-landscape-phone-candidate.png`
- Material and lighting brief:
  `./seraphic-vault-gate3-1-sun-mode-material-lighting-brief.md`
- Image-generation record:
  `./seraphic-vault-gate3-1-sun-mode-imagegen-prompts.md`
- Registration report:
  `./seraphic-vault-gate3-1-sun-mode-registration-report.json`

### Sun-mode target result

The revised target removes the ring-and-spoke aureole. One natural white-gold
solar disc now sits beyond the architecture and opens the cloud field around
it. Its corona dissolves into cloud light, and the same direction governs warm
rib edges, cloud tops, sanctuary crowns, and the quiet reflection across the
stage.

The full second visual pass is registered with the sun as its governing source:
denser foreground cloud depth, responsive framing, cooler lower-third contrast,
weathered pearl alabaster, a more grounded stage, atmospheric sanctuary contact,
restrained iridescence, slow layered motion, and protected prop and trail
readability. The approved Gate 2 geometry and platform coordinates remain
unchanged.

### Gate 3.1 verification

- All three targets preserve the registered Gate 2 aspect ratios within `0.15%`.
- Desktop, portrait, and horizontal-phone views retain six feather ribs, one
  clear performer lane, and four separated sanctuary roles.
- Manual target audit confirms one natural sun with no rings, spokes, glyphs,
  sigils, or second solar hotspot.
- The gate manifest archives the former Gate 3, Gate 4, and rejected Gate 5
  evidence before resetting production to this earliest affected gate.
- The scene-gate validator passes with Gate 3.1 as `ready-for-review` and all
  later gates returned to `pending`.

### Gate 3.1 approval question

Does this now read as Sun mode because one natural white-gold sun governs the
cloud light, warm rib edges, sanctuary highlights, and floor reflection, with
no graphic aureole remaining? Museum review item: `JiBggDsnOzh9lY5S4wmU`.

## Gate 4 revision 1: Production slice, superseded

- Runtime slice: `./seraphic-vault-gate4-vertical-slice.md`
- Desktop evidence: `./seraphic-vault-gate4-desktop.png`
- Interaction capture: `./seraphic-vault-gate4-interaction-capture.gif`
- Performance report: `./seraphic-vault-gate4-performance-report.json`
- Image-generation record: `./seraphic-vault-gate4-imagegen-prompt.md`

### Production result

Gate 4 finishes Broken Vigil as the representative distant sanctuary. Its
weathered deck, cool inlays, fractured edge, and broken feather crest sit at the
approved lower-left desktop coordinate. The main platform now uses cooler
alabaster, mineral veining, two restrained inlay rings, and a more responsive
surface sheen. A sunless cloud panorama fills the open blue field while the
existing procedural cloud layer and god rays provide continuous motion.

The solar treatment has one bright core, two aureole rings, twelve radial rays,
and one restrained light fan. The panorama contains no competing light source.
The celestial audio path extends the shared scene-audio engine with Choir of
Air and exposes the same play, pause, volume, and mute states as the ocean
background.

### Verification

- The main GLB is 3,028,348 bytes and the Broken Vigil GLB is 694,324
  bytes. Both pass their structural verifiers and use meshopt, KTX2, and mesh
  quantization.
- A 300-frame Chromium sample at 1920 by 1080 averaged 16.61 ms per frame,
  with 60.19 estimated frames per second, a 16.8 ms p95, and no frame over 25
  ms.
- The runtime reported environment progress at 20 and 100 percent, then
  `environment READY`. It produced no errors or warnings.
- The audio control changed from Play to Pause after a pointer unlock. The
  24-frame GIF records the active audio state together with cloud and god-ray
  motion.
- Full `svelte-check` completed with zero errors and zero warnings at the error
  threshold. The focused audio registry test passed.
- The visual sweep passed at 1920, 2560, 3840, 1440, tablet, landscape phone,
  and portrait phone sizes. Gate 4 judges Broken Vigil in the registered
  desktop frame; Gate 5 remains responsible for all four responsive distant
  sanctuaries.

### Approval question

Does this finished slice read as a weathered angelic sanctuary suspended inside
a deep cloud sea, with Broken Vigil as the lower-left secondary destination and
the aureole as the scene's only sun?

### Approval

Austen passed Gate 4 on 2026-08-09 while identifying one correction for the
integrated environment: the aureole currently reads too close to the feather
architecture. Gate 5 must restore a clear far-distance read without introducing
a second sun. Gate 4 approval is recorded in `n1v3Fdzxp8XZyuf5PQY0`; the solar
depth requirement is recorded in `7uC2ew1pteQ9fQDRapFJ`. Gate 3.1 supersedes
this slice's solar, lighting, cloud, and material target, so Gate 4 must be
proved again after approval.

## Gate 5 revision 1: Integrated environment, rejected

- Integration report: `./seraphic-vault-gate5-integrated-environment.md`
- Desktop evidence: `./seraphic-vault-gate5-desktop.png`
- Integrated camera sweep:
  `./seraphic-vault-gate5-integrated-camera-sweep.gif`
- Transition captures: `./seraphic-vault-gate5-transition-captures.gif`
- Audio review: `./seraphic-vault-gate5-audio-review.md`
- State and performance report:
  `./seraphic-vault-gate5-performance-report.json`

### Integrated result

One optimized GLB now contains Broken Vigil, Twin Choir, Eroded Halo, and Cloud
Crown. The runtime positions their four roots from the approved responsive
coordinate manifest. Their stone silhouettes remain distinct, while 32
translucent cloud-collar meshes and distance grading bind them into the same
atmosphere.

The aureole moved behind the full architectural field to `z = -110`. Its
self-luminous meshes remain unfogged, so it holds as the scene's only sun while
its depth, scale, and surrounding haze make it read beyond every sanctuary.

### Verification

- The integrated GLB is 1,391,168 bytes and passes its structural verifier with
  four responsive roots, 64 nodes, 59 meshes, and every required semantic role.
- The original Gate 4 slice still passes its verifier with the approved digest.
- Hero, aisle, stage, and profile camera presets preserve the platform field and
  usable main deck.
- The shared transition owner completed Seraph to Cosmic to Seraph to Ocean to
  Seraph. Both returns restored all four sanctuaries.
- `Choir of Air` and volume `0.7` returned with Seraph. The focused audio test
  and ten transition tests passed.
- A 300-frame Chromium sample averaged 16.62 ms, estimated 60.17 FPS, and had no
  frame over 25 ms.
- The seven target viewports preserve the two-lower, two-elevated composition.

### Approval question

Does the sun now read beyond every sanctuary, with Broken Vigil lower left,
Twin Choir lower right, Eroded Halo upper left, and Cloud Crown highest upper
right? The answer was no: the drawn aureole remained the weakest element in a
scene intended to represent Sun mode. Review tracker `nRHSlTryZBPiIvGoK1w9`
records the rejection, and `NqtbLpPGntxwmalkZDNL` records the approved full
visual-pass direction.

## Gate 6: Final acceptance

- Acceptance sweep:
- Seven-viewport evidence:
- Regression report:
- Known limitations:
