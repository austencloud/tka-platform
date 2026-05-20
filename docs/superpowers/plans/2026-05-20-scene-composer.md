# Scene Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plugin architecture for universal 3D object placement — extract museum editor into shared system, then wire into Scene Lab as "Compose" mode.

**Architecture:** Scene plugins register via singleton registry. Each plugin declares a catalog (what objects), surface rules (where they land), constraints (limits), and defaults (seed layout). A generic editor shell (extracted from MuseumSceneEditor) consumes any plugin. Persistence writes `.ts` files via Vite dev endpoint. Museum editor becomes a thin wrapper.

**Tech Stack:** Svelte 5, Threlte 8, Three.js, camera-controls, Vite plugin API

**Spec:** `docs/superpowers/specs/2026-05-20-scene-composer-design.md`

---

## File Structure

```
NEW FILES:
  src/lib/shared/3d/scene-composer/
  ├── types.ts                           — Plugin contract + catalog + surface rules + constraints
  ├── registry.ts                        — SceneComposerRegistry singleton
  ├── command-stack.svelte.ts            — Generic undo/redo with Svelte 5 $state
  ├── composer-editor-state.svelte.ts    — Reactive editor state (mode, selection, gizmo, placements)
  ├── GenericSceneEditor.svelte          — Universal editor (raycasting, gizmo, WASD, keyboard)
  ├── ComposerGhost.svelte              — Placement preview (surface snap, valid/invalid feedback)
  ├── ComposerPickerPanel.svelte        — Object catalog sidebar
  ├── ComposedObject.svelte             — Renders a PlacedObject with fallback geometry
  └── persistence/
      ├── types.ts                       — PlacementPersistence interface
      ├── file-persistence.ts            — Dev-tool .ts file writer
      └── composer-placement-plugin.ts   — Vite dev endpoint (/__composer-placements)

  src/lib/shared/3d/environments/scenes/autumn/
  └── autumn-composer-plugin.ts          — Autumn scene plugin registration

MODIFIED FILES:
  src/lib/shared/3d/procedural-engine/objects/PlacedObject.ts  — Widen PlacedObjectType to string
  src/lib/features/museum/components/game/MuseumSceneEditor.svelte  — Thin wrapper
  src/lib/features/museum/state/museum-3d-editor-state.svelte.ts  — Re-export from composer state
  src/lib/features/lab/tabs/scene-lab/components/ScenePreview.svelte  — Add Compose camera mode
  src/lib/features/lab/tabs/scene-lab/SceneLab.svelte  — Swap controls pane in Compose mode
  vite.config.ts  — Add composerPlacementPlugin()
```

---

### Task 1: Plugin Contract Types

**Files:**
- Create: `src/lib/shared/3d/scene-composer/types.ts`

- [ ] **Step 1: Create the types file with all interfaces**

```typescript
// src/lib/shared/3d/scene-composer/types.ts

import type { Vector3, Quaternion, Mesh } from "three";
import type { ObjectDefinition } from "../procedural-engine/objects/object-catalog";

export interface SceneComposerPlugin {
  sceneId: string;
  displayName: string;
  catalog: ComposerCatalog;
  surfaceRules: SurfaceRules;
  getDefaults(): ComposerPlacement[];
  constraints?: PlacementConstraints;
}

export interface ComposerCatalog {
  categories: CatalogCategory[];
  getDefinition(key: string): ObjectDefinition | undefined;
  allItems(): ObjectDefinition[];
}

export interface CatalogCategory {
  id: string;
  label: string;
  icon: string;
  items: ObjectDefinition[];
}

export interface SurfaceRules {
  isSurface(mesh: Mesh): boolean;
  orientationMode: "upright" | "surface-normal" | "custom";
  orientFromNormal?(normal: Vector3): Quaternion;
  gridSize: number | null;
  surfaceOffset: number;
}

export interface PlacementConstraints {
  maxObjects?: number;
  maxPerType?: Record<string, number>;
  minSpacing?: number;
  exclusionZones?: ExclusionZone[];
  validate?(placement: ComposerPlacement, existing: ComposerPlacement[]): string | null;
}

export interface ExclusionZone {
  center: [number, number, number];
  radius: number;
  reason: string;
}

export interface ComposerPlacement {
  id: string;
  objectKey: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
  locked?: boolean;
  visible?: boolean;
}
```

Note: `ComposerPlacement` is a lighter model than `PlacedObject` — drops userId, createdAt, lastModified, sceneId (known from context), objectType/modelKey (combined into `objectKey` which maps to `ObjectDefinition.key`). The existing `PlacedObject` stays for Hannons Camp compatibility.

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --threshold error 2>&1 | head -5`
Expected: 0 errors (new file, no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/scene-composer/types.ts
git commit -m "feat(scene-composer): add plugin contract types"
```

---

### Task 2: Scene Composer Registry

**Files:**
- Create: `src/lib/shared/3d/scene-composer/registry.ts`
- Test: `src/lib/shared/3d/scene-composer/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/shared/3d/scene-composer/__tests__/registry.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { SceneComposerRegistry } from "../registry";
import type { SceneComposerPlugin, ComposerCatalog, SurfaceRules } from "../types";

function makeStubPlugin(sceneId: string): SceneComposerPlugin {
  const catalog: ComposerCatalog = {
    categories: [],
    getDefinition: () => undefined,
    allItems: () => [],
  };
  const surfaceRules: SurfaceRules = {
    isSurface: () => true,
    orientationMode: "upright",
    gridSize: null,
    surfaceOffset: 0.01,
  };
  return {
    sceneId,
    displayName: sceneId,
    catalog,
    surfaceRules,
    getDefaults: () => [],
  };
}

describe("SceneComposerRegistry", () => {
  let registry: SceneComposerRegistry;

  beforeEach(() => {
    registry = new SceneComposerRegistry();
  });

  it("registers and retrieves a plugin", () => {
    const plugin = makeStubPlugin("autumn");
    registry.register(plugin);
    expect(registry.get("autumn")).toBe(plugin);
    expect(registry.has("autumn")).toBe(true);
  });

  it("returns undefined for unregistered scene", () => {
    expect(registry.get("nonexistent")).toBeUndefined();
    expect(registry.has("nonexistent")).toBe(false);
  });

  it("throws on duplicate registration", () => {
    registry.register(makeStubPlugin("autumn"));
    expect(() => registry.register(makeStubPlugin("autumn"))).toThrow(
      "Scene composer plugin already registered: autumn"
    );
  });

  it("lists all registered plugins", () => {
    registry.register(makeStubPlugin("autumn"));
    registry.register(makeStubPlugin("winter"));
    expect(registry.list()).toHaveLength(2);
    expect(registry.composableSceneIds()).toEqual(
      expect.arrayContaining(["autumn", "winter"])
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/3d/scene-composer/__tests__/registry.test.ts 2>&1 | tail -10`
Expected: FAIL — `../registry` does not exist

- [ ] **Step 3: Write the registry**

```typescript
// src/lib/shared/3d/scene-composer/registry.ts

import type { SceneComposerPlugin } from "./types";

export class SceneComposerRegistry {
  private plugins = new Map<string, SceneComposerPlugin>();

  register(plugin: SceneComposerPlugin): void {
    if (this.plugins.has(plugin.sceneId)) {
      throw new Error(
        `Scene composer plugin already registered: ${plugin.sceneId}`
      );
    }
    this.plugins.set(plugin.sceneId, plugin);
  }

  get(sceneId: string): SceneComposerPlugin | undefined {
    return this.plugins.get(sceneId);
  }

  has(sceneId: string): boolean {
    return this.plugins.has(sceneId);
  }

  list(): SceneComposerPlugin[] {
    return [...this.plugins.values()];
  }

  composableSceneIds(): string[] {
    return [...this.plugins.keys()];
  }
}

export const composerRegistry = new SceneComposerRegistry();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/3d/scene-composer/__tests__/registry.test.ts 2>&1 | tail -10`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/scene-composer/registry.ts src/lib/shared/3d/scene-composer/__tests__/registry.test.ts
git commit -m "feat(scene-composer): add plugin registry with tests"
```

---

### Task 3: Command Stack (Undo/Redo)

**Files:**
- Create: `src/lib/shared/3d/scene-composer/command-stack.svelte.ts`
- Test: `src/lib/shared/3d/scene-composer/__tests__/command-stack.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/shared/3d/scene-composer/__tests__/command-stack.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommandStack, type Command } from "../command-stack.svelte";

function makeCommand(label: string): Command & { executed: boolean; undone: boolean } {
  const cmd = {
    label,
    executed: false,
    undone: false,
    execute() { this.executed = true; this.undone = false; },
    undo() { this.undone = true; this.executed = false; },
  };
  return cmd;
}

describe("CommandStack", () => {
  let stack: CommandStack;

  beforeEach(() => {
    stack = new CommandStack();
  });

  it("executes a command and tracks it", () => {
    const cmd = makeCommand("Place Rock");
    stack.execute(cmd);
    expect(cmd.executed).toBe(true);
    expect(stack.canUndo).toBe(true);
    expect(stack.canRedo).toBe(false);
  });

  it("undoes a command", () => {
    const cmd = makeCommand("Place Rock");
    stack.execute(cmd);
    stack.undo();
    expect(cmd.undone).toBe(true);
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(true);
  });

  it("redoes an undone command", () => {
    const cmd = makeCommand("Place Rock");
    stack.execute(cmd);
    stack.undo();
    stack.redo();
    expect(cmd.executed).toBe(true);
    expect(stack.canUndo).toBe(true);
    expect(stack.canRedo).toBe(false);
  });

  it("clears redo stack on new action after undo", () => {
    const cmd1 = makeCommand("Place Rock");
    const cmd2 = makeCommand("Place Tree");
    stack.execute(cmd1);
    stack.undo();
    stack.execute(cmd2);
    expect(stack.canRedo).toBe(false);
  });

  it("clear() resets both stacks", () => {
    stack.execute(makeCommand("a"));
    stack.execute(makeCommand("b"));
    stack.undo();
    stack.clear();
    expect(stack.canUndo).toBe(false);
    expect(stack.canRedo).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/3d/scene-composer/__tests__/command-stack.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Implement CommandStack**

```typescript
// src/lib/shared/3d/scene-composer/command-stack.svelte.ts

export interface Command {
  execute(): void;
  undo(): void;
  label: string;
}

export class CommandStack {
  private _undoStack: Command[] = $state([]);
  private _redoStack: Command[] = $state([]);

  get canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  get undoLabel(): string | undefined {
    return this._undoStack[this._undoStack.length - 1]?.label;
  }

  get redoLabel(): string | undefined {
    return this._redoStack[this._redoStack.length - 1]?.label;
  }

  execute(cmd: Command): void {
    cmd.execute();
    this._undoStack.push(cmd);
    this._redoStack.length = 0;
  }

  undo(): void {
    const cmd = this._undoStack.pop();
    if (!cmd) return;
    cmd.undo();
    this._redoStack.push(cmd);
  }

  redo(): void {
    const cmd = this._redoStack.pop();
    if (!cmd) return;
    cmd.execute();
    this._undoStack.push(cmd);
  }

  clear(): void {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/3d/scene-composer/__tests__/command-stack.test.ts 2>&1 | tail -10`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/3d/scene-composer/command-stack.svelte.ts src/lib/shared/3d/scene-composer/__tests__/command-stack.test.ts
git commit -m "feat(scene-composer): add generic undo/redo command stack"
```

---

### Task 4: Composer Editor State

**Files:**
- Create: `src/lib/shared/3d/scene-composer/composer-editor-state.svelte.ts`

- [ ] **Step 1: Create reactive editor state**

```typescript
// src/lib/shared/3d/scene-composer/composer-editor-state.svelte.ts

import type { Object3D } from "three";
import type CameraControls from "camera-controls";
import type { ObjectDefinition } from "../procedural-engine/objects/object-catalog";
import type { ComposerPlacement } from "./types";
import { CommandStack } from "./command-stack.svelte";

export type ComposerMode = "browse" | "select" | "place";

const CAMERA_KEY = "composer-editor-camera";

interface EditorCamera {
  x: number; y: number; z: number;
  targetX: number; targetY: number; targetZ: number;
}

export function createComposerEditorState() {
  let mode = $state<ComposerMode>("browse");
  let active = $state(false);
  let selectedObject: Object3D | null = $state(null);
  let gizmoMode: "translate" | "rotate" | "scale" = $state("translate");
  let activeCatalogItem: ObjectDefinition | null = $state(null);
  let ghostValid = $state(false);
  let placements = $state<ComposerPlacement[]>([]);
  let dirty = $state(false);
  let orbitControls: CameraControls | null = null;

  const commands = new CommandStack();

  return {
    commands,

    get active() { return active; },
    get mode() { return mode; },
    get selectedObject() { return selectedObject; },
    get gizmoMode() { return gizmoMode; },
    get activeCatalogItem() { return activeCatalogItem; },
    get ghostValid() { return ghostValid; },
    get placements() { return placements; },
    get dirty() { return dirty; },

    setActive(v: boolean) {
      active = v;
      if (!v) {
        mode = "browse";
        selectedObject = null;
        activeCatalogItem = null;
        ghostValid = false;
        gizmoMode = "translate";
      }
    },

    toggle() {
      this.setActive(!active);
    },

    select(obj: Object3D) {
      selectedObject = obj;
      mode = "select";
      activeCatalogItem = null;
      if (orbitControls && obj) {
        const { Vector3 } = require("three");
        const pos = new Vector3();
        obj.getWorldPosition(pos);
        orbitControls.setTarget(pos.x, pos.y, pos.z, true);
      }
    },

    deselect() {
      selectedObject = null;
      mode = active ? "select" : "browse";
    },

    setGizmoMode(m: "translate" | "rotate" | "scale") {
      gizmoMode = m;
    },

    startPlacement(def: ObjectDefinition) {
      activeCatalogItem = def;
      mode = "place";
      selectedObject = null;
      ghostValid = false;
    },

    stopPlacement() {
      activeCatalogItem = null;
      mode = active ? "select" : "browse";
      ghostValid = false;
    },

    setGhostValid(v: boolean) {
      ghostValid = v;
    },

    setPlacements(p: ComposerPlacement[]) {
      placements = p;
    },

    addPlacement(p: ComposerPlacement) {
      placements.push(p);
      dirty = true;
    },

    removePlacement(id: string) {
      const idx = placements.findIndex(p => p.id === id);
      if (idx !== -1) {
        placements.splice(idx, 1);
        dirty = true;
      }
    },

    updatePlacement(id: string, update: Partial<ComposerPlacement>) {
      const p = placements.find(p => p.id === id);
      if (p) {
        Object.assign(p, update);
        dirty = true;
      }
    },

    markClean() {
      dirty = false;
    },

    setOrbitControls(controls: CameraControls | null) {
      orbitControls = controls;
    },

    focusOnPoint(x: number, y: number, z: number) {
      orbitControls?.setTarget(x, y, z, true);
    },

    panTarget(dx: number, dy: number, dz: number) {
      if (!orbitControls) return;
      const { Vector3 } = require("three");
      const v = new Vector3();
      orbitControls.getTarget(v);
      orbitControls.setTarget(v.x + dx, v.y + dy, v.z + dz, false);
    },

    loadCamera(): EditorCamera | null {
      try {
        const raw = sessionStorage.getItem(CAMERA_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    },

    saveCamera(cam: EditorCamera) {
      try {
        sessionStorage.setItem(CAMERA_KEY, JSON.stringify(cam));
      } catch { /* non-critical */ }
    },
  };
}

export type ComposerEditorState = ReturnType<typeof createComposerEditorState>;
```

Note: Uses `require("three")` in the `select` and `panTarget` methods to lazily access Vector3 without top-level import (avoids SSR issues in `.svelte.ts` files). Alternative: pass the Vector3 constructor in or move these methods to only run client-side. The executing agent should verify which approach the codebase prefers — check if other `.svelte.ts` files import from `three` at the top level. If they do, switch to a top-level import.

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --threshold error 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/scene-composer/composer-editor-state.svelte.ts
git commit -m "feat(scene-composer): add reactive editor state"
```

---

### Task 5: Widen PlacedObjectType

**Files:**
- Modify: `src/lib/shared/3d/procedural-engine/objects/PlacedObject.ts:33-38`

The existing `PlacedObjectType` is a closed union (`"tent" | "marker" | "prop" | "zone" | "path"`). Scene Composer needs arbitrary types per scene. Widen to `string` but keep the named union as a subtype for backwards compatibility.

- [ ] **Step 1: Widen the type**

In `src/lib/shared/3d/procedural-engine/objects/PlacedObject.ts`, change:

```typescript
// Before:
export type PlacedObjectType =
  | "tent"
  | "marker"
  | "prop"
  | "zone"
  | "path";

// After:
export type CampObjectType =
  | "tent"
  | "marker"
  | "prop"
  | "zone"
  | "path";

export type PlacedObjectType = CampObjectType | (string & {});
```

The `(string & {})` trick preserves autocomplete for known values while accepting any string. `CampObjectType` alias keeps the Hannons Camp values discoverable.

- [ ] **Step 2: Verify no downstream breakage**

Run: `npx svelte-check --threshold error 2>&1 | tail -5`
Expected: 0 errors — widening a union to include string is backwards-compatible.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/procedural-engine/objects/PlacedObject.ts
git commit -m "feat(scene-composer): widen PlacedObjectType to accept arbitrary strings"
```

---

### Task 6: Persistence Interface + File Writer

**Files:**
- Create: `src/lib/shared/3d/scene-composer/persistence/types.ts`
- Create: `src/lib/shared/3d/scene-composer/persistence/file-persistence.ts`
- Test: `src/lib/shared/3d/scene-composer/__tests__/file-persistence.test.ts`

- [ ] **Step 1: Create persistence interface**

```typescript
// src/lib/shared/3d/scene-composer/persistence/types.ts

import type { ComposerPlacement } from "../types";

export interface PlacementPersistence {
  save(sceneId: string, placements: ComposerPlacement[]): Promise<void>;
}
```

- [ ] **Step 2: Write test for serialization**

```typescript
// src/lib/shared/3d/scene-composer/__tests__/file-persistence.test.ts
import { describe, it, expect } from "vitest";
import { serializeComposerPlacements } from "../persistence/file-persistence";
import type { ComposerPlacement } from "../types";

describe("serializeComposerPlacements", () => {
  it("generates valid TypeScript source", () => {
    const placements: ComposerPlacement[] = [
      {
        id: "rock-001",
        objectKey: "rock-large",
        position: [5.2, 0, -3.1],
        rotation: [0, 0.38, 0, 0.92],
        scale: [1.2, 1, 1.2],
      },
    ];

    const output = serializeComposerPlacements("forest-autumn", placements);

    expect(output).toContain("import type { ComposerPlacement }");
    expect(output).toContain("FOREST_AUTUMN_PLACEMENTS");
    expect(output).toContain('"rock-001"');
    expect(output).toContain('"rock-large"');
    expect(output).toContain("[5.2, 0, -3.1]");
  });

  it("generates empty array for no placements", () => {
    const output = serializeComposerPlacements("winter", []);
    expect(output).toContain("WINTER_PLACEMENTS: ComposerPlacement[] = []");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/shared/3d/scene-composer/__tests__/file-persistence.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 4: Implement file persistence**

```typescript
// src/lib/shared/3d/scene-composer/persistence/file-persistence.ts

import type { ComposerPlacement } from "../types";
import type { PlacementPersistence } from "./types";

function sceneIdToConstName(sceneId: string): string {
  return sceneId.toUpperCase().replace(/-/g, "_") + "_PLACEMENTS";
}

export function serializeComposerPlacements(
  sceneId: string,
  placements: ComposerPlacement[],
): string {
  const constName = sceneIdToConstName(sceneId);
  const lines: string[] = [];

  lines.push(
    `import type { ComposerPlacement } from "$lib/shared/3d/scene-composer/types";`,
  );
  lines.push("");

  if (placements.length === 0) {
    lines.push(`export const ${constName}: ComposerPlacement[] = [];`);
    lines.push("");
    return lines.join("\n");
  }

  lines.push(`export const ${constName}: ComposerPlacement[] = [`);

  for (const p of placements) {
    const pos = `[${p.position.map((n) => round(n)).join(", ")}]`;
    const rot = `[${p.rotation.map((n) => round(n, 4)).join(", ")}]`;
    const scl = `[${p.scale.map((n) => round(n)).join(", ")}]`;

    lines.push("  {");
    lines.push(`    id: "${p.id}",`);
    lines.push(`    objectKey: "${p.objectKey}",`);
    lines.push(`    position: ${pos},`);
    lines.push(`    rotation: ${rot},`);
    lines.push(`    scale: ${scl},`);
    if (p.locked) lines.push(`    locked: true,`);
    if (p.visible === false) lines.push(`    visible: false,`);
    lines.push("  },");
  }

  lines.push("];");
  lines.push("");
  return lines.join("\n");
}

function round(n: number, decimals = 2): string {
  return Number(n.toFixed(decimals)).toString();
}

export class FilePersistence implements PlacementPersistence {
  async save(sceneId: string, placements: ComposerPlacement[]): Promise<void> {
    const content = serializeComposerPlacements(sceneId, placements);
    const response = await fetch(`/__composer-placements/${sceneId}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: content,
    });
    if (!response.ok) {
      throw new Error(
        `Failed to write placements: ${response.status} ${response.statusText}`,
      );
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/shared/3d/scene-composer/__tests__/file-persistence.test.ts 2>&1 | tail -10`
Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/3d/scene-composer/persistence/
git add src/lib/shared/3d/scene-composer/__tests__/file-persistence.test.ts
git commit -m "feat(scene-composer): add placement persistence interface and file writer"
```

---

### Task 7: Vite Dev Endpoint

**Files:**
- Create: `src/lib/shared/3d/scene-composer/persistence/composer-placement-plugin.ts`
- Modify: `vite.config.ts:3` (add import) and `vite.config.ts:649` (add plugin)

- [ ] **Step 1: Create the Vite plugin**

```typescript
// src/lib/shared/3d/scene-composer/persistence/composer-placement-plugin.ts

import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import type { Plugin } from "vite";

function sceneIdToDir(sceneId: string): string {
  const map: Record<string, string> = {
    "forest-autumn": "autumn",
    "forest-firefly": "forest",
    winter: "winter",
    "cosmic-night": "cosmic",
    "cosmic-aurora": "cosmic",
    "ocean-abyss": "ocean",
    "ocean-reef": "ocean",
    "ocean-mystical": "ocean",
    "ocean-cinematic": "ocean",
  };
  return map[sceneId] ?? sceneId;
}

export function composerPlacementPlugin(): Plugin {
  return {
    name: "composer-placement-writer",
    configureServer(server) {
      server.middlewares.use("/__composer-placements", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }

        const sceneId = (req.url ?? "").replace(/^\//, "");
        if (!sceneId) {
          res.statusCode = 400;
          res.end("Missing sceneId in URL");
          return;
        }

        let body = "";
        req.on("data", (chunk: string) => {
          body += chunk;
        });
        req.on("end", () => {
          try {
            const dir = sceneIdToDir(sceneId);
            const outPath = resolve(
              process.cwd(),
              "src/lib/shared/3d/environments/scenes",
              dir,
              "placements.ts",
            );
            mkdirSync(dirname(outPath), { recursive: true });
            writeFileSync(outPath, body, "utf-8");
            console.log(`[composer] Wrote placements for ${sceneId} → ${outPath}`);
            res.statusCode = 200;
            res.end("OK");
          } catch (err) {
            console.error("[composer-placement-plugin] Write failed:", err);
            res.statusCode = 500;
            res.end("Write failed");
          }
        });
      });
    },
  };
}
```

- [ ] **Step 2: Wire into vite.config.ts**

Add import near line 3 (after the museumPlacementPlugin import):

```typescript
import { composerPlacementPlugin } from './src/lib/shared/3d/scene-composer/persistence/composer-placement-plugin';
```

Add plugin call near line 649 (after `museumPlacementPlugin()`):

```typescript
composerPlacementPlugin(),
```

- [ ] **Step 3: Run build to verify no import errors**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds (plugin only runs in dev server, build doesn't execute configureServer)

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/scene-composer/persistence/composer-placement-plugin.ts vite.config.ts
git commit -m "feat(scene-composer): add Vite dev endpoint for placement file writes"
```

---

### Task 8: ComposedObject Renderer

**Files:**
- Create: `src/lib/shared/3d/scene-composer/ComposedObject.svelte`

- [ ] **Step 1: Create the fallback-geometry renderer**

```svelte
<script lang="ts">
  import { T } from "@threlte/core";
  import {
    BoxGeometry,
    SphereGeometry,
    CylinderGeometry,
    ConeGeometry,
    MeshStandardMaterial,
    Color,
  } from "three";
  import type { ObjectDefinition } from "../procedural-engine/objects/object-catalog";
  import type { ComposerPlacement } from "./types";

  interface Props {
    placement: ComposerPlacement;
    definition: ObjectDefinition;
  }

  const { placement, definition }: Props = $props();

  const geometries = {
    box: new BoxGeometry(1, 1, 1),
    sphere: new SphereGeometry(0.5, 16, 12),
    cylinder: new CylinderGeometry(0.5, 0.5, 1, 16),
    cone: new ConeGeometry(0.5, 1, 16),
    flag: new BoxGeometry(0.05, 1, 0.5),
  };

  const geometry = $derived(
    geometries[definition.fallbackGeometry] ?? geometries.box
  );

  const material = $derived(
    new MeshStandardMaterial({
      color: new Color(definition.color),
      roughness: 0.7,
      metalness: 0.1,
    })
  );

  const effectiveScale = $derived<[number, number, number]>([
    placement.scale[0] * definition.defaultScale,
    placement.scale[1] * definition.defaultScale,
    placement.scale[2] * definition.defaultScale,
  ]);
</script>

<T.Group
  position={placement.position}
  quaternion={placement.rotation}
  scale={effectiveScale}
  userData={{ composerId: placement.id }}
  visible={placement.visible !== false}
>
  <T.Mesh {geometry} {material} castShadow receiveShadow />
</T.Group>
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --threshold error 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/scene-composer/ComposedObject.svelte
git commit -m "feat(scene-composer): add ComposedObject fallback-geometry renderer"
```

---

### Task 9: ComposerGhost (Placement Preview)

**Files:**
- Create: `src/lib/shared/3d/scene-composer/ComposerGhost.svelte`

This is the generic extraction of `PlacementGhost.svelte`. Museum-specific logic (GLTF cloning, tile grid, wall facing, mount height) is removed. Surface classification and ghost feedback are driven by plugin's `SurfaceRules`.

- [ ] **Step 1: Create ComposerGhost**

```svelte
<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import {
    Raycaster,
    Vector2,
    Vector3,
    Quaternion,
    MeshStandardMaterial,
    BoxGeometry,
    SphereGeometry,
    CylinderGeometry,
    ConeGeometry,
    Color,
    type Intersection,
    type Object3D,
    type Mesh,
  } from "three";
  import type { ObjectDefinition } from "../procedural-engine/objects/object-catalog";
  import type { SurfaceRules, ComposerPlacement, PlacementConstraints, ExclusionZone } from "./types";

  interface Props {
    definition: ObjectDefinition;
    surfaceRules: SurfaceRules;
    constraints?: PlacementConstraints;
    existingPlacements: ComposerPlacement[];
    onPlace: (placement: ComposerPlacement) => void;
    onCancel: () => void;
  }

  const {
    definition,
    surfaceRules,
    constraints,
    existingPlacements,
    onPlace,
    onCancel,
  }: Props = $props();

  const UP = new Vector3(0, 1, 0);
  const COLOR_VALID = new Color(0x22dd77);
  const COLOR_INVALID = new Color(0xdd3344);

  const threlteCtx = useThrelte();
  function getScene() { return (threlteCtx as any).scene?.current ?? (threlteCtx as any).scene; }
  function getCamera() { return (threlteCtx as any).camera?.current ?? (threlteCtx as any).camera; }
  function getRenderer() { return (threlteCtx as any).renderer?.current ?? (threlteCtx as any).renderer; }

  let ghostX = $state(0);
  let ghostY = $state(0);
  let ghostZ = $state(0);
  let ghostQuat: [number, number, number, number] = $state([0, 0, 0, 1]);
  let valid = $state(false);
  let visible = $state(false);

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  const hitNormal = new Vector3();
  const hitPoint = new Vector3();
  const tempQuat = new Quaternion();

  const ghostMaterial = new MeshStandardMaterial({
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    color: COLOR_INVALID,
  });

  const geometries: Record<string, any> = {
    box: new BoxGeometry(1, 1, 1),
    sphere: new SphereGeometry(0.5, 16, 12),
    cylinder: new CylinderGeometry(0.5, 0.5, 1, 16),
    cone: new ConeGeometry(0.5, 1, 16),
    flag: new BoxGeometry(0.05, 1, 0.5),
  };

  const ghostGeometry = $derived(
    geometries[definition.fallbackGeometry] ?? geometries.box
  );

  function isGhostMesh(obj: Object3D): boolean {
    let current: Object3D | null = obj;
    while (current) {
      if (current.userData?.__isComposerGhost) return true;
      const type = current.type ?? "";
      if (
        type === "TransformControlsGizmo" ||
        type === "TransformControlsPlane"
      ) return true;
      current = current.parent;
    }
    return false;
  }

  function filterIntersections(hits: Intersection[]): Intersection | null {
    for (const hit of hits) {
      if (isGhostMesh(hit.object)) continue;
      if (!surfaceRules.isSurface(hit.object as Mesh)) continue;
      return hit;
    }
    return null;
  }

  function snapToGrid(v: number, gridSize: number): number {
    return Math.round(v / gridSize) * gridSize;
  }

  function isInExclusionZone(
    x: number, y: number, z: number,
    zones?: ExclusionZone[],
  ): boolean {
    if (!zones) return false;
    for (const zone of zones) {
      const dx = x - zone.center[0];
      const dy = y - zone.center[1];
      const dz = z - zone.center[2];
      if (dx * dx + dy * dy + dz * dz < zone.radius * zone.radius) return true;
    }
    return false;
  }

  function onPointerMove(event: PointerEvent): void {
    const ren = getRenderer();
    if (!ren?.domElement) return;
    const rect = ren.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const cam = getCamera();
    const scn = getScene();
    if (!cam || !scn) return;

    raycaster.setFromCamera(pointer, cam);
    const intersections = raycaster.intersectObjects(scn.children, true);
    const hit = filterIntersections(intersections);

    if (!hit || !hit.face) {
      valid = false;
      visible = false;
      ghostMaterial.color.copy(COLOR_INVALID);
      return;
    }

    visible = true;
    hitPoint.copy(hit.point);

    hitNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);

    let px = hitPoint.x;
    let py = hitPoint.y + surfaceRules.surfaceOffset;
    let pz = hitPoint.z;

    if (surfaceRules.gridSize) {
      px = snapToGrid(px, surfaceRules.gridSize);
      pz = snapToGrid(pz, surfaceRules.gridSize);
    }

    if (definition.snapToGround) {
      py = definition.defaultHeight + surfaceRules.surfaceOffset;
    }

    ghostX = px;
    ghostY = py;
    ghostZ = pz;

    if (surfaceRules.orientationMode === "upright") {
      ghostQuat = [0, 0, 0, 1];
    } else if (surfaceRules.orientationMode === "surface-normal") {
      tempQuat.setFromUnitVectors(UP, hitNormal);
      ghostQuat = [tempQuat.x, tempQuat.y, tempQuat.z, tempQuat.w];
    } else if (surfaceRules.orientationMode === "custom" && surfaceRules.orientFromNormal) {
      const q = surfaceRules.orientFromNormal(hitNormal);
      ghostQuat = [q.x, q.y, q.z, q.w];
    }

    let isValid = true;

    if (isInExclusionZone(px, py, pz, constraints?.exclusionZones)) {
      isValid = false;
    }

    if (constraints?.maxObjects && existingPlacements.length >= constraints.maxObjects) {
      isValid = false;
    }

    if (constraints?.validate) {
      const draftPlacement: ComposerPlacement = {
        id: "draft",
        objectKey: definition.key,
        position: [px, py, pz],
        rotation: [...ghostQuat],
        scale: [1, 1, 1],
      };
      const err = constraints.validate(draftPlacement, existingPlacements);
      if (err) isValid = false;
    }

    valid = isValid;
    ghostMaterial.color.copy(isValid ? COLOR_VALID : COLOR_INVALID);
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    if (!valid) return;

    const placement: ComposerPlacement = {
      id: crypto.randomUUID(),
      objectKey: definition.key,
      position: [ghostX, ghostY, ghostZ],
      rotation: [...ghostQuat],
      scale: [1, 1, 1],
    };
    onPlace(placement);
  }

  function onClickCapture(event: MouseEvent): void {
    event.stopImmediatePropagation();
    event.preventDefault();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") onCancel();
  }

  let domEl: HTMLCanvasElement | null = null;

  onMount(() => {
    const ren = getRenderer();
    domEl = ren?.domElement ?? null;
    if (!domEl) return;
    domEl.addEventListener("pointermove", onPointerMove);
    domEl.addEventListener("pointerdown", onPointerDown, true);
    domEl.addEventListener("click", onClickCapture, true);
    window.addEventListener("keydown", onKeyDown);
  });

  onDestroy(() => {
    if (domEl) {
      domEl.removeEventListener("pointermove", onPointerMove);
      domEl.removeEventListener("pointerdown", onPointerDown, true);
      domEl.removeEventListener("click", onClickCapture, true);
    }
    window.removeEventListener("keydown", onKeyDown);
    ghostMaterial.dispose();
    Object.values(geometries).forEach((g: any) => g.dispose());
  });

  function onGhostCreate(ref: Object3D): void {
    ref.userData.__isComposerGhost = true;
    ref.traverse((child) => {
      child.userData.__isComposerGhost = true;
    });
  }
</script>

{#if visible}
  <T.Group
    oncreate={onGhostCreate}
    position={[ghostX, ghostY, ghostZ]}
    quaternion={ghostQuat}
  >
    <T.Mesh
      geometry={ghostGeometry}
      material={ghostMaterial}
      scale={[definition.defaultScale, definition.defaultScale, definition.defaultScale]}
    />
  </T.Group>
{/if}
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --threshold error 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/scene-composer/ComposerGhost.svelte
git commit -m "feat(scene-composer): add generic placement ghost with surface rules"
```

---

### Task 10: ComposerPickerPanel

**Files:**
- Create: `src/lib/shared/3d/scene-composer/ComposerPickerPanel.svelte`

Extracted from `PlacementPickerPanel.svelte`. Reads catalog from plugin, not from `PLACEABLE_OBJECTS`.

- [ ] **Step 1: Create ComposerPickerPanel**

```svelte
<script lang="ts">
  import type { ComposerCatalog, CatalogCategory } from "./types";
  import type { ObjectDefinition } from "../procedural-engine/objects/object-catalog";

  interface Props {
    catalog: ComposerCatalog;
    sceneName: string;
    placedCount: number;
    activeItemKey: string | null;
    onSelectItem: (def: ObjectDefinition) => void;
    onDeselectItem: () => void;
    onClose: () => void;
  }

  const {
    catalog,
    sceneName,
    placedCount,
    activeItemKey,
    onSelectItem,
    onDeselectItem,
    onClose,
  }: Props = $props();

  let collapsedCategories = $state<Set<string>>(new Set());

  function toggleCategory(id: string) {
    const next = new Set(collapsedCategories);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsedCategories = next;
  }

  function handleClick(def: ObjectDefinition) {
    if (activeItemKey === def.key) {
      onDeselectItem();
    } else {
      onSelectItem(def);
    }
  }

  const allItems = $derived(catalog.allItems());

  function handleKeyDown(event: KeyboardEvent): void {
    const num = parseInt(event.key);
    if (num >= 1 && num <= 9) {
      const idx = num - 1;
      if (idx < allItems.length) {
        const def = allItems[idx];
        if (!def) return;
        handleClick(def);
      }
    }
  }

  const fallbackIcons: Record<string, string> = {
    cone: "🌲",
    sphere: "🪨",
    cylinder: "🪵",
    box: "📦",
    flag: "🚩",
  };

  function iconForDef(def: ObjectDefinition): string {
    return fallbackIcons[def.fallbackGeometry] ?? "📦";
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="composer-picker">
  <div class="picker-header">
    <span class="header-label">{sceneName} — Compose</span>
    <button class="exit-btn" onclick={onClose} aria-label="Exit compose mode">
      <i class="fas fa-xmark" aria-hidden="true"></i>
    </button>
  </div>

  <div class="scene-indicator">
    <i class="fas fa-cubes" aria-hidden="true"></i>
    <span>{placedCount} objects</span>
  </div>

  {#each catalog.categories as category (category.id)}
    <button
      class="picker-category"
      onclick={() => toggleCategory(category.id)}
      aria-expanded={!collapsedCategories.has(category.id)}
    >
      <i class="fas {category.icon}" aria-hidden="true"></i>
      {category.label}
      <span class="cat-count">{category.items.length}</span>
      <i
        class="fas fa-chevron-{collapsedCategories.has(category.id) ? 'right' : 'down'} chevron"
        aria-hidden="true"
      ></i>
    </button>

    {#if !collapsedCategories.has(category.id)}
      <div class="picker-grid">
        {#each category.items as def, index (def.key)}
          {@const globalIdx = allItems.indexOf(def)}
          <button
            class="picker-item"
            class:selected={activeItemKey === def.key}
            onclick={() => handleClick(def)}
            title={def.name}
          >
            {#if globalIdx < 9}
              <span class="key-hint">{globalIdx + 1}</span>
            {/if}
            <span class="item-icon">{iconForDef(def)}</span>
            <span class="item-label">{def.name}</span>
          </button>
        {/each}
      </div>
    {/if}
  {/each}

  <div class="picker-hint">
    <p>Click to select, click again to cancel</p>
    <p><kbd>1-9</kbd> quick-select &bull; <kbd>ESC</kbd> cancel</p>
    <p><kbd>Del</kbd> remove selected &bull; <kbd>Ctrl+Z</kbd> undo</p>
  </div>
</div>

<style>
  .composer-picker {
    display: flex;
    flex-direction: column;
    gap: 0;
    height: 100%;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .picker-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
  }

  .header-label {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .exit-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .exit-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
  }

  .scene-indicator {
    padding: 8px 12px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .picker-category {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 12px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    background: transparent;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    text-align: left;
  }

  .picker-category:hover {
    color: rgba(255, 255, 255, 0.8);
  }

  .cat-count {
    margin-left: auto;
    font-size: 9px;
    color: rgba(255, 255, 255, 0.3);
    font-weight: 500;
  }

  .chevron {
    font-size: 8px;
    color: rgba(255, 255, 255, 0.3);
    margin-left: 4px;
  }

  .picker-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    padding: 0 10px 10px;
    flex-shrink: 0;
  }

  .picker-item {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 10px 6px 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 6px;
    cursor: pointer;
    color: var(--theme-text, #ffffff);
    transition: border-color 0.15s ease, background 0.15s ease;
    text-align: center;
    min-width: 0;
  }

  .picker-item:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.07));
  }

  .picker-item.selected {
    border-color: var(--theme-accent, #7c6af0);
    background: color-mix(in srgb, var(--theme-accent, #7c6af0) 18%, transparent);
  }

  .item-icon {
    font-size: 20px;
    line-height: 1;
  }

  .item-label {
    font-size: 11px;
    line-height: 1.3;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    width: 100%;
    word-break: break-word;
  }

  .key-hint {
    position: absolute;
    top: 4px;
    right: 4px;
    font-size: 9px;
    color: rgba(255, 255, 255, 0.3);
    font-weight: 600;
  }

  .picker-hint {
    margin-top: auto;
    padding: 12px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
  }

  .picker-hint p {
    font-size: 11px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    margin: 0 0 5px;
    line-height: 1.4;
  }

  .picker-hint p:last-child { margin-bottom: 0; }

  kbd {
    display: inline-block;
    padding: 1px 5px;
    font-size: 10px;
    font-family: inherit;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 3px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
  }
</style>
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --threshold error 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/scene-composer/ComposerPickerPanel.svelte
git commit -m "feat(scene-composer): add catalog picker panel with collapsible categories"
```

---

### Task 11: GenericSceneEditor

**Files:**
- Create: `src/lib/shared/3d/scene-composer/GenericSceneEditor.svelte`

Core editor shell. Extracted from `MuseumSceneEditor.svelte` (310 lines). Replaces hardcoded museum state refs with generic `ComposerEditorState`. Replaces `findClickedObject`'s museum-prefix walking with `userData.composerId` walking. Keeps: raycasting, gizmo, undo/redo, WASD, keyboard shortcuts.

- [ ] **Step 1: Create GenericSceneEditor**

```svelte
<script lang="ts">
  import { useThrelte, useTask } from "@threlte/core";
  import { TransformControls } from "@threlte/extras";
  import { Raycaster, Vector2, Vector3, type Object3D, type Camera } from "three";
  import { onMount, onDestroy } from "svelte";
  import type { ComposerEditorState } from "./composer-editor-state.svelte";
  import type { ComposerPlacement } from "./types";
  import type { Command } from "./command-stack.svelte";

  interface Props {
    editorState: ComposerEditorState;
    onSave?: () => void;
  }

  const { editorState, onSave }: Props = $props();

  const _tempVec = new Vector3();
  const _worldPos = new Vector3();

  let dragStartPos: Vector3 | null = null;
  let dragStartRot = $state<{ x: number; y: number; z: number } | null>(null);
  let dragStartScale: Vector3 | null = null;

  function captureBeforeDrag(obj: Object3D) {
    dragStartPos = obj.position.clone();
    dragStartRot = { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z };
    dragStartScale = obj.scale.clone();
  }

  function captureAfterDrag(obj: Object3D) {
    if (!dragStartPos || !dragStartRot || !dragStartScale) return;

    const beforePos = dragStartPos.clone();
    const beforeRotX = dragStartRot.x;
    const beforeRotY = dragStartRot.y;
    const beforeRotZ = dragStartRot.z;
    const beforeScale = dragStartScale.clone();
    const afterPos = obj.position.clone();
    const afterRotX = obj.rotation.x;
    const afterRotY = obj.rotation.y;
    const afterRotZ = obj.rotation.z;
    const afterScale = obj.scale.clone();
    const target = obj;

    const composerId = findComposerId(obj);

    const cmd: Command = {
      label: `Move ${composerId ?? "object"}`,
      execute() {
        target.position.copy(afterPos);
        target.rotation.set(afterRotX, afterRotY, afterRotZ);
        target.scale.copy(afterScale);
        if (composerId) syncPlacementFromObject(composerId, target);
      },
      undo() {
        target.position.copy(beforePos);
        target.rotation.set(beforeRotX, beforeRotY, beforeRotZ);
        target.scale.copy(beforeScale);
        if (composerId) syncPlacementFromObject(composerId, target);
      },
    };

    editorState.commands.execute(cmd);
    dragStartPos = null;
    dragStartRot = null;
    dragStartScale = null;
  }

  function syncPlacementFromObject(id: string, obj: Object3D) {
    obj.getWorldPosition(_worldPos);
    editorState.updatePlacement(id, {
      position: [_worldPos.x, _worldPos.y, _worldPos.z],
      rotation: [obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    });
  }

  function findComposerId(obj: Object3D): string | null {
    let current: Object3D | null = obj;
    while (current) {
      if (current.userData?.composerId) return current.userData.composerId as string;
      current = current.parent;
    }
    return null;
  }

  const ctx = useThrelte();
  const getScene = () => (ctx.scene as any)?.current ?? ctx.scene;
  const getCamera = (): Camera | null => {
    const c = (ctx.camera as any)?.current ?? ctx.camera;
    return c?.isCamera ? c : null;
  };
  const getCanvas = (): HTMLCanvasElement | null => {
    const r = (ctx.renderer as any)?.current ?? ctx.renderer;
    return r?.domElement ?? null;
  };

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let gizmoDragging = false;

  function findClickedObject(event: PointerEvent): Object3D | null {
    const cam = getCamera();
    const scene = getScene();
    if (!cam || !scene) return null;

    const canvas = getCanvas();
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, cam);
    const intersects = raycaster.intersectObjects(scene.children, true);

    for (const hit of intersects) {
      let isGizmo = false;
      let parent: Object3D | null = hit.object;
      while (parent) {
        if (
          (parent as any).isTransformControls ||
          parent.type === "TransformControlsGizmo" ||
          parent.type === "TransformControlsPlane"
        ) {
          isGizmo = true;
          break;
        }
        parent = parent.parent;
      }
      if (isGizmo) return null;
      if ((hit.object as any).isInstancedMesh) continue;

      // Walk up to find composerId
      let target: Object3D = hit.object;
      let walk: Object3D | null = hit.object;
      while (walk && walk.type !== "Scene") {
        if (walk.userData?.composerId) {
          target = walk;
          break;
        }
        walk = walk.parent;
      }

      if (target.userData?.composerId) return target;
    }
    return null;
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    if (gizmoDragging) return;
    if (editorState.activeCatalogItem) return;

    requestAnimationFrame(() => {
      if (gizmoDragging) return;
      const obj = findClickedObject(event);
      if (obj) {
        editorState.select(obj);
      } else {
        editorState.deselect();
      }
    });
  }

  function handleDoubleClick(event: MouseEvent) {
    const cam = getCamera();
    const scene = getScene();
    const canvas = getCanvas();
    if (!cam || !scene || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, cam);
    const hits = raycaster.intersectObjects(scene.children, true);

    for (const hit of hits) {
      if ((hit.object as any).isInstancedMesh || (hit.object as any).isTransformControls) continue;
      editorState.focusOnPoint(hit.point.x, hit.point.y, hit.point.z);
      break;
    }
  }

  // ── WASD panning ──
  const panKeys = new Set<string>();
  const PAN_SPEED = 8;

  function handleKeyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();

    if (key === "1") { editorState.setGizmoMode("translate"); return; }
    if (key === "2") { editorState.setGizmoMode("rotate"); return; }
    if (key === "3") { editorState.setGizmoMode("scale"); return; }
    if (key === "escape") { editorState.deselect(); editorState.stopPlacement(); return; }

    if (key === "delete" || key === "backspace") {
      const sel = editorState.selectedObject;
      if (sel) {
        const id = findComposerId(sel);
        if (id) {
          const placement = editorState.placements.find(p => p.id === id);
          if (placement) {
            const cmd: Command = {
              label: `Delete ${placement.objectKey}`,
              execute() { editorState.removePlacement(id); sel.visible = false; },
              undo() { editorState.addPlacement(placement); sel.visible = true; },
            };
            editorState.commands.execute(cmd);
            editorState.deselect();
          }
        }
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      event.shiftKey ? editorState.commands.redo() : editorState.commands.undo();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && key === "s") {
      event.preventDefault();
      onSave?.();
      return;
    }

    if (["w", "a", "s", "d", "q", "e"].includes(key)) {
      panKeys.add(key);
      event.preventDefault();
      event.stopPropagation();
    }
    if (event.key === "Shift") panKeys.add("shift");
  }

  function handleKeyUp(event: KeyboardEvent) {
    panKeys.delete(event.key.toLowerCase());
    if (event.key === "Shift") panKeys.delete("shift");
  }

  useTask((delta) => {
    if (panKeys.size === 0) return;
    const cam = getCamera();
    if (!cam) return;

    const speed = (panKeys.has("shift") ? PAN_SPEED * 3 : PAN_SPEED) * delta;
    const forward = (panKeys.has("w") ? 1 : 0) - (panKeys.has("s") ? 1 : 0);
    const strafe = (panKeys.has("d") ? 1 : 0) - (panKeys.has("a") ? 1 : 0);
    const vertical = (panKeys.has("e") ? 1 : 0) - (panKeys.has("q") ? 1 : 0);
    if (forward === 0 && strafe === 0 && vertical === 0) return;

    cam.getWorldDirection(_tempVec);
    const fwdLen = Math.sqrt(_tempVec.x ** 2 + _tempVec.z ** 2) || 1;
    const nfx = _tempVec.x / fwdLen;
    const nfz = _tempVec.z / fwdLen;
    const nrx = -nfz;
    const nrz = nfx;

    const dx = (nfx * forward + nrx * strafe) * speed;
    const dz = (nfz * forward + nrz * strafe) * speed;
    const dy = vertical * speed;

    cam.position.x += dx;
    cam.position.y += dy;
    cam.position.z += dz;
    editorState.panTarget(dx, dy, dz);
  });

  onMount(() => {
    const canvas = getCanvas();
    if (canvas) {
      canvas.addEventListener("pointerdown", handlePointerDown);
      canvas.addEventListener("dblclick", handleDoubleClick);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    if (document.pointerLockElement) document.exitPointerLock();
  });

  onDestroy(() => {
    const canvas = getCanvas();
    if (canvas) {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("dblclick", handleDoubleClick);
    }
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    editorState.deselect();
  });
</script>

{#if editorState.selectedObject}
  <TransformControls
    object={editorState.selectedObject}
    mode={editorState.gizmoMode}
    translationSnap={0.5}
    rotationSnap={Math.PI / 12}
    scaleSnap={0.1}
    onmouseDown={() => {
      gizmoDragging = true;
      if (editorState.selectedObject) captureBeforeDrag(editorState.selectedObject);
    }}
    onmouseUp={() => {
      gizmoDragging = false;
      if (editorState.selectedObject) captureAfterDrag(editorState.selectedObject);
    }}
  />
{/if}
```

- [ ] **Step 2: Run typecheck**

Run: `npx svelte-check --threshold error 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/3d/scene-composer/GenericSceneEditor.svelte
git commit -m "feat(scene-composer): add generic scene editor with gizmo, undo/redo, WASD"
```

---

### Task 12: Autumn Scene Plugin

**Files:**
- Create: `src/lib/shared/3d/environments/scenes/autumn/autumn-composer-plugin.ts`
- Create: `src/lib/shared/3d/environments/scenes/autumn/placements.ts`

- [ ] **Step 1: Create the empty placements file**

```typescript
// src/lib/shared/3d/environments/scenes/autumn/placements.ts
import type { ComposerPlacement } from "$lib/shared/3d/scene-composer/types";

export const FOREST_AUTUMN_PLACEMENTS: ComposerPlacement[] = [];
```

- [ ] **Step 2: Create the autumn composer plugin**

```typescript
// src/lib/shared/3d/environments/scenes/autumn/autumn-composer-plugin.ts

import type { Mesh } from "three";
import { composerRegistry } from "$lib/shared/3d/scene-composer/registry";
import type {
  SceneComposerPlugin,
  ComposerCatalog,
  CatalogCategory,
  SurfaceRules,
  PlacementConstraints,
  ComposerPlacement,
} from "$lib/shared/3d/scene-composer/types";
import type { ObjectDefinition } from "$lib/shared/3d/procedural-engine/objects/object-catalog";
import { FOREST_AUTUMN_PLACEMENTS } from "./placements";

const vegetationItems: ObjectDefinition[] = [
  {
    key: "oak-tree",
    name: "Oak Tree",
    type: "prop",
    icon: "fa-tree",
    fallbackGeometry: "cone",
    defaultScale: 3,
    defaultHeight: 0,
    snapToGround: true,
    canRotate: true,
    canScale: true,
    color: 0xc87533,
  },
  {
    key: "birch-tree",
    name: "Birch Tree",
    type: "prop",
    icon: "fa-tree",
    fallbackGeometry: "cone",
    defaultScale: 2.5,
    defaultHeight: 0,
    snapToGround: true,
    canRotate: true,
    canScale: true,
    color: 0xe8c170,
  },
  {
    key: "bush-large",
    name: "Large Bush",
    type: "prop",
    icon: "fa-leaf",
    fallbackGeometry: "sphere",
    defaultScale: 1.5,
    defaultHeight: 0,
    snapToGround: true,
    canRotate: false,
    canScale: true,
    color: 0x8b6914,
  },
  {
    key: "bush-small",
    name: "Small Bush",
    type: "prop",
    icon: "fa-seedling",
    fallbackGeometry: "sphere",
    defaultScale: 0.8,
    defaultHeight: 0,
    snapToGround: true,
    canRotate: false,
    canScale: true,
    color: 0xa07828,
  },
  {
    key: "mushroom-cluster",
    name: "Mushroom Cluster",
    type: "prop",
    icon: "fa-fan",
    fallbackGeometry: "sphere",
    defaultScale: 0.4,
    defaultHeight: 0,
    snapToGround: true,
    canRotate: true,
    canScale: true,
    color: 0xd4a574,
  },
];

const terrainItems: ObjectDefinition[] = [
  {
    key: "rock-large",
    name: "Large Rock",
    type: "prop",
    icon: "fa-mountain",
    fallbackGeometry: "sphere",
    defaultScale: 1.8,
    defaultHeight: 0,
    snapToGround: true,
    canRotate: true,
    canScale: true,
    color: 0x6b6b6b,
  },
  {
    key: "rock-small",
    name: "Small Rock",
    type: "prop",
    icon: "fa-gem",
    fallbackGeometry: "sphere",
    defaultScale: 0.6,
    defaultHeight: 0,
    snapToGround: true,
    canRotate: true,
    canScale: true,
    color: 0x7a7a7a,
  },
  {
    key: "fallen-log",
    name: "Fallen Log",
    type: "prop",
    icon: "fa-minus",
    fallbackGeometry: "cylinder",
    defaultScale: 2,
    defaultHeight: 0.2,
    snapToGround: true,
    canRotate: true,
    canScale: true,
    color: 0x5c3a1e,
  },
];

const atmosphereItems: ObjectDefinition[] = [
  {
    key: "campfire",
    name: "Campfire",
    type: "prop",
    icon: "fa-fire",
    fallbackGeometry: "cylinder",
    defaultScale: 1,
    defaultHeight: 0,
    snapToGround: true,
    canRotate: false,
    canScale: true,
    color: 0xcc5500,
  },
  {
    key: "lantern",
    name: "Lantern",
    type: "prop",
    icon: "fa-lightbulb",
    fallbackGeometry: "sphere",
    defaultScale: 0.3,
    defaultHeight: 0.5,
    snapToGround: true,
    canRotate: false,
    canScale: true,
    color: 0xffcc44,
  },
  {
    key: "mist-patch",
    name: "Mist Patch",
    type: "zone",
    icon: "fa-cloud",
    fallbackGeometry: "cylinder",
    defaultScale: 3,
    defaultHeight: 0.1,
    snapToGround: true,
    canRotate: false,
    canScale: true,
    color: 0xcccccc,
  },
];

const categories: CatalogCategory[] = [
  { id: "vegetation", label: "Vegetation", icon: "fa-tree", items: vegetationItems },
  { id: "terrain", label: "Terrain", icon: "fa-mountain", items: terrainItems },
  { id: "atmosphere", label: "Atmosphere", icon: "fa-fire", items: atmosphereItems },
];

const allItems = categories.flatMap((c) => c.items);

const catalog: ComposerCatalog = {
  categories,
  getDefinition(key: string) {
    return allItems.find((d) => d.key === key);
  },
  allItems() {
    return allItems;
  },
};

const surfaceRules: SurfaceRules = {
  isSurface(mesh: Mesh): boolean {
    // Accept ground plane and terrain meshes. Reject trees, mushrooms, stream.
    // Ground meshes are typically large flat geometry near y=0.
    // Simple heuristic: accept any mesh whose name contains "ground" or whose
    // bounding sphere radius > 5 (large flat surfaces).
    const name = (mesh.name ?? "").toLowerCase();
    if (name.includes("ground") || name.includes("terrain") || name.includes("plane")) {
      return true;
    }
    // Accept meshes that are likely the ground — large geometry at low Y
    if (mesh.geometry?.boundingSphere) {
      mesh.geometry.computeBoundingSphere();
      if (mesh.geometry.boundingSphere!.radius > 5) return true;
    }
    return false;
  },
  orientationMode: "upright",
  gridSize: null,
  surfaceOffset: 0.02,
};

const constraints: PlacementConstraints = {
  maxObjects: 200,
  minSpacing: 0.5,
  exclusionZones: [
    {
      center: [0, 0, 0],
      radius: 5,
      reason: "performer clearing",
    },
  ],
};

const autumnPlugin: SceneComposerPlugin = {
  sceneId: "forest-autumn",
  displayName: "Autumn Forest",
  catalog,
  surfaceRules,
  getDefaults(): ComposerPlacement[] {
    return [...FOREST_AUTUMN_PLACEMENTS];
  },
  constraints,
};

composerRegistry.register(autumnPlugin);

export { autumnPlugin };
```

- [ ] **Step 3: Run typecheck**

Run: `npx svelte-check --threshold error 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/3d/environments/scenes/autumn/autumn-composer-plugin.ts
git add src/lib/shared/3d/environments/scenes/autumn/placements.ts
git commit -m "feat(scene-composer): add autumn scene plugin with catalog and constraints"
```

---

### Task 13: Scene Lab Compose Mode Integration

**Files:**
- Modify: `src/lib/features/lab/tabs/scene-lab/components/ScenePreview.svelte`
- Modify: `src/lib/features/lab/tabs/scene-lab/SceneLab.svelte`

This wires Compose mode into Scene Lab. The cam-toggle gets a 4th "Compose" button. When active, GenericSceneEditor is injected inside the Canvas, and the controls pane swaps to ComposerPickerPanel.

- [ ] **Step 1: Add Compose mode to ScenePreview**

In `ScenePreview.svelte`, add imports at the top of the `<script>`:

```typescript
import GenericSceneEditor from "$lib/shared/3d/scene-composer/GenericSceneEditor.svelte";
import ComposerGhost from "$lib/shared/3d/scene-composer/ComposerGhost.svelte";
import ComposedObject from "$lib/shared/3d/scene-composer/ComposedObject.svelte";
import { composerRegistry } from "$lib/shared/3d/scene-composer/registry";
import { createComposerEditorState } from "$lib/shared/3d/scene-composer/composer-editor-state.svelte";
import { FilePersistence } from "$lib/shared/3d/scene-composer/persistence/file-persistence";
import type { ComposerPlacement } from "$lib/shared/3d/scene-composer/types";
import type { Command } from "$lib/shared/3d/scene-composer/command-stack.svelte";
```

Add the side-effect import to register the autumn plugin:

```typescript
import "$lib/shared/3d/environments/scenes/autumn/autumn-composer-plugin";
```

Change the CamMode type:

```typescript
type CamMode = "orbit" | "walk" | "fly" | "compose";
```

Add compose state after the player state:

```typescript
const composerState = createComposerEditorState();
const persistence = new FilePersistence();

const activePlugin = $derived(composerRegistry.get(labState.sceneId));
const canCompose = $derived(!!activePlugin);

$effect(() => {
  if (camMode === "compose" && activePlugin) {
    composerState.setActive(true);
    composerState.setPlacements([...activePlugin.getDefaults()]);
  } else {
    composerState.setActive(false);
  }
});

async function handleSave() {
  if (!activePlugin) return;
  await persistence.save(activePlugin.sceneId, composerState.placements);
  composerState.markClean();
}

function handlePlaceObject(placement: ComposerPlacement) {
  const cmd: Command = {
    label: `Place ${placement.objectKey}`,
    execute() { composerState.addPlacement(placement); },
    undo() { composerState.removePlacement(placement.id); },
  };
  composerState.commands.execute(cmd);
}
```

Inside the `<Canvas>`, after the scene group and before the closing `</Canvas>`, add:

```svelte
{#if camMode === "compose" && activePlugin}
  <GenericSceneEditor editorState={composerState} onSave={handleSave} />

  {#each composerState.placements as placement (placement.id)}
    {@const def = activePlugin.catalog.getDefinition(placement.objectKey)}
    {#if def}
      <ComposedObject {placement} definition={def} />
    {/if}
  {/each}

  {#if composerState.activeCatalogItem && activePlugin}
    <ComposerGhost
      definition={composerState.activeCatalogItem}
      surfaceRules={activePlugin.surfaceRules}
      constraints={activePlugin.constraints}
      existingPlacements={composerState.placements}
      onPlace={handlePlaceObject}
      onCancel={() => composerState.stopPlacement()}
    />
  {/if}
{/if}
```

In the cam-toggle div, add the Compose button after Fly:

```svelte
{#if canCompose}
  <button
    class:active={camMode === "compose"}
    onclick={() => (camMode = "compose")}
    title="Compose - place and arrange objects"
  >
    <i class="fas fa-cubes"></i> Compose
  </button>
{/if}
```

When compose mode is active, use orbit controls (not walk/fly). In the camera section, make orbit controls render when `camMode === "orbit" || camMode === "compose"`:

```svelte
{#if camMode === "orbit" || camMode === "compose"}
  <OrbitControls
    bind:ref={controlsRef}
    ...existing props...
  />
{/if}
```

And pass controlsRef to composer state after mount:

```typescript
$effect(() => {
  if (camMode === "compose" && controlsRef) {
    composerState.setOrbitControls(controlsRef);
  }
});
```

- [ ] **Step 2: Expose composerState and handlers from ScenePreview for the controls pane**

Add exports that SceneLab.svelte can bind to. The simplest approach: export the composerState and activePlugin via a context or bindable props. Since SceneLab is the parent, use bindable:

```typescript
// At the bottom of the Props or exported from the script
export { composerState, activePlugin, handleSave, camMode };
```

Actually, a cleaner approach: use Svelte context. Create a composer context file:

Create `src/lib/features/lab/tabs/scene-lab/context/scene-lab-composer-context.ts`:

```typescript
import { getContext, setContext } from "svelte";
import type { ComposerEditorState } from "$lib/shared/3d/scene-composer/composer-editor-state.svelte";
import type { SceneComposerPlugin } from "$lib/shared/3d/scene-composer/types";

const KEY = Symbol("scene-lab-composer");

interface ComposerContext {
  editorState: ComposerEditorState;
  activePlugin: SceneComposerPlugin | undefined;
  onSave: () => void;
  camMode: string;
}

export function setComposerContext(ctx: ComposerContext) {
  setContext(KEY, ctx);
}

export function getComposerContext(): ComposerContext {
  return getContext(KEY);
}
```

Then in ScenePreview, call `setComposerContext` to expose the state. In SceneLab, call `getComposerContext` to conditionally render the picker panel.

Note: The executing agent should check whether other contexts in this module use `getContext`/`setContext` (they do — `scene-lab-context.ts` exists). Follow the same pattern.

- [ ] **Step 3: Swap controls pane in SceneLab**

In `SceneLab.svelte`, add an import:

```typescript
import ComposerPickerPanel from "$lib/shared/3d/scene-composer/ComposerPickerPanel.svelte";
import { getComposerContext } from "./context/scene-lab-composer-context";
```

But wait — SceneLab is the *parent* of ScenePreview, and context flows *down*. The context set inside ScenePreview won't be readable by SceneLab (its parent). Two options:

**Option A:** Move composerState creation to SceneLab and pass it down to ScenePreview as a prop.
**Option B:** Use a module-level reactive store instead of context.

Option A is cleaner and follows the existing pattern (SceneLab creates `sceneState` and passes it via context).

**Revised approach:** Create composerState in SceneLab, pass to ScenePreview via context, read it in SceneLab for the controls pane conditional.

In `SceneLab.svelte`:

```typescript
import ComposerPickerPanel from "$lib/shared/3d/scene-composer/ComposerPickerPanel.svelte";
import { createComposerEditorState } from "$lib/shared/3d/scene-composer/composer-editor-state.svelte";
import { composerRegistry } from "$lib/shared/3d/scene-composer/registry";
import { FilePersistence } from "$lib/shared/3d/scene-composer/persistence/file-persistence";
import "$lib/shared/3d/environments/scenes/autumn/autumn-composer-plugin";

const composerState = createComposerEditorState();
const persistence = new FilePersistence();

// Provide composer state via the existing scene-lab context
// (extend setSceneLabContext to include composer state)
```

Actually, the simplest and least invasive approach: add `composerState` to the existing scene lab context object:

Modify `scene-lab-context.ts` to include an optional `composerState`:

```typescript
interface SceneLabContext {
  state: SceneLabState;
  composerState?: ComposerEditorState;
}
```

Then SceneLab creates both, ScenePreview reads from context.

The executing agent should look at `src/lib/features/lab/tabs/scene-lab/context/scene-lab-context.ts`, see the exact pattern, and extend it. The controls pane swap in `SceneLab.svelte` replaces the controls-scroll div content:

```svelte
<div class="controls-scroll">
  {#if composerState.active}
    {@const plugin = composerRegistry.get(sceneState.sceneId)}
    {#if plugin}
      <ComposerPickerPanel
        catalog={plugin.catalog}
        sceneName={plugin.displayName}
        placedCount={composerState.placements.length}
        activeItemKey={composerState.activeCatalogItem?.key ?? null}
        onSelectItem={(def) => composerState.startPlacement(def)}
        onDeselectItem={() => composerState.stopPlacement()}
        onClose={() => composerState.setActive(false)}
      />
    {/if}
  {:else if sceneState.sceneId === "winter"}
    <WinterControls />
  {:else if ...}
    ...existing controls...
  {/if}
</div>
```

Add a save button in the actions bar when composer is active:

```svelte
<div class="actions">
  {#if composerState.active}
    <button class="action-btn" onclick={() => composerState.setActive(false)}>
      <i class="fas fa-arrow-left"></i> Controls
    </button>
    <button
      class="action-btn primary"
      class:dirty={composerState.dirty}
      onclick={async () => {
        const plugin = composerRegistry.get(sceneState.sceneId);
        if (plugin) {
          await persistence.save(plugin.sceneId, composerState.placements);
          composerState.markClean();
        }
      }}
    >
      <i class="fas fa-save"></i> Save
      {#if composerState.dirty}<span class="dot"></span>{/if}
    </button>
  {:else}
    <!-- existing Reset + Copy config buttons -->
    <button class="action-btn" onclick={handleReset}>...</button>
    <button class="action-btn primary" onclick={handleCopy}>...</button>
  {/if}
</div>
```

- [ ] **Step 4: Run typecheck**

Run: `npx svelte-check --threshold error 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 5: Run build**

Run: `npx vite build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/lab/tabs/scene-lab/
git add src/lib/shared/3d/scene-composer/
git commit -m "feat(scene-composer): integrate Compose mode into Scene Lab"
```

---

### Task 14: Museum Editor Migration to Thin Wrapper

**Files:**
- Modify: `src/lib/features/museum/components/game/MuseumSceneEditor.svelte`
- Modify: `src/lib/features/museum/state/museum-3d-editor-state.svelte.ts`

Museum editor becomes a thin wrapper that imports GenericSceneEditor, creates a museum-specific `ComposerEditorState`, and delegates. The old `museum3dEditorState` API stays intact (other museum code references it) but internally delegates to ComposerEditorState.

**Important:** This task is higher risk — museum editor is production code. The executing agent MUST verify museum editor works identically after this change by running `npm run build` and `npx svelte-check`.

- [ ] **Step 1: Update museum-3d-editor-state to wrap ComposerEditorState**

The existing `museum3dEditorState` singleton has a specific API that museum components depend on (`toggle()`, `select()`, `deselect()`, `startPlacement()`, `stopPlacement()`, etc.). Rather than rewriting all callers, keep the singleton but internally delegate to a `ComposerEditorState` instance.

Add to `museum-3d-editor-state.svelte.ts`:

```typescript
import { createComposerEditorState } from "$lib/shared/3d/scene-composer/composer-editor-state.svelte";

// Internal composer state for the generic editor
export const museumComposerState = createComposerEditorState();
```

Then proxy the existing methods to call through to `museumComposerState` where applicable. The existing methods stay for backwards compatibility — but the gizmo mode, selection, and active state are now backed by the shared state.

The executing agent should read all consumers of `museum3dEditorState` (grep for it) to ensure no breakage. Key consumers:
- `MuseumSceneEditor.svelte` — will become thin wrapper
- `PlacementGhost.svelte` — reads `placementDef`, `ghostValid`
- `PlacementPickerPanel.svelte` — reads/writes `placementDef`
- `museum-3d-editor-state.svelte.ts` — the state itself

Since museum still uses `PlaceableObjectDef` (not `ObjectDefinition`), and the picker/ghost reference museum-specific types, the museum components should continue working unchanged. Only `MuseumSceneEditor.svelte` gets rewritten to use `GenericSceneEditor` internally.

Actually — on reflection, the museum migration is NOT required for Phase 1. Phase 1 goal is: Scene Composer works in Scene Lab for Autumn. Museum editor stays as-is. Museum migration happens in Phase 2 or later to reduce code duplication.

**Revised:** Skip museum migration for now. The generic editor is independently functional. Museum and composer share the same patterns but don't need to share code yet. When 3+ scenes use the composer, the museum migration pays for itself.

- [ ] **Step 2: (Skipped — deferred to Phase 2)**

- [ ] **Step 3: Commit if any changes were made**

If any bridge code was added to museum-3d-editor-state, commit it. Otherwise this task is a no-op for Phase 1.

---

### Task 15: Cleanup + Final Verification

**Files:**
- Delete: `src/lib/shared/3d/environments/scenes/autumn/ProceduralAutumnTree.svelte` (dead code, 235 lines, no imports)

- [ ] **Step 1: Verify ProceduralAutumnTree is unused**

Run: `grep -r "ProceduralAutumnTree" src/ --include="*.svelte" --include="*.ts" -l`
Expected: Only the file itself appears (no imports)

- [ ] **Step 2: Delete the dead code**

```bash
rm src/lib/shared/3d/environments/scenes/autumn/ProceduralAutumnTree.svelte
```

- [ ] **Step 3: Run full typecheck**

Run: `npx svelte-check --threshold error 2>&1 | tail -10`
Expected: 0 errors

- [ ] **Step 4: Run full build**

Run: `npx vite build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 5: Run all tests**

Run: `npx vitest run src/lib/shared/3d/scene-composer/ 2>&1 | tail -15`
Expected: All tests pass (registry: 4, command-stack: 5, file-persistence: 2)

- [ ] **Step 6: Commit**

```bash
git rm src/lib/shared/3d/environments/scenes/autumn/ProceduralAutumnTree.svelte
git commit -m "chore: delete dead ProceduralAutumnTree.svelte (replaced by InstancedMesh)"
```

- [ ] **Step 7: Clean up temp files from prior session**

```bash
rm -f autumn-scene-plan.html
git add -u autumn-scene-plan.html 2>/dev/null || true
```

---

## Self-Review

**Spec coverage check:**

| Spec Section | Task(s) |
|---|---|
| Plugin contract (§1) | Task 1 |
| Catalog system (§2) | Task 1 (types) + Task 12 (autumn implementation) |
| Surface rules (§3) | Task 1 (types) + Task 12 (autumn implementation) |
| Placement constraints (§4) | Task 1 (types) + Task 12 (autumn implementation) |
| Registry (§5) | Task 2 |
| Generic scene editor (§6) | Task 11 |
| Placement ghost (§7) | Task 9 |
| Picker panel (§8) | Task 10 |
| Undo/redo (§9) | Task 3 |
| Persistence (§10) | Task 6 |
| Vite endpoint (§11) | Task 7 |
| Scene Lab integration (§12) | Task 13 |
| ComposedObject renderer (§13) | Task 8 |
| Museum migration (§14) | Task 14 (deferred — not required for Phase 1) |

**Placeholder scan:** No TBDs, TODOs, or "implement later" found.

**Type consistency:** `ComposerPlacement` used consistently across all tasks. `ObjectDefinition` referenced from existing `object-catalog.ts` throughout. `ComposerEditorState` factory return type used by GenericSceneEditor and ScenePreview. `Command` interface from command-stack.svelte.ts used by GenericSceneEditor.

**Notes for executing agent:**
- Task 4 has a `require("three")` in `select`/`panTarget` — verify whether top-level `import { Vector3 } from "three"` works in `.svelte.ts` files in this codebase. If it does, use that instead.
- Task 13 is the most complex — read existing context pattern carefully before modifying.
- Task 14 is explicitly deferred. Don't touch museum editor code.
