# Broken Rift Gate Look Development

Status: selected visual language  
Date: 2026-08-25  
Spatial authority: `scene-development.md`, Direction E

## Purpose

Direction E won the spatial comparison. Its graybox is not an art target. This
pass tests four visual languages inside the same geometry so material mood does
not quietly rewrite the spatial decision.

Every treatment uses the same meshes, performer proxy, cameras, render engine,
and output resolution. Only procedural materials, world color, exposure, and
lighting change.

## Treatments

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

## R2 outcome

**Blackglass Mineral Rift is selected as Ember's visual language.** It wins as
a palette and material system, not as a frozen render target.

| Rank | Treatment | Result |
| ---: | --- | --- |
| 1 | Blackglass Mineral Rift | Best hot-cold separation, strongest performer readability, and the only surrounding field that reads mostly as cooled geology rather than an orange ocean. |
| 2 | Blackglass Blue Hour | Strong premium contrast, but the broad molten field overpowers the environment and flattens its scale. |
| 3 | Ash Eclipse | Coherent, but collapses basalt, atmosphere, and lava into brown-orange soup. |
| 4 | Sulfur Furnace | Distinctive mineral idea, but the full olive-yellow treatment looks muddy and sickly. Its ochre survives only as a sparse accent. |
| 5 | Ironstorm | Aggressive and readable, but repeats Ember's existing neon-red hell problem instead of solving it. |

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

## Deliverables

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

## Next production gate

Build one authored gate fragment and one authored ground tile using the
selected material hierarchy. Prove them in the real Viewer3D lighting and orbit
before producing the rest of the environment. This gate tests geometry quality,
texture scale, silhouette, and web performance without turning the entire
graybox into expensive final art at once.
