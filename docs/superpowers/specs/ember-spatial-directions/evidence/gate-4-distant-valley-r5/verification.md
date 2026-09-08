# Ember R5 — molten crust and temporal stability

Requested: a proper lava pass after black pixels flickered in the lower basin.
The river network, terrain, stage, and six foreground flow meshes remain intact.

## Material and motion

Extended `createMidflankLava`, the existing shared thermal material owner used
by `ember-lava-features.ts`, after searching lava/thermal/crust owners. No new
renderer, loader, material stack, or runtime geometry was added.

- Larger crust forms develop gradually along the widening lower reach. The
  change is tied to world location, not a camera-distance material swap.
- Exposed melt has cooler red margins and hotter orange interiors. Narrow
  upstream channels retain finer broken forms and the existing 400 drifting
  geometry rafts. The same downstream time uniform drives all thermal patterns.
- Each noise octave is filtered before nonlinear opening thresholds. Threshold
  widths also account for screen derivatives. Unresolved large patterns fade to
  mean radiance; fine wrinkles no longer drive high-contrast subpixel cracks.
- Remote vertical heave is reduced from a maximum 4 cm to 6 mm. This does not
  slow or reverse the downhill thermal flow.

The art direction draws on [USGS observations of dark crustal plates and
incandescent spreading zones](https://pubs.usgs.gov/publication/sir20185008),
and [USGS colour/temperature guidance](https://www.usgs.gov/news/volcano-watch-lava-tubes-cool-slowly).
This is a stylized basaltic flow field, not a thermodynamic simulation.

## A second flicker mechanism

The preceding diagnosis sampled 292 locations and missed thin-clearance spots.
A denser check of 46,560 exported triangle-interior/edge samples found a minimum
clearance of 2.91 cm and ten samples within the old wave amplitude. Rock could
therefore appear through the animated surface. This is distinct from aliasing.

The Blender source now smoothly increases the remote surface lift by up to
18 cm after the upstream join, preserving the join itself. R5 is exported and
optimized through the existing pipeline. Regression assertions check four
previously thin-clearance locations against actual delivered lava and terrain
meshes, requiring over 9 cm and under 50 cm clearance.

## Evidence

- `basin-final.png`: actual shared-world preview at camera
  `-4.770,38.381,-47.900`, target `-1.367,27.090,-69.943`, FOV 50,
  native 1600×900 capture. Broad molten openings and stable dark crust replace
  the uniform fine speckle. Near-to-valley contact was also inspected close up.
- Twenty consecutive browser captures per version, same camera/viewport and
  lower-basin crop (x 27–59%, y 40–86%). For pixels near visible orange heat,
  counted three-frame red-channel direction reversals exceeding 22/255 in both
  directions. R4: 21 reversals / 228,736 eligible samples; final R5: zero /
  221,578. Mean adjacent-frame red-channel delta: 5.64 → 2.10. All 18 measured
  frame pairs contained motion. These are short local samples with uncontrolled
  capture intervals and different animation phases, not a universal no-flicker
  guarantee or a fixed-timestep benchmark.
- Final preview: 21 draws, 579,014 rendered triangles, median CPU submission
  1.0–1.1 ms and frame interval 16.7 ms over 120 samples. No extra geometry,
  lights, or draw calls. Local measurements are not a device-wide guarantee.
- 11 focused tests pass, including delivered clearance, downhill bed and UVs,
  shared shader ownership, raft motion/freeze, and exact foreground preservation.
- Optimized asset: 4,714,904 bytes. Native source and historical R4 are retained.

The cross-worktree preview initially hit a shader-name collision; it was fixed
before the final captures. A task-owned Vite preview supplied fresh transforms.
Its process subsequently exited; no other task's replacement listener was
stopped. Final app checks use the untouched user-owned server on port 5173.

This amendment does not close the historical production cold-boot performance
finding or attribute final visual acceptance to Austen.
