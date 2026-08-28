# Flow Fest 60 FPS stabilization

## Outcome

Flow Fest must sustain a responsive third-person EUC ride before additional
scene fidelity is added. The riding camera, terrain collision, forest, crowd,
and festival dressing remain visually and physically intact.

## Measured baseline

The live `gate6=1` scene was sampled on the accelerated NVIDIA RTX 4090 path at
1x render density and a 2.72 megapixel canvas.

- The scene reported 100 ms p50, p95, and p99 frame times: about 10 FPS.
- The renderer reported 659 draw calls and 42,243,756 triangles.
- The terrain render mesh contains 2,097,152 triangles.
- A CPU profile attributed roughly 67% of samples to Three.js triangle
  intersection beneath `UnifiedCameraController`'s third-person collision ray.
- Another 8.7% of samples were garbage collection while that raycast ran.
- The call path was `UnifiedCameraController` -> `Raycaster.intersectObjects`
  -> `Mesh.raycast` -> terrain triangle intersection.

The fatal regression is therefore the visible full-resolution terrain being
registered as a camera collider. Forest geometry remains a secondary render
budget concern to measure after the camera collision owner is corrected.

## Capability ownership

`packages/camera-3d/src/lib/components/UnifiedCameraController.svelte` remains
the camera behavior owner. This pass extends it with an optional collision
probe. Consumers that do not provide the probe retain the existing opted-in
mesh collision path.

Flow Fest already owns a Rapier world containing buffered terrain chunks and
production collision bodies. Its third-person camera will query that world
through the shared physics raycast instead of intersecting the visual terrain.
No parallel camera, terrain, or collision system is introduced.

## Implementation scope

1. Add an optional, allocation-free third-person collision probe contract to
   `UnifiedCameraController`.
2. Pass the Flow Fest Rapier raycast through that seam and exclude the rider's
   own capsule.
3. Stop opting the full-resolution terrain render mesh into camera collision.
4. Record the collision strategy in the existing runtime proof surface.
5. Run focused camera/terrain/Flow Fest tests and a worktree-local runtime
   performance sample.
6. Only if the corrected camera path remains above budget, reduce the measured
   secondary cost, beginning with the current high-detail tree distribution and
   draw-call envelope.

## Acceptance

- Third-person EUC camera collision uses Rapier broadphase queries.
- The visible terrain mesh is absent from the mesh camera-collider index.
- Terrain, tents, vehicles, trees, and festival structures still keep the
  camera from visibly passing through supported collision bodies.
- A moving or continuously rendered EUC sample reaches p95 <= 16.7 ms and p99
  <= 25 ms on the current desktop test machine.
- No repeated frame exceeds 50 ms after warmup.
- Controls and player movement remain responsive at the lower loop, middle
  clearing, entrance, and upper clearing.
- Renderer counters, CPU profile, focused tests, and browser console are
  recorded as verification evidence.

## Secondary budget gate

If Rapier camera collision alone does not reach the acceptance target, the next
measured pass must restore sparse high-detail PlantFactory accents, enforce
distance-aware tree LOD, and reduce material batches. Visual diversity and
registered travel corridors are invariants; tree count is not a reason to keep
unbounded triangle or draw-call cost.
