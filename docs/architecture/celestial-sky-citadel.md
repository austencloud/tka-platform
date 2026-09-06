# Celestial Sky Citadel

Celestial is a heavenly castle and surrounding archipelago. A winged gateway,
cloistered performance courtyard, bridges, monastery, beacon and distant ruins
give the camera places to discover. The armillary and solar rose keep astronomy
within the architecture. The earlier Blender studies remain available.

## Source and runtime

- Editable source: `blender/celestial/sky-citadel.blend` (packed textures).
- Authoring: `scripts/build-celestial-citadel.py`, run with Blender 5.0 in background mode.
- Export: `scripts/blender-export-celestial-citadel.py`, then
  `node scripts/optimize-celestial-citadel.mjs`.
- Shared measurements: `scripts/celestial-citadel-layout.json`.
- Runtime asset: `static/models/celestial/sky-citadel.glb`, 9,352,796 bytes;
  material/role batching, 24 instanced olives, WebP textures and Meshopt compression.
- Architecture, terrain and mineral textures are original Blender work. The
  olive is reused from the shipped Meshy asset in `sunward-gardens.blend`.
- Clouds use a seeded 64³ density texture generated in memory and ray marching.
  The cloud sea and six distant cumulus volumes stay in world space. No cloud
  photograph is requested by the production world. Low tier uses fewer samples.
- Both production renderers use the same world factory, floor measurements,
  reflective pool and cloud implementation. Reduced motion freezes cloud drift.

## Verification

Reviewed Blender output and the live app at all seven required viewport sizes,
plus 800×450 reflow and reduced motion. Checked the wide island view and casts
of one and eight in the production viewer. Focused world, adapter, grounding
and asset-prefetch tests pass (18 tests). Svelte check: zero errors and warnings.
glTF validation: zero errors; one generated tangent-space warning on the reused
olive, plus notices for extensions outside the validator's support.

Local performance with several review tabs open reached 60 fps for one performer
and about 15 fps for eight. The eight-performer path remains costly; this is not
a claim of mobile or eight-performer 60 fps. The worker review camera also keeps
its existing closer cast framing. Cloud rendering assumes the normal camera
space above the cloud sea; this is not a flight-through-clouds simulator.
