# Distant valley extension

2026-09-05. Austen identified the empty view beyond the mountain, proposed a simple distant 3D valley and explicitly instructed “do it” after discussing its performance cost. Tracker authority: `YSugmayi3aen8Zspk9Se`. Earlier end-to-end production delegation remains in force. Final acceptance of this new geometry is not claimed.

## Geometry and ownership

`scripts/build-ember-distant-valley.py` begins with the completed geology/stage native asset. It preserves every existing mesh's vertex, face, UV, color and world-transform digest. The six active lava channels, stage, bench wall, rocks and original terrain remain unchanged.

An annular terrain mesh continues beyond the original 380 by 335 m footprint, easing downhill into an ash basin. The southern basin has two irregular enclosing ridge bands; additional western and eastern ridges fill sideward views. The outer extent is approximately 1,429 m from the origin. Distant illumination and aerial perspective are baked into vertex colors. A second mesh carries a few static heat traces on the basin floor, fitted to the actual triangulated terrain by raycasts. These are authored visual scenery, not a new lava or erosion simulation.

Internal searches for backdrop, distant terrain and horizon found the existing authored-surface owner and its legacy horizon apron. This pass extends the Blender-to-GLB production pipeline and the shared authored-surface material configuration. It does not revive the legacy runtime apron or introduce a new loader. Both renderers use the same asset. Backdrop meshes receive simple unlit vertex-color materials, no near-field fog, no dynamic shadows and no collisions. The foreground atmosphere is unchanged.

The worker's existing scene preparation sets the camera far plane to 2,000 m for Ember and resets it to 500 m for other environments. This avoids clipping the distant ridges without changing their geometry or the performer camera controls. No new animation loop, light, texture, dependency or paid asset is added.

## Verification and cost

- Eleven focused tests pass. The foreground regression now compares every original optimized mesh's attributes and transforms against the geology/stage asset, including the six channels' flow metadata. Existing downhill-flow, stage-contact and renderer-parity checks pass.
- New asset checks enforce two backdrop meshes, fewer than 11,000 triangles, no backdrop collision flag and no backdrop intersection above the stage. Runtime checks verify unlit materials with foreground fog and shadows disabled for the two backdrop meshes only.
- The final asset is 2,780,748 bytes, an increase of 46,736 bytes over the previous canonical asset. Its two new meshes contribute 9,968 triangles.
- Same-camera browser A/B measurements are recorded in `render-cost.json`. The final backdrop changes the shared-world preview from 26 to 28 draws and from 489,417 to 499,385 rendered triangles. The page reports rolling 120-sample median CPU submission time and frame cadence. These are shared-machine development observations, not GPU execution measurements, mobile guarantees or a cold-boot benchmark.
- Visual review includes the performer-scale downhill view, high side overlook, basin-focused view and unchanged uphill view. The initial repeating rounded skyline was replaced with unequal peaks. Remote heat was fitted onto the coarse triangles and restricted to the basin floor after inspection.
- Focused production lint passes. The guarded local integration supplies the final full-project type check.

The native `.blend` and versioned GLB are retained alongside the canonical GLB; no earlier source asset is deleted. Gate 4's pre-existing cold-boot input-gap failure remains open. This task does not claim a deployment or final user acceptance.
