# Ember R4 — shared near/far lava

The reported view exposed a material discontinuity: R3 rendered valley heat as
baked vertex colour on an unlit surface, while the foreground used animated
thermal crust. R4 replaces that baked heat with the existing foreground shader.

## Change

- Blender-authored valley flow UVs use real metres, with exported V increasing
  downhill. RGB now carries bank coverage, heat, and reflection masks, not a
  painted yellow centreline. The runtime preserves this surface for the shared
  lava material owner instead of converting it to an unlit backdrop material.
- Near and far share the same shader callback and time uniform: the same
  red-orange radiance, fissures, crust size, and 0.72 m/s downstream UV motion.
- Subpixel detail blends toward average heat coverage using pixel derivatives.
  Close detail remains unchanged. Remote atmospheric density eases from the
  near-field value into lighter kilometre-scale haze; there is no hard LOD swap.
- R3 terrain and drainage geometry are unchanged. No additional lights, meshes,
  or drifting rafts were added. Two backdrop meshes remain; the optimized asset
  is 4,714,844 bytes (59,972 bytes larger than R3).

## Evidence

- `build-report.json`: preserved source-mesh digests and the same 544-point
  descending drainage profile; no uphill segments.
- `shared-material-reported-view.png`: actual shared world at the reported
  camera, with foreground and valley in one view. The smooth yellow band is gone.
- `shared-material-valley-close.png`: the valley surface retains crust and
  fissures when approached, rather than exposing baked streaks.
- Focused exported-asset/runtime tests: 11 passing. These cover metre-scaled
  downhill UVs, shared near/far shader ownership, heat-mask ranges, 400 moving
  rafts, preserved foreground geometry, and the descending exported river bed.
- Focused ESLint and `git diff --check`: pass.
- Native 1600×900 preview at the reported camera: 22 draws, 581,846 rendered
  triangles, 1.5–1.6 ms median CPU submission, 16.7 ms median frame interval
  over 120 samples. This is a local observation, not a device-wide performance
  guarantee; the remote surface now has a more expensive fragment shader.
- Preview emitted no shader/runtime errors. It did emit the existing multiple
  Three.js-import warning in the cross-worktree manual preview.

This amendment does not claim overall final art acceptance or resolve the
earlier production gate's cold-boot input-gap finding.
