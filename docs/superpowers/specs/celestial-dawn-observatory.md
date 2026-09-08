# Dawn Observatory

Replaces Sunward Gardens in the production Celestial environment. Austen requested
an adversarial reassessment and a fully implemented blank-slate redesign. That
direction supersedes the earlier natural-geology restriction for this scene.

## Adversarial assessment

Sunward Gardens earned 3/10 for art direction. Its repeated mesa profiles read as
stacked cylinders, the detailed trees exposed the simplicity of the surrounding
forms, and the vacant circular stage felt imposed by the application. The lagoon
looked applied to the terrain. Pale materials and fog reduced depth. Passing
technical checks was insufficient justification for calling it a strong design.

The replacement is a suspended observatory with a 36.44-metre segmented stone
instrument, inclined brass meridian, inner armillary globe and polar spindle.
A curved colonnade, solitary olive, inset reflecting channel and rear gallery
give the performance terrace a spatial context. Long shadows make the instrument
present on the floor without adding obstacles to the performer lane.

Current assessment: 7/10. The silhouette, architectural continuity and material
hierarchy are substantially stronger. Stone still needs richer surface history
to approach a finished environment-art portfolio piece. The rear gallery and
satellite terrace are deliberately simpler than the instrument. This is a
stylized realtime scene, not photorealism.

## Source and runtime

- Editable source: `blender/celestial/dawn-observatory.blend`, authored in Blender
  5.0.1. Aggregate textures are packed into the file.
- Rebuild: run Blender with `--background --factory-startup --threads 8 --python
scripts/build-celestial-dawn.py`, then `node scripts/optimize-celestial-dawn.mjs`.
  `TKA_DAWN_EVIDENCE` can direct renders and temporary PNGs outside the checkout.
- Exporter batches static geometry by material and role. Tangents are omitted;
  the shipped renderer derives tangent space, matching the existing asset path.
- The measured water outline is shared through `scripts/celestial-dawn-layout.json`.
  The basin is a physical opening in the terrace. Its floor is below the water.
- One shipped Meshy olive is reused from the previous editable source. No new
  external assets or purchases. Architecture and stone textures are original.
- Both renderers consume the existing shared Celestial world. Its asset manifest
  preloads the new GLB. The previous model remains as historical source.
- One modest water-clock curtain replaces the four unrelated falling-water sheets.
  The existing reduced-motion and disposal contracts remain in force.

Final asset: 2,580,992 bytes, 66,829 authored triangles, 20 batched meshes.
The standalone hero reported 35 draw calls and 77,625 visible triangles including
atmosphere and runtime water. These are scene counters, not a total GPU-work estimate.

## Verification

- Three Blender render/export iterations. Fixed missing generated textures,
  a slab covering the pool, buried stairs, and unsupported colonnade footings.
- glTF validator: zero errors, one generated-tangent-space warning; its report
  also notes unsupported compressed-extension inspection.
- Eighteen focused tests passed: shared world lifecycle, grounding, cast growth,
  reduced motion, adapter contract and boot asset manifest.
- Svelte check: zero errors and zero warnings before final integration.
- Browser inspection at 375x667, 960x412, 820x1180, 1440x900, 1920x1080,
  2560x1440 and 3840x2160. Also inspected the 800x450 reflow equivalent,
  reduced-motion media setting, reverse gallery, low view and structural plan.
- Main-thread and worker production viewers inspected with one and eight
  performers. Both were taken to Void and back. The worker's existing close
  camera does not automatically frame the full eight-person cast.
- Performance remains limited with eight performers: one observed main-thread
  sample was 19 fps; a settled one-performer sample was 60 fps. These are local
  development observations under shared-machine load, not benchmark promises.

Screenshots and validator output are in the task's `celestial-dawn` evidence
directory under the Codex visualization workspace. The hero screenshots show
the live application; `blender-arrival.png` is the separate Cycles render.
