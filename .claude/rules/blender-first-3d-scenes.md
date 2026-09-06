---
paths:
  - "src/lib/shared/3d/**/*"
  - "scripts/**/*.{py,mjs}"
  - "static/models/**/*"
---

# Blender-First 3D Scene Contract

For environment composition and art revisions, first read
`docs/architecture/scene-design-brief.md`. It owns the shared visual checks;
this contract owns the asset pipeline.

Static environment geometry and set dressing are authored in Blender, exported
to an optimized GLB, stored under `static/models/<scene>/`, and loaded through
the existing Threlte scene infrastructure.

- Runtime meshes are reserved for genuinely dynamic or parametric behavior such
  as particles, shader surfaces, runtime layout helpers, and simulated fauna.
- Reuse the established exporter and `gltf-transform` optimization path. Verify
  current scripts before adapting them; ocean-named scripts are references, not
  guaranteed generic tooling.
- Keep runtime-owned water, lights, and similar systems out of the baked mesh.
- Register loading progress and readiness through the current scene-feature
  owner. Do not add another environment loader or scene switch.
- Existing procedural scenes are legacy behavior, not templates for new static
  geometry.
- Record asset provenance and licensing. CC0 is ship-clean; other licenses need
  explicit commercial-use, modification, redistribution, and attribution review.

Before changing the pipeline, search `docs/architecture/canonical-capabilities.md`
for scene boot and read `docs/architecture/scene-boot-cost.md` for measured
constraints.
