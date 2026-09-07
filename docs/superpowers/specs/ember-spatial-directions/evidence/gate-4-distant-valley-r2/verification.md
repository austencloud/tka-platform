# Valley relief revision

2026-09-05. Austen rejected R1's flat gray silhouettes and visible polygon corners, then delegated the revision: “do it right, astra ... trust your own judgment”. This supersedes the R1 backdrop's art treatment, not the approved foreground or the existing cold-boot gate. Final user acceptance is not claimed.

## Delivered design

The existing Blender generator now authors broad, overlapping ridges with nested smaller relief. The annular mesh has 512 angular samples and approximately 12 m radial spacing, rather than widely separated outer rings. Its inner edge still follows the original terrain's measured height field. A dark-to-distant lighting transition removes the pale boundary observed during the wide-camera review.

One 2048-square embedded atlas carries authored rock variation, relief shading, approximate directional terrain shadow, and progressively stronger aerial perspective. Linear baked colors are encoded to sRGB for the generated-image export. The first browser pass caught and corrected a double-darkening error here.

The existing authored-surface owner keeps that atlas when converting the backdrop to an unlit material. Its material patch reuses the already-loaded basalt texture on three axes so steep faces retain fine grain without planar stretching. Detail fades with distance. The terrain adds no dynamic lights, shadows, collision surface, animation loop, or additional asset request. The atlas adds approximately 22.4 MB of GPU texture storage including mipmaps; the existing detail texture is shared, not duplicated.

Remote heat has dark margins, a hotter narrow center, uneven width and tapered ends. Its vertices are fitted to the actual triangulated terrain. It remains static distant scenery, not a new lava simulation. All six foreground animated channels retain their prior geometry and flow metadata.

Internal searches for terrain, backdrop and texture confirmed ownership in the existing Ember Blender generator, optimizer and shared authored-surface module. This revision extends those owners. No third-party asset or paid generation was used; all new artwork is procedural project-authored content.

## Evidence

- `build-report.json` retains the native source hash and exact position/face/UV/color/world-transform digests for every original foreground mesh. The generator asserts preservation before export.
- The optimized canonical asset is 4,571,236 bytes (R1: 2,780,748 bytes), an increase of approximately 1.79 MB. The backdrop is two meshes and 101,512 triangles. The extra silhouette resolution replaces R1's 9,968-triangle budget deliberately; it is not described as free.
- Eleven focused tests pass: optimized foreground preservation, all six channels' downhill flow, moving crust size, stage contact, absence of background collision over the stage, bounded mesh count/triangles, unlit/fog/shadow routing, and atlas retention through the material replacement. Geometry-only tests substitute texture handles because jsdom cannot decode embedded images; browser inspection supplies the actual decoding/shader proof.
- Production TypeScript ESLint passes. Guarded integration runs the required full project check.
- `basin-overlook.png` records the reported camera: position `[-0.826,27.384,-68.885]`, target `[-1.18,26.97,-70]`, FOV 50, 1600 by 900. The image shows the detailed nearer faces and softer far range.
- `mountain-side-join.png` uses `[-79.803,79.923,63.344]` toward `[-85.908,74.511,61.047]`, checking continuity beyond the original mountain edge.
- `basin-portrait.png` checks a narrow 640 by 860 canvas at the reported camera. This is an environment-material/geometry revision, not a responsive viewer-shell redesign.
- `render-cost.json` records a same-camera shared-world A/B: valley on = 22 draws / 548,254 rendered triangles; off = 20 / 446,742. Both rolling 120-sample medians were 0.8 ms CPU submission and 16.7 ms frame cadence. These are shared-machine development observations, not GPU timings, mobile certification or a cold-boot claim.

The review harness uses the actual shared world and final optimized asset, including foreground materials and flow. A temporary self-contained bundle was used after stale dev dependency responses blocked the harness; the temporary bundle is not shipped. The primary 5173 server was not restarted or modified. One isolated task server was tried and stopped when the browser would not connect to its port.

The unchanged stage and the downhill composition were also inspected. Full worker and legacy viewer handoff is verified after guarded local integration; the shared-world captures here are not mislabeled as full performer-viewer captures. The pre-existing Gate 4 cold-boot input-gap failure remains open.
