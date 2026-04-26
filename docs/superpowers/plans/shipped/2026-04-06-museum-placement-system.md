# Museum Object Placement System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sims-like object placement in the museum editor — pick from a panel, see a ghost preview that snaps to walls, click to place, persist to source code.

**Architecture:** New placement data flows through existing rendering pipeline. A `PlaceableObjectDef` registry catalogs objects with surface rules. The editor gets a placement sub-mode with ghost preview + raycasting. Placements persist to a `.ts` data file that the geometry builder reads at build time. Phase A = wall fixtures only.

**Tech Stack:** Svelte 5, Three.js (Raycaster, BatchedMesh, Quaternion), Threlte, TypeScript, Vite HMR

**Spec:** `docs/superpowers/specs/2026-04-06-museum-placement-system-design.md`

---

### Task 1: PlaceableObjectDef Registry

**Files:**
- Create: `src/lib/features/museum/domain/placeable-object-registry.ts`

- [ ] **Step 1: Create the PlaceableObjectDef interface and registry**

```ts
// src/lib/features/museum/domain/placeable-object-registry.ts
import type { WingTheme } from './museum-grid-types';
import { FIXTURE_REGISTRY } from './fixture-registry';

export type PlacementSurface = 'wall' | 'floor' | 'floor_against_wall';

export interface PlaceableObjectDef {
  id: string;
  label: string;
  category: 'fixture' | 'furniture';
  surface: PlacementSurface;
  modelPath: string;
  mountHeight: number;
  wallOffset: number;
  scale: number;
  wingTheme?: WingTheme;
  hasFlame?: boolean;
  hasEmbers?: boolean;
  lightColor?: string;
  lightIntensity?: number;
}

/** Build the fixture catalog from FIXTURE_REGISTRY. One entry per wing theme. */
function buildFixtureDefs(): PlaceableObjectDef[] {
  const entries = Object.entries(FIXTURE_REGISTRY) as [WingTheme, typeof FIXTURE_REGISTRY[WingTheme]][];
  return entries.map(([theme, config]) => ({
    id: `${theme}-fixture`,
    label: `${config.label} (${config.era})`,
    category: 'fixture' as const,
    surface: 'wall' as const,
    modelPath: config.modelPath,
    mountHeight: 1.25,
    wallOffset: 0.175,
    scale: config.scale,
    wingTheme: theme,
    hasFlame: config.hasFlame,
    hasEmbers: config.hasEmbers,
    lightColor: config.lightColor,
    lightIntensity: config.lightIntensity,
  }));
}

export const PLACEABLE_OBJECTS: PlaceableObjectDef[] = [
  ...buildFixtureDefs(),
  // Phase B: furniture defs will be added here
];

/** Lookup by id */
export function getPlaceableObject(id: string): PlaceableObjectDef | undefined {
  return PLACEABLE_OBJECTS.find(o => o.id === id);
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsc --noEmit 2>&1 | grep placeable-object-registry`
Expected: No errors from this file

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/museum/domain/placeable-object-registry.ts
git commit -m "feat(museum): add PlaceableObjectDef registry for placement system"
```

---

### Task 2: Manual Placements Data File

**Files:**
- Create: `src/lib/features/museum/data/museum-manual-placements.ts`

- [ ] **Step 1: Create the ManualPlacement interface and data structure**

```ts
// src/lib/features/museum/data/museum-manual-placements.ts
import type { Direction } from '../domain/museum-grid-types';

export interface ManualPlacement {
  id: string;
  objectDefId: string;
  tileX: number;
  tileY: number;
  wallFacing: Direction | null;
  yaw: number;
}

/**
 * Manual placements keyed by room ID. Written by the editor save action.
 * The geometry builder reads this at build time to merge with auto-placed objects.
 */
export const MANUAL_PLACEMENTS: Record<string, ManualPlacement[]> = {
  // Populated by editor — do not edit manually
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep museum-manual-placements`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/museum/data/museum-manual-placements.ts
git commit -m "feat(museum): add manual placements data file for editor persistence"
```

---

### Task 3: Extend Editor State With Placement Mode

**Files:**
- Modify: `src/lib/features/museum/state/museum-3d-editor-state.svelte.ts`

- [ ] **Step 1: Add placement mode state**

At the top of the file, add the import:

```ts
import type { PlaceableObjectDef } from '../domain/placeable-object-registry';
```

After the existing `$state` declarations (around line 24), add:

```ts
let placementDef: PlaceableObjectDef | null = $state(null);
let ghostValid = $state(false);
```

- [ ] **Step 2: Add placement mode methods to the exported object**

Inside the `museum3dEditorState` exported object (around line 75), add these getters and methods alongside the existing ones:

```ts
  get placementDef() { return placementDef; },
  get ghostValid() { return ghostValid; },

  startPlacement(def: PlaceableObjectDef) {
    placementDef = def;
    ghostValid = false;
    // Deselect any gizmo-selected object when entering placement mode
    selectedObject = null;
  },

  stopPlacement() {
    placementDef = null;
    ghostValid = false;
  },

  setGhostValid(valid: boolean) {
    ghostValid = valid;
  },
```

- [ ] **Step 3: Update toggle() to clear placement mode**

In the existing `toggle()` method, add `placementDef = null;` inside the deactivation branch:

```ts
  toggle() {
    editorActive = !editorActive;
    if (!editorActive) {
      selectedObject = null;
      gizmoMode = "translate";
      placementDef = null;
      ghostValid = false;
    }
  },
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep museum-3d-editor-state`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/museum/state/museum-3d-editor-state.svelte.ts
git commit -m "feat(museum): add placement mode to editor state"
```

---

### Task 4: Placement Ghost Component

**Files:**
- Create: `src/lib/features/museum/components/editor/PlacementGhost.svelte`

This is the core of the placement system — the translucent preview that follows the cursor, raycasts against walls, snaps to position, and shows valid/invalid state.

- [ ] **Step 1: Create the ghost component**

```svelte
<!-- src/lib/features/museum/components/editor/PlacementGhost.svelte -->
<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import {
    Raycaster, Vector2, Vector3, Quaternion, MeshStandardMaterial,
    BoxGeometry, type Object3D, type Intersection
  } from 'three';
  import type { PlaceableObjectDef } from '../../domain/placeable-object-registry';
  import { museum3dEditorState } from '../../state/museum-3d-editor-state.svelte';

  const TILE_SIZE = 0.5;
  const WORLD_FORWARD = new Vector3(0, 0, 1);
  const WORLD_UP = new Vector3(0, 1, 0);

  interface Props {
    def: PlaceableObjectDef;
    onPlace: (worldX: number, worldZ: number, yaw: number, wallFacing: string | null) => void;
  }

  const { def, onPlace }: Props = $props();
  const { scene, camera, renderer } = useThrelte();

  // Ghost mesh state
  let ghostPosition = $state(new Vector3());
  let ghostQuaternion = $state(new Quaternion());
  let ghostVisible = $state(false);
  let isValid = $state(false);

  // Reusable objects (avoid per-frame allocation)
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const tempNormal = new Vector3();

  // Ghost material — green when valid, red when invalid
  const ghostMaterial = new MeshStandardMaterial({
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    color: 0x22dd77,
  });

  // Placeholder geometry until we load the actual model
  const ghostGeo = new BoxGeometry(0.15, 0.3, 0.1);

  /** Classify a world-space face normal as 'wall' or 'floor' */
  function classifySurface(normal: Vector3): 'wall' | 'floor' | 'other' {
    const dot = Math.abs(normal.dot(WORLD_UP));
    if (dot > 0.7) return 'floor';
    if (dot < 0.3) return 'wall';
    return 'other';
  }

  /** Convert a wall normal to a cardinal Direction string */
  function normalToFacing(normal: Vector3): string | null {
    const ax = Math.abs(normal.x);
    const az = Math.abs(normal.z);
    if (ax > az) {
      return normal.x > 0 ? 'east' : 'west';
    } else {
      return normal.z > 0 ? 'south' : 'north';
    }
  }

  /** Find the best wall or floor hit under the cursor */
  function findSurfaceHit(event: PointerEvent): { point: Vector3; normal: Vector3; surfaceType: 'wall' | 'floor' } | null {
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera.current!);
    const hits = raycaster.intersectObjects(scene.children, true);

    for (const hit of hits) {
      if (!hit.face) continue;
      // Skip the ghost mesh itself
      if (isGhostDescendant(hit.object)) continue;
      // Skip gizmo meshes
      if (isGizmoMesh(hit.object)) continue;

      const worldNormal = tempNormal.copy(hit.face.normal)
        .transformDirection(hit.object.matrixWorld)
        .normalize();

      const surfaceType = classifySurface(worldNormal);
      if (surfaceType === 'other') continue;

      return { point: hit.point.clone(), normal: worldNormal.clone(), surfaceType };
    }
    return null;
  }

  function isGhostDescendant(obj: Object3D): boolean {
    let current: Object3D | null = obj;
    while (current) {
      if ((current as any).__isPlacementGhost) return true;
      current = current.parent;
    }
    return false;
  }

  function isGizmoMesh(obj: Object3D): boolean {
    let current: Object3D | null = obj;
    while (current) {
      if ((current as any).isTransformControls) return true;
      if (current.type === 'TransformControlsGizmo' || current.type === 'TransformControlsPlane') return true;
      current = current.parent;
    }
    return false;
  }

  /** Update ghost position/orientation from a pointer event */
  function updateGhost(event: PointerEvent): void {
    const hit = findSurfaceHit(event);
    if (!hit) {
      ghostVisible = false;
      isValid = false;
      museum3dEditorState.setGhostValid(false);
      return;
    }

    ghostVisible = true;

    // Check if the surface matches the object's placement rule
    const surfaceMatch = (def.surface === 'wall' && hit.surfaceType === 'wall')
      || (def.surface === 'floor' && hit.surfaceType === 'floor')
      || (def.surface === 'floor_against_wall' && hit.surfaceType === 'floor');

    isValid = surfaceMatch;
    museum3dEditorState.setGhostValid(surfaceMatch);
    ghostMaterial.color.setHex(isValid ? 0x22dd77 : 0xdd3344);
    ghostMaterial.needsUpdate = true;

    if (hit.surfaceType === 'wall') {
      // Snap tangent axes to tile grid
      const snappedX = Math.round(hit.point.x / TILE_SIZE) * TILE_SIZE;
      const snappedZ = Math.round(hit.point.z / TILE_SIZE) * TILE_SIZE;
      const y = def.mountHeight;

      // Offset from wall by wallOffset along the normal
      ghostPosition = new Vector3(
        snappedX + hit.normal.x * def.wallOffset,
        y,
        snappedZ + hit.normal.z * def.wallOffset,
      );

      // Orient to face away from wall
      if (hit.normal.dot(WORLD_FORWARD) < -0.999) {
        ghostQuaternion = new Quaternion().setFromAxisAngle(WORLD_UP, Math.PI);
      } else {
        ghostQuaternion = new Quaternion().setFromUnitVectors(WORLD_FORWARD, hit.normal);
      }
    } else {
      // Floor placement — snap to tile grid center
      ghostPosition = new Vector3(
        Math.round(hit.point.x / TILE_SIZE) * TILE_SIZE,
        0,
        Math.round(hit.point.z / TILE_SIZE) * TILE_SIZE,
      );
      ghostQuaternion = new Quaternion();
    }
  }

  /** Handle click to confirm placement */
  function handleClick(event: PointerEvent): void {
    if (event.button !== 0) return;
    if (!ghostVisible || !isValid) return;

    // Extract yaw from quaternion
    const euler = ghostQuaternion.clone();
    const tempEuler = new Vector3();
    // Use atan2 to get Y rotation from quaternion
    const q = ghostQuaternion;
    const yaw = Math.atan2(
      2 * (q.w * q.y + q.x * q.z),
      1 - 2 * (q.y * q.y + q.z * q.z)
    );

    // Determine wall facing from the ghost's orientation
    const forward = WORLD_FORWARD.clone().applyQuaternion(ghostQuaternion);
    const wallFacing = def.surface === 'wall' ? normalToFacing(forward) : null;

    onPlace(ghostPosition.x, ghostPosition.z, yaw, wallFacing);
  }

  /** Handle ESC to exit placement mode */
  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      museum3dEditorState.stopPlacement();
    }
  }

  // Register event listeners on the canvas
  import { onMount, onDestroy } from 'svelte';

  let cleanupFns: (() => void)[] = [];

  onMount(() => {
    const canvas = renderer.domElement;
    const onMove = (e: PointerEvent) => updateGhost(e);
    const onClick = (e: PointerEvent) => handleClick(e);
    const onKey = (e: KeyboardEvent) => handleKeyDown(e);

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onClick);
    window.addEventListener('keydown', onKey);

    cleanupFns = [
      () => canvas.removeEventListener('pointermove', onMove),
      () => canvas.removeEventListener('pointerdown', onClick),
      () => window.removeEventListener('keydown', onKey),
    ];
  });

  onDestroy(() => {
    cleanupFns.forEach(fn => fn());
    ghostMaterial.dispose();
    ghostGeo.dispose();
  });
</script>

{#if ghostVisible}
  <T.Mesh
    position={[ghostPosition.x, ghostPosition.y, ghostPosition.z]}
    quaternion={[ghostQuaternion.x, ghostQuaternion.y, ghostQuaternion.z, ghostQuaternion.w]}
    material={ghostMaterial}
    geometry={ghostGeo}
    oncreate={(ref) => { (ref as any).__isPlacementGhost = true; }}
  />
{/if}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep PlacementGhost`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/museum/components/editor/PlacementGhost.svelte
git commit -m "feat(museum): add PlacementGhost component with wall snapping and raycasting"
```

---

### Task 5: Picker Panel Component

**Files:**
- Create: `src/lib/features/museum/components/editor/PlacementPickerPanel.svelte`

- [ ] **Step 1: Create the picker panel**

```svelte
<!-- src/lib/features/museum/components/editor/PlacementPickerPanel.svelte -->
<script lang="ts">
  import { PLACEABLE_OBJECTS, type PlaceableObjectDef } from '../../domain/placeable-object-registry';
  import { museum3dEditorState } from '../../state/museum-3d-editor-state.svelte';

  const fixtures = PLACEABLE_OBJECTS.filter(o => o.category === 'fixture');
  const furniture = PLACEABLE_OBJECTS.filter(o => o.category === 'furniture');

  function selectObject(def: PlaceableObjectDef): void {
    if (museum3dEditorState.placementDef?.id === def.id) {
      museum3dEditorState.stopPlacement();
    } else {
      museum3dEditorState.startPlacement(def);
    }
  }
</script>

<div class="placement-picker">
  <div class="picker-title">Place Object</div>

  {#if fixtures.length > 0}
    <div class="picker-category">Wall Fixtures</div>
    <div class="picker-grid">
      {#each fixtures as def (def.id)}
        <button
          class="picker-item"
          class:selected={museum3dEditorState.placementDef?.id === def.id}
          onclick={() => selectObject(def)}
        >
          <span class="item-icon">🔥</span>
          <span class="item-label">{def.label}</span>
        </button>
      {/each}
    </div>
  {/if}

  {#if furniture.length > 0}
    <div class="picker-category">Floor Objects</div>
    <div class="picker-grid">
      {#each furniture as def (def.id)}
        <button
          class="picker-item"
          class:selected={museum3dEditorState.placementDef?.id === def.id}
          onclick={() => selectObject(def)}
        >
          <span class="item-icon">🪑</span>
          <span class="item-label">{def.label}</span>
        </button>
      {/each}
    </div>
  {/if}

  <div class="picker-hint">
    <p>Click an object, then click a surface in the scene.</p>
    <p><kbd>ESC</kbd> cancel · <kbd>Right-click</kbd> delete</p>
  </div>
</div>

<style>
  .placement-picker {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 240px;
    background: var(--theme-panel-bg, rgba(16, 16, 28, 0.96));
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    padding: 16px;
    overflow-y: auto;
    z-index: 100;
  }

  .picker-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--theme-accent, #f0c674);
    margin-bottom: 16px;
    padding-left: 12px;
    border-left: 3px solid var(--theme-accent, #f0c674);
  }

  .picker-category {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #666;
    margin: 16px 0 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .picker-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .picker-item {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 14px 8px;
    text-align: center;
    cursor: pointer;
    transition: all 0.15s;
    color: inherit;
    font-family: inherit;
  }

  .picker-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .picker-item.selected {
    background: rgba(240, 198, 116, 0.12);
    border-color: var(--theme-accent, #f0c674);
    box-shadow: 0 0 12px rgba(240, 198, 116, 0.1);
  }

  .item-icon {
    display: block;
    font-size: 28px;
    margin-bottom: 6px;
  }

  .item-label {
    display: block;
    font-size: 11px;
    color: #aaa;
  }

  .picker-item.selected .item-label {
    color: var(--theme-accent, #f0c674);
  }

  .picker-hint {
    margin-top: 20px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .picker-hint p {
    font-size: 11px;
    color: #555;
    line-height: 1.5;
  }

  .picker-hint kbd {
    display: inline-block;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 10px;
    color: #aaa;
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep PlacementPickerPanel`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/museum/components/editor/PlacementPickerPanel.svelte
git commit -m "feat(museum): add PlacementPickerPanel for object selection"
```

---

### Task 6: Placement Persister

**Files:**
- Create: `src/lib/features/museum/services/contracts/IPlacementPersister.ts`
- Create: `src/lib/features/museum/services/implementations/PlacementPersister.ts`

The persister writes to `museum-manual-placements.ts` by calling a Vite dev server endpoint. In dev mode, Vite plugins can expose custom middleware that writes files.

- [ ] **Step 1: Create the persister interface**

```ts
// src/lib/features/museum/services/contracts/IPlacementPersister.ts
import type { ManualPlacement } from '../../data/museum-manual-placements';

export interface IPlacementPersister {
  save(roomId: string, placement: ManualPlacement): Promise<void>;
  remove(roomId: string, placementId: string): Promise<void>;
  getAll(roomId: string): ManualPlacement[];
}
```

- [ ] **Step 2: Create the persister implementation**

```ts
// src/lib/features/museum/services/implementations/PlacementPersister.ts
import type { IPlacementPersister } from '../contracts/IPlacementPersister';
import type { ManualPlacement } from '../../data/museum-manual-placements';
import { MANUAL_PLACEMENTS } from '../../data/museum-manual-placements';

/**
 * Persists manual placements to the source .ts file via the Vite dev server.
 * In production builds, placements are baked in at compile time — this persister
 * is only used during development.
 */
export class PlacementPersister implements IPlacementPersister {
  async save(roomId: string, placement: ManualPlacement): Promise<void> {
    if (!MANUAL_PLACEMENTS[roomId]) {
      MANUAL_PLACEMENTS[roomId] = [];
    }
    MANUAL_PLACEMENTS[roomId].push(placement);
    await this.writeToFile();
  }

  async remove(roomId: string, placementId: string): Promise<void> {
    const arr = MANUAL_PLACEMENTS[roomId];
    if (!arr) return;
    const idx = arr.findIndex(p => p.id === placementId);
    if (idx >= 0) {
      arr.splice(idx, 1);
      if (arr.length === 0) delete MANUAL_PLACEMENTS[roomId];
      await this.writeToFile();
    }
  }

  getAll(roomId: string): ManualPlacement[] {
    return MANUAL_PLACEMENTS[roomId] ?? [];
  }

  private async writeToFile(): Promise<void> {
    const body = this.serializePlacements();
    try {
      await fetch('/__museum-placements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: body }),
      });
    } catch (err) {
      console.error('[PlacementPersister] Failed to write placements file:', err);
    }
  }

  private serializePlacements(): string {
    const lines: string[] = [
      `import type { Direction } from '../domain/museum-grid-types';`,
      ``,
      `export interface ManualPlacement {`,
      `  id: string;`,
      `  objectDefId: string;`,
      `  tileX: number;`,
      `  tileY: number;`,
      `  wallFacing: Direction | null;`,
      `  yaw: number;`,
      `}`,
      ``,
      `export const MANUAL_PLACEMENTS: Record<string, ManualPlacement[]> = {`,
    ];

    for (const [roomId, placements] of Object.entries(MANUAL_PLACEMENTS)) {
      lines.push(`  "${roomId}": [`);
      for (const p of placements) {
        const facing = p.wallFacing ? `"${p.wallFacing}"` : 'null';
        lines.push(`    { id: "${p.id}", objectDefId: "${p.objectDefId}", tileX: ${p.tileX}, tileY: ${p.tileY}, wallFacing: ${facing}, yaw: ${p.yaw.toFixed(4)} },`);
      }
      lines.push(`  ],`);
    }

    lines.push(`};`);
    lines.push(``);
    return lines.join('\n');
  }
}
```

- [ ] **Step 3: Verify both files compile**

Run: `npx tsc --noEmit 2>&1 | grep -i placement`
Expected: No errors from these files

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/museum/services/contracts/IPlacementPersister.ts
git add src/lib/features/museum/services/implementations/PlacementPersister.ts
git commit -m "feat(museum): add PlacementPersister for writing placements to source file"
```

---

### Task 7: Vite Plugin for File Persistence

**Files:**
- Create: `src/lib/features/museum/dev/museum-placement-plugin.ts`
- Modify: `vite.config.ts`

The Vite plugin exposes a `/__museum-placements` POST endpoint that writes the placements file to disk. Dev-only — never runs in production.

- [ ] **Step 1: Create the Vite plugin**

```ts
// src/lib/features/museum/dev/museum-placement-plugin.ts
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { Plugin } from 'vite';

const PLACEMENTS_PATH = 'src/lib/features/museum/data/museum-manual-placements.ts';

export function museumPlacementPlugin(): Plugin {
  return {
    name: 'museum-placement-writer',
    configureServer(server) {
      server.middlewares.use('/__museum-placements', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const { content } = JSON.parse(body);
            const fullPath = resolve(process.cwd(), PLACEMENTS_PATH);
            writeFileSync(fullPath, content, 'utf-8');
            res.statusCode = 200;
            res.end('OK');
          } catch (err) {
            console.error('[museum-placement-plugin] Write failed:', err);
            res.statusCode = 500;
            res.end('Write failed');
          }
        });
      });
    },
  };
}
```

- [ ] **Step 2: Register the plugin in vite.config.ts**

Read the existing `vite.config.ts` to find where plugins are registered. Add the import and plugin call:

At the top of the file, add:
```ts
import { museumPlacementPlugin } from './src/lib/features/museum/dev/museum-placement-plugin';
```

In the `plugins` array, add:
```ts
museumPlacementPlugin(),
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep museum-placement-plugin`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/museum/dev/museum-placement-plugin.ts
git add vite.config.ts
git commit -m "feat(museum): add Vite plugin for placement file persistence"
```

---

### Task 8: Wire Picker + Ghost Into Museum3DScene

**Files:**
- Modify: `src/lib/features/museum/components/game/Museum3DScene.svelte`
- Modify: `src/lib/features/museum/components/game/MuseumSceneEditor.svelte`

- [ ] **Step 1: Import new components in Museum3DScene.svelte**

Near the top imports (around line 32), add:

```ts
import PlacementPickerPanel from '../editor/PlacementPickerPanel.svelte';
import PlacementGhost from '../editor/PlacementGhost.svelte';
import { PlacementPersister } from '../../services/implementations/PlacementPersister';
import type { PlaceableObjectDef } from '../../domain/placeable-object-registry';
```

In the script section (near other singleton declarations), add:

```ts
const placementPersister = new PlacementPersister();
```

Add a placement handler function:

```ts
function handlePlace(worldX: number, worldZ: number, yaw: number, wallFacing: string | null): void {
  const def = museum3dEditorState.placementDef;
  if (!def) return;

  // Determine which room the placement is in
  const tileX = Math.round(worldX / TILE_SIZE);
  const tileY = Math.round(worldZ / TILE_SIZE);
  const wing = grid.wings.find(w => {
    const b = w.bounds;
    return tileX >= b.x && tileX < b.x + b.width && tileY >= b.y && tileY < b.y + b.height;
  });
  const roomId = wing?.id ?? 'unknown';

  const placement = {
    id: `${roomId}-${def.id}-${Date.now()}`,
    objectDefId: def.id,
    tileX,
    tileY,
    wallFacing: wallFacing as any,
    yaw,
  };

  placementPersister.save(roomId, placement);
}
```

- [ ] **Step 2: Mount the picker panel in the template**

Find the editor badge conditional (around line 1694 where `MuseumSceneEditor` mounts). Just before `<MuseumSceneEditor>`, add the picker panel:

```svelte
{#if museum3dEditorState.editorActive}
  <PlacementPickerPanel />
  {#if museum3dEditorState.placementDef}
    <PlacementGhost def={museum3dEditorState.placementDef} onPlace={handlePlace} />
  {/if}
  <MuseumSceneEditor onOverrideChanged={applyEditorOverrides} />
{/if}
```

Note: `PlacementPickerPanel` is an HTML overlay (position: fixed), not a Three.js component, so it renders as a Svelte component outside the `<T.>` tree. `PlacementGhost` is a Three.js component that lives in the scene graph.

- [ ] **Step 3: Guard MuseumSceneEditor clicks during placement mode**

In `MuseumSceneEditor.svelte`, modify `handlePointerDown` (around line 174) to bail out when placement mode is active:

```ts
function handlePointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  if (gizmoDragging) return;
  // Don't interfere with placement mode — PlacementGhost handles clicks
  if (museum3dEditorState.placementDef) return;
  // ... existing code
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/museum/components/game/Museum3DScene.svelte
git add src/lib/features/museum/components/game/MuseumSceneEditor.svelte
git commit -m "feat(museum): wire picker panel and placement ghost into editor"
```

---

### Task 9: Geometry Builder Reads Manual Placements

**Files:**
- Modify: `src/lib/features/museum/services/implementations/MuseumGeometryBuilder.ts`

The geometry builder needs to read `MANUAL_PLACEMENTS` and append them to the torch positions generated during bucketing.

- [ ] **Step 1: Import manual placements at the top of the file**

```ts
import { MANUAL_PLACEMENTS } from '../../data/museum-manual-placements';
import { getPlaceableObject } from '../../domain/placeable-object-registry';
```

- [ ] **Step 2: Add manual placements to buildRoomChunk**

After the existing torch bucketing (around line 660, before the `return` statement), add:

```ts
  // Append manual placements for this room
  if (wingId) {
    const manualPlacements = MANUAL_PLACEMENTS[wingId] ?? [];
    for (const mp of manualPlacements) {
      const objDef = getPlaceableObject(mp.objectDefId);
      if (!objDef || objDef.category !== 'fixture') continue;

      const worldX = mp.tileX * TILE_SIZE;
      const worldZ = mp.tileY * TILE_SIZE;

      // Compute wall offset from facing direction
      let wallOffsetX = 0;
      let wallOffsetZ = 0;
      if (mp.wallFacing === 'north') wallOffsetZ = -TILE_SIZE * 0.35;
      else if (mp.wallFacing === 'south') wallOffsetZ = TILE_SIZE * 0.35;
      else if (mp.wallFacing === 'west') wallOffsetX = -TILE_SIZE * 0.35;
      else if (mp.wallFacing === 'east') wallOffsetX = TILE_SIZE * 0.35;

      torchPositions.push({
        id: nextTorchId++,
        tileX: mp.tileX,
        tileY: mp.tileY,
        x: worldX,
        z: worldZ,
        wallOffsetX,
        wallOffsetZ,
        wingTheme: objDef.wingTheme ?? 'cave',
      });
    }
  }
```

Note: `torchPositions` is the existing array from `bucketMuseumTiles()`. `nextTorchId` is the existing counter. The `wingId` is passed into `buildRoomChunk` — it matches the room graph `id` field which keys `MANUAL_PLACEMENTS`.

- [ ] **Step 3: Verify it compiles**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/museum/services/implementations/MuseumGeometryBuilder.ts
git commit -m "feat(museum): geometry builder reads manual placements for torch rendering"
```

---

### Task 10: Update Editor Badge With Placement Status

**Files:**
- Modify: `src/lib/features/museum/components/game/DimensionFlipProof.svelte`

- [ ] **Step 1: Add placement status to the editor badge**

Find the editor badge (around line 453). Replace the static text with a dynamic version:

```svelte
{#if museum3dEditorState.editorActive}
  <div class="editor-badge">
    {#if museum3dEditorState.placementDef}
      PLACING: {museum3dEditorState.placementDef.label} — Click wall to place · ESC cancel · Right-click delete
    {:else}
      EDITOR — Orbit: drag, Pan: right-drag/WASD, Zoom: scroll, Select: click, Focus: dbl-click, 1/2/3: modes, Ctrl+Z: undo, F2: exit
    {/if}
  </div>
{/if}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/museum/components/game/DimensionFlipProof.svelte
git commit -m "feat(museum): show placement status in editor badge"
```

---

### Task 11: Integration Test — Full Placement Flow

**Files:**
- No new test files (this is a manual integration test via the running app)

- [ ] **Step 1: Start the dev server on port 5174**

Run: `npx vite --port 5174`
Expected: Server starts, no errors

- [ ] **Step 2: Navigate to museum, enter edit mode**

1. Open `http://localhost:5174` (or use the user's running server on 5173)
2. Navigate to the museum
3. Walk to the Room of Collaboration
4. Press F2 to enter edit mode
5. Verify: Picker panel appears on the left side
6. Verify: Editor badge shows the standard controls text

- [ ] **Step 3: Test placement flow**

1. Click "Wall Torch (Cave)" in the picker panel
2. Verify: Badge changes to "PLACING: Wall Torch (Cave) — Click wall to place · ESC cancel · Right-click delete"
3. Move cursor over a wall surface
4. Verify: Green ghost box appears, oriented flush against the wall
5. Move cursor over the floor
6. Verify: Ghost turns red (wall torch can't go on floor)
7. Move cursor back to a wall, click to place
8. Verify: `museum-manual-placements.ts` file is updated with a new entry
9. Verify: On next HMR reload, the torch appears as a real MuseumTorch3D

- [ ] **Step 4: Test ESC cancellation**

1. Click a fixture in the picker
2. Press ESC
3. Verify: Ghost disappears, badge returns to standard text, picker item deselected

- [ ] **Step 5: Commit all remaining changes**

```bash
git add -A
git commit -m "feat(museum): complete Sims-like object placement system (Phase A — wall fixtures)"
```

---

## Task Dependency Graph

```
Task 1 (Registry) ──────┐
Task 2 (Data File) ─────┤
Task 3 (Editor State) ──┼── Task 4 (Ghost) ──┐
                         │                     ├── Task 8 (Wire) ── Task 10 (Badge) ── Task 11 (Test)
                         ├── Task 5 (Picker) ──┘
                         ├── Task 6 (Persister) ── Task 7 (Vite Plugin) ──┘
                         └── Task 9 (Geometry Builder)
```

Tasks 1, 2, 3 can be done in parallel. Tasks 4, 5, 6 depend on earlier tasks but are independent of each other. Task 7 depends on 6. Task 8 wires everything together. Tasks 9, 10 are independent. Task 11 is the integration test.
