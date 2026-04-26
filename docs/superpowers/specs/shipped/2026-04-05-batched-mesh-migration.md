# BatchedMesh Migration — Replace InstancedMesh with GPU-Culled Batches

**Date:** 2026-04-05
**Status:** Draft — next major optimization
**Scope:** Replace all museum InstancedMesh objects with BatchedMesh for per-instance GPU frustum culling

---

## Problem

The museum creates ~40 InstancedMesh objects (one per material/color bucket). Three.js frustum-culls whole InstancedMesh objects but cannot cull individual instances within one. A player facing one wall still renders all 2,000+ wall instances across the entire museum.

## Solution: BatchedMesh

Three.js `BatchedMesh` (stable since r159, available in 0.182) supports:
- **Per-instance frustum culling** — built in, enabled by default (`perObjectFrustumCulled = true`)
- **Per-instance visibility** — `setVisibleAt(id, false)` per tile
- **Multiple geometries** — floor boxes + wall boxes + pedestal boxes in one mesh
- **Per-instance sorting** — automatic front-to-back for opaque
- **Built-in raycasting** — returns `batchId` for camera collision
- **Shadow support** — `castShadow`/`receiveShadow` work normally

### Key Constraint

**One material per BatchedMesh.** The museum has ~5 floor materials (PBR textures) and ~11 wall materials (PBR textures per wing theme). Each unique material needs its own BatchedMesh.

### Expected Result

| | Current (InstancedMesh) | BatchedMesh |
|---|---|---|
| Draw calls | ~40 (1 per material bucket) | ~16 (1 per unique material) |
| Frustum culling | Whole mesh only | Per-instance (GPU) |
| Tiles rendered when facing a wall | All ~14,636 floor + ~2,088 wall | Only visible ~200-500 |
| Per-instance visibility | Not available | `setVisibleAt()` |
| Raycasting for camera collision | Separate from render | Built-in with `batchId` |

---

## API Reference (Three.js 0.182)

### Constructor
```typescript
new BatchedMesh(maxInstanceCount, maxVertexCount, maxIndexCount?, material?)
```

### Key Methods
```typescript
// Geometry
addGeometry(geometry: BufferGeometry): number  // returns geometryId
deleteGeometry(geometryId: number): void

// Instances
addInstance(geometryId: number): number  // returns instanceId
deleteInstance(instanceId: number): void
setMatrixAt(instanceId: number, matrix: Matrix4): void
setVisibleAt(instanceId: number, visible: boolean): void
setColorAt(instanceId: number, color: Color): void
getVisibleAt(instanceId: number): boolean

// Per-instance frustum culling (enabled by default)
perObjectFrustumCulled: boolean  // default true

// Raycasting (built-in, returns batchId)
raycast(): Intersection & { batchId: number }
```

---

## Implementation Plan

### Step 1: Replace MuseumGeometryBuilder output

Change `buildRoomChunk` to create `BatchedMesh` instead of `InstancedMesh`:

```typescript
// Before: one InstancedMesh per material bucket
const mesh = new InstancedMesh(floorGeo, material, bucket.positions.length);
for (let i = 0; i < bucket.positions.length; i++) {
  dummy.position.set(x, 0, z);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}

// After: one BatchedMesh per material, add geometry once, add instances per tile
const batch = new BatchedMesh(maxInstances, vertexCount, indexCount, material);
const geoId = batch.addGeometry(floorGeo);
for (let i = 0; i < bucket.positions.length; i++) {
  dummy.position.set(x, 0, z);
  dummy.updateMatrix();
  const instanceId = batch.addInstance(geoId);
  batch.setMatrixAt(instanceId, dummy.matrix);
}
```

### Step 2: Merge floor + ceiling + pedestal into fewer batches

Since BatchedMesh supports multiple geometries, we can merge different shapes that share a material:

```typescript
// One BatchedMesh for stone material — contains floor tiles, ceiling tiles, and pedestals
const stoneBatch = new BatchedMesh(totalInstances, totalVerts, totalIndices, stoneMaterial);
const floorGeoId = stoneBatch.addGeometry(floorGeometry);
const ceilingGeoId = stoneBatch.addGeometry(ceilingGeometry);
const pedestalGeoId = stoneBatch.addGeometry(pedestalGeometry);

// Add instances with different geometry IDs
for (const pos of stoneFloorPositions) {
  const id = stoneBatch.addInstance(floorGeoId);
  stoneBatch.setMatrixAt(id, ...);
}
for (const pos of ceilingPositions) {
  const id = stoneBatch.addInstance(ceilingGeoId);
  stoneBatch.setMatrixAt(id, ...);
  // Track ceiling instances for FPS visibility toggle
  ceilingInstanceIds.push(id);
}
```

### Step 3: Ceiling visibility via setVisibleAt

Instead of `mesh.visible = fpsActive` for the whole ceiling mesh, toggle per-instance:

```typescript
$effect(() => {
  for (const id of ceilingInstanceIds) {
    stoneBatch.setVisibleAt(id, fpsActive);
  }
});
```

### Step 4: Camera collision via BatchedMesh raycasting

Replace the current wall mesh raycasting with BatchedMesh built-in raycasting. The `batchId` in the intersection tells which specific wall tile was hit:

```typescript
const intersects = raycaster.intersectObject(wallBatch);
if (intersects.length > 0) {
  const hit = intersects[0];
  // hit.batchId identifies the specific wall instance
}
```

### Step 5: Tag instances for camera collision

Instead of `mesh.userData.cameraCollider = true` on the whole InstancedMesh, only wall BatchedMesh instances are raycast targets. Non-wall batches can have `batch.raycast = () => []` to skip them.

---

## Material Bucketing (Reduced)

| Batch | Material | Contains | Est. Instances |
|-------|----------|----------|---------------|
| stone-floor | Rock035 PBR | Stone floor + ceiling + corridor tiles | ~8,000 |
| marble-floor | Marble006 PBR | Marble floor tiles (institutional) | ~2,000 |
| wood-floor | WoodFloor007 PBR | Wood floor tiles | ~500 |
| sandstone-floor | Rock003 PBR | Sandstone floor tiles | ~300 |
| door-floor | Solid color | Door tiles | ~100 |
| cave-wall | Rock035 PBR (tinted) | Cave walls | ~400 |
| classical-wall | Rock003 PBR | Classical/renaissance walls | ~300 |
| gallery-wall | Plaster001 PBR | Gallery/modern walls | ~200 |
| institutional-wall | Solid white | Institutional walls | ~300 |
| generic-wall | Solid color | Remaining wall themes | ~500 |
| props | Solid colors | Pedestals, signs, performers | ~100 |

~11 BatchedMesh objects total, each with GPU frustum culling. Down from ~40 InstancedMeshes with no culling.

---

## Files to Modify

| File | Change |
|---|---|
| `MuseumGeometryBuilder.ts` | Replace `InstancedMesh` creation with `BatchedMesh` |
| `Museum3DScene.svelte` | Update `scene.add()` calls, ceiling visibility via `setVisibleAt` |
| `UnifiedCameraController.svelte` | Update raycasting for `batchId` |
| `RoomChunk` interface | Replace `InstancedMesh` types with `BatchedMesh` |

---

## Future: OffscreenCanvas

Threlte doesn't support OffscreenCanvas (DOM-coupled). To move rendering off the main thread, we'd need to drop Threlte and manage Three.js directly in a Web Worker. This is the right long-term architecture but requires:
1. Manual event proxying (mouse, keyboard, resize)
2. `ImageBitmapLoader` instead of `TextureLoader`
3. All scene management in the worker (no Svelte for 3D objects)
4. Svelte only for HTML overlays via `postMessage`

This is a separate project, not part of the BatchedMesh migration.
