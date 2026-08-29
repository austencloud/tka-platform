# Flow Fest 120 FPS headroom

## Outcome

Flow Fest should have enough render and simulation headroom for a 120 Hz
desktop path without sacrificing the measured campground plan, nearby Forest
assets, or festival interaction. A 60 Hz display can prove an 8.33 ms frame
budget but cannot demonstrate 120 presented frames per second, so runtime claims
must distinguish frame cost from display refresh.

## Starting point

The stabilized EUC route reached 58.7 sustained FPS at one-times render density
with a 16.8 ms p95 and 33.4 ms p99 frame time. The renderer still submitted 115
draw calls and approximately 5.40 million triangles. The remaining dominant
costs were the same full-detail tree geometry at every distance, a 2048 square
directional shadow map rendered every frame, and repeated instance-buffer work
for camera movement too small to change the visible set.

## Capability ownership

The shared Forest runtime remains the tree-material and GPU-instancing owner.
The shared instance culler remains the visibility owner. Flow Fest supplies its
measured tree placements, distance policy, generated geometry tiers, and
runtime proof data. The existing adaptive-quality context governs pixel density
and broad quality features; this pass does not create another quality system.

The distance assets are geometry-only. The accepted near-tree sources remain
the only material and texture authority, so a lower geometry tier cannot drift
into a different forest palette or duplicate texture memory.

## Implementation

1. Preserve the exact accepted tree families inside 55 metres.
2. Submit reduced geometry from 55 to 130 metres and a second reduced tier
   beyond 130 metres. Every measured placement belongs to exactly one tier.
3. Reject instances by distance before the frustum test and avoid instance
   matrix rewrites for sub-threshold camera jitter.
4. Preserve modeled grass inside 70 metres while rejecting the thousands of
   individual blades that cannot contribute readable silhouette beyond it.
5. Keep the moving shadow pool on a six-metre world grid and refresh dynamic
   casters at 30 Hz instead of paying for a 2048 square shadow pass on every
   rendered frame.
6. Remove static terrain discovery and material writes from the per-frame
   production task.
7. Expose adaptive tier, pixel density, distance rejection, frustum rejection,
   and culling-update counters through the existing runtime proof surface.

The generated tier manifest records source and output SHA-256 digests, byte
sizes, and triangle counts. Mid-distance source families retain about 20% of
their source triangles; far-distance families retain about 10%.

## Acceptance

- All measured tree coordinates remain represented exactly once at runtime.
- Nearby Forest and PlantFactory trees retain their accepted silhouettes,
  materials, and textures.
- A registered ride does not reveal missing-tree gaps, tier overlap, or an
  obvious material flash at 55 or 130 metres.
- Sustained rendering reaches p95 <= 8.33 ms and p99 <= 16.7 ms on a 120 Hz
  capable desktop path, or demonstrates the same frame-cost envelope on a lower
  refresh display without claiming presented 120 FPS.
- Renderer submissions stay below 100 draw calls and 3 million visible
  triangles during the representative route sample.
- Shadow motion remains coherent for the rider and festival community at the
  30 Hz refresh cadence.
- Focused culling, ecology, and asset-provenance tests pass; Svelte diagnostics
  remain clean; the browser console has no new errors.

## Hardware boundary

Desktop 120 Hz headroom is not backpack certification. The fan-display use case
still needs a separate sustained thermal and battery profile on its target GPU,
display resolution, and power envelope.
