# Broken Rift Gate Look Development

Status: historical Gate 3 study; superseded by the geology-first Gate 1.1 R3 restart

Date: 2026-08-27

Former spatial authority: `scene-development.md`, Direction E

Reopen authority: museum tracker `rn25Qau62kXyyOJpgm7Z`

Selection authority: museum tracker `QRHbwRQLhM7Zn9LyYHOd`

Current authority is `geology-lava-composition-research.md` and the R3 evidence
named by `scene-gates.json`. Nothing in this document is an active Gate 3
approval or current geometry contract.

## Purpose

Direction E won the spatial comparison. Its graybox is not an art target. The
first production pass met the technical contract but failed an adversarial art
review: the scene still read as primitive geological props, the hero identity
was weak, and multiple orbit sectors depended on darkness to hide thin or
generic compositions.

The regression preserves the measured floor relationship, 4.5 m performer
clearance, performer orientation, responsive-stage behavior, hero location,
and ten-camera registration set. It replaces the geological art direction with
three editable Blender targets. Each target uses original scene-authored hero
geometry. Poly Haven CC0 rock assets appear only as secondary talus and
perimeter geology.

## Gate 3 regression targets

### 1. Riven Lava Tube

A collapsed lava-tube shell breaks into six weathered fragments around a wide
negative-space aperture. Localized clinker anchors the bases, and a narrow hot
seam sits behind the opening instead of becoming a glowing stage border.

Strength: the most iconic front silhouette and the clearest performer-to-landmark
relationship.

Risk: the portal mass becomes dominant from the rear camera. Production art
must preserve the fractured crown and irregular ends without rebuilding a
smooth fantasy arch.

### 2. Columnar Furnace

Two asymmetric cooling-joint escarpments peel apart around a narrow horizon
aperture. Five-, six-, and seven-sided columns vary in height, lean, radius,
depth, and cap profile. Collapsed entablature interrupts the vertical rhythm at
the bases.

Strength: strongest eight-angle structure, clearest geological basis, and the
best path from visual target to performant modular runtime art.

Risk: excessive repetition would turn the formation back into organ pipes.
Production must retain asymmetric height profiles, broken caps, missing
columns, and buried base transitions.

### 3. Obsidian Shear

Six low fault benches step away from a three-plate glassy shear fan. The low
profile keeps every orbit sector open and lets violet atmosphere, reflective
obsidian, and sparse red heat carry more of the identity.

Strength: best all-angle openness and the most distinct material identity.

Risk: the hero is intentionally lower and therefore least monumental from the
default camera. The glass plates need strong environment reflections in the
runtime renderer or they will collapse into dark slabs.

## Shared registration contract

- Performer and prop proxies remain readable from all eight orbit sectors.
- The performer retains a measured 4.5 m unobstructed action radius.
- Hero center remains `(0.6, -13.8, 0.0)` in Blender target coordinates.
- All three targets share the same hero, seven additional orbit, detail, and
  orthographic plan cameras.
- Basalt, ash shelf, obsidian, and live fissures remain separate material
  families.
- Live heat stays narrow and orange. It cannot return to the blown-out white
  tubes or broad molten field rejected during the first pass.
- Secondary geology encircles the stage outside the clear action radius, so no
  camera sees a single decorated edge against an empty world.

## Adversarial scorecard

These scores judge the registered targets, not a finished runtime scene.

| Target           | Hero silhouette | Material separation | Atmospheric depth | Eight-angle composition | Originality | Runtime path | Mean |
| ---------------- | --------------: | ------------------: | ----------------: | ----------------------: | ----------: | -----------: | ---: |
| Columnar Furnace |             8.7 |                 8.4 |               8.0 |                     8.5 |         8.3 |          8.8 |  8.5 |
| Riven Lava Tube  |             9.0 |                 8.2 |               7.8 |                     7.8 |         8.5 |          7.7 |  8.2 |
| Obsidian Shear   |             7.7 |                 8.7 |               8.2 |                     8.6 |         8.6 |          8.0 |  8.3 |

## Approved direction

**Columnar Furnace is selected.** Austen approved the recommendation after
reviewing the registered comparison and orbit evidence: “I will take your
recommendation.”

The production target is two asymmetric fractured cooling-joint escarpments
framing the performer and a narrow horizon aperture. Gate 4 must preserve:

- irregular five- to seven-sided column profiles;
- asymmetric height, lean, depth, radius, and cap rhythms;
- missing joints and buried collapsed entablature at both bases;
- blue-green cold light across readable basalt faces;
- localized orange heat behind the aperture and inside narrow fissures;
- the full 4.5 m performer action radius and responsive stage behavior;
- secondary geology across the complete orbit without rebuilding a prop ring.

Riven Lava Tube and Obsidian Shear remain rejected comparison evidence. Their
portal and low-shear identities must not be blended into the selected hero.

## Research basis

- National Park Service documentation on columnar jointing informed the
  irregular five- to seven-sided cooling-joint family rather than a uniform
  cylinder array.
- USGS descriptions of smooth, hummocky, ropy, glass-skinned lava informed the
  shelf and restrained live-fissure hierarchy.
- Poly Haven's CC0 license covers the secondary rock assets. None of those
  assets defines a hero silhouette.

## Gate 3 R3 deliverables

- `blender/ember-broken-rift-lookdev-r3.blend`: three independently editable
  target scenes plus a hidden CC0 support library.
- `evidence/lookdev-r3/ember-lookdev-r3-comparison-board.png`: locked hero-camera
  comparison.
- `evidence/lookdev-r3/ember-lookdev-r3-riven-lava-tube-orbit-board.png`:
  eight-sector Riven proof.
- `evidence/lookdev-r3/ember-lookdev-r3-columnar-furnace-orbit-board.png`:
  eight-sector Columnar proof.
- `evidence/lookdev-r3/ember-lookdev-r3-obsidian-shear-orbit-board.png`:
  eight-sector Obsidian proof.
- `evidence/lookdev-r3/ember-lookdev-r3-report.json`: shared cameras, palettes,
  support placements, mesh counts, render paths, and editable-source digest.

Gate 3 is approved. Gate 4 was separately authorized in museum tracker
`gME4uHJawz9dtTlirRl8`; Austen's adversarial art-revision direction is recorded
in `5otAzYdNg5Wp5E27mgfo`.

The selected look remains a direction, not a literal image-matching target.
Gate 4 Revision 4 deliberately departs from the registered target where the
translation produced organ-pipe repetition, a neon-zipper fissure, horizontal
procedural bands, or emissive interface-like lozenges. The current production
boundary preserves the selected material hierarchy and columnar identity while
using nested geological mass, negative space, occluded heat, and coordinated
full-orbit outcrops. Its review evidence lives in `evidence/gate-4-columnar-r4/`.

## Gate 4 Volcanic World R5 amendment

R4 solved several surface-level tells but remained compositionally contained.
Austen's R5 direction, recorded in museum tracker `nu73zqvPJRxio4T2sWz7`, is
larger than adding more scenery: Ember should read as a lava landscape or the
interior of a volcano, with distant scale and a credible molten river.

R5 therefore treats the registered Columnar Furnace as one formation inside a
larger world rather than the world itself. One continuous basin now carries
near, middle, and far geological mass; the far field terminates at an active
vent rather than a flat backdrop; and an open lava river descends along an
authored channel, skirts the performer, and exits the camera frame. The river's
dark rafted crust and bright mobile leads are informed by USGS descriptions of
crusted channel flow, but the result remains an art-directed real-time material
rather than a fluid simulation.

The selected Blackglass Mineral Rift palette still governs the cold basalt and
hot accents, but the old prohibition against a broad molten field is narrowed:
an open river is now correct when it has visible banks, dark crust, downhill
movement, and localized light rather than behaving like a flat orange floor.
The current proof is `evidence/gate-4-volcanic-r5/`. It is the new review
boundary, not a literal final target. Its best river-side composition reaches a
top-tier read; the complete orbit still exposes smooth distant slopes, a simple
vent crown, and weaker rear composition.

## Gate 4 Volcanic World R6 continuity correction

Tracker `ATURN84Ov2hmjWUndebl` records Austen's correction that R5 still read as
a contained vignette. R6 does not replace the Columnar Furnace or Blackglass
Mineral Rift language. It expands the single terrain owner around the camera to
380 by 335 metres, distributes eight asymmetrical geological provinces across
foreground, middle distance, and horizon, and cuts three low saddles that read
as routes onward instead of closing the scene into a bowl.

The lava contract now runs from the distant vent through the negative-Z
audience side of the frame. Fog and the scene clear colour share one horizon
value, while the volcanic haze follows the active camera so free orbit cannot
outrun the atmosphere. Registered evidence lives in
`evidence/gate-4-volcanic-r6/`. Runtime capture remains pending because the
checkout currently returns an unrelated SvelteKit virtual-CSS HTTP 500.

## Historical R2 material study

The earlier pass tested four visual languages inside the same geometry so
material mood did not quietly rewrite the spatial decision.

Every treatment uses the same meshes, performer proxy, cameras, render engine,
and output resolution. Only procedural materials, world color, exposure, and
lighting change.

### Treatments

### 1. Blackglass Blue Hour

Cold blue-black basalt and reflective obsidian with narrow amber lava seams.
The volcanic heat is a sharp accent inside a mostly moonlit environment.

Question: can Ember feel expensive and geological without becoming an orange
fog scene?

### 2. Ash Eclipse

Warm gray ash, soot-brown basalt, a dim rust horizon, and lava light diffused
through particulate atmosphere.

Question: can the environment feel scorched and ancient while keeping enough
value separation around the performer?

### 3. Sulfur Furnace

Olive-black basalt, pale mineral crust, sulfur ochre highlights, and golden
lava. This is the most naturalistic and least conventional hell palette.

Question: does mineral color make Ember distinctive, or merely muddy?

### 4. Ironstorm

Iron-rich red-black basalt under a violet storm sky, with hard red lava and
cold lightning-colored key light.

Question: can the scene keep its aggressive hellish energy without returning
to monochrome red overload?

### 5. Blackglass Mineral Rift

This refinement was earned by the first four-look comparison rather than
selected in advance. It keeps Blackglass Blue Hour's cold-hot separation,
cools most of the surrounding lava field into near-black crust, roughens the
obsidian shelf, and borrows only a restrained mineral ochre from Sulfur
Furnace.

Question: can the strongest treatment become quieter, more geological, and
more useful to the performer without losing Ember's heat?

## Comparison criteria

1. Performer and prop readability at every camera.
2. Three clearly separated material families: basalt, obsidian shelf, molten
   field.
3. Hot light remains an accent rather than flattening the entire frame.
4. The treatment remains recognizable when the hero landmark is partly out of
   frame.
5. The result does not resemble a generic lava level, nightclub, or neon
   screensaver.
6. The material logic can be translated into a web production asset without
   relying on Blender-only tricks.

### R2 outcome

**Blackglass Mineral Rift is selected as Ember's visual language.** It wins as
a palette and material system, not as a frozen render target.

| Rank | Treatment               | Result                                                                                                                                                     |
| ---: | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
|    1 | Blackglass Mineral Rift | Best hot-cold separation, strongest performer readability, and the only surrounding field that reads mostly as cooled geology rather than an orange ocean. |
|    2 | Blackglass Blue Hour    | Strong premium contrast, but the broad molten field overpowers the environment and flattens its scale.                                                     |
|    3 | Ash Eclipse             | Coherent, but collapses basalt, atmosphere, and lava into brown-orange soup.                                                                               |
|    4 | Sulfur Furnace          | Distinctive mineral idea, but the full olive-yellow treatment looks muddy and sickly. Its ochre survives only as a sparse accent.                          |
|    5 | Ironstorm               | Aggressive and readable, but repeats Ember's existing neon-red hell problem instead of solving it.                                                         |

The selected language consists of:

- blue-black basalt carrying the cold key light;
- rough, dark obsidian rather than mirror-black plastic;
- mostly cooled crust with sparse live fissures;
- orange heat localized to cracks, fall edges, and reflected pools;
- pale mineral deposits used selectively to break the basalt family;
- a cool performer silhouette that survives every tested camera.

The proxy boulders, current gate fragments, shelf silhouette, procedural noise,
and exact light placements remain replaceable. Production art should express
the same contrast hierarchy with authored geological forms.

### R2 deliverables

- `blender/ember-broken-rift-lookdev-r2.blend`: five independently editable
  Blender scenes, including the earned refinement.
- `evidence/lookdev-r2/ember-lookdev-r2-hero-board.png`: fixed-camera treatment
  comparison.
- `evidence/lookdev-r2/ember-lookdev-r2-plan-board.png`: fixed-scale topology
  comparison.
- `evidence/lookdev-r2/ember-lookdev-r2-blackglass-mineral-camera-board.png`:
  selected treatment from all four shared cameras.
- `evidence/lookdev-r2/ember-lookdev-r2-report.json`: palettes, cameras, object
  counts, and output paths.

### Superseded next production gate

Build one authored gate fragment and one authored ground tile using the
selected material hierarchy. Prove them in the real Viewer3D lighting and orbit
before producing the rest of the environment. This gate tests geometry quality,
texture scale, silhouette, and web performance without turning the entire
graybox into expensive final art at once.
