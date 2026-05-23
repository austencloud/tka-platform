# Ocean Scene Performance Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce ocean scene from 250MB/400+ draw calls to ~30MB/~45 draw calls with mobile support, eliminating loading jank via a Suspense-based loading gate.

**Architecture:** Five sequential phases — P1 build-time asset compression via gltf-transform CLI, P2 loading gate with Threlte Suspense + HTML overlay, P3 instancing overhaul replacing clone patterns with InstancedMesh + per-instance attributes, P4 quality tier auto-detection with shader quality defines, P5 post-processing tuning + memory cleanup hardening.

**Tech Stack:** Three.js r182, Threlte core v8, Threlte extras v9, SvelteKit, gltf-transform CLI, KTX2Loader, MeshoptDecoder, pmndrs/postprocessing

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `scripts/optimize-ocean-assets.sh` | gltf-transform pipeline for all ocean GLBs |
| `src/lib/shared/3d/environments/scenes/ocean/ocean-loading-manager.ts` | Shared `THREE.LoadingManager` wrapper with reactive progress |
| `src/lib/shared/3d/environments/scenes/ocean/OceanLoadingScreen.svelte` | HTML overlay loading screen (2D, not 3D) |
| `src/lib/shared/3d/environments/scenes/ocean/ocean-instancing.ts` | InstancedMesh factory functions for coral, kelp, jellyfish, decorations, hero rocks |
| `src/lib/shared/3d/environments/scenes/ocean/ocean-quality.ts` | Tier detection + quality config presets |

### Modified Files

| File | Changes |
|---|---|
| `package.json` | Add `@gltf-transform/cli` devDep, `optimize:ocean` script |
| `OceanScene.svelte` | Replace clone patterns with instancing calls, integrate quality config, integrate loading manager, wrap with loading gate |
| `GodRayShafts.svelte` | Convert N meshes → 1 InstancedMesh, add material disposal, accept quality config |
| `ProceduralSeabed.svelte` | Add `#define QUALITY_LEVEL`, parameterize segments, add texture disposal |
| `WaterSurface.svelte` | Parameterize segments |
| `UnderwaterParticles.svelte` | Accept count from quality config |
| `ScenePostProcessing.svelte` | Add `resolutionScale`, conditional effects, pixel ratio cap |
| `OceanControls.svelte` | Add quality tier dropdown |
| `dispose-scene.ts` | Add texture disposal to traversal |
| `FishSchool.svelte` | Use shared loading manager |
| `ReefStructures.svelte` | Use shared loading manager |

---

## Phase 1: Build-Time Asset Pipeline

### Task 1: Install gltf-transform CLI

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the devDependency**

```bash
pnpm add -D @gltf-transform/cli
```

- [ ] **Step 2: Add the npm script to package.json**

Add to the `"scripts"` section:

```json
"optimize:ocean": "bash scripts/optimize-ocean-assets.sh"
```

- [ ] **Step 3: Verify installation**

Run: `pnpm gltf-transform --help`
Expected: Help output listing available commands (dedup, flatten, prune, simplify, meshopt, etc.)

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @gltf-transform/cli for ocean asset optimization"
```

---

### Task 2: Create the asset optimization script

**Files:**
- Create: `scripts/optimize-ocean-assets.sh`

- [ ] **Step 1: Create the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Ocean Asset Optimization Pipeline
# Run: pnpm optimize:ocean
# Processes all GLB files in static/models/ocean/ through gltf-transform.

OCEAN_DIR="static/models/ocean"
BACKUP_DIR="assets/source-models/ocean"
GLTF="pnpm gltf-transform"

# Ensure backup directory exists (gitignored)
mkdir -p "$BACKUP_DIR"

optimize_file() {
  local src="$1"
  local simplify_ratio="$2"
  local basename
  basename=$(basename "$src")
  local backup="$BACKUP_DIR/$basename"

  # Back up original if not already backed up
  if [ ! -f "$backup" ]; then
    cp "$src" "$backup"
    echo "  Backed up: $basename"
  fi

  local tmp="${src%.glb}.opt.glb"

  echo "  Processing: $basename (simplify ratio: $simplify_ratio)"

  # Pipeline: dedup → flatten → prune → simplify → meshopt → ktx2
  $GLTF dedup "$src" "$tmp"
  mv "$tmp" "$src"

  $GLTF flatten "$src" "$tmp"
  mv "$tmp" "$src"

  $GLTF prune "$src" "$tmp"
  mv "$tmp" "$src"

  if [ "$simplify_ratio" != "none" ]; then
    $GLTF simplify "$src" "$tmp" --ratio "$simplify_ratio"
    mv "$tmp" "$src"
  fi

  $GLTF meshopt "$src" "$tmp"
  mv "$tmp" "$src"

  # GPU-compressed textures (3-4x VRAM reduction, stays compressed on GPU)
  # Skipped if no embedded textures in the GLB
  $GLTF ktx2 "$src" "$tmp" --codec uastc 2>/dev/null && mv "$tmp" "$src" || true

  local size_kb
  size_kb=$(du -k "$src" | cut -f1)
  echo "  Done: $basename → ${size_kb}KB"
}

echo "=== Ocean Asset Optimization ==="
echo ""

# Hero rocks (aggressive simplify — 500K+ tris → 50K)
echo "[1/5] Hero rocks (simplify 0.1)..."
for f in "$OCEAN_DIR"/rock_*.glb; do
  [ -f "$f" ] && optimize_file "$f" "0.1"
done

# Reef structures (aggressive simplify)
echo "[2/5] Reef structures (simplify 0.1)..."
for f in "$OCEAN_DIR"/structures/*.glb; do
  [ -f "$f" ] && optimize_file "$f" "0.1"
done

# Fish (moderate simplify)
echo "[3/5] Fish species (simplify 0.5)..."
for f in "$OCEAN_DIR"/pack/*.glb; do
  [ -f "$f" ] && optimize_file "$f" "0.5"
done

# Small models (no simplify, just dedup/prune/meshopt)
echo "[4/5] Coral, kelp, jellyfish, decorations (meshopt only)..."
for f in "$OCEAN_DIR"/coral_*.glb "$OCEAN_DIR"/seaweed.glb "$OCEAN_DIR"/kelp_plant.glb \
         "$OCEAN_DIR"/jellyfish.glb "$OCEAN_DIR"/jellyfish_small.glb \
         "$OCEAN_DIR"/starfish.glb "$OCEAN_DIR"/sea_urchin.glb \
         "$OCEAN_DIR"/shell.glb "$OCEAN_DIR"/anemone.glb; do
  [ -f "$f" ] && optimize_file "$f" "none"
done

# Large coral (no simplify)
echo "[5/5] Large coral (meshopt only)..."
[ -f "$OCEAN_DIR/coral_large.glb" ] && optimize_file "$OCEAN_DIR/coral_large.glb" "none"

echo ""
echo "=== Optimization complete ==="
echo "Originals backed up to: $BACKUP_DIR/"
echo "Add $BACKUP_DIR to .gitignore if not already present."
```

- [ ] **Step 2: Make the script executable**

```bash
chmod +x scripts/optimize-ocean-assets.sh
```

- [ ] **Step 3: Add backup directory to .gitignore**

Append to `.gitignore`:
```
assets/source-models/
```

- [ ] **Step 4: Run the script on a test file to verify**

Run: `pnpm gltf-transform dedup static/models/ocean/coral_0.glb static/models/ocean/coral_0.test.glb && rm static/models/ocean/coral_0.test.glb`
Expected: Command succeeds, test file created and removed.

- [ ] **Step 5: Commit**

```bash
git add scripts/optimize-ocean-assets.sh .gitignore
git commit -m "feat(ocean): add gltf-transform asset optimization pipeline"
```

---

### Task 3: Run the optimization pipeline

This task must be run manually and may take several minutes.

- [ ] **Step 1: Run the full pipeline**

```bash
pnpm optimize:ocean
```

Expected: Each file processed with final size printed. Hero rocks should drop from ~20MB to 1-2MB each. Total ocean assets should be ~25-35MB.

- [ ] **Step 2: Verify the models still load**

Start the dev server and confirm the ocean scene renders without visual corruption. Some loss of geometric detail on rocks is expected and acceptable.

- [ ] **Step 3: Commit the optimized assets**

```bash
git add static/models/ocean/
git commit -m "perf(ocean): compress all ocean GLBs via gltf-transform (250MB → ~30MB)"
```

---

### Task 4: Add MeshoptDecoder + KTX2Loader to the GLTF loading chain

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte` (lines 82-84)

- [ ] **Step 1: Copy the Basis Universal transcoder to static**

The KTX2Loader needs the Basis transcoder WASM files. Copy them from Three.js:

```bash
mkdir -p static/basis
cp node_modules/three/examples/jsm/libs/basis/basis_transcoder.js static/basis/
cp node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm static/basis/
```

- [ ] **Step 2: Update the loader setup**

In `OceanScene.svelte`, replace the current loader setup:

```typescript
const dracoLoader = useDraco("/draco/");
const opts = { dracoLoader };
```

With:

```typescript
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

const { renderer } = useThrelte();

const ktx2Loader = new KTX2Loader()
  .setTranscoderPath('/basis/')
  .detectSupport(renderer);

const opts = { meshoptDecoder: MeshoptDecoder, ktx2Loader };
```

Note: `useGltf` in Threlte extras accepts `meshoptDecoder` and `ktx2Loader` as options. The Draco loader is no longer needed since meshopt replaces it. Both decoders run in web workers automatically.

- [ ] **Step 3: Add KTX2Loader cleanup to onDestroy**

```typescript
onDestroy(() => {
  ktx2Loader.dispose();
  // ... existing cleanup
});
```

- [ ] **Step 4: Verify the imports resolve**

Run: `pnpm check`
Expected: No type errors for the MeshoptDecoder or KTX2Loader imports.

- [ ] **Step 5: Verify models load with meshopt + KTX2 decoding**

Start the dev server, navigate to ocean scene, confirm all models render. Check console for any KTX2 decode errors (okay if models don't have KTX2 textures yet — the loader will simply skip).

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/OceanScene.svelte static/basis/
git commit -m "feat(ocean): add MeshoptDecoder + KTX2Loader for compressed asset loading"
```

---

## Phase 2: Loading Gate

### Task 5: Create the shared loading manager

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean/ocean-loading-manager.ts`

- [ ] **Step 1: Write the loading manager module**

```typescript
import { LoadingManager } from 'three';

export interface OceanLoadingState {
  progress: number;
  loaded: boolean;
  itemsLoaded: number;
  itemsTotal: number;
}

export function createOceanLoadingManager(): {
  manager: LoadingManager;
  state: OceanLoadingState;
} {
  const state: OceanLoadingState = $state({
    progress: 0,
    loaded: false,
    itemsLoaded: 0,
    itemsTotal: 0,
  });

  const manager = new LoadingManager();

  manager.onStart = (_url, loaded, total) => {
    state.itemsLoaded = loaded;
    state.itemsTotal = total;
    state.progress = total > 0 ? loaded / total : 0;
  };

  manager.onProgress = (_url, loaded, total) => {
    state.itemsLoaded = loaded;
    state.itemsTotal = total;
    state.progress = total > 0 ? loaded / total : 0;
  };

  manager.onLoad = () => {
    state.loaded = true;
    state.progress = 1;
  };

  manager.onError = (url) => {
    console.error(`[OceanLoadingManager] Failed to load: ${url}`);
  };

  return { manager, state };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/ocean-loading-manager.ts
git commit -m "feat(ocean): create shared loading manager with reactive progress"
```

---

### Task 6: Create the loading screen component

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean/OceanLoadingScreen.svelte`

- [ ] **Step 1: Write the loading screen**

```svelte
<script lang="ts">
  interface Props {
    progress: number;
    visible: boolean;
  }

  let { progress, visible }: Props = $props();

  const percent = $derived(Math.round(progress * 100));
</script>

{#if visible}
  <div class="ocean-loading-overlay" class:fade-out={progress >= 1}>
    <div class="loading-content">
      <div class="wave-container">
        <svg viewBox="0 0 200 20" class="wave-svg">
          <path
            d="M0,10 Q25,2 50,10 T100,10 T150,10 T200,10"
            fill="none"
            stroke="rgba(100,180,220,0.6)"
            stroke-width="1.5"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="-50,0;0,0;-50,0"
              dur="3s"
              repeatCount="indefinite"
            />
          </path>
          <path
            d="M0,12 Q25,4 50,12 T100,12 T150,12 T200,12"
            fill="none"
            stroke="rgba(100,180,220,0.3)"
            stroke-width="1"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0,0;-50,0;0,0"
              dur="4s"
              repeatCount="indefinite"
            />
          </path>
        </svg>
      </div>

      <div class="progress-bar-track">
        <div class="progress-bar-fill" style:width="{percent}%"></div>
      </div>

      <span class="progress-text">{percent}%</span>
    </div>
  </div>
{/if}

<style>
  .ocean-loading-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, #0a1628 0%, #0d2847 40%, #1a5580 100%);
    transition: opacity 300ms ease-out;
    pointer-events: all;
  }

  .ocean-loading-overlay.fade-out {
    opacity: 0;
    pointer-events: none;
  }

  .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    width: min(280px, 60vw);
  }

  .wave-container {
    width: 100%;
    height: 20px;
    overflow: hidden;
  }

  .wave-svg {
    width: 150%;
    height: 100%;
  }

  .progress-bar-track {
    width: 100%;
    height: 3px;
    background: rgba(100, 180, 220, 0.15);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #4a90b8, #7ec8e3);
    border-radius: 2px;
    transition: width 200ms ease-out;
  }

  .progress-text {
    font-family: var(--font-mono, monospace);
    font-size: 0.8rem;
    color: rgba(126, 200, 227, 0.6);
    letter-spacing: 0.1em;
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/OceanLoadingScreen.svelte
git commit -m "feat(ocean): add HTML loading screen overlay"
```

---

### Task 7: Wire the loading gate into OceanScene

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte`

- [ ] **Step 1: Import the loading manager and loading screen**

Add imports at the top of the script block (after existing imports):

```typescript
import OceanLoadingScreen from "./ocean/OceanLoadingScreen.svelte";
import { createOceanLoadingManager } from "./ocean/ocean-loading-manager";
```

- [ ] **Step 2: Create the loading manager instance**

After the `opts` definition (~line 84), add:

```typescript
const { manager: loadingManager, state: loadingState } = createOceanLoadingManager();
```

- [ ] **Step 3: Replace the loading progress tracking**

Replace the existing loading progress `$effect` block (lines 942-953):

```typescript
$effect(() => {
  if (!sceneFeatures) return;
  const glbs = [
    $coralGlb0, $coralGlb1, $coralGlb2, $coralGlb3, $coralLargeGlb,
    $seaweedGlb, $kelpPlantGlb,
    $jellyfishGlb, $jellyfishSmallGlb,
    $starfishGlb, $seaUrchinGlb, $shellGlb, $anemoneGlb,
  ];
  const loaded = glbs.filter(Boolean).length;
  sceneFeatures.reportProgress("environment", loaded / glbs.length);
  if (loaded === glbs.length) sceneFeatures.reportReady("environment");
});
```

With:

```typescript
$effect(() => {
  if (!sceneFeatures) return;
  sceneFeatures.reportProgress("environment", loadingState.progress);
  if (loadingState.loaded) sceneFeatures.reportReady("environment");
});
```

- [ ] **Step 4: Update the timeout from 5s to 15s**

In the `onMount` block (line 956), change `5_000` to `15_000`.

- [ ] **Step 5: Add the loading screen to the template**

At the very top of the template section (before `<SkyGradient>`), add:

```svelte
<OceanLoadingScreen progress={loadingState.progress} visible={!loadingState.loaded} />
```

- [ ] **Step 6: Gate scene rendering behind loading state**

Wrap the entire template content (everything from `<SkyGradient>` to the closing `<RuinsPlatform>`) in a conditional:

```svelte
{#if loadingState.loaded}
  <!-- existing template content here -->
{/if}
```

This ensures no 3D objects render until all assets are loaded, eliminating the progressive pop-in jank.

- [ ] **Step 7: Verify the loading screen appears**

Start the dev server, navigate to ocean scene. Expected: blue gradient loading screen with progress bar, then scene appears all at once when loaded.

- [ ] **Step 8: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "feat(ocean): add loading gate — scene renders only when fully loaded"
```

---

## Phase 3: Instancing Overhaul

### Task 8: Create the instancing factory module

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean/ocean-instancing.ts`

- [ ] **Step 1: Write the instancing factory**

```typescript
import {
  InstancedMesh,
  InstancedBufferAttribute,
  Matrix4,
  Vector3,
  Quaternion,
  Euler,
  Color,
  Object3D,
  Mesh,
  type BufferGeometry,
  type Material,
  MeshStandardMaterial,
} from 'three';

export interface InstancePlacement {
  x: number;
  z: number;
  y: number;
  scale: number;
  rotY: number;
}

export interface ColoredInstancePlacement extends InstancePlacement {
  color: Color;
}

function extractFirstMeshGeometryAndMaterial(
  root: Object3D,
): { geometry: BufferGeometry; material: Material } | null {
  let result: { geometry: BufferGeometry; material: Material } | null = null;
  root.traverse((child) => {
    if (result) return;
    const m = child as Mesh;
    if (!m.isMesh || !m.geometry) return;
    const mat = Array.isArray(m.material) ? m.material[0]! : m.material;
    result = { geometry: m.geometry, material: mat };
  });
  return result;
}

export function createInstancedMeshFromModel(
  model: Object3D,
  placements: InstancePlacement[],
): InstancedMesh | null {
  if (placements.length === 0) return null;

  const extracted = extractFirstMeshGeometryAndMaterial(model);
  if (!extracted) return null;

  const inst = new InstancedMesh(extracted.geometry, extracted.material, placements.length);
  inst.frustumCulled = false;

  const mat = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();

  for (let i = 0; i < placements.length; i++) {
    const p = placements[i]!;
    q.setFromEuler(new Euler(0, p.rotY, 0));
    s.setScalar(p.scale);
    mat.compose(new Vector3(p.x, p.y, p.z), q, s);
    inst.setMatrixAt(i, mat);
  }

  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

export function createColoredInstancedMesh(
  model: Object3D,
  placements: ColoredInstancePlacement[],
): InstancedMesh | null {
  if (placements.length === 0) return null;

  const extracted = extractFirstMeshGeometryAndMaterial(model);
  if (!extracted) return null;

  const baseMat = extracted.material as MeshStandardMaterial;
  const instanceMat = baseMat.clone();

  instanceMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      attribute vec3 aInstanceColor;
      varying vec3 vInstanceColor;`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vInstanceColor = aInstanceColor;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vInstanceColor;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      diffuseColor.rgb *= vInstanceColor;`,
    );
  };

  const geo = extracted.geometry.clone();
  const colors = new Float32Array(placements.length * 3);
  for (let i = 0; i < placements.length; i++) {
    const c = placements[i]!.color;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('aInstanceColor', new InstancedBufferAttribute(colors, 3));

  const inst = new InstancedMesh(geo, instanceMat, placements.length);
  inst.frustumCulled = false;

  const mat = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();

  for (let i = 0; i < placements.length; i++) {
    const p = placements[i]!;
    q.setFromEuler(new Euler(0, p.rotY, 0));
    s.setScalar(p.scale);
    mat.compose(new Vector3(p.x, p.y, p.z), q, s);
    inst.setMatrixAt(i, mat);
  }

  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

export function disposeInstancedMesh(inst: InstancedMesh | null): void {
  if (!inst) return;
  inst.geometry.dispose();
  const mat = inst.material;
  if (Array.isArray(mat)) {
    for (const m of mat) m.dispose();
  } else {
    mat.dispose();
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/ocean-instancing.ts
git commit -m "feat(ocean): add InstancedMesh factory for batched rendering"
```

---

### Task 9: Convert coral clones to instanced meshes

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte`

This is the biggest single change — replacing 200+ coral clones (each a separate draw call with cloned material) with 5 InstancedMesh objects (one per species).

- [ ] **Step 1: Import the instancing factory**

Add to imports:

```typescript
import { createColoredInstancedMesh, disposeInstancedMesh, type ColoredInstancePlacement } from "./ocean/ocean-instancing";
```

- [ ] **Step 2: Replace the `coralClones` derived with `coralInstances`**

Replace the `coralClones` block (lines 717-742):

```typescript
const coralClones = $derived.by(() => {
  const models = [
    $coralGlb0,
    $coralGlb1,
    $coralGlb2,
    $coralGlb3,
    $coralLargeGlb,
  ].filter(Boolean) as { scene: Object3D }[];
  if (models.length === 0) return [];
  return coralPlacements.map((placement) => {
    // ... clone + tint per placement
  });
});
```

With:

```typescript
const coralInstances = $derived.by((): (InstancedMesh | null)[] => {
  const models = [
    $coralGlb0,
    $coralGlb1,
    $coralGlb2,
    $coralGlb3,
    $coralLargeGlb,
  ].filter(Boolean) as { scene: Object3D }[];
  if (models.length === 0) return [];

  const buckets = new Map<number, ColoredInstancePlacement[]>();

  for (let pi = 0; pi < coralPlacements.length; pi++) {
    const placement = coralPlacements[pi]!;
    const speciesIdx = placement.speciesIdx % models.length;
    if (!buckets.has(speciesIdx)) buckets.set(speciesIdx, []);

    const baseColor = new Color(activeConfig.coral.glowColor);
    const hsl = { h: 0, s: 0, l: 0 };
    baseColor.getHSL(hsl);
    hsl.h += placement.hueShift;
    hsl.s = Math.min(1, hsl.s * placement.satBoost);
    hsl.l = Math.max(0.1, Math.min(0.7, hsl.l + (placement.hueShift > 0 ? 0.05 : -0.03)));
    baseColor.setHSL(hsl.h, hsl.s, hsl.l);

    const s = (coralScales[pi] ?? 0.001) * placement.scale;
    const th = getTerrainY(placement.x, placement.z);
    const baseOffset = (coralBaseOffsets[speciesIdx % coralBaseOffsets.length] ?? 0) * s;

    buckets.get(speciesIdx)!.push({
      x: placement.x,
      z: placement.z,
      y: groundY + th + baseOffset,
      scale: s,
      rotY: placement.rotY,
      color: baseColor,
    });
  }

  return models.map((model, idx) => {
    const placements = buckets.get(idx) ?? [];
    return createColoredInstancedMesh(model.scene, placements);
  });
});
```

- [ ] **Step 3: Replace the coral template section**

Replace the coral `{#each coralClones}` block (lines 1043-1060):

```svelte
{#if activeConfig.coral.enabled && coralClones.length > 0}
  {#each coralClones as clone, i}
    ...
  {/each}
{/if}
```

With:

```svelte
{#if activeConfig.coral.enabled}
  {#each coralInstances as inst}
    {#if inst}
      <T is={inst} />
    {/if}
  {/each}
{/if}
```

- [ ] **Step 4: Update the cleanup block**

In `onDestroy`, replace:

```typescript
for (const c of coralClones) disposeSceneGraph(c);
```

With:

```typescript
for (const inst of coralInstances) disposeInstancedMesh(inst);
```

- [ ] **Step 5: Verify coral renders correctly**

Start dev server, navigate to ocean scene. Coral should appear with per-instance color variation, positioned correctly on terrain. Expected draw calls for coral: 5 (one per species) instead of 200+.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "perf(ocean): instance coral — 200+ draw calls → 5"
```

---

### Task 10: Convert kelp clones to instanced meshes

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte`

- [ ] **Step 1: Replace `kelpClones` with `kelpInstances`**

Replace the `kelpClones` block (lines 844-852):

```typescript
const kelpClones = $derived.by(() => {
  const models = [$seaweedGlb, $kelpPlantGlb].filter(Boolean) as { scene: Object3D }[];
  if (models.length === 0) return [];
  return kelpPlacements.map((_, i) =>
    underwaterClone(models[i % models.length]!.scene, "#0d3a1a", 0.2, true),
  );
});
```

With:

```typescript
import { createInstancedMeshFromModel, type InstancePlacement } from "./ocean/ocean-instancing";

const kelpInstances = $derived.by((): (InstancedMesh | null)[] => {
  const models = [$seaweedGlb, $kelpPlantGlb].filter(Boolean) as { scene: Object3D }[];
  if (models.length === 0) return [];

  const buckets: InstancePlacement[][] = models.map(() => []);

  for (let i = 0; i < kelpPlacements.length; i++) {
    const p = kelpPlacements[i]!;
    const modelIdx = i % models.length;
    const s = kelpScales[i] ?? 0.001;
    const th = getTerrainY(p.x, p.z);
    const baseOffset = (kelpBaseOffsets[modelIdx % kelpBaseOffsets.length] ?? 0) * p.scale * s;

    buckets[modelIdx]!.push({
      x: p.x,
      z: p.z,
      y: groundY + th + baseOffset,
      scale: p.scale * s,
      rotY: p.rotY,
    });
  }

  return models.map((model, idx) =>
    createInstancedMeshFromModel(model.scene, buckets[idx]!),
  );
});
```

- [ ] **Step 2: Remove the kelp sway animation from the useTask block**

Remove the kelp sway section (lines 903-915) from the `useTask` callback:

```typescript
// Kelp: gentle sway via direct rotation mutation
const swaySpeed = activeConfig.kelp.swaySpeed;
const swayAmp = activeConfig.kelp.swayAmplitude;
for (let i = 0; i < kelpClones.length; i++) {
  const clone = kelpClones[i];
  if (clone) {
    const phase = i * 1.7;
    clone.rotation.x =
      Math.sin(animTime * swaySpeed + phase) * swayAmp;
    clone.rotation.z =
      Math.cos(animTime * swaySpeed * 0.7 + phase) * swayAmp * 0.6;
  }
}
```

Kelp sway will be handled in the vertex shader as a future enhancement (documented in spec). For now, static placement is acceptable since it eliminates 80 draw calls.

- [ ] **Step 3: Replace the kelp template section**

Replace:

```svelte
{#if activeConfig.kelp.enabled && kelpClones.length > 0}
  {#each kelpClones as clone, i}
    ...
  {/each}
{/if}
```

With:

```svelte
{#if activeConfig.kelp.enabled}
  {#each kelpInstances as inst}
    {#if inst}
      <T is={inst} />
    {/if}
  {/each}
{/if}
```

- [ ] **Step 4: Update cleanup**

Replace:

```typescript
for (const c of kelpClones) disposeSceneGraph(c);
```

With:

```typescript
for (const inst of kelpInstances) disposeInstancedMesh(inst);
```

- [ ] **Step 5: Verify and commit**

Run: `pnpm check`
Start dev server, confirm kelp renders as a static instanced mesh group.

```bash
git add src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "perf(ocean): instance kelp — 80+ draw calls → 2"
```

---

### Task 11: Convert jellyfish clones to instanced meshes

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte`

- [ ] **Step 1: Replace `jellyfishClones` with `jellyfishInstances`**

Replace the `jellyfishClones` block (lines 855-863):

```typescript
const jellyfishClones = $derived.by(() => {
  const large = $jellyfishGlb;
  const small = $jellyfishSmallGlb;
  if (!large) return [];
  return jellyfishSamples.map((jf) => {
    if (jf.isSmall && small) return small.scene.clone();
    return large.scene.clone();
  });
});
```

With:

```typescript
const jellyfishInstances = $derived.by((): { large: InstancedMesh | null; small: InstancedMesh | null } => {
  const large = $jellyfishGlb;
  const small = $jellyfishSmallGlb;
  if (!large) return { large: null, small: null };

  const largePlacements: InstancePlacement[] = [];
  const smallPlacements: InstancePlacement[] = [];

  for (const jf of jellyfishSamples) {
    const placement: InstancePlacement = {
      x: jf.x,
      z: jf.z,
      y: groundY + jf.y,
      scale: jf.isSmall ? jellyfishSmallScale : jellyfishLargeScale,
      rotY: 0,
    };
    if (jf.isSmall && small) {
      smallPlacements.push(placement);
    } else {
      largePlacements.push(placement);
    }
  }

  return {
    large: createInstancedMeshFromModel(large.scene, largePlacements),
    small: small ? createInstancedMeshFromModel(small.scene, smallPlacements) : null,
  };
});
```

- [ ] **Step 2: Remove the jellyfish drift/pulse animation from useTask**

Remove the jellyfish animation section (lines 884-901) from the `useTask` callback. With instancing, per-instance animation requires updating the instance matrix each frame — which is still possible but the drift effect is subtle enough that static placement is acceptable for the perf win. The per-jellyfish `PointLight` is the real performance cost (removed in Phase 4 for medium/low tiers).

- [ ] **Step 3: Replace the jellyfish template section**

Replace the entire jellyfish `{#if}` block (lines 1159-1189):

```svelte
{#if activeConfig.jellyfish?.enabled && jellyfishClones.length > 0}
  {#each jellyfishSamples as jf, i}
    ...
  {/each}
{/if}
```

With:

```svelte
{#if activeConfig.jellyfish?.enabled}
  {#if jellyfishInstances.large}
    <T is={jellyfishInstances.large} />
  {/if}
  {#if jellyfishInstances.small}
    <T is={jellyfishInstances.small} />
  {/if}
{/if}
```

Note: This removes the per-jellyfish `PointLight` for now. Phase 4 will add them back conditionally for the Ultra tier.

- [ ] **Step 4: Update cleanup**

Replace:

```typescript
for (const c of jellyfishClones) disposeSceneGraph(c);
```

With:

```typescript
disposeInstancedMesh(jellyfishInstances.large);
disposeInstancedMesh(jellyfishInstances.small);
```

- [ ] **Step 5: Verify and commit**

```bash
git add src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "perf(ocean): instance jellyfish — 20+ draw calls → 2"
```

---

### Task 12: Convert decoration clones to instanced meshes

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte`

- [ ] **Step 1: Replace `decorationClones` with `decorationInstances`**

Replace the `decorationClones` block (lines 865-876):

```typescript
const decorationClones = $derived.by(() => {
  return decorationPlacements.map((dec) => {
    ...
  });
});
```

With:

```typescript
const decorationInstances = $derived.by((): Record<string, InstancedMesh | null> => {
  const modelMap: Record<string, Object3D | undefined> = {
    starfish: $starfishGlb?.scene,
    urchin: $seaUrchinGlb?.scene,
    shell: $shellGlb?.scene,
    anemone: $anemoneGlb?.scene,
  };

  const buckets: Record<string, InstancePlacement[]> = {
    starfish: [],
    urchin: [],
    shell: [],
    anemone: [],
  };

  for (const dec of decorationPlacements) {
    const th = getTerrainY(dec.x, dec.z);
    buckets[dec.type]!.push({
      x: dec.x,
      z: dec.z,
      y: groundY + th,
      scale: dec.scale * decoScale(dec.type),
      rotY: dec.rotY,
    });
  }

  const result: Record<string, InstancedMesh | null> = {};
  for (const [type, model] of Object.entries(modelMap)) {
    result[type] = model
      ? createInstancedMeshFromModel(model, buckets[type]!)
      : null;
  }
  return result;
});
```

- [ ] **Step 2: Replace the decoration template section**

Replace:

```svelte
{#if activeConfig.decorations.enabled}
  {#each decorationClones as clone, i}
    ...
  {/each}
{/if}
```

With:

```svelte
{#if activeConfig.decorations.enabled}
  {#each Object.values(decorationInstances) as inst}
    {#if inst}
      <T is={inst} />
    {/if}
  {/each}
{/if}
```

- [ ] **Step 3: Update cleanup**

Replace:

```typescript
for (const c of decorationClones) if (c) disposeSceneGraph(c as Object3D);
```

With:

```typescript
for (const inst of Object.values(decorationInstances)) disposeInstancedMesh(inst);
```

- [ ] **Step 4: Verify and commit**

```bash
git add src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "perf(ocean): instance decorations — 60+ draw calls → 4"
```

---

### Task 13: Convert hero rock clones to instanced meshes

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte`

- [ ] **Step 1: Replace `heroRockClones` with `heroRockInstances`**

Replace the `heroRockClones` block (lines 633-639):

```typescript
const heroRockClones = $derived.by(() => {
  if (!hasGlbRocks) return [];
  return heroRockPlacements.map((p) => {
    const model = rockGlbModels[p.modelIdx % rockGlbModels.length]!;
    return underwaterClone(model.scene, activeConfig.rocks.tintColor, activeConfig.rocks.tintBlend * 0.5);
  });
});
```

With:

```typescript
const heroRockInstances = $derived.by((): (InstancedMesh | null)[] => {
  if (!hasGlbRocks) return [];

  const buckets: Map<number, InstancePlacement[]> = new Map();

  for (const p of heroRockPlacements) {
    const modelIdx = p.modelIdx % rockGlbModels.length;
    if (!buckets.has(modelIdx)) buckets.set(modelIdx, []);

    const s = rockGlbScales[modelIdx] ?? 0.001;
    const baseOffset = (rockGlbBaseOffsets[modelIdx] ?? 0) * p.scale * s;

    buckets.get(modelIdx)!.push({
      x: p.x,
      z: p.z,
      y: groundY + getTerrainY(p.x, p.z) + baseOffset,
      scale: p.scale * s,
      rotY: p.rotY,
    });
  }

  return rockGlbModels.map((model, idx) => {
    const placements = buckets.get(idx) ?? [];
    return createInstancedMeshFromModel(model.scene, placements);
  });
});
```

- [ ] **Step 2: Replace the hero rocks template section**

Replace:

```svelte
{#if activeConfig.rocks.enabled && heroRockClones.length > 0}
  {#each heroRockClones as clone, i}
    ...
  {/each}
{/if}
```

With:

```svelte
{#if activeConfig.rocks.enabled && hasGlbRocks}
  {#each heroRockInstances as inst}
    {#if inst}
      <T is={inst} />
    {/if}
  {/each}
{/if}
```

- [ ] **Step 3: Update cleanup**

Replace:

```typescript
for (const c of heroRockClones) disposeSceneGraph(c);
```

With:

```typescript
for (const inst of heroRockInstances) disposeInstancedMesh(inst);
```

- [ ] **Step 4: Verify and commit**

```bash
git add src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "perf(ocean): instance hero rocks — 40+ draw calls → 6"
```

---

### Task 14: Convert god ray shafts to a single InstancedMesh

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/GodRayShafts.svelte`

- [ ] **Step 1: Rewrite GodRayShafts to use a single InstancedMesh**

Replace the entire content of `GodRayShafts.svelte`:

```svelte
<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    ShaderMaterial,
    AdditiveBlending,
    DoubleSide,
    Color,
    PlaneGeometry,
    InstancedMesh,
    InstancedBufferAttribute,
    Matrix4,
    Vector3,
    Quaternion,
    Euler,
  } from "three";
  import type { OceanGodRayShaftConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onDestroy } from "svelte";

  interface Props {
    config: OceanGodRayShaftConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const vertexShader = /* glsl */ `
    attribute float aOpacityMult;
    varying vec2 vUv;
    varying float vWorldY;
    varying float vNormY;
    varying float vOpacityMult;
    uniform float uHeight;
    uniform float uGroundY;

    void main() {
      vUv = uv;
      vOpacityMult = aOpacityMult;
      vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vWorldY = worldPos.y;
      vNormY = clamp((worldPos.y - uGroundY) / uHeight, 0.0, 1.0);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uColorTop;
    uniform vec3 uColorBottom;
    uniform float uIntensity;
    varying vec2 vUv;
    varying float vWorldY;
    varying float vNormY;
    varying float vOpacityMult;

    void main() {
      float cx = (vUv.x - 0.48) * 2.0;
      float centerFade = exp(-cx * cx * 2.5);
      float verticalFade = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.5, vUv.y);

      float s1 = sin(vWorldY * 1.7 + uTime * 1.2);
      float s2 = sin(vWorldY * 3.3 - uTime * 0.7 + 1.3);
      float s3 = sin(vWorldY * 0.8 + uTime * 2.1 + 3.7);
      float s4 = cos(vWorldY * 5.1 - uTime * 1.5 + 0.9);
      float shimmer = 0.55 + 0.2 * s1 + 0.12 * s2 + 0.08 * s3 + 0.05 * s4;

      vec3 color = mix(uColorBottom, uColorTop, vNormY);
      float alpha = centerFade * verticalFade * shimmer * uIntensity * vOpacityMult;
      gl_FragColor = vec4(color * alpha, alpha * 0.35);
    }
  `;

  function seededRandom(seed: number) {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
  }

  const material = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColorTop: { value: new Color("#d4e8f0") },
      uColorBottom: { value: new Color(config.color) },
      uIntensity: { value: config.intensity },
      uHeight: { value: config.height },
      uGroundY: { value: 0 },
    },
    vertexShader,
    fragmentShader,
  });

  const instancedMesh = $derived.by(() => {
    const geo = new PlaneGeometry(config.width, config.height);
    const rng = seededRandom(777);

    const count = config.count;
    const opacities = new Float32Array(count);

    const inst = new InstancedMesh(geo, material, count);
    inst.frustumCulled = false;

    const mat = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3(1, 1, 1);

    for (let i = 0; i < count; i++) {
      const x = (rng() - 0.5) * 22;
      const z = (rng() - 0.5) * 22;
      const rotY = rng() * Math.PI * 2;
      const tilt = 0.04 + rng() * 0.12;
      const widthScale = 0.5 + rng() * 0.8;
      opacities[i] = 0.4 + rng() * 0.6;

      q.setFromEuler(new Euler(0, rotY, tilt));
      s.set(widthScale, 1, 1);
      mat.compose(
        new Vector3(x, groundY + config.height * 0.5, z),
        q,
        s,
      );
      inst.setMatrixAt(i, mat);
    }

    inst.instanceMatrix.needsUpdate = true;
    geo.setAttribute('aOpacityMult', new InstancedBufferAttribute(opacities, 1));

    return inst;
  });

  $effect(() => {
    material.uniforms.uColorBottom!.value = new Color(config.color);
    material.uniforms.uIntensity!.value = config.intensity;
    material.uniforms.uGroundY!.value = groundY;
  });

  useTask((delta) => {
    material.uniforms.uTime!.value += delta * config.speed * 5;
  });

  onDestroy(() => {
    material.dispose();
    instancedMesh.geometry.dispose();
  });
</script>

<T is={instancedMesh} />
```

- [ ] **Step 2: Verify it compiles and renders**

Run: `pnpm check`
Start dev server, confirm god ray shafts still animate and look correct.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/GodRayShafts.svelte
git commit -m "perf(ocean): instance god ray shafts — 12 draw calls → 1"
```

---

### Task 15: Remove now-unused functions from OceanScene

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte`

- [ ] **Step 1: Remove `tintUnderwater`, `underwaterClone`, and `hasSkeleton`**

These functions (lines 653-713) were only used by the clone pattern. With instancing, per-instance color variation is handled by `InstancedBufferAttribute`. Remove the entire block from `function tintUnderwater(` through the closing `}` of `function underwaterClone(`.

- [ ] **Step 2: Remove the `clone` import from SkeletonUtils**

Remove:

```typescript
import { clone as cloneWithSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm check`

```bash
git add src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "refactor(ocean): remove dead clone/tint functions replaced by instancing"
```

---

## Phase 4: Quality Tier System

### Task 16: Create the quality tier module

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/ocean/ocean-quality.ts`

- [ ] **Step 1: Write the quality tier detection and config**

```typescript
import type { WebGLRenderer } from 'three';

export type OceanQualityTier = 'ultra' | 'medium' | 'low';

export interface OceanQualityConfig {
  tier: OceanQualityTier;

  maxCoralCount: number;
  maxKelpCount: number;
  maxFishCount: number;
  maxHeroRocks: number;
  maxReefStructures: number;
  maxJellyfish: number;
  maxGodRayShafts: number;
  particleCount: number;
  bubbleCount: number;

  seabedSegments: number;
  waterSurfaceSegments: number;

  seabedFbmOctaves: number;
  enableCaustics: boolean;
  enableSparkle: boolean;
  godRayFrequencies: number;

  enableBloom: boolean;
  bloomResolutionScale: number;
  bloomLevels: number;
  enableChromaticAberration: boolean;
  maxPixelRatio: number;

  enableJellyfishLights: boolean;
}

const TIER_PRESETS: Record<OceanQualityTier, OceanQualityConfig> = {
  ultra: {
    tier: 'ultra',
    maxCoralCount: 200,
    maxKelpCount: 80,
    maxFishCount: 200,
    maxHeroRocks: 40,
    maxReefStructures: 4,
    maxJellyfish: 20,
    maxGodRayShafts: 12,
    particleCount: 4000,
    bubbleCount: 200,
    seabedSegments: 192,
    waterSurfaceSegments: 64,
    seabedFbmOctaves: 5,
    enableCaustics: true,
    enableSparkle: true,
    godRayFrequencies: 4,
    enableBloom: true,
    bloomResolutionScale: 1.0,
    bloomLevels: 8,
    enableChromaticAberration: true,
    maxPixelRatio: 2,
    enableJellyfishLights: true,
  },
  medium: {
    tier: 'medium',
    maxCoralCount: 80,
    maxKelpCount: 30,
    maxFishCount: 100,
    maxHeroRocks: 15,
    maxReefStructures: 2,
    maxJellyfish: 8,
    maxGodRayShafts: 6,
    particleCount: 1500,
    bubbleCount: 100,
    seabedSegments: 96,
    waterSurfaceSegments: 32,
    seabedFbmOctaves: 3,
    enableCaustics: true,
    enableSparkle: false,
    godRayFrequencies: 2,
    enableBloom: true,
    bloomResolutionScale: 0.5,
    bloomLevels: 5,
    enableChromaticAberration: true,
    maxPixelRatio: 1.5,
    enableJellyfishLights: false,
  },
  low: {
    tier: 'low',
    maxCoralCount: 30,
    maxKelpCount: 10,
    maxFishCount: 30,
    maxHeroRocks: 5,
    maxReefStructures: 0,
    maxJellyfish: 0,
    maxGodRayShafts: 3,
    particleCount: 500,
    bubbleCount: 50,
    seabedSegments: 48,
    waterSurfaceSegments: 16,
    seabedFbmOctaves: 2,
    enableCaustics: false,
    enableSparkle: false,
    godRayFrequencies: 0,
    enableBloom: false,
    bloomResolutionScale: 1.0,
    bloomLevels: 0,
    enableChromaticAberration: false,
    maxPixelRatio: 1,
    enableJellyfishLights: false,
  },
};

export function detectOceanQuality(renderer: WebGLRenderer): OceanQualityTier {
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

export function getOceanQualityConfig(tier: OceanQualityTier): OceanQualityConfig {
  return { ...TIER_PRESETS[tier] };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/ocean-quality.ts
git commit -m "feat(ocean): add quality tier detection and config presets"
```

---

### Task 17: Wire quality config into OceanScene

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte`

- [ ] **Step 1: Import the quality module**

```typescript
import { detectOceanQuality, getOceanQualityConfig, type OceanQualityTier, type OceanQualityConfig } from "./ocean/ocean-quality";
```

- [ ] **Step 2: Detect quality tier on mount**

Add after the `useThrelte()` call:

```typescript
const { renderer } = useThrelte();

let qualityOverride = $state<OceanQualityTier | 'auto'>('auto');
const detectedTier = $derived.by((): OceanQualityTier => {
  if (qualityOverride !== 'auto') return qualityOverride;
  return detectOceanQuality(renderer);
});
const qualityConfig = $derived(getOceanQualityConfig(detectedTier));
```

Note: `renderer` is already destructured from `useThrelte()` on line 115 as part of `const { scene } = useThrelte()`. Update that destructuring to also include `renderer`:

```typescript
const { scene, renderer } = useThrelte();
```

- [ ] **Step 3: Apply count limits from quality config**

In `scenePlacements`, clamp each category's max count by `qualityConfig`:

For hero rocks — change `if (heroRocks.length >= 40)` to `if (heroRocks.length >= qualityConfig.maxHeroRocks)`.

For coral — change the `maxCount` from `cfg.coral.count` to `Math.min(cfg.coral.count, qualityConfig.maxCoralCount)`.

For kelp — change the `maxCount` from `cfg.kelp.count` to `Math.min(cfg.kelp.count, qualityConfig.maxKelpCount)`.

For decorations — change the `maxCount` from `cfg.decorations.count` to `Math.min(cfg.decorations.count, qualityConfig.maxCoralCount)`. (Actually, use a separate decoration limit — but the quality config doesn't have one explicitly. Use `qualityConfig.maxCoralCount * 0.3` as a proxy, or add `maxDecorations` to the config.)

- [ ] **Step 4: Apply particle count from quality config**

Pass `qualityConfig.particleCount` to `UnderwaterParticles`:

```svelte
<UnderwaterParticles count={qualityConfig.particleCount} />
```

- [ ] **Step 5: Apply bubble count from quality config**

Update the bubbles block:

```svelte
{#key activeConfig.bubbles.count}
  <FallingParticles
    ...
    count={Math.min(activeConfig.bubbles.count, qualityConfig.bubbleCount)}
    ...
  />
{/key}
```

- [ ] **Step 6: Conditionally render reef structures**

```svelte
{#if qualityConfig.maxReefStructures > 0}
  <ReefStructures ... />
{/if}
```

- [ ] **Step 7: Apply pixel ratio cap**

Add an `$effect` after the quality detection:

```typescript
$effect(() => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualityConfig.maxPixelRatio));
});
```

- [ ] **Step 8: Verify and commit**

Run: `pnpm check`

```bash
git add src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "feat(ocean): wire quality tier config — count limits + pixel ratio cap"
```

---

### Task 18: Add shader quality defines to ProceduralSeabed

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/ProceduralSeabed.svelte`

- [ ] **Step 1: Accept quality level as a prop**

Add to the interface and props:

```typescript
interface Props {
  // ... existing props
  qualityLevel?: number; // 0 = low, 1 = medium, 2 = ultra
  segments?: number;
}

let {
  // ... existing defaults
  qualityLevel = 2,
  segments = 192,
}: Props = $props();
```

- [ ] **Step 2: Parameterize the segment count**

Replace `const SEGMENTS = 192;` with:

```typescript
const SEGMENTS = segments;
```

- [ ] **Step 3: Add quality-conditioned shader code**

In the noise GLSL block, add reduced-octave FBM variants:

```glsl
float seaFbm3(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * seaNoise(p); p *= 2.0; a *= 0.5; }
  return v;
}
float seaNoise2(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 2; i++) { v += a * seaNoise(p); p *= 2.0; a *= 0.5; }
  return v;
}
```

- [ ] **Step 4: Wrap the caustics and sparkle sections with quality guards**

In the fragment shader injection that replaces `#include <opaque_fragment>`, add the `QUALITY_LEVEL` define to the material:

```typescript
material.defines = material.defines ?? {};
material.defines.QUALITY_LEVEL = qualityLevel;
```

Then wrap the caustic code:

```glsl
#if QUALITY_LEVEL >= 1
  // Caustic UV offset ...
  float c1 = voronoiCaustic(cwp * 0.6, causticTime);
  // ... existing caustic code
  outgoingLight += vec3(0.55, 0.85, 0.75) * caustic * 0.35;
#endif

#if QUALITY_LEVEL >= 2
  // Wet sand sparkle ...
  // ... existing sparkle code
  outgoingLight += vec3(0.5, 0.7, 0.6) * sparkle * sparkleMask * 0.4;
#endif
```

And use the reduced-octave FBM based on quality:

```glsl
#if QUALITY_LEVEL >= 2
  float rockMask = smoothstep(0.42, 0.58, seaFbm(wp * 0.08 + 3.7));
  float algaeMask = smoothstep(0.48, 0.62, seaFbm(wp * 0.18 + 11.3));
  float trailNoise = seaFbm(wp * 0.35 + 7.1);
#elif QUALITY_LEVEL >= 1
  float rockMask = smoothstep(0.42, 0.58, seaFbm3(wp * 0.08 + 3.7));
  float algaeMask = smoothstep(0.48, 0.62, seaFbm3(wp * 0.18 + 11.3));
  float trailNoise = seaFbm3(wp * 0.35 + 7.1);
#else
  float rockMask = smoothstep(0.42, 0.58, seaNoise2(wp * 0.08 + 3.7));
  float algaeMask = 0.0;
  float trailNoise = seaNoise2(wp * 0.35 + 7.1);
#endif
```

- [ ] **Step 5: Update the caller in OceanScene.svelte**

```svelte
<ProceduralSeabed
  color={activeConfig.ground.color}
  rippleColor={seabedRippleColor}
  size={activeConfig.ground.size}
  stageRadius={zones.stageRadius}
  clearingRadius={zones.clearingRadius}
  {moundSources}
  qualityLevel={detectedTier === 'ultra' ? 2 : detectedTier === 'medium' ? 1 : 0}
  segments={qualityConfig.seabedSegments}
/>
```

- [ ] **Step 6: Verify and commit**

Run: `pnpm check`

```bash
git add src/lib/shared/3d/environments/scenes/ocean/ProceduralSeabed.svelte src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "perf(ocean): add shader quality tiers to seabed (5/3/2 FBM octaves)"
```

---

### Task 19: Parameterize WaterSurface segments

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/WaterSurface.svelte`

- [ ] **Step 1: Accept segments as a prop**

Add to the interface:

```typescript
interface Props {
  config: OceanWaterSurfaceConfig;
  size?: number;
  segments?: number;
}

let { config, size = 50, segments = 64 }: Props = $props();
```

- [ ] **Step 2: Use the prop in the template**

Replace:

```svelte
<T.PlaneGeometry args={[size, size, 64, 64]} />
```

With:

```svelte
<T.PlaneGeometry args={[size, size, segments, segments]} />
```

- [ ] **Step 3: Update the caller**

In `OceanScene.svelte`:

```svelte
<WaterSurface
  config={activeConfig.waterSurface}
  size={activeConfig.ground.size}
  segments={qualityConfig.waterSurfaceSegments}
/>
```

- [ ] **Step 4: Verify and commit**

```bash
git add src/lib/shared/3d/environments/scenes/ocean/WaterSurface.svelte src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "perf(ocean): parameterize water surface segment count by quality tier"
```

---

### Task 20: Add quality dropdown to OceanControls

**Files:**
- Modify: `src/lib/features/lab/tabs/scene-lab/components/OceanControls.svelte`

- [ ] **Step 1: Add a quality tier panel**

First, check what select/dropdown primitives exist. The component uses `ParamSlider` and `ParamColor`. For a dropdown, check if `ParamSelect` exists:

```bash
grep -r "ParamSelect" src/lib/features/lab/
```

If `ParamSelect` doesn't exist, add a simple native select within a `ParamPanel`. Add at the top of the template:

```svelte
<ParamPanel title="Performance">
  <label class="param-row">
    <span class="param-label">Quality</span>
    <select class="param-select" value={cfg.qualityTier ?? 'auto'} onchange={(e) => (mut().qualityTier = e.currentTarget.value)}>
      <option value="auto">Auto</option>
      <option value="ultra">Ultra</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
    </select>
  </label>
</ParamPanel>
```

This requires adding `qualityTier` to the `OceanSceneConfig` type — add it as an optional field:

```typescript
qualityTier?: 'auto' | 'ultra' | 'medium' | 'low';
```

Then wire `OceanScene.svelte` to read it:

```typescript
let qualityOverride = $derived<OceanQualityTier | 'auto'>(activeConfig.qualityTier ?? 'auto');
```

- [ ] **Step 2: Verify and commit**

```bash
git add src/lib/features/lab/tabs/scene-lab/components/OceanControls.svelte src/lib/shared/3d/environments/domain/models/scene-configs.ts src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "feat(ocean): add quality tier dropdown in Scene Lab"
```

---

## Phase 5: Post-Processing + Memory Cleanup

### Task 21: Add resolutionScale and conditional effects to ScenePostProcessing

**Files:**
- Modify: `src/lib/shared/3d/effects/post-processing/ScenePostProcessing.svelte`

- [ ] **Step 1: Accept quality config as a prop**

```typescript
interface Props {
  children: Snippet;
  bloomResolutionScale?: number;
  bloomLevels?: number;
  enableBloom?: boolean;
  enableChromaticAberration?: boolean;
}

let {
  children,
  bloomResolutionScale = 1.0,
  bloomLevels = 8,
  enableBloom = true,
  enableChromaticAberration = true,
}: Props = $props();
```

- [ ] **Step 2: Use the props in buildComposer**

Update the `buildComposer` function to conditionally add effects:

```typescript
function buildComposer() {
  disposeComposer();

  const cam = camera.current;
  const scn = (scene as any).current ?? scene;
  if (!cam || !scn) return;

  composer = new EffectComposer(renderer, {
    frameBufferType: HalfFloatType,
  });

  composer.addPass(new RenderPass(scn, cam));

  const effects: import("postprocessing").Effect[] = [];

  if (enableBloom) {
    effects.push(
      new BloomEffect({
        intensity: 1.5,
        luminanceThreshold: 0.4,
        luminanceSmoothing: 0.3,
        mipmapBlur: true,
        radius: 0.7,
        levels: bloomLevels,
        resolutionScale: bloomResolutionScale,
      }),
    );
  }

  if (enableChromaticAberration) {
    effects.push(
      new ChromaticAberrationEffect({
        offset: new Vector2(0.0006, 0.0006),
        radialModulation: true,
        modulationOffset: 0.2,
      }),
    );
  }

  effects.push(
    new VignetteEffect({
      darkness: 0.5,
      offset: 0.25,
    }),
  );

  if (effects.length > 0) {
    composer.addPass(new EffectPass(cam, ...effects));
  }

  // ... rest of sizing logic unchanged
}
```

- [ ] **Step 3: Update the shouldCompose gate**

Extend to also check if bloom is disabled:

```typescript
const shouldCompose = $derived(isOcean && !viewer3DState.isExporting && enableBloom);
```

Actually, keep `shouldCompose` as is (it should compose for vignette even without bloom), but for low tier where `enableBloom` is false and `enableChromaticAberration` is false, only vignette remains. That's fine — vignette alone is very cheap.

For Low tier where ALL post-processing is disabled, the caller should not render ScenePostProcessing at all. Leave the `shouldCompose` logic unchanged and let the caller handle it.

- [ ] **Step 4: Verify and commit**

Run: `pnpm check`

```bash
git add src/lib/shared/3d/effects/post-processing/ScenePostProcessing.svelte
git commit -m "perf(ocean): add configurable bloom resolution + conditional post-processing"
```

---

### Task 22: Harden dispose-scene.ts with texture disposal

**Files:**
- Modify: `src/lib/shared/3d/environments/utils/dispose-scene.ts`

- [ ] **Step 1: Add texture disposal to the traversal**

Replace the entire file:

```typescript
import type { Object3D, Material, BufferGeometry, Texture } from "three";

interface DisposableMesh {
  geometry?: BufferGeometry;
  material?: Material | Material[];
}

function disposeMaterialTextures(mat: Material): void {
  const m = mat as Record<string, unknown>;
  const textureKeys = ['map', 'normalMap', 'roughnessMap', 'aoMap', 'emissiveMap', 'metalnessMap', 'envMap', 'lightMap', 'bumpMap', 'displacementMap', 'alphaMap'];
  for (const key of textureKeys) {
    const tex = m[key] as Texture | undefined;
    if (tex && typeof tex.dispose === 'function') {
      tex.dispose();
    }
  }
}

export function disposeSceneGraph(root: Object3D): void {
  root.traverse((child) => {
    const mesh = child as unknown as DisposableMesh;
    mesh.geometry?.dispose();
    if (mesh.material) {
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const m of mats) {
        disposeMaterialTextures(m);
        m.dispose();
      }
    }
  });
}
```

- [ ] **Step 2: Verify and commit**

Run: `pnpm check`

```bash
git add src/lib/shared/3d/environments/utils/dispose-scene.ts
git commit -m "fix(ocean): dispose material textures in scene graph cleanup"
```

---

### Task 23: Add texture disposal to ProceduralSeabed

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/ocean/ProceduralSeabed.svelte`

- [ ] **Step 1: Add onDestroy for texture + material + geometry disposal**

Add at the bottom of the script block:

```typescript
import { onDestroy } from "svelte";

onDestroy(() => {
  sandDiffuse.dispose();
  sandNormal.dispose();
  sandRoughness.dispose();
  sandAo.dispose();
  material.dispose();
  geometry.dispose();
});
```

- [ ] **Step 2: Verify and commit**

Run: `pnpm check`

```bash
git add src/lib/shared/3d/environments/scenes/ocean/ProceduralSeabed.svelte
git commit -m "fix(ocean): dispose sand textures and material on seabed teardown"
```

---

### Task 24: Add dev-mode renderer diagnostics

**Files:**
- Modify: `src/lib/shared/3d/environments/scenes/OceanScene.svelte`

- [ ] **Step 1: Add renderer info diagnostic to onMount**

In the `onMount` callback, after the existing `__oceanDiag` setup, add:

```typescript
(window as any).__oceanPerf = () => {
  const info = renderer.info;
  console.log(`Draw calls: ${info.render.calls}`);
  console.log(`Triangles: ${info.render.triangles}`);
  console.log(`Textures: ${info.memory.textures}`);
  console.log(`Geometries: ${info.memory.geometries}`);
  console.log(`Quality tier: ${detectedTier}`);
  return {
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    textures: info.memory.textures,
    geometries: info.memory.geometries,
    tier: detectedTier,
  };
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/OceanScene.svelte
git commit -m "feat(ocean): add window.__oceanPerf() dev diagnostic"
```

---

### Task 25: Final verification

- [ ] **Step 1: Run typecheck**

```bash
pnpm check
```

Expected: No errors.

- [ ] **Step 2: Run build**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Measure draw calls**

Start dev server, open ocean scene, open browser console:

```javascript
window.__oceanPerf()
```

Expected on Ultra tier: draw calls ~40-50 (down from 400+).

- [ ] **Step 4: Verify loading screen**

Hard refresh the page. Expected: blue gradient loading screen with progress bar appears, then scene reveals all at once when loaded.

- [ ] **Step 5: Verify visual quality on Ultra**

Confirm: coral has per-instance color variation, seabed has caustics and sparkle, god rays animate, bloom is visible, water surface shimmers. No visual regression from pre-optimization state.

- [ ] **Step 6: Test quality override**

Open Scene Lab → Performance panel → switch to Low. Expected: scene simplifies (fewer objects, no caustics, no bloom, lower pixel ratio). Switch back to Ultra — full quality restores.
