# Connected downhill drainage

2026-09-05. Austen approved replacing the disconnected valley heat strips with a connected downhill system. This revises the R2 backdrop, not the approved performance bench or the six animated mountain flows. Final user acceptance is not claimed.

## Design and construction

The main river now continues beyond the original mountain boundary into a descending ravine. It broadens into a crusted flow field before narrowing into an outlet through a broad saddle in both distant mountain ranges. The lowland is a sloping flow field, not a level lava lake. A shared route controls the terrain floor, cooled deposits, exposed heat, and mountain opening.

The authored centreline begins at local `[18, -68.716, -143]` and ends at `[344.345, -295.239, -1229]`. There are 544 measured stations over 1,086 metres of north-south displacement, with 226.5 metres of descent. The rendered surface is fitted to the actual triangulated ground. The generator rejects any centreline rise greater than 2.5 cm between adjacent stations. All stations pass. This establishes geometric drainage, not a fluid-dynamics simulation.

The first blockout exposed two problems before delivery: old depressions caused downstream climbs, and a narrow cut through the existing ranges looked artificial. The revised bed grades those depressions and the mountain masses themselves leave a broad saddle. The subsequent material pass removed a hard brightness threshold that made the hot channel look blocky. Irregular cool patches and dark blended margins interrupt its otherwise uniform appearance.

All new content is project-authored procedural geometry and baked colour. No third-party asset, paid generation, or new dependency was used. The existing Blender export, meshopt optimization and renderer-neutral Ember world own delivery. No runtime renderer, camera control, light, shadow, or simulation code changed. The remote heat remains static scenery; the original six nearby flows remain animated.

## Verification

- `build-report.json` records native source provenance, all foreground mesh digests, and every fitted drainage station. The generator asserts that all original mesh positions, topology, UVs, vertex colours and world transforms remain unchanged.
- Eleven focused tests pass using the project Vitest configuration. They compare the optimized foreground against the existing geology-stage asset, preserve the six flow paths, check stage contact and material routing, and raycast the optimized lowland heat at regular intervals to verify its descending elevation.
- The testing and code-style skills were applied to the exported-geometry regression check. It samples segment interiors to avoid treating millimetre-scale quantization at an open boundary as a missing channel. The Blender check covers all stations; the optimized-asset check samples at 24 m intervals to keep the unit test bounded.
- The canonical optimized asset is 4,654,872 bytes, versus 4,571,236 bytes for R2. The same 2048-square atlas and two backdrop meshes are retained. The backdrop has 135,104 triangles, below the revised 140,000 limit. This is an explicit geometry increase, not a claim of zero cost.
- Shared-world review used the final optimized asset through the existing manual review entry. A temporary self-contained bundle avoided Vite caching a missing worktree tsconfig. The bundle and temporary HTML edit are removed before commit. Port 5173 was never restarted or replaced.
- `shared-world-overlook.png` uses the user's reported position `[1.661,34.603,-46.292]`, target `[-1.367,27.090,-69.943]`, FOV 50. The native viewport is 1600 by 900. It shows the connected heat corridor and the opened mountain saddle.
- `source-join.png` uses `[48,-36,-122]` toward `[18,-78,-157]`, checking the continuation beyond the existing river's end. The convex terrain break partly occludes the descent from this side view.
- `stage-preserved.png` uses `[0,8.75,-21.5]` toward `[0,2.25,0]`. This is the actual shared-world environment, not a performer-viewer capture.
- A narrow viewport was exercised, but in-app device emulation produced tiled screenshot artifacts and dimensions different from those requested. That image was discarded rather than recorded as valid narrow-viewport proof. Native-viewport captures are clean; no responsive viewer-shell code changed.
- Shared-world observations at the reported overlook showed 23 draws, 585,974 rendered triangles, approximately 0.8 to 1.1 ms median CPU submission and 16.7 ms median frame cadence over 120 samples. These are development measurements on this computer, not GPU timing or mobile certification.

The shared-world screenshots use its existing sky and ground settings; the full application supplies its own viewer settings. Worker and legacy viewer inspection follows guarded local integration. The pre-existing camera orbit-target limitation and earlier cold-boot gate are outside this art revision and are not claimed fixed.
