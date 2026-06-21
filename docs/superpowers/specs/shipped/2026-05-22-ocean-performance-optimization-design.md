# Ocean Scene Performance Optimization

> Build-time asset pipeline, loading gate, instancing overhaul, and quality tier system to take the ocean scene from 250MB/400+ draw calls to ~30MB/~45 draw calls with mobile support.

## Context

The ocean scene ships ~250MB of unoptimized GLB geometry:
- 6 hero rock models: 126MB total (~20MB each, likely 500K+ triangles per model)
- 4 reef structures: 94MB total (~22MB each)
- 50 fish species: ~24MB total
- Coral, kelp, jellyfish, decorations: ~6MB total

Runtime issues:
- **Loading jank:** Models load individually via `useGltf()` with no rendering gate. Each model renders immediately on resolve. Reactive `$derived` placement chains recompute as models arrive, causing visible reshuffling — rocks appear above terrain, coral pops in around them, positions shift.
- **Draw call explosion:** Coral (200+ clones), kelp (80+ clones), jellyfish (20+ clones), decorations (60+ clones) each create individual draw calls with cloned materials. God ray shafts create N individual ShaderMaterials. Total: 400+ draw calls.
- **Shader cost:** Seabed runs 5-octave FBM + voronoi caustics + sparkle + per-channel absorption in the fragment shader across 192×192 segments (37K vertices).
- **Post-processing:** Bloom at full resolution with 8 mip levels on HiDPI displays.
- **No quality tiers:** Same scene complexity on a desktop GPU and a phone.

## Constraints

- Must work on desktop, tablet, and phone (per user requirement)
- No WebGPU migration in this scope (tracked separately in `project_webgpu_migration.md`)
- Fish GPUComputationRenderer stays as-is (WebGL2 compute workaround, works)
- Must not regress visual quality on desktop Ultra tier
- Loading screen preferred over progressive reveal (user preference)

---

## Phase 1: Build-Time Asset Pipeline

### Goal
Reduce total ocean asset download from ~250MB to ~25-35MB.

### Approach

Install `@gltf-transform/cli` as a devDependency. Create `scripts/optimize-ocean-assets.sh` that processes every GLB in `static/models/ocean/`.

Pipeline per file:
1. `gltf-transform dedup` — remove duplicate accessors, textures, materials
2. `gltf-transform flatten` — collapse unnecessary scene hierarchy
3. `gltf-transform prune` — strip unused data
4. `gltf-transform simplify --ratio <target>` — decimate geometry (category-specific ratios)
5. `gltf-transform meshopt` — geometry compression (30-70% smaller, fast WASM decode)
6. `gltf-transform ktx2 --codec uastc` — GPU-compressed textures (3-4x VRAM reduction, stays compressed on GPU)

### Per-Category Targets

| Category | Files | Current | Target tris | Target size | Simplify ratio |
|---|---|---|---|---|---|
| Hero rocks | `rock_0.glb` – `rock_5.glb` | ~20MB each | 50K | 1-2MB each | 0.1 |
| Reef structures | `structures/*.glb` | ~22MB each | 80K | 2-3MB each | 0.1 |
| Fish | `pack/*.glb` | 200KB-1MB | 5K | 50-150KB each | 0.5 |
| Large coral | `coral_large.glb` | 245KB | As-is | ~80KB | N/A |
| Small coral | `coral_0-3.glb` | 30-125KB | As-is | ~15-50KB | N/A |
| Kelp/seaweed | 2 files | 150KB-1MB | As-is | ~50-300KB | N/A |
| Jellyfish | 2 files | 60-512KB | As-is | ~20-150KB | N/A |
| Decorations | 4 files | 76-635KB | As-is | ~25-200KB | N/A |

### Runtime Loader Changes

Add `KTX2Loader` and `MeshoptDecoder` to the GLTF loading chain:

```typescript
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const ktx2Loader = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer);
const gltfLoader = new GLTFLoader();
gltfLoader.setKTX2Loader(ktx2Loader);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
```

Both decoders run in web workers automatically — zero main thread decode cost.

### Output Directory

Optimized files go to `static/models/ocean/` (replace originals). Original high-poly source files archived to `assets/source-models/ocean/` (gitignored, preserved locally for re-optimization).

### NPM Script

```json
{
  "optimize:ocean": "bash scripts/optimize-ocean-assets.sh"
}
```

Run manually when new models are added. Not part of the build pipeline (too slow for CI).

---

## Phase 2: Loading Gate

### Goal
Eliminate visual jank. Scene appears fully composed or not at all.

### Architecture

```
OceanSceneWrapper.svelte
├── {#if !ready}
│   └── OceanLoadingScreen.svelte    ← 2D HTML overlay, progress bar
├── <Suspense>
│   ├── {#snippet fallback}          ← empty (loading screen handles UI)
│   └── <OceanScene />               ← all useGltf calls suspend here
```

### Loading Screen

- HTML overlay (not 3D) — renders during Suspense fallback
- Ocean-themed: dark blue gradient, animated wave line, percentage counter
- Progress sourced from `THREE.LoadingManager` wrapping all loaders
- Fade-out transition when Suspense resolves (300ms opacity fade)

### Progress Tracking

Create a shared `OceanLoadingManager` that wraps `THREE.LoadingManager`:

```typescript
const manager = new THREE.LoadingManager();
manager.onProgress = (url, loaded, total) => {
  progress = loaded / total;
};
manager.onLoad = () => {
  allLoaded = true;
};
```

Pass this manager to every `GLTFLoader`, `TextureLoader`, and `KTX2Loader` instance in the ocean scene.

### Emergency Timeout

Extend existing 5-second timeout to 15 seconds. If loading hasn't completed by then, lift the curtain anyway and log a warning. This prevents permanent loading screens on partial asset failures.

### Preload Hints

Add to `app.html` for the 6 hero rock models (largest assets, start fetch before JS parses):

```html
<link rel="preload" href="/models/ocean/rock_0.glb" as="fetch" crossorigin>
<!-- ... rock_1 through rock_5 -->
```

Conditionally injected only when ocean scene is the active background (via SvelteKit `+layout.svelte` head management).

---

## Phase 3: Instancing Overhaul

### Goal
Reduce draw calls from 400+ to ~45.

### Current vs. Target

| Object type | Current approach | Current draw calls | Target approach | Target draw calls |
|---|---|---|---|---|
| Coral (5 species) | `.clone()` per placement | ~200 | 5 `InstancedMesh` (1/species) | 5 |
| Kelp (2 types) | `.clone()` per placement | ~80 | 2 `InstancedMesh` | 2 |
| Jellyfish (2 sizes) | `.clone()` per placement | ~20 | 2 `InstancedMesh` | 2 |
| Decorations (4 types) | `.clone()` per placement | ~60 | 4 `InstancedMesh` | 4 |
| Hero rocks (6 models) | `.clone()` per placement | ~40 | 6 `InstancedMesh` (1/model) | 6 |
| Procedural rocks | Already `InstancedMesh` | 6 | Keep | 6 |
| Boulders | Already `InstancedMesh` | 6 | Keep | 6 |
| Reef structures | 4 clones | 4 | Keep (only 4) | 4 |
| God ray shafts | N meshes, N materials | ~12 | 1 `InstancedMesh`, 1 material | 1 |
| Fish | Already `InstancedMesh` | per-species | Keep | per-species |
| **Total** | | **~430** | | **~45** |

### Coral Instancing Detail

The challenge: each coral clone currently gets a unique hue/saturation tint via `tintUnderwater()`. With instancing, per-instance color variation must come from attributes.

Solution: `InstancedBufferAttribute` for per-instance color:

```typescript
const colors = new Float32Array(count * 3);
for (let i = 0; i < count; i++) {
  const hsl = computeCoralHSL(placements[i]);
  const c = new Color().setHSL(hsl.h, hsl.s, hsl.l);
  colors[i * 3] = c.r;
  colors[i * 3 + 1] = c.g;
  colors[i * 3 + 2] = c.b;
}
geo.setAttribute('aInstanceColor', new InstancedBufferAttribute(colors, 3));
```

The coral material becomes a single `MeshStandardMaterial` with `onBeforeCompile` injecting:
- Vertex: pass `aInstanceColor` to fragment via varying
- Fragment: multiply `diffuseColor.rgb` by the instance color

This replaces the current pattern of cloning materials per coral placement.

### Kelp Animation with Instancing

Current: direct rotation mutation on clones in `useTask`. 
With instancing: per-instance sway phase stored as an `InstancedBufferAttribute`, sway computed in the vertex shader:

```glsl
attribute float aSwayPhase;
uniform float uTime;
uniform float uSwaySpeed;
uniform float uSwayAmplitude;

// In vertex shader, before projection:
float sway = sin(uTime * uSwaySpeed + aSwayPhase) * uSwayAmplitude;
transformed.x += sway * (position.y / maxHeight); // sway increases with height
```

### Jellyfish Animation with Instancing

Current: per-clone position offsets + pulse scaling in `useTask`.
With instancing: per-instance phase attribute, drift/pulse computed in vertex shader. The `PointLight` per jellyfish is the expensive part — on Medium/Low tiers, these lights are removed entirely.

### God Ray Shafts

Current: N separate meshes with N separate `ShaderMaterial` instances.
After: 1 `InstancedMesh` with per-instance attributes for position, rotation, tilt, width, opacity. Single shared `ShaderMaterial`.

---

## Phase 4: Quality Tier System

### Goal
Run the ocean scene on phones at playable framerates without regressing desktop quality.

### Tier Detection

```typescript
type OceanQualityTier = 'ultra' | 'medium' | 'low';

function detectOceanQuality(renderer: WebGLRenderer): OceanQualityTier {
  const gl = renderer.getContext();
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const gpuRenderer = debugInfo
    ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    : '';

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const isLowEnd = /SwiftShader|llvmpipe|Mali-4|Adreno [23]/i.test(gpuRenderer);
  const cores = navigator.hardwareConcurrency ?? 4;

  if (isMobile || isLowEnd || cores <= 4) return 'low';
  if (/Intel|integrated|UHD|Iris/i.test(gpuRenderer)) return 'medium';
  return 'ultra';
}
```

### Quality Config

```typescript
interface OceanQualityConfig {
  tier: OceanQualityTier;

  // Counts
  maxCoralCount: number;
  maxKelpCount: number;
  maxFishCount: number;
  maxHeroRocks: number;
  maxReefStructures: number;
  maxJellyfish: number;
  maxGodRayShafts: number;
  particleCount: number;
  bubbleCount: number;

  // Geometry
  seabedSegments: number;
  waterSurfaceSegments: number;

  // Shader quality
  seabedFbmOctaves: number;
  enableCaustics: boolean;
  enableSparkle: boolean;
  godRayFrequencies: number;

  // Post-processing
  enableBloom: boolean;
  bloomResolutionScale: number;
  bloomLevels: number;
  enableChromaticAberration: boolean;
  maxPixelRatio: number;

  // Lighting
  enableJellyfishLights: boolean;
}
```

### Tier Presets

| Setting | Ultra | Medium | Low |
|---|---|---|---|
| `maxCoralCount` | 200 | 80 | 30 |
| `maxKelpCount` | 80 | 30 | 10 |
| `maxFishCount` | 200+ (full) | 100 | 30 (CPU fallback) |
| `maxHeroRocks` | 40 | 15 | 5 |
| `maxReefStructures` | 4 | 2 | 0 |
| `maxJellyfish` | 20 | 8 | 0 |
| `maxGodRayShafts` | 12 | 6 | 3 |
| `particleCount` | 4000 | 1500 | 500 |
| `bubbleCount` | 200 | 100 | 50 |
| `seabedSegments` | 192 | 96 | 48 |
| `waterSurfaceSegments` | 64 | 32 | 16 |
| `seabedFbmOctaves` | 5 | 3 | 2 |
| `enableCaustics` | true | true | false |
| `enableSparkle` | true | false | false |
| `godRayFrequencies` | 4 | 2 | 0 (no shimmer) |
| `enableBloom` | true | true | false |
| `bloomResolutionScale` | 1.0 | 0.5 | N/A |
| `bloomLevels` | 8 | 5 | N/A |
| `enableChromaticAberration` | true | true | false |
| `maxPixelRatio` | 2 | 1.5 | 1 |
| `enableJellyfishLights` | true | false | false |

### Shader Quality Defines

Seabed, water surface, and god ray shaders receive a compile-time `#define QUALITY_LEVEL` (0/1/2).

Seabed fragment shader example:

```glsl
#if QUALITY_LEVEL >= 2
  // Full: 5-octave FBM + caustics + sparkle + per-channel absorption
  float fbmVal = seaFbm5(wp);
  float caustic = voronoiCaustic(cwp * 0.6, causticTime);
  // ... sparkle, absorption
#elif QUALITY_LEVEL >= 1
  // Medium: 3-octave FBM + caustics, no sparkle
  float fbmVal = seaFbm3(wp);
  float caustic = voronoiCaustic(cwp * 0.6, causticTime);
#else
  // Low: 2-octave noise, solid color blend, no caustics
  float fbmVal = seaNoise2(wp);
#endif
```

### User Override

Scene Lab dropdown: Auto / Ultra / Medium / Low. Stored in `settingsService`. Auto runs `detectOceanQuality()` on mount.

---

## Phase 5: Post-Processing + Memory Cleanup

### Post-Processing Changes

1. **Bloom half-res (Medium tier):** `new BloomEffect({ resolutionScale: 0.5, ... })`
2. **Pixel ratio cap:** `renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualityConfig.maxPixelRatio))`
3. **Conditional EffectComposer:** Low tier skips post-processing entirely — `shouldCompose` gate extended to check tier
4. **Bloom level reduction:** Medium tier uses 5 levels instead of 8

### Memory Cleanup Hardening

Add missing disposal:
- `tintUnderwater` cloned materials: track in a `Set<Material>`, dispose in `onDestroy`
- KTX2 texture disposal on scene teardown
- `GPUComputationRenderer` data textures: already disposed in FishSchool cleanup (verified)
- God ray shaft materials: dispose in `onDestroy` (currently created in `$derived` without cleanup)
- Sand textures in ProceduralSeabed: dispose `sandDiffuse`, `sandNormal`, `sandRoughness`, `sandAo` in `onDestroy`

### Renderer Info Monitoring

Add dev-mode diagnostic (Scene Lab debug panel):
```typescript
const info = renderer.info;
console.log(`Draw calls: ${info.render.calls}, Triangles: ${info.render.triangles}`);
console.log(`Textures: ${info.memory.textures}, Geometries: ${info.memory.geometries}`);
```

Exposed via `window.__oceanPerf()` for quick profiling.

---

## Files Touched

### Phase 1 (Asset Pipeline)
- NEW: `scripts/optimize-ocean-assets.sh`
- `package.json` — devDep + script
- All ocean GLB files in `static/models/ocean/`

### Phase 2 (Loading Gate)
- NEW: `src/lib/shared/3d/environments/scenes/ocean/OceanLoadingScreen.svelte`
- NEW: `src/lib/shared/3d/environments/scenes/ocean/ocean-loading-manager.ts`
- `OceanScene.svelte` — wrap in Suspense, use shared loading manager
- `FishSchool.svelte` — use shared loading manager for fish GLTFs
- `ReefStructures.svelte` — use shared loading manager
- `ProceduralSeabed.svelte` — use shared loading manager for sand textures

### Phase 3 (Instancing)
- `OceanScene.svelte` — replace clone patterns with InstancedMesh builders
- `GodRayShafts.svelte` — convert to single InstancedMesh
- NEW: `src/lib/shared/3d/environments/scenes/ocean/ocean-instancing.ts` — InstancedMesh factory functions

### Phase 4 (Quality Tiers)
- NEW: `src/lib/shared/3d/environments/scenes/ocean/ocean-quality.ts` — tier detection + config
- `OceanScene.svelte` — read quality config, apply count limits
- `ProceduralSeabed.svelte` — shader quality defines
- `WaterSurface.svelte` — shader quality defines, segment count
- `GodRayShafts.svelte` — frequency count from config
- `ScenePostProcessing.svelte` — bloom resolution scale, conditional effects
- `OceanControls.svelte` (Scene Lab) — quality dropdown

### Phase 5 (Cleanup)
- `OceanScene.svelte` — disposal hardening
- `ProceduralSeabed.svelte` — texture disposal
- `GodRayShafts.svelte` — material disposal
- `OceanControls.svelte` — renderer info diagnostic

---

## Success Criteria

| Metric | Before | After (Ultra) | After (Low) |
|---|---|---|---|
| Total asset download | ~250MB | ~30MB | ~15MB (fewer assets) |
| Draw calls | 400+ | ~45 | ~20 |
| Loading experience | Objects pop in, shuffle, settle | Clean loading screen → instant reveal | Same |
| Desktop FPS (GTX 1060) | Sluggish | 60fps stable | N/A |
| Phone FPS (iPhone 13) | Unplayable | N/A | 30fps+ |
| Tablet FPS (iPad Pro) | Choppy | N/A | 45fps+ |
| VRAM usage | 500MB+ | ~120MB | ~50MB |
| Loading time (50Mbps) | 40s+ | ~5s | ~3s |

---

## Non-Goals

- WebGPU migration (separate project)
- TSL shader rewrite (separate project)
- FFT ocean surface (requires WebGPU compute)
- Fish GPU compute rewrite (works fine as-is)
- LOD system for individual objects (instancing + count reduction achieves the same result more simply)
- Texture atlasing (KTX2 compression + instancing removes the need)
