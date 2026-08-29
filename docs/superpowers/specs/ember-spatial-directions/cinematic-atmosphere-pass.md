# Ember Gate 4 cinematic atmosphere pass

- Status: ready for Austen's visual review
- Authorization: museum tracker `sDKmB6cUEXLfHgz4DGd4`
- Geometry boundary: locked R7 production slice
- Meshy spend: zero

## Question

Can the committed R7 volcanic world stop reading as one gray material band by
changing runtime atmosphere, material response, and light interaction alone?

The pass keeps the 380 by 335 metre terrain, seventeen-point lava river,
performer clearance, stage-growth owner, and all four Meshy geology modules
unchanged. It extends the existing Ember haze, particle, heat-distortion, lava,
and shared shadow systems rather than creating parallel effects.

## Registered audition

Three looks use the same production geometry, hero camera, performer, and
viewport:

1. **Blackglass Inferno**: black volcanic glass, red cloud horizon, orange lava
   bounce, and a cool opposing geology rim.
2. **Furnace Storm**: brighter orange storm light, denser smoke, and a hotter
   global value range.
3. **Sulfur Caldera**: yellow-green atmospheric contamination and muted sulfur
   mineral response.

The comparison is recorded in
`evidence/gate-4-atmosphere-r1/ember-atmosphere-look-board.png`.

## Decision

Blackglass Inferno is selected. Furnace Storm flattens the world by pushing the
terrain, sky, performer, and stage into the same orange band. Sulfur Caldera is
readable, but its green-yellow identity competes with Ember instead of
supporting it. Blackglass gives the lava the highest contrast, preserves dark
geology, separates the Meshy escarpment with cool rim light, and keeps the
performer readable.

The first Blackglass runtime frame exposed two defects that were corrected
before evidence capture: low-roughness stage highlights formed rectangular
glitter bands, and an ochre response made shelf strata read as orange trim.
The selected material treatment now keeps the stage matte, the strata dark,
and the reflected lava light local.

## Runtime result

- Three-look comparison:
  `evidence/gate-4-atmosphere-r1/ember-atmosphere-look-board.png`
- Eight-sector orbit:
  `evidence/gate-4-atmosphere-r1/ember-blackglass-orbit-board.png`
- Seven required viewports:
  `evidence/gate-4-atmosphere-r1/ember-blackglass-viewport-board.png`
- Machine-readable capture and frame-time report:
  `evidence/gate-4-atmosphere-r1/ember-atmosphere-runtime-report.json`

The 1920 by 1080 frame-time sample held 60.28 average FPS over 180 frames with
a 16.8 ms p95. The orbit remains a continuous volcanic landscape on every
side. Rear sectors are intentionally quieter than the breached-caldera hero
side, but they retain the lava channel, rolling terrain, cloud ceiling, and
the same stage-to-world value relationship.

## Honest bar

This pass removes the graybox lighting read and establishes a coherent
cinematic world. It does not claim final Gate 4 approval. The remaining gap to
a literal AAA reference is asset-level terrain variation at middle distance:
the large authored basin still carries broader, more repeated surface detail
than the four Meshy formations. That is a later geometry/material-source
decision, not a reason to compromise this selected runtime look.
