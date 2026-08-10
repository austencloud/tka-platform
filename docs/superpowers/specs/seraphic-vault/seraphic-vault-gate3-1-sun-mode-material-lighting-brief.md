# Seraphic Vault Gate 3.1 Sun-mode material and lighting brief

**Status:** Ready for Gate 3.1 review

**Spatial authority:** Approved Gate 2 revision 3

**Visual-pass authority:** Museum decision `NqtbLpPGntxwmalkZDNL`

**Supersedes:** The solar and lighting direction in the approved Gate 3 target

## Target sentence

Seraphic Vault is the embodiment of Sun mode: one far-distant white-gold sun
opens the cloud sea, lights the feather architecture, and lays a warm path across
the stage while the lower clouds remain cool, deep, and calm.

## The sun

- One natural solar disc is the brightest point in every registered view.
- A soft corona dissolves into the surrounding clouds. It is atmospheric light,
  not a drawn halo.
- The sun, god rays, cloud highlights, rib-edge light, floor reflection, and
  runtime light source share one projected position.
- The disc feels far beyond the sanctuary. It never reads as a ball placed
  between the ribs.
- No rings, spokes, glyphs, sigils, radial ornaments, or second solar hotspot.
- Bloom preserves a readable core. The sun may glow, but it cannot become a
  flat white patch.

## Material families

| Family | Target | Working palette | Surface behavior |
|---|---|---|---|
| Carved feather stone | Cool pearl alabaster with chipped edges, hairline cracks, mineral variation, and restrained opal seams | `#D8DEE5`, `#BAC6D4`, `#BFDDE6`, `#D9C4ED` | Rough stone body, narrow warm rim response, no glossy white plastic |
| Performance floor | Pale weathered marble with subtle radial inlay and a quiet solar reflection | `#E9E2D7`, `#C7CED8`, `#9EA9B8` | Broad readable plane, soft contact shadow, no mirror finish |
| Cloud volume | Dense ivory cumulus with cool blue-gray undersides | `#F6F1E8`, `#DCE2E8`, `#75849B`, `#4F607A` | Layered foreground, middle, and far depth with soft occlusion around platform edges |
| Solar focus | Natural white-gold disc with cloud-scattered corona | `#FFF8DC`, `#F2D18A`, `#D99A4D` | Bright readable core, soft atmospheric falloff, one governing direction |
| Distant sanctuaries | The same stone culture with increasing cool shift and decreasing detail | Near `#D6D8D8` to far `#93A9C0` | Broken Vigil remains most legible; Cloud Crown approaches a clean silhouette |

## Lighting logic

- The upper middle opens around the sun while surrounding clouds contain the
  frame. Empty blue sky never becomes a major shape.
- Warm light catches the sun-facing rib edges, the tops of cloud banks, the
  stage horizon, and the crowns of the distant sanctuaries.
- The lower third stays cool enough for pale props, trails, and interface chrome
  to remain readable.
- Contact shadows hold the ribs and cloud banks to the main platform.
- Iridescence appears only at grazing angles and never competes with the sun.
- Exposure changes smoothly across camera presets. No preset clips the cloud
  highlights or buries the floor.

## Composition and integration

- The six feather ribs and broad central performer lane remain unchanged.
- Broken Vigil stays lower left, Twin Choir lower right, Eroded Halo upper left,
  and Cloud Crown highest at upper right.
- Foreground cloud masses overlap the platform edge and create a near layer.
  They do not enter the protected performer lane.
- Each distant sanctuary receives cloud contact, scale haze, and solar rim light
  so it belongs to the same atmosphere as the main sanctuary.
- Responsive framing protects the sun, the clear stage, and all four sanctuary
  silhouettes across desktop, portrait, and horizontal-phone cameras.

## Atmospheric motion

- Cloud drift is slow, layered, and directionally consistent.
- Corona breathing and light movement remain below the threshold of conscious
  attention.
- Motes stay sparse near the performer and cannot look like snow, dust, or stars.
- Nothing rotates around the sun or recreates the rejected graphic aureole.

## Runtime ownership

- One solar owner controls the disc, corona, projected light position, and ray
  origin.
- The optimized environment GLB owns the performance floor and six carved ribs.
- `CelestialScene.svelte` owns runtime atmosphere, cloud motion, motes, fog,
  quality adaptation, and distant sanctuary assembly.
- `Environment3D.svelte` remains the only environment selection, transition,
  and stage-alignment owner.
- Gate 3.1 changes art direction and light behavior. Gate 2 coordinates, platform
  assignments, and camera presets remain binding.

## Acceptance conditions

1. At first glance, the scene reads as Sun mode rather than a generic heaven.
2. The sun looks natural, distant, and physically connected to the scene light.
3. Clouds surround the viewer with clear foreground, middle, and far layers.
4. The stage remains the cleanest and most usable area of the composition.
5. Stone reads as carved mineral and feather structure, never plastic or literal
   bird plumage.
6. The four distant sanctuaries remain readable without challenging the main
   sanctuary.
7. Props and trails remain legible against the cool lower third.
8. Desktop, portrait, and horizontal-phone views preserve the same visual story.

## Rejection conditions

- A ring, spoke, sigil, glyph, or ornament appears around the sun.
- The sun reads as a nearby ball, a flat decal, or an unrelated glow.
- Light rays, shadows, cloud highlights, and floor reflection disagree about the
  sun's position.
- Open sky or empty negative space dominates the frame.
- Foreground clouds cover the performer lane or feel like opaque foam props.
- White materials flatten into one value or clip under bloom.
- Any distant sanctuary crosses a feather silhouette or the protected central
  performer band.
- Gardens, trees, foliage, coral, stars, statues, people, or unrelated ruins
  enter the scene.

## Production translation

The registered images are visual targets, not runtime assets. The next
production slice must prove the unified sun and lighting system first, then the
cloud enclosure, material response, stage integration, sanctuary atmosphere,
and restrained motion under the approved responsive cameras.
