# Guitar 3D Prop Rebuild

## Decision

Replace the procedural Guitar fallback with one production GLB. The target is a compact steel-string acoustic stage prop: immediately recognizable as a real guitar, light and shallow enough to read as manipulatable, and reinforced around the neck grip used by the existing motion system. It should match the canonical 2D asset's acoustic silhouette rather than inventing a fantasy flow toy or a generic electric-guitar outline.

## Evidence

- The current `Guitar3D.svelte` is two flattened spheres, a rectangular neck, and a white torus. In the live scene it reads as two plates attached to a ruler, not a guitar.
- The canonical `static/images/props/guitar.svg` establishes a long neck, 3+3 headstock, waisted acoustic body, sound hole, bridge, frets, and six-string construction.
- Yamaha's current acoustic specifications put a full-size instrument near 1.03 m overall, with a roughly 0.50 m body, 0.38-0.42 m body width, and 0.63-0.65 m scale length. The runtime model keeps those relationships while compressing the total length to the existing 0.80 m prop envelope.
- Physical flow props favor durable, balanced construction and readable silhouettes in motion. The model expresses that with a shallow impact-resistant shell, rounded binding, a reinforced neck, and no fragile floating ornament.

Primary proportion reference: [Yamaha TransAcoustic specifications](https://usa.yamaha.com/products/musical_instruments/guitars_basses/ac_guitars/ta_series/specs.html). Anatomy reference: [Yamaha Guide to Choosing an Acoustic Guitar](https://www.yamaha.com/US/houseofworship/downloadables/How-to-Choose-Guides/Yamaha-Guide-to-Choosing-an-Acoustic-Guitar.pdf).

## Geometry contract

- Root: `TKA_Guitar`
- Local long axis: Y, with headstock toward positive Y and body toward negative Y
- Hand pivot: world origin, inside the lower neck; no separate grip sleeve or floating ring
- Authored length: approximately 0.80 m, preserving the existing Guitar reach
- Maximum body width: approximately 0.30 m; shell depth: approximately 0.075 m
- Silhouette: a continuous rounded acoustic outline with distinct lower bout, waist, upper bout, heel, tapered neck, and crowned 3+3 headstock
- Required readable parts: front soundboard, darker sides/back, binding, recessed sound hole and rosette, bridge and saddle, raised fretboard, metal frets, position markers, six strings, nut, six tuning machines, heel, end pin, and an asymmetric pickguard
- Grip: the neck itself is the grip. A subtle flattened back and slightly thicker reinforcement at the world origin make the hold believable without changing the visible guitar anatomy.
- Stage readability: the sound hole, pale binding, fretboard, bridge, and metal hardware retain fixed contrast while the shell and neck recolor blue or red.
- Budget: at most 1.25 MB, 38,000 triangles, one scene, no cameras, no lights, normals and UVs on every primitive

## Material contract

- `TKA_Guitar_Recolor`: body shell, soundboard, neck back, and headstock face. Runtime blue/red recoloring targets only materials whose names contain `Recolor`.
- `TKA_Guitar_Fretboard`: fixed near-black walnut fretboard, bridge, heel cap, and pickguard
- `TKA_Guitar_Binding`: fixed warm ivory edge binding, nut, saddle, and position markers
- `TKA_Guitar_Metal`: fixed satin metal strings, frets, tuner posts, and tuning keys
- `TKA_Guitar_SoundHole`: fixed dark recessed cavity

Legacy single-material GLBs continue to recolor as before. The Guitar's fixed detail materials must retain contrast after either hand color is applied.

## Integration

- Export to `static/models/props/guitar.glb`.
- Register `PropType.GUITAR` in the scene package prop model registry at scale 1 and grip offset 0.
- Register `PropType.UKULELE` against the same authored model at a smaller scale so the existing family relationship continues to work without duplicating geometry.
- Keep `Guitar3D.svelte` as the loading/failure fallback.
- Preserve the production viewer's prop cascade. Explicit scene prop overrides must outrank cached performer defaults so the review studio and viewer embeds show the requested model.

## Review studio

Use `/test/prop-3d-studio` with the production viewer, one avatar, generated 16-count rotated LOOPs, seam-safe continuous playback, and the fixed front, three-quarter, profile, rear, top, and grip cameras. The model must stay attached to both hands, rotate around the neck origin, remain readable at full-body distance, and survive at least one automatic LOOP swap.

## Verification

1. Run a structural GLB verifier for scene structure, named nodes, materials, bounds, pivot, UVs, normals, file size, and triangle count.
2. Run focused unit tests for explicit prop override precedence, selective runtime recoloring, Guitar registry resolution, and Ukulele scale reuse.
3. Run the project type checker against captured output.
4. Inspect Blender proof renders from front, three-quarter, profile, and rear cameras.
5. Inspect the live model at all seven required viewport sizes and every studio camera, including one automatic LOOP transition.
6. Give the visual evidence to a separate reviewer, apply sound suggestions, then rerun structural, focused, and live visual proof.
