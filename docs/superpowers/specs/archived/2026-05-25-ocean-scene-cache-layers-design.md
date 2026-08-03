---
status: backlog
value: 2
effort: M
remaining: "Body status: Spec (layers 1-2 implemented, layers 3-4 pending)"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Ocean Scene Cache Layers 3-4: Service Worker + Instance Matrix Cache

**Date:** 2026-05-25
**Status:** Spec (layers 1-2 implemented, layers 3-4 pending)

## Context

The ocean scene loads ~30 GLB models (9.7MB), creates hundreds of instanced meshes via deterministic placement algorithms, generates SDF textures, and compiles dozens of shaders. Loading takes several seconds on first visit.

**Already implemented:**
- Layer 1: `renderer.compileAsync()` — shaders compile in parallel during loading screen
- Layer 2: SDF IndexedDB cache — skip GPU SDF generation on repeat visits
- Threlte `useGltf` in-memory cache — same-session remounts are instant
- Chrome shader disk cache — repeat visits skip shader compilation automatically
- HTTP disk cache — browser caches raw GLB bytes

**Still slow on repeat visits:**
- GLB re-parsing: Meshopt/Draco decompression runs every page load even with HTTP cache (~500-1500ms)
- Instance matrix computation: Poisson disc + DLA + seeded RNG runs every mount (~100ms)

## Layer 3: Service Worker GLB Cache

### Problem
Browser HTTP cache handles the network layer, but `useGltf` → `GLTFLoader` → `FileLoader` still fetches through the standard fetch API. A Service Worker with Cache API eliminates even the cache-validation round-trip (304 checks) and guarantees offline availability.

### Design

**File:** `src/service-worker.ts` (SvelteKit convention)

**Strategy:** Cache-first for static 3D assets, network-first for everything else.

**Cache targets:**
- `/models/ocean/**/*.glb`
- `/models/ocean/**/*.ktx2` (future texture compression)
- `/draco/*` (Draco decoder WASM)

**Cache key:** URL path. No query string variance needed — models are immutable between deploys.

**Invalidation:** Version the cache name (`tka-3d-assets-v{N}`). On deploy, the new Service Worker activates, opens a new cache, and deletes the old one. Since models only change when we replace GLB files (rare), the cache version only bumps on model changes.

**Implementation sketch:**
```typescript
// src/service-worker.ts
const CACHE_NAME = 'tka-3d-assets-v1';
const ASSET_PATTERNS = [/\/models\/ocean\//, /\/draco\//];

self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);
  if (!ASSET_PATTERNS.some(p => p.test(url.pathname))) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })
  );
});
```

**SvelteKit integration:** SvelteKit has built-in service worker support via `src/service-worker.ts`. The `$service-worker` module provides the file manifest for precaching. However, for our use case (runtime caching of large binary assets), a custom fetch handler is more appropriate than precaching — we don't want to block SW installation on downloading 9.7MB of models.

**Risk:** Service Workers can interfere with dev server HMR. Gate the SW registration behind `import.meta.env.PROD` or a feature flag.

### Expected impact
- Eliminates 304 cache-validation latency (~50-200ms per model)
- Guarantees offline model availability
- Total: ~200-600ms saved on repeat visits with cold HTTP cache

## Layer 4: Instance Matrix IndexedDB Cache

### Problem
Every mount of OceanScene runs deterministic placement algorithms:
- `poissonDiscSample()` with seeded RNG for coral, kelp, rocks, decorations
- `generateDLAMask()` for reef macro-shape
- `selectSpecies()` + `vonMisesSample()` for each placement
- `terrainHeightForPlacement()` per instance
- Scale computation (`mScale`) per instance
- Color computation (HSL shifts) per coral instance

The algorithms are seeded and deterministic — same config produces same output. The work is wasted on every mount.

### Design

**New file:** `src/lib/shared/3d/environments/scenes/ocean/placement-cache.ts`

**What gets cached:** The final instance matrices (Float32Array from `InstancedMesh.instanceMatrix.array`) plus per-instance colors (Float32Array from `InstancedBufferAttribute`). These are the end products of all placement computation.

**Cache key:** Hash of the scene config values that affect placement:
- `stageRadius`, `clearingRadius`
- Coral/kelp/rock/decoration counts and species configs
- `groundY`
- Quality tier
- Seed values

**Schema:**
```typescript
interface CachedPlacement {
  configHash: string;
  version: number;
  buckets: {
    name: string; // 'coral-0', 'rock-2', 'midKelp-1', etc.
    instanceMatrix: ArrayBuffer; // Float32Array of 4x4 matrices
    instanceColor?: ArrayBuffer; // Float32Array of RGB per instance
    count: number;
    modelPath: string; // which GLB this bucket maps to
  }[];
  timestamp: number;
}
```

**Cache flow:**
1. On mount, compute config hash
2. Check IndexedDB for matching hash
3. **HIT:** Skip all Poisson/DLA/placement math. Create `InstancedMesh` per bucket, set `.instanceMatrix` from cached array, set `.count`.
4. **MISS:** Run placement as normal. After all instance meshes are built, extract matrices and store to IndexedDB.

**Integration point:** The `$effect` blocks in OceanScene.svelte that create `coralInstances`, `rockInstances`, `midKelpInstances`, etc. Each would check cache before running the placement pipeline.

**Size estimate:** ~200 coral instances * 64 bytes (4x4 float matrix) + colors = ~20KB per species. Total across all instance types: ~100-200KB. Well within IndexedDB comfort zone.

### Expected impact
- Eliminates ~100ms of placement computation on repeat visits
- More importantly, eliminates GC pressure from thousands of temporary Vector3/Matrix4 allocations during placement

## Combined Impact (All 4 Layers)

| Visit type | Before | After |
|---|---|---|
| First visit, cold cache | 3-5s | 2-4s (compileAsync parallelism) |
| Repeat visit, same session | ~instant | ~instant (Threlte cache) |
| Repeat visit, new session | 2-4s | 0.5-1.5s (SW + IndexedDB skip parse/SDF/placement) |

## Implementation Priority

1. **Layer 3 (Service Worker)** — highest ROI, eliminates biggest remaining cost (network + parse)
2. **Layer 4 (Instance matrices)** — lower ROI but completes the cache story

## Open Questions

- Should the Service Worker also precache models on first visit (background fetch after scene loads)? This would make the second visit instant even if the user navigated away before all models loaded.
- Should we add a cache-bust mechanism tied to git hash of the `/models/ocean/` directory?
