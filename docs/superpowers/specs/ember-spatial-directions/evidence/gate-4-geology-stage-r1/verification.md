# Geology and cooled performer ground

2026-09-05. The coordinator relayed Austen's request for stronger volcanic terrain hierarchy and an integrated performer stage while retaining the completed lava, scale, mood and textures. Tracker authority: `ZlG9TMyWMYzh66WR12D4`. The earlier end-to-end production delegation remains `HyW3fFQVRHU3Uc0ezeWO`. Neither record claims user acceptance of this final geometry.

## Baseline and preserved work

Before editing, both main and the task worktree contained the latest six-channel revision, including the distant flows and corrected downhill motion. The canonical asset matched `ember-mountain-tributaries-r2.glb`, SHA-256 `a8a10cff870f69508daa13843c098f3ca88c3f8d6406b7c2d7bf98dac1369a82`. The three existing motion tests passed on that baseline. This was reported to the coordinator before terrain work began.

The native builder starts from `blender/ember-mountain-tributaries-r2.blend`. It hashes every existing mesh except the intentionally reduced talus, then asserts unchanged vertex coordinates, faces, UVs, colors and flow paths before exporting. This retains the original terrain, bench rib, six active channels, levees, cold overflow and floating-crust template. The runtime material and flow owner is unchanged, including its 400 moving rafts.

## Authored terrain treatment

Four embedded outcrops add larger forms between the established channels: a divided western ridge, a broad eastern buttress, a narrow upper fin and a lower weathered mound. Each has a separate crest profile, asymmetric sides and buried margins. An overhead review caught repetitive initial profiles; the delivered forms use different silhouettes. These are authored volcanic interpretations, not a new eruption or erosion simulation.

Twenty-nine larger fractured blocks form small groups near those structures. Of 3,810 original disconnected talus fragments, 1,604 remain, concentrated near channels and landforms. The other 2,206 are omitted only from this revision; all are recoverable in the unchanged R2 native source and versioned asset. The original dense bench-wall rocks remain intact.

The cooled performer plate follows the existing irregular bench and ground height, with a nominal 2 cm surface clearance to avoid clipping after asset quantization. It has a dark, non-emissive core and the existing ground detail treatment. Three short, faint ember-bearing fractures stay outside the protected 4.5 m action radius. They are a restrained fantasy detail, not a glowing circular border or a claim that hot lava is safe to stand on. No cave or unrelated prop set was added.

The original terrain remains the collision owner. The new distant landforms are outside the performer and orbit area. Thin stage skins receive existing shadows but do not cast a misleading elevated ledge shadow. No new platform behavior, render loop, light, texture, dependency, loader or paid asset is introduced.

## Delivery and verification

The new builder is `scripts/build-ember-geology-stage.py`; the existing optimizer adds `--geology-stage` while retaining its earlier modes. Deliverables are `blender/ember-geology-stage-r1.blend` and `static/models/ember/ember-geology-stage-r1.glb`, also copied to the canonical production GLB. The build report records the native digest, authored coordinates and preserved mesh digests.

The final GLB is 2,734,012 bytes, 610,168 bytes smaller than R2, with 26 mesh primitives. The shared-world preview reports 24 to 31 draws across the inspected views. File size and preview draw counts are not a full-viewer performance benchmark.

- Eleven focused motion and renderer-parity tests pass. The new regression check compares all six optimized lava meshes' position, UV and color bytes, world transforms and flow paths against R2.
- Actual optimized-asset raycasts at the stage centre and eight points around its 4.2 m radius verify contact between 5 and 40 mm above terrain. Every peripheral fracture vertex remains outside the 4.5 m action radius. Stage core emission is zero, and both thin skins have shadow casting disabled by the shared world.
- Focused production lint passes. The full project type check passed with zero errors and zero warnings before the final shadow adjustment; the guarded integration command supplies the final type gate.
- Direct browser review of the final shared world covers uphill stage, western and eastern orbit views, and bird's-eye composition. The four PNGs in this folder are captures of the actual optimized asset with the shared runtime materials.

Gate 4 remains in progress. Its historical cold-boot input-gap failure is neither resolved nor waived here. Final user acceptance, deployment and Meshy spending are not claimed.
