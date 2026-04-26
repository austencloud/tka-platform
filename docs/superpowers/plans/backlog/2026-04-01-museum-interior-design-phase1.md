# Museum Interior Design Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the infrastructure for readable in-game plaques, a museum design validator, and dev whiteboards — then prove it works by designing the Entrance Lobby.

**Architecture:** Canvas-to-texture plaque rendering via OffscreenCanvas mapped to Three.js meshes. A design validator service that lints exhibit placement against museum design rules. Dev whiteboards auto-placed on anchor walls. TV display system is Phase 2 (separate plan).

**Tech Stack:** Svelte 5, Three.js (via @threlte/core), TypeScript, ITI dependency injection, OffscreenCanvas API.

**Spec:** `docs/superpowers/specs/2026-04-01-museum-interior-design-system.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/features/museum-2d/domain/layout-types.ts` | Add `size`, `group`, `isAnchor` to ExhibitPlacement; add `ScreenPlacement`, `devNotes` to RoomNode |
| Modify | `src/lib/features/museum-2d/domain/museum-grid-types.ts` | Add `"sequence-screen"` to TileType union |
| Modify | `src/lib/features/museum-2d/domain/tile-registry.ts` | Add `"sequence-screen"` tile metadata |
| Create | `src/lib/features/museum-2d/domain/museum-design-rules.ts` | Design rule constants (corner distance, clearance, coverage %) |
| Create | `src/lib/features/museum-2d/services/contracts/IPlaqueTextureGenerator.ts` | Interface for plaque texture generation |
| Create | `src/lib/features/museum-2d/services/implementations/PlaqueTextureGenerator.ts` | Canvas-to-texture plaque rendering |
| Create | `src/lib/features/museum-2d/components/game/MuseumPlaque3D.svelte` | Individual plaque 3D component (replaces InstancedMesh) |
| Modify | `src/lib/features/museum-2d/components/game/Museum3DScene.svelte` | Remove exhibit InstancedMesh, render MuseumPlaque3D components |
| Create | `src/lib/features/museum-2d/services/contracts/IMuseumDesignValidator.ts` | Interface for design validator |
| Create | `src/lib/features/museum-2d/services/implementations/MuseumDesignValidator.ts` | Validates exhibit placement against museum design rules |
| Modify | `src/lib/features/museum-2d/services/implementations/MuseumGridBuilder.ts` | Auto-place dev whiteboards, pass edge data for entrance detection |
| Modify | `src/lib/features/museum-2d/data/museum-room-graph.ts` | Add `devNotes` to Entrance Lobby, add `isAnchor`/`group` to exhibits |
| Create | `tests/unit/museum/PlaqueTextureGenerator.test.ts` | Tests for canvas text layout logic |
| Create | `tests/unit/museum/MuseumDesignValidator.test.ts` | Tests for each validation rule |

---

### Task 1: Data Model Changes

**Files:**
- Modify: `src/lib/features/museum-2d/domain/layout-types.ts`
- Modify: `src/lib/features/museum-2d/domain/museum-grid-types.ts`
- Modify: `src/lib/features/museum-2d/domain/tile-registry.ts`
- Create: `src/lib/features/museum-2d/domain/museum-design-rules.ts`

- [ ] **Step 1: Add new fields to ExhibitPlacement in layout-types.ts**

```typescript
export interface ExhibitPlacement {
  wall: "north" | "south" | "east" | "west";
  position: number;
  refId: string;
  facing: Direction;
  size?: "standard" | "large" | "dev-whiteboard";
  group?: string;
  isAnchor?: boolean;
}
```

- [ ] **Step 2: Add ScreenPlacement type and devNotes to RoomNode in layout-types.ts**

```typescript
export type ScreenDecade = "1940s" | "1950s" | "1960s" | "1970s" | "1980s" | "1990s" | "2000s" | "2010s" | "2020s";

export interface ScreenPlacement {
  wall: "north" | "south" | "east" | "west";
  position: number;
  refId: string;
  facing: Direction;
  decade: ScreenDecade;
  sequenceId?: string;
}

export interface RoomNode {
  id: string;
  name: string;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  material: FloorMaterial;
  theme: WingTheme;
  description?: string;
  devNotes?: string;
  exhibits?: ExhibitPlacement[];
  performers?: PerformerPlacement[];
  torches?: TorchPlacement[];
  screens?: ScreenPlacement[];
}
```

Also add `devNotes` and `screens` to `PlacedRoom` so they carry through the layout engine.

- [ ] **Step 3: Add "sequence-screen" to TileType union in museum-grid-types.ts**

Find the `TileType` union and add `"sequence-screen"` to it.

- [ ] **Step 4: Add "sequence-screen" to tile-registry.ts**

```typescript
"sequence-screen": { walkable: false, interactable: true, solid: true, renders3D: true, cssClass: "tile-screen", label: "Screen", icon: "fa-tv" },
```

- [ ] **Step 5: Create museum-design-rules.ts with constants**

```typescript
// src/lib/features/museum-2d/domain/museum-design-rules.ts

export const DESIGN_RULES = {
  /** Minimum tiles between an exhibit and a room corner */
  cornerAvoidance: 1,
  /** Minimum tiles between an exhibit and a doorway opening */
  entranceClearance: 2,
  /** Minimum tiles between two exhibits (unless grouped) */
  exhibitSpacing: 2,
  /** Maximum percentage of wall tiles that can be exhibits */
  maxWallCoverage: 0.7,
  /** Dev whiteboards enabled (set false for production) */
  devWhiteboards: true,
} as const;

export const OPPOSITE_WALL: Record<string, string> = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
};
```

- [ ] **Step 6: Run typecheck**

Run: `npx svelte-check --output machine 2>&1 | grep -c ERROR`
Expected: Same count as before (no new errors). The `PlacedRoom` change may require updating `GraphLayoutEngine.createPlacedRoom` to pass through `devNotes` and `screens`.

- [ ] **Step 7: Fix any propagation issues in GraphLayoutEngine and MuseumGridBuilder**

The `createPlacedRoom` method in `GraphLayoutEngine.ts` copies fields from `RoomNode` to `PlacedRoom`. Add `devNotes` and `screens` to that copy.

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/museum-2d/domain/
git add src/lib/features/museum-2d/services/implementations/GraphLayoutEngine.ts
git add src/lib/features/museum-2d/services/implementations/MuseumGridBuilder.ts
git commit -m "feat(museum): add data model for plaque sizes, screen placements, dev notes, and design rules"
```

Also add `size?: PlaqueSize` to `ExhibitDefinition` in `museum-grid-types.ts` and propagate it in `MuseumGridBuilder.placeExhibits` so the 3D renderer can read it. Without this, plaque sizing would silently default to `"standard"` for everything.

---

### Task 2: PlaqueTextureGenerator Service

**Files:**
- Create: `src/lib/features/museum-2d/services/contracts/IPlaqueTextureGenerator.ts`
- Create: `src/lib/features/museum-2d/services/implementations/PlaqueTextureGenerator.ts`
- Create: `tests/unit/museum/PlaqueTextureGenerator.test.ts`

- [ ] **Step 1: Write test for plaque texture generation**

```typescript
// tests/unit/museum/PlaqueTextureGenerator.test.ts
import { describe, it, expect } from "vitest";
import { PlaqueTextureGenerator } from "$lib/features/museum-2d/services/implementations/PlaqueTextureGenerator";

describe("PlaqueTextureGenerator", () => {
  it("returns canvas dimensions matching standard plaque size", () => {
    const generator = new PlaqueTextureGenerator();
    const result = generator.generateCanvas({
      title: "Test Title",
      body: "Test body text",
    }, "standard");
    expect(result.width).toBe(512);
    expect(result.height).toBe(768);
  });

  it("returns larger canvas for large plaque size", () => {
    const generator = new PlaqueTextureGenerator();
    const result = generator.generateCanvas({
      title: "Large Test",
      body: "Large body",
    }, "large");
    expect(result.width).toBe(1024);
    expect(result.height).toBe(768);
  });

  it("returns whiteboard dimensions for dev-whiteboard size", () => {
    const generator = new PlaqueTextureGenerator();
    const result = generator.generateCanvas({
      title: "Dev Notes",
      body: "TODO list here",
    }, "dev-whiteboard");
    expect(result.width).toBe(2048);
    expect(result.height).toBe(1536);
  });

  it("caches textures by refId", () => {
    const generator = new PlaqueTextureGenerator();
    const content = { title: "Cached", body: "Content" };
    const a = generator.generateCanvas(content, "standard", "ref-1");
    const b = generator.generateCanvas(content, "standard", "ref-1");
    expect(a).toBe(b); // same reference
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/museum/PlaqueTextureGenerator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create IPlaqueTextureGenerator interface**

```typescript
// src/lib/features/museum-2d/services/contracts/IPlaqueTextureGenerator.ts

export interface PlaqueContent {
  title: string;
  subtitle?: string;
  body: string;
  footer?: string;
}

export type PlaqueSize = "standard" | "large" | "dev-whiteboard";

export interface IPlaqueTextureGenerator {
  generateCanvas(content: PlaqueContent, size: PlaqueSize, cacheKey?: string): OffscreenCanvas;
}
```

- [ ] **Step 4: Implement PlaqueTextureGenerator**

```typescript
// src/lib/features/museum-2d/services/implementations/PlaqueTextureGenerator.ts

import type { IPlaqueTextureGenerator, PlaqueContent, PlaqueSize } from "../contracts/IPlaqueTextureGenerator";

const SIZE_CONFIG: Record<PlaqueSize, { width: number; height: number }> = {
  standard: { width: 512, height: 768 },
  large: { width: 1024, height: 768 },
  "dev-whiteboard": { width: 2048, height: 1536 },
};

const PLAQUE_STYLE = {
  bg: "#1a1a18",
  border: "#8a7040",
  titleColor: "#d4b878",
  subtitleColor: "#a89060",
  bodyColor: "#c8b898",
  footerColor: "#887050",
  titleFont: 'bold 36px Georgia, "Times New Roman", serif',
  subtitleFont: 'italic 22px Georgia, "Times New Roman", serif',
  bodyFont: '20px Georgia, "Times New Roman", serif',
  footerFont: '16px Georgia, "Times New Roman", serif',
};

const WHITEBOARD_STYLE = {
  bg: "#f0f0e8",
  border: "#ccccbb",
  titleColor: "#1a1a1a",
  subtitleColor: "#333333",
  bodyColor: "#2a2a2a",
  footerColor: "#555555",
  titleFont: 'bold 40px Consolas, "Courier New", monospace',
  subtitleFont: '24px Consolas, "Courier New", monospace',
  bodyFont: '22px Consolas, "Courier New", monospace',
  footerFont: '18px Consolas, "Courier New", monospace',
};

export class PlaqueTextureGenerator implements IPlaqueTextureGenerator {
  private cache = new Map<string, OffscreenCanvas>();

  generateCanvas(content: PlaqueContent, size: PlaqueSize, cacheKey?: string): OffscreenCanvas {
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    const { width, height } = SIZE_CONFIG[size];
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    const style = size === "dev-whiteboard" ? WHITEBOARD_STYLE : PLAQUE_STYLE;
    const padding = Math.floor(width * 0.06);

    // Background
    ctx.fillStyle = style.bg;
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, width - 12, height - 12);

    let y = padding + 10;
    const maxTextWidth = width - padding * 2;

    // Title
    ctx.fillStyle = style.titleColor;
    ctx.font = style.titleFont;
    y = this.wrapText(ctx, content.title, padding, y, maxTextWidth, 42);
    y += 12;

    // Subtitle
    if (content.subtitle) {
      ctx.fillStyle = style.subtitleColor;
      ctx.font = style.subtitleFont;
      y = this.wrapText(ctx, content.subtitle, padding, y, maxTextWidth, 28);
      y += 16;
    }

    // Divider line
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    y += 16;

    // Body
    ctx.fillStyle = style.bodyColor;
    ctx.font = style.bodyFont;
    y = this.wrapText(ctx, content.body, padding, y, maxTextWidth, 26);

    // Footer (anchored near bottom)
    if (content.footer) {
      ctx.fillStyle = style.footerColor;
      ctx.font = style.footerFont;
      const footerY = Math.max(y + 20, height - padding - 20);
      this.wrapText(ctx, content.footer, padding, footerY, maxTextWidth, 22);
    }

    if (cacheKey) {
      this.cache.set(cacheKey, canvas);
    }
    return canvas;
  }

  private wrapText(
    ctx: OffscreenCanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
  ): number {
    // Split on explicit newlines first, then word-wrap each line
    const paragraphs = text.split("\n");
    let currentY = y;

    for (const paragraph of paragraphs) {
      const words = paragraph.split(" ");
      let line = "";

      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line) {
          ctx.fillText(line, x, currentY);
          currentY += lineHeight;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        ctx.fillText(line, x, currentY);
        currentY += lineHeight;
      }
    }
    return currentY;
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/unit/museum/PlaqueTextureGenerator.test.ts`
Expected: PASS (all 4 tests). **Important:** `OffscreenCanvas` is not available in Node.js. Mock it in the test file:

```typescript
// At top of test file
class MockOffscreenCanvas {
  width: number;
  height: number;
  constructor(w: number, h: number) { this.width = w; this.height = h; }
  getContext() {
    return {
      fillStyle: "", strokeStyle: "", lineWidth: 0, font: "",
      fillRect: () => {}, strokeRect: () => {}, fillText: () => {},
      beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
      measureText: () => ({ width: 0 }),
    };
  }
}
globalThis.OffscreenCanvas = MockOffscreenCanvas as any;
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/museum-2d/services/contracts/IPlaqueTextureGenerator.ts
git add src/lib/features/museum-2d/services/implementations/PlaqueTextureGenerator.ts
git add tests/unit/museum/PlaqueTextureGenerator.test.ts
git commit -m "feat(museum): add PlaqueTextureGenerator with canvas-to-texture rendering"
```

---

### Task 3: MuseumPlaque3D Component

**Files:**
- Create: `src/lib/features/museum-2d/components/game/MuseumPlaque3D.svelte`
- Modify: `src/lib/features/museum-2d/components/game/Museum3DScene.svelte`

- [ ] **Step 1: Create MuseumPlaque3D.svelte**

A Threlte component that renders a single plaque as a textured mesh with a brass frame behind it. Props: world position, facing direction, plaque content, and size.

```svelte
<script lang="ts">
  import { T } from "@threlte/core";
  import {
    BoxGeometry,
    MeshStandardMaterial,
    CanvasTexture,
    NearestFilter,
  } from "three";
  import { PlaqueTextureGenerator } from "../../services/implementations/PlaqueTextureGenerator";
  import type { PlaqueContent, PlaqueSize } from "../../services/contracts/IPlaqueTextureGenerator";

  // Props defined below with shared generator instance

  const TILE_SIZE = 0.5;

  const SIZE_DIMS: Record<PlaqueSize, { w: number; h: number; d: number }> = {
    standard: { w: TILE_SIZE * 0.8, h: 1.5, d: 0.08 },
    large: { w: TILE_SIZE * 1.5, h: 1.5, d: 0.08 },
    "dev-whiteboard": { w: TILE_SIZE * 3, h: 2.5, d: 0.06 },
  };

  const dims = SIZE_DIMS[size];
  // PlaqueTextureGenerator must be a SHARED instance (not per-component)
  // to preserve the texture cache. Pass it via props from Museum3DScene.
  interface Props {
    worldX: number;
    worldZ: number;
    yaw: number;
    wallOffsetX: number;
    wallOffsetZ: number;
    content: PlaqueContent;
    size: PlaqueSize;
    refId: string;
    generator: PlaqueTextureGenerator;  // shared instance from parent
  }

  let { worldX, worldZ, yaw, wallOffsetX, wallOffsetZ, content, size, refId, generator }: Props = $props();

  const canvas = generator.generateCanvas(content, size, refId);
  const texture = new CanvasTexture(canvas);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.needsUpdate = true;

  const plaqueMat = new MeshStandardMaterial({
    map: texture,
    roughness: 0.9,
    metalness: 0.0,
  });

  const frameMat = new MeshStandardMaterial({
    color: size === "dev-whiteboard" ? "#ccccbb" : "#8a7040",
    metalness: size === "dev-whiteboard" ? 0.1 : 0.6,
    roughness: size === "dev-whiteboard" ? 0.8 : 0.4,
  });

  const plaqueGeo = new BoxGeometry(dims.w, dims.h, dims.d);
  const frameGeo = new BoxGeometry(dims.w + 0.04, dims.h + 0.04, dims.d * 0.5);

  const px = worldX + wallOffsetX;
  const pz = worldZ + wallOffsetZ;
</script>

<!-- Plaque face with texture -->
<T.Mesh
  geometry={plaqueGeo}
  material={plaqueMat}
  position.x={px}
  position.y={1.2}
  position.z={pz}
  rotation.y={yaw}
/>

<!-- Brass/whiteboard frame behind plaque -->
<T.Mesh
  geometry={frameGeo}
  material={frameMat}
  position.x={px}
  position.y={1.2}
  position.z={pz}
  rotation.y={yaw}
/>
```

- [ ] **Step 2: Modify Museum3DScene.svelte — remove exhibit InstancedMesh**

Remove the `exhibitMesh` and `frameMesh` InstancedMesh construction block (~lines 809-850 in current file). Remove `exhibitGeo` and `frameGeo` geometry creation. Remove the instanced mesh `<T>` elements for exhibits from the template.

Keep `exhibitPositions` array but change it to carry full plaque data:

```typescript
interface PlaquePlacement {
  worldX: number;
  worldZ: number;
  yaw: number;
  wallOffsetX: number;
  wallOffsetZ: number;
  content: PlaqueContent;
  size: PlaqueSize;
  refId: string;
}
const plaquePlacements: PlaquePlacement[] = [];
```

In the tile processing loop, when hitting `"exhibit-panel"`:

```typescript
case "exhibit-panel": {
  addToFloorBucket(FLOOR_COLORS.stone, worldX, worldZ);
  const facing = tile.facing ?? "south";
  const yaw = PLAQUE_YAW[facing] ?? 0;
  const wallShift = PLAQUE_WALL_SHIFT[facing] ?? { x: 0, z: 0 };

  // Find the exhibit definition to get plaque content
  const exhibit = grid.exhibits.find(e => e.tileX === tileX && e.tileY === tileY);
  if (exhibit?.plaque) {
    plaquePlacements.push({
      worldX, worldZ, yaw,
      wallOffsetX: wallShift.x,
      wallOffsetZ: wallShift.z,
      content: exhibit.plaque,
      size: (exhibit as any).size ?? "standard",
      refId: exhibit.id,
    });
  }
  break;
}
```

The `PLAQUE_YAW` and `PLAQUE_WALL_SHIFT` maps already exist from our earlier fix.

- [ ] **Step 3: Add MuseumPlaque3D to the template**

In Museum3DScene.svelte's template section, add:

```svelte
{#each plaquePlacements as plaque (plaque.refId)}
  <MuseumPlaque3D
    worldX={plaque.worldX}
    worldZ={plaque.worldZ}
    yaw={plaque.yaw}
    wallOffsetX={plaque.wallOffsetX}
    wallOffsetZ={plaque.wallOffsetZ}
    content={plaque.content}
    size={plaque.size}
    refId={plaque.refId}
  />
{/each}
```

Import MuseumPlaque3D at the top of the script.

- [ ] **Step 4: Verify build**

Run: `npx vite build 2>&1 | grep -iE "error" | head -5`
Expected: No new errors. Plaques should now render with readable text.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/museum-2d/components/game/MuseumPlaque3D.svelte
git add src/lib/features/museum-2d/components/game/Museum3DScene.svelte
git commit -m "feat(museum): replace exhibit InstancedMesh with textured MuseumPlaque3D components"
```

---

### Task 4: Museum Design Validator

**Files:**
- Create: `src/lib/features/museum-2d/services/contracts/IMuseumDesignValidator.ts`
- Create: `src/lib/features/museum-2d/services/implementations/MuseumDesignValidator.ts`
- Create: `tests/unit/museum/MuseumDesignValidator.test.ts`

- [ ] **Step 1: Write tests for each validation rule**

```typescript
// tests/unit/museum/MuseumDesignValidator.test.ts
import { describe, it, expect } from "vitest";
import { MuseumDesignValidator } from "$lib/features/museum-2d/services/implementations/MuseumDesignValidator";
import type { PlacedRoom, RoomEdge } from "$lib/features/museum-2d/domain/layout-types";
import type { MuseumGrid, MuseumTile } from "$lib/features/museum-2d/domain/museum-grid-types";

// Helper to create a minimal room
function makeRoom(overrides: Partial<PlacedRoom> = {}): PlacedRoom {
  return {
    id: "test-room", name: "Test", x: 10, y: 10, w: 20, h: 16,
    material: "stone", theme: "cave",
    exhibits: [], ...overrides,
  } as PlacedRoom;
}

function makeEdge(to: string, toWall: string): RoomEdge {
  return { from: "prev", to, type: "main-path", fromWall: "north", toWall: toWall as any, corridorWidth: 4 };
}

describe("MuseumDesignValidator", () => {
  const validator = new MuseumDesignValidator();

  it("warns when exhibit is within 1 tile of corner", () => {
    const room = makeRoom({
      exhibits: [{ wall: "north", position: 0.0, refId: "corner-test", facing: "south" }],
    });
    const violations = validator.validateRoom(room, "south");
    expect(violations.some(v => v.rule === "corner-avoidance")).toBe(true);
  });

  it("passes when exhibit is away from corners", () => {
    const room = makeRoom({
      exhibits: [{ wall: "north", position: 0.5, refId: "center-test", facing: "south" }],
    });
    const violations = validator.validateRoom(room, "south");
    expect(violations.some(v => v.rule === "corner-avoidance")).toBe(false);
  });

  it("warns when no anchor is designated (if any exhibit has isAnchor)", () => {
    const room = makeRoom({
      exhibits: [
        { wall: "north", position: 0.5, refId: "a", facing: "south", isAnchor: false },
      ],
    });
    // No exhibits have isAnchor: true, but at least one has the field set
    // The validator should skip rooms with no anchor annotations at all
    const violations = validator.validateRoom(room, "south");
    // Room has no isAnchor=true exhibits — should produce info, not warning
    expect(violations.some(v => v.rule === "anchor-presence" && v.severity === "error")).toBe(false);
  });

  it("warns when two exhibits are too close (not grouped)", () => {
    const room = makeRoom({
      w: 20, h: 16,
      exhibits: [
        { wall: "north", position: 0.45, refId: "a", facing: "south" },
        { wall: "north", position: 0.5, refId: "b", facing: "south" },
      ],
    });
    const violations = validator.validateRoom(room, "south");
    expect(violations.some(v => v.rule === "spacing")).toBe(true);
  });

  it("passes when close exhibits share a group", () => {
    const room = makeRoom({
      w: 20, h: 16,
      exhibits: [
        { wall: "north", position: 0.45, refId: "a", facing: "south", group: "tablets" },
        { wall: "north", position: 0.5, refId: "b", facing: "south", group: "tablets" },
      ],
    });
    const violations = validator.validateRoom(room, "south");
    expect(violations.some(v => v.rule === "spacing")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/museum/MuseumDesignValidator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create IMuseumDesignValidator interface**

```typescript
// src/lib/features/museum-2d/services/contracts/IMuseumDesignValidator.ts

export interface DesignViolation {
  roomId: string;
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  exhibitRefId?: string;
}

export interface IMuseumDesignValidator {
  validateRoom(room: PlacedRoom, entranceWall: string): DesignViolation[];
  validateAll(rooms: PlacedRoom[], edges: RoomEdge[]): DesignViolation[];
}
```

(Import PlacedRoom and RoomEdge from layout-types.)

- [ ] **Step 4: Implement MuseumDesignValidator**

Implement each rule from the spec:
- `corner-avoidance`: compute tile position, check distance from room corners
- `entrance-clearance`: compute doorway center tile, check exhibit distance from it
- `wall-backed`: check tile behind exhibit is a wall (needs grid tiles — this rule runs in `validateAll` which receives the grid)
- `anchor-presence`: check if any exhibit has `isAnchor: true` (skip if no exhibits have the field at all)
- `anchor-placement`: check anchor is on the opposite wall from entrance
- `spacing`: compute pairwise distances between exhibits, skip pairs in same group
- `wall-coverage`: count exhibit tiles per wall, compare to wall length
- `sightline`: tile-based raycast from entrance center to anchor tile

The `validateRoom` method handles rules that only need room data. The `validateAll` method adds rules that need the grid (wall-backed) and edge data (entrance detection).

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/unit/museum/MuseumDesignValidator.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/museum-2d/services/contracts/IMuseumDesignValidator.ts
git add src/lib/features/museum-2d/services/implementations/MuseumDesignValidator.ts
git add tests/unit/museum/MuseumDesignValidator.test.ts
git commit -m "feat(museum): add MuseumDesignValidator with gallery design rules"
```

---

### Task 5: Dev Whiteboard Auto-Placement

**Files:**
- Modify: `src/lib/features/museum-2d/services/implementations/MuseumGridBuilder.ts`
- Modify: `src/lib/features/museum-2d/data/museum-room-graph.ts`

- [ ] **Step 1: Add whiteboard auto-placement to MuseumGridBuilder**

After the existing `placeExhibits` / `placePerformers` / `placeTorches` calls in the `build` method, add a `placeDevWhiteboards` step:

```typescript
// After Step 4 (place room content)
if (DESIGN_RULES.devWhiteboards) {
  for (const room of layout.rooms) {
    this.placeDevWhiteboard(tiles, room, edges, exhibits);
  }
}
```

The `placeDevWhiteboard` method:
1. Finds the entrance wall for this room from the edge data
2. Computes the opposite wall (anchor wall)
3. Places a `"exhibit-panel"` tile centered on the anchor wall with `size: "dev-whiteboard"`
4. Uses the existing `hasWallBehind` check to find a valid position
5. Adds an ExhibitDefinition with the room's `devNotes` as the plaque body

- [ ] **Step 2: Add devNotes to the Entrance Lobby in museum-room-graph.ts**

```typescript
{
  id: "entrance",
  name: "Entrance Lobby",
  // ... existing fields ...
  devNotes:
    "ENTRANCE LOBBY\n" +
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
    "PURPOSE: Set the institutional tone.\n" +
    "The player's first impression.\n" +
    "\n" +
    "SPATIAL BEAT: Modest. Formal.\n" +
    "Not impressive yet.\n" +
    "\n" +
    "EXHIBITS:\n" +
    "[x] Welcome plaque (north wall)\n" +
    "[x] Guest book (south wall)\n" +
    "[ ] Redesign with anchor piece\n" +
    "\n" +
    "TONE: Bureaucratic. Sterile.\n" +
    "Visiting hours: 24/7.",
},
```

- [ ] **Step 3: Add devNotes plaque content to museum-room-content.ts**

The whiteboard's plaque content is auto-generated from `devNotes`, but we need an entry in `ROOM_CONTENT` for it. The grid builder creates this dynamically — no static entry needed. The `ExhibitDefinition` is created in the builder with the devNotes text as the plaque body.

- [ ] **Step 4: Verify build and walk the entrance**

Run: `npx vite build 2>&1 | grep -iE "error" | head -5`
Expected: No errors. The entrance lobby should now have a large white whiteboard on the north wall (opposite the south entrance).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/museum-2d/services/implementations/MuseumGridBuilder.ts
git add src/lib/features/museum-2d/data/museum-room-graph.ts
git commit -m "feat(museum): add dev whiteboard auto-placement with entrance lobby notes"
```

---

### Task 6: Wire Validator into Grid Build + First Room Pass

**Files:**
- Modify: `src/lib/features/museum-2d/Museum2DModule.svelte`
- Modify: `src/lib/features/museum-2d/data/museum-room-graph.ts`

- [ ] **Step 1: Run validator after grid build in Museum2DModule.svelte**

In the module's grid build section, after `buildMuseumGrid`:

```typescript
import { MuseumDesignValidator } from "./services/implementations/MuseumDesignValidator";
import { MUSEUM_EDGES } from "./data/museum-room-graph";

const { grid: generatedGrid, validation } = buildMuseumGrid(MUSEUM_ROOMS, MUSEUM_EDGES, GRID_CONFIG);

// Design validation (dev only)
if (import.meta.env.DEV) {
  const designValidator = new MuseumDesignValidator();
  const placedRooms = generatedGrid.wings.map(w => ({ ...w, id: w.id })); // adapt wing data
  const violations = designValidator.validateAll(MUSEUM_ROOMS, MUSEUM_EDGES, generatedGrid);
  if (violations.length > 0) {
    console.group("🏛️ Museum Design Violations");
    for (const v of violations) {
      const icon = v.severity === "error" ? "❌" : v.severity === "warning" ? "⚠️" : "ℹ️";
      console.log(`${icon} [${v.roomId}] ${v.rule}: ${v.message}`);
    }
    console.groupEnd();
  }
}
```

- [ ] **Step 2: Add isAnchor and group to Entrance Lobby exhibits**

```typescript
exhibits: [
  {
    wall: "north",
    position: 0.5,
    refId: "entrance-welcome",
    facing: "south",
    isAnchor: true,  // anchor piece, opposite entrance (south)
  },
  {
    wall: "south",
    position: 0.5,
    refId: "entrance-guest-book",
    facing: "north",
  },
],
```

- [ ] **Step 3: Run the app, check console for violations**

Open the museum in the browser (localhost:5173), open dev console, look for "Museum Design Violations" group. Fix any violations for the Entrance Lobby.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/museum-2d/Museum2DModule.svelte
git add src/lib/features/museum-2d/data/museum-room-graph.ts
git commit -m "feat(museum): wire design validator into grid build, annotate entrance lobby"
```

---

## Execution Notes

- **Task 1** (data model) has no dependencies and unblocks everything else.
- **Tasks 2-4** (plaque generator, plaque component, validator) are independent and can run in parallel.
- **Task 5** (whiteboard) depends on Tasks 1 + 2 (needs data model + texture generator).
- **Task 6** (wiring) depends on all previous tasks.
- After Task 6, the user walks the Entrance Lobby and gives feedback. Remaining rooms are designed iteratively using these tools.
- TV display system is a separate Phase 2 plan.
