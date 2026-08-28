# Flow Fest Sim Gate 3 material, lighting, and sound brief

Status: registered visual target, ready for review after verification. This is
not final production art and does not authorize Gate 4 interaction work.

## Visual thesis

The campground stays legible as Earth first. Terrain relief, clearing edges,
roads, and Austen's traced connectors lead the composition. Temporary festival
objects add human scale. The fictional fire jam becomes the hero only at night,
when a low fire focal plane, moving props, and a human perimeter become visible
through light instead of a tall landmark competing with the campground.

The target is an intentional low-poly site model. It is not a claim that the
campground contains faceted trees or the authored festival objects shown here.

## Spatial lock

- The full one-metre DTM, world frame, spawn, routes, zones, collision policy,
  and five Gate 2 cameras are immutable in Gate 3.
- Each registered camera keeps its exact world position, target, and 65 degree
  horizontal field of view. Viewport changes may alter projection only.
- Twelve canonical terrain-following path surfaces remain in place. Seven use
  Austen's traced connector vertices without drift.
- The 427 canopy candidates remain deterministic LiDAR local maxima. Their
  visual silhouette may change; their evidence coordinates do not.
- The measured Gate 1 plan is overview context, not a sixth beauty camera.

## Material families

| Family     | Treatment                                                                                                                                                                         | Truth class                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Terrain    | The registered orthophoto remains the color-detail owner. A restrained moment-specific multiply grade and rough response preserve roads and clearing edges.                       | measured                                   |
| Paths      | Vehicle surfaces use compacted neutral earth; traced pedestrian connectors use warmer soil; interpreted approaches remain quieter and partially transparent.                      | measured plus classified interpretation    |
| Canopy     | Four overlapping faceted crown masses create a continuous deciduous silhouette around each LiDAR peak. Trunks stay collision-visible.                                             | interpreted from measured surface evidence |
| Camps      | Canvas colors, matte vehicles, and human-scale spacing separate temporary occupation from the land.                                                                               | authored festival fiction                  |
| Fire jam   | A terrain-conforming open performance floor, central fire ring, 16 shared-avatar spectators, and three active fire artists form a broad circle with an open eastern arrival edge. | authored festival fiction                  |
| LED circle | A separate open-sided, flat-roof canopy supports a hanging LED ring, lit floor ring, and three active LED artists without reading as a teepee or replacing the fire circle.       | authored festival fiction                  |
| Field flow | Two shared-avatar jugglers occupy the open field between the circles. Their ambient loops are authored festival motion, not canonical TKA sequence claims.                        | authored festival fiction                  |

The bridge and permanent structures remain absent because their footprints are
not source-locked. Gate 3 does not disguise a guessed bridge as site truth.

## Lighting logic

The renderer uses linear-sRGB lighting, sRGB display output, and AgX tone
mapping. One 2048-pixel directional shadow owner follows the visitor and covers
a 92-metre local composition. This gives nearby trunks, tents, and terrain
contact without wasting one shadow map across the square-kilometre site.

A hemisphere light preserves sky/ground separation. One unshadowed directional
fill prevents black canopy cutouts. A restrained ambient lift protects material
color after tone mapping. Night adds only two local practical lights: the fire
circle and the LED-circle pool.

| Moment             |  Key | Fog density | Exposure | Intended read                         |
| ------------------ | ---: | ----------: | -------: | ------------------------------------- |
| Thursday afternoon | 2.70 |     0.00072 |     1.02 | terrain, tier edges, and camp choices |
| Thursday dusk      | 2.15 |     0.00094 |     1.05 | route memory and tree-line depth      |
| First night        | 0.52 |     0.00124 |     1.08 | people as silhouettes around light    |

## Atmosphere and hierarchy

1. Measured landform and tier edges.
2. Registered roads and traced connectors.
3. Temporary camps and parking.
4. The fire-jam spectator perimeter and active performance floor.
5. The separate LED circle.

Day is blue-green with warm late-afternoon sun. Dusk separates a cool upper sky
from a restrained warm horizon. Night uses blue-violet atmospheric depth; the
fire and LED installation provide the only saturated color in the clearing.

## Sound target for Gate 4

Gate 3 introduces no runtime audio. The next gate should prove one coherent
spatial mix in the production slice:

- quiet rural air and distant insects across the measured site;
- localized camp murmur that falls away before the connectors;
- a clearly bounded fire-jam bed at Middle Earth with a quieter LED-circle edge;
- one fire source tied to the visible fire circle;
- user-gesture unlock plus existing scene mute and volume preferences;
- no copyrighted event recordings or unverified ambience assets.

Audio must reinforce the same hierarchy as light. It cannot make an invented
path or permanent structure sound physically real.

## Gate 4 boundary

Gate 4 may replace visual-target primitives with production assets inside one
representative slice. It must preserve these camera compositions and spatial
owners, retain visible/collider parity, and prove the complete interaction in
the runtime. This brief does not approve a vehicle controller, final bridge,
touch locomotion, or release asset provenance.
