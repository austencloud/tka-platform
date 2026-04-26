# Museum Floor Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Kinetic Archive as one continuous walkable 2D tile grid — 16 rooms, corridors, and easter eggs.

**Architecture:** A single `buildFullMuseum(): MuseumGrid` function in `data/museum-floor-plan.ts` constructs the entire grid using helper functions that stamp rooms and corridors at absolute positions. The existing `Museum2DModule.svelte` swaps from `buildDiscoveryChamber()` to `buildFullMuseum()`. No rendering changes needed — the existing walker handles any grid.

**Tech Stack:** TypeScript, Svelte 5, existing museum-2d module infrastructure

**Spec:** `docs/superpowers/specs/2026-03-28-museum-floor-plan-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/features/museum-2d/data/museum-floor-plan.ts` | Create | `buildFullMuseum()` + room stamping helpers |
| `src/lib/features/museum-2d/Museum2DModule.svelte` | Modify | Replace `buildDiscoveryChamber()` with `buildFullMuseum()` |
| `src/lib/features/museum-2d/components/game/MuseumTileRenderer.svelte` | Modify | Add CSS for `rope`, `scaffolding`, `sign` tile types |
| `src/lib/features/museum-2d/domain/museum-grid-types.ts` | Already done | New tile types and themes already added |
| `src/lib/features/museum-2d/domain/tile-registry.ts` | Already done | New tile metadata already registered |
| `tests/unit/museum-2d/MuseumFloorPlan.test.ts` | Create | Validates grid integrity |

---

### Task 1: Grid Builder Helpers

**Files:**
- Create: `src/lib/features/museum-2d/data/museum-floor-plan.ts`
- Test: `tests/unit/museum-2d/MuseumFloorPlan.test.ts`

Build the low-level helpers that stamp rooms and corridors onto an absolute-coordinate tile map. These are the building blocks for every room.

- [ ] **Step 1: Write tests for stampRoom helper**

```typescript
// tests/unit/museum-2d/MuseumFloorPlan.test.ts
import { describe, it, expect } from "vitest";
import type { MuseumTile } from "$lib/features/museum-2d/domain/museum-grid-types";
import { tileKey } from "$lib/features/museum-2d/domain/museum-grid-types";

// We'll import these once they exist
// import { stampRoom, stampCorridor, carveDoor } from "$lib/features/museum-2d/data/museum-floor-plan";

describe("Museum Floor Plan Helpers", () => {
  it("stampRoom creates walls on edges and floor inside", () => {
    const tiles = new Map<string, MuseumTile>();
    stampRoom(tiles, 10, 20, 6, 4, "stone");

    // Corners are walls
    expect(tiles.get(tileKey(10, 20))?.type).toBe("wall");
    expect(tiles.get(tileKey(15, 23))?.type).toBe("wall");

    // Interior is floor
    expect(tiles.get(tileKey(12, 21))?.type).toBe("floor");
    expect(tiles.get(tileKey(12, 21))?.material).toBe("stone");

    // Total: 6*4 = 24 tiles
    expect(tiles.size).toBe(24);
  });

  it("stampCorridor fills a rectangle with corridor tiles and walls on long edges", () => {
    const tiles = new Map<string, MuseumTile>();
    stampCorridor(tiles, 5, 10, 4, 8, "vertical", "marble");

    // Side walls (x=5 and x=8) are walls
    expect(tiles.get(tileKey(5, 12))?.type).toBe("wall");
    expect(tiles.get(tileKey(8, 12))?.type).toBe("wall");

    // Interior is corridor
    expect(tiles.get(tileKey(6, 12))?.type).toBe("corridor");
    expect(tiles.get(tileKey(6, 12))?.material).toBe("marble");
  });

  it("carveDoor replaces wall tiles with door tiles", () => {
    const tiles = new Map<string, MuseumTile>();
    stampRoom(tiles, 0, 0, 10, 10, "stone");

    // South wall center: x=4,5 at y=9
    carveDoor(tiles, 4, 9, 2, "horizontal");

    expect(tiles.get(tileKey(4, 9))?.type).toBe("door");
    expect(tiles.get(tileKey(5, 9))?.type).toBe("door");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/museum-2d/MuseumFloorPlan.test.ts`
Expected: FAIL — functions not found

- [ ] **Step 3: Implement the helpers**

```typescript
// src/lib/features/museum-2d/data/museum-floor-plan.ts
import type {
  MuseumTile,
  MuseumGrid,
  FloorMaterial,
  Direction,
  WingRegion,
  ExhibitDefinition,
  PerformerDefinition,
  TriggerDefinition,
  WingTheme,
} from "../domain/museum-grid-types";
import { tileKey } from "../domain/museum-grid-types";

// ── Helpers ──

/** Stamp a rectangular room: walls on edges, floor inside. */
export function stampRoom(
  tiles: Map<string, MuseumTile>,
  x: number, y: number, w: number, h: number,
  material: FloorMaterial,
): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const isEdge = dx === 0 || dy === 0 || dx === w - 1 || dy === h - 1;
      const key = tileKey(x + dx, y + dy);
      if (isEdge) {
        tiles.set(key, { type: "wall" });
      } else {
        tiles.set(key, { type: "floor", material });
      }
    }
  }
}

/**
 * Stamp a corridor: walls on the long edges, corridor tiles inside.
 * orientation: "vertical" = walls on left/right, "horizontal" = walls on top/bottom
 */
export function stampCorridor(
  tiles: Map<string, MuseumTile>,
  x: number, y: number, w: number, h: number,
  orientation: "vertical" | "horizontal",
  material: FloorMaterial,
): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const key = tileKey(x + dx, y + dy);
      const isWall = orientation === "vertical"
        ? (dx === 0 || dx === w - 1)
        : (dy === 0 || dy === h - 1);
      if (isWall) {
        tiles.set(key, { type: "wall" });
      } else {
        tiles.set(key, { type: "corridor", material });
      }
    }
  }
}

/** Replace existing tiles at a position with door tiles. */
export function carveDoor(
  tiles: Map<string, MuseumTile>,
  x: number, y: number,
  length: number,
  orientation: "horizontal" | "vertical",
): void {
  for (let i = 0; i < length; i++) {
    const dx = orientation === "horizontal" ? i : 0;
    const dy = orientation === "vertical" ? i : 0;
    tiles.set(tileKey(x + dx, y + dy), { type: "door" });
  }
}

/** Place a single tile, overwriting whatever was there. */
export function placeTile(
  tiles: Map<string, MuseumTile>,
  x: number, y: number,
  tile: MuseumTile,
): void {
  tiles.set(tileKey(x, y), tile);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/museum-2d/MuseumFloorPlan.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/museum-2d/data/museum-floor-plan.ts tests/unit/museum-2d/MuseumFloorPlan.test.ts
git commit -m "feat(museum-2d): add grid builder helpers for full floor plan"
```

---

### Task 2: Build the Main Path Rooms (Entrance through Suppression)

**Files:**
- Modify: `src/lib/features/museum-2d/data/museum-floor-plan.ts`
- Test: `tests/unit/museum-2d/MuseumFloorPlan.test.ts`

Build the first 7 Order-era rooms and their connecting corridors. Each room is stamped at its absolute position per the spec, then doors are carved and exhibit placeholders placed.

- [ ] **Step 1: Write integration test for main path connectivity**

```typescript
// Add to tests/unit/museum-2d/MuseumFloorPlan.test.ts
import { buildFullMuseum } from "$lib/features/museum-2d/data/museum-floor-plan";
import { isWalkable } from "$lib/features/museum-2d/domain/tile-registry";

describe("Full Museum Grid", () => {
  const grid = buildFullMuseum();

  it("has expected dimensions", () => {
    expect(grid.width).toBe(150);
    expect(grid.height).toBe(220);
  });

  it("spawn point is on a walkable tile", () => {
    const spawnTile = grid.tiles.get(tileKey(grid.spawn.x, grid.spawn.y));
    expect(spawnTile).toBeDefined();
    expect(isWalkable(spawnTile!.type)).toBe(true);
  });

  it("has all 16 wing regions defined", () => {
    expect(grid.wings.length).toBeGreaterThanOrEqual(16);
  });

  it("has exhibits in the Vulcan Cave", () => {
    const caveExhibits = grid.exhibits.filter(
      (e) => e.id.startsWith("cave-")
    );
    expect(caveExhibits.length).toBeGreaterThanOrEqual(2);
  });

  it("main path rooms have walkable floors", () => {
    // Check a floor tile inside each major room
    const samplePoints = [
      { x: 80, y: 205, name: "Lobby" },       // inside Entrance Lobby
      { x: 80, y: 175, name: "Cave" },         // inside Vulcan Cave
      { x: 110, y: 145, name: "Egyptian" },     // inside Egyptian Wing
      { x: 108, y: 175, name: "Renaissance" },  // inside Renaissance Wing
      { x: 72, y: 174, name: "Victorian" },      // inside Victorian Wing
      { x: 62, y: 143, name: "Digital" },        // inside Digital Wing
      { x: 60, y: 110, name: "Suppression" },   // inside Suppression
    ];
    for (const pt of samplePoints) {
      const tile = grid.tiles.get(tileKey(pt.x, pt.y));
      expect(tile, `${pt.name} at (${pt.x},${pt.y})`).toBeDefined();
      expect(
        isWalkable(tile!.type),
        `${pt.name} tile type ${tile!.type} should be walkable`
      ).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/museum-2d/MuseumFloorPlan.test.ts`
Expected: FAIL — `buildFullMuseum` not exported or rooms not built

- [ ] **Step 3: Implement buildFullMuseum with Order-era rooms**

Add to `museum-floor-plan.ts`:

```typescript
export function buildFullMuseum(): MuseumGrid {
  const tiles = new Map<string, MuseumTile>();
  const wings: WingRegion[] = [];
  const exhibits: ExhibitDefinition[] = [];
  const performers: PerformerDefinition[] = [];
  const triggers: TriggerDefinition[] = [];

  // ── Entrance Lobby ──
  stampRoom(tiles, 68, 197, 24, 16, "marble");
  carveDoor(tiles, 77, 212, 6, "horizontal"); // south entrance
  carveDoor(tiles, 78, 197, 4, "horizontal"); // north to corridor
  placeTile(tiles, 80, 208, { type: "pedestal", refId: "guest-book" });
  placeTile(tiles, 78, 198, { type: "sign", refId: "welcome-sign" });
  wings.push({ id: "entrance", name: "Entrance Lobby", bounds: { x: 68, y: 197, width: 24, height: 16 }, theme: "institutional" });

  // ── Corridor: Lobby → Cave ──
  stampCorridor(tiles, 78, 189, 4, 9, "vertical", "stone");
  carveDoor(tiles, 78, 197, 4, "horizontal"); // overlap with lobby north wall
  carveDoor(tiles, 78, 189, 4, "horizontal"); // overlap with cave south wall

  // ── Vulcan Cave ──
  stampRoom(tiles, 65, 161, 30, 29, "stone");
  carveDoor(tiles, 78, 189, 4, "horizontal"); // south door
  carveDoor(tiles, 88, 161, 4, "horizontal"); // north-east door to Egyptian corridor
  // Torches
  placeTile(tiles, 67, 163, { type: "torch" });
  placeTile(tiles, 92, 163, { type: "torch" });
  placeTile(tiles, 67, 185, { type: "torch" });
  placeTile(tiles, 92, 185, { type: "torch" });
  placeTile(tiles, 80, 170, { type: "torch" });
  placeTile(tiles, 80, 180, { type: "torch" });
  // Exhibits
  for (let x = 78; x <= 81; x++) {
    placeTile(tiles, x, 162, { type: "exhibit-panel", refId: "cave-lascaux", facing: "south" });
  }
  placeTile(tiles, 76, 164, { type: "pedestal", refId: "cave-tablet-1" });
  placeTile(tiles, 83, 164, { type: "pedestal", refId: "cave-tablet-2" });
  // Performers
  placeTile(tiles, 78, 167, { type: "performer-station", refId: "cave-performer", facing: "south" });
  placeTile(tiles, 81, 167, { type: "performer-station", refId: "cave-performer", facing: "south" });

  wings.push({ id: "cave", name: "Vulcan Cave", bounds: { x: 65, y: 161, width: 30, height: 29 }, theme: "cave" });
  exhibits.push({
    id: "cave-lascaux", tileX: 79, tileY: 162,
    plaque: {
      title: "The Lascaux Tablets",
      subtitle: "c. 35,000 BCE (replica)",
      body: "Stone tablets recovered from a sealed chamber in the Lascaux cave system. " +
        "The markings show a four-beat sequence using burning branches. " +
        "Designated OOGA-1 by the Nomenclature Division.",
      footer: "Discovered 1979, Dr. Henri Marchand (published posthumously)",
    },
  });
  performers.push({
    id: "cave-performer", tileX: 78, tileY: 167,
    facing: "south", autoPlay: false,
  });

  // ── Corridor: Cave → Egyptian (L-shaped) ──
  // Vertical leg
  stampCorridor(tiles, 88, 153, 4, 9, "vertical", "sandstone");
  carveDoor(tiles, 88, 161, 4, "horizontal"); // overlap cave north wall
  // Horizontal leg
  stampCorridor(tiles, 88, 153, 10, 4, "horizontal", "sandstone");
  // Carve connection to Egyptian west wall
  carveDoor(tiles, 96, 153, 4, "vertical");

  // ── Egyptian Wing ──
  stampRoom(tiles, 96, 133, 28, 24, "sandstone");
  carveDoor(tiles, 96, 153, 4, "vertical"); // west door from corridor
  carveDoor(tiles, 108, 156, 4, "horizontal"); // south door to Renaissance corridor
  // Pillars
  placeTile(tiles, 104, 140, { type: "pedestal", refId: "egypt-pillar" });
  placeTile(tiles, 116, 140, { type: "pedestal", refId: "egypt-pillar" });
  placeTile(tiles, 104, 150, { type: "pedestal", refId: "egypt-pillar" });
  placeTile(tiles, 116, 150, { type: "pedestal", refId: "egypt-pillar" });
  // Exhibits
  placeTile(tiles, 110, 134, { type: "exhibit-panel", refId: "egypt-karnak", facing: "south" });
  placeTile(tiles, 97, 142, { type: "exhibit-panel", refId: "egypt-priesthood", facing: "east" });
  placeTile(tiles, 122, 142, { type: "exhibit-panel", refId: "egypt-amphora", facing: "west" });
  placeTile(tiles, 110, 155, { type: "exhibit-panel", refId: "egypt-controlled", facing: "north" });

  wings.push({ id: "egyptian", name: "Egyptian Wing", bounds: { x: 96, y: 133, width: 28, height: 24 }, theme: "classical" });
  exhibits.push({
    id: "egypt-karnak", tileX: 110, tileY: 134,
    plaque: { title: "The Karnak Scrolls", subtitle: "c. 1470 BCE",
      body: "Hieroglyphic scrolls documenting the first formal Type classification system. " +
        "Six categories of movement, organized by hand path. " +
        "The priesthood controlled access to advanced notation.",
      footer: "Translated by the Cairo Institute, 1923" },
  });

  // ── Corridor: Egyptian → Renaissance ──
  stampCorridor(tiles, 108, 156, 4, 9, "vertical", "wood");
  carveDoor(tiles, 108, 156, 4, "horizontal"); // overlap Egyptian south
  carveDoor(tiles, 108, 164, 4, "horizontal"); // overlap Renaissance north

  // ── Renaissance Wing ──
  stampRoom(tiles, 96, 164, 24, 22, "wood");
  carveDoor(tiles, 108, 164, 4, "horizontal"); // north door
  carveDoor(tiles, 96, 173, 1, "vertical"); // west door (carve 4 tiles vertically)
  carveDoor(tiles, 96, 174, 1, "vertical");
  carveDoor(tiles, 96, 175, 1, "vertical");
  carveDoor(tiles, 96, 176, 1, "vertical");
  // Exhibits
  placeTile(tiles, 108, 165, { type: "exhibit-panel", refId: "ren-codex", facing: "south" });
  placeTile(tiles, 97, 170, { type: "exhibit-panel", refId: "ren-vitruvian", facing: "east" });
  placeTile(tiles, 118, 175, { type: "exhibit-panel", refId: "ren-workshop", facing: "west" });
  placeTile(tiles, 108, 184, { type: "exhibit-panel", refId: "ren-notebooks", facing: "north" });
  placeTile(tiles, 106, 175, { type: "pedestal", refId: "ren-workbench" });

  wings.push({ id: "renaissance", name: "Renaissance Wing", bounds: { x: 96, y: 164, width: 24, height: 22 }, theme: "renaissance" });
  exhibits.push({
    id: "ren-codex", tileX: 108, tileY: 165,
    plaque: { title: "Codex Pages", subtitle: "c. 1500 CE",
      body: "Da Vinci's notebooks contain rotational diagrams that precisely match " +
        "the Kinetic Alphabet's position system. He decoded the Egyptian scrolls " +
        "and recast them as geometry.",
      footer: "Reproductions. Originals: scattered across seven collections." },
  });

  // ── Corridor: Renaissance → Victorian ──
  stampCorridor(tiles, 86, 171, 11, 4, "horizontal", "marble");
  carveDoor(tiles, 96, 173, 4, "vertical"); // overlap Renaissance west
  carveDoor(tiles, 86, 171, 4, "vertical"); // overlap Victorian east

  // ── Victorian Wing ──
  stampRoom(tiles, 58, 161, 29, 26, "marble");
  carveDoor(tiles, 86, 173, 4, "vertical"); // east door from Renaissance
  carveDoor(tiles, 62, 161, 4, "horizontal"); // north door to Digital
  carveDoor(tiles, 82, 186, 4, "horizontal"); // south-east door to Construction Zone
  // Exhibits
  placeTile(tiles, 72, 162, { type: "exhibit-panel", refId: "vic-brass", facing: "south" });
  placeTile(tiles, 59, 172, { type: "exhibit-panel", refId: "vic-patents", facing: "east" });
  placeTile(tiles, 85, 172, { type: "exhibit-panel", refId: "vic-portraits", facing: "west" });
  placeTile(tiles, 72, 185, { type: "exhibit-panel", refId: "vic-discredited", facing: "north" });
  placeTile(tiles, 72, 170, { type: "pedestal", refId: "vic-prototype" });
  placeTile(tiles, 72, 176, { type: "pedestal", refId: "vic-device" });
  // Gas lamps
  placeTile(tiles, 60, 163, { type: "torch" });
  placeTile(tiles, 84, 163, { type: "torch" });

  wings.push({ id: "victorian", name: "Victorian Wing", bounds: { x: 58, y: 161, width: 29, height: 26 }, theme: "industrial" });
  exhibits.push({
    id: "vic-brass", tileX: 72, tileY: 162,
    plaque: { title: "The Brass Notation Device", subtitle: "1871, London",
      body: "The only surviving prototype. A mechanical calculator that could " +
        "enumerate all possible four-beat sequences for a given starting position. " +
        "Patent recalled by the Home Office within six months of filing.",
      footer: "Inventor: [NAME REDACTED]" },
  });

  // ── Corridor: Victorian → Digital ──
  stampCorridor(tiles, 62, 153, 4, 9, "vertical", "stone");
  carveDoor(tiles, 62, 161, 4, "horizontal"); // overlap Victorian north
  carveDoor(tiles, 62, 153, 4, "horizontal"); // overlap Digital south

  // ── Digital Wing ──
  stampRoom(tiles, 50, 133, 24, 21, "stone");
  carveDoor(tiles, 62, 153, 4, "horizontal"); // south door
  carveDoor(tiles, 60, 133, 4, "horizontal"); // north door to Suppression
  // VTG Wing visible opening (rope barrier on west wall)
  for (let y = 140; y <= 145; y++) {
    placeTile(tiles, 50, y, { type: "rope" }); // replace west wall with rope
  }
  // Exhibits
  placeTile(tiles, 62, 134, { type: "exhibit-panel", refId: "digital-crt", facing: "south" });
  placeTile(tiles, 51, 140, { type: "exhibit-panel", refId: "digital-bbs", facing: "east" });
  placeTile(tiles, 72, 140, { type: "exhibit-panel", refId: "digital-3400", facing: "west" });
  placeTile(tiles, 62, 152, { type: "exhibit-panel", refId: "digital-team", facing: "north" });
  placeTile(tiles, 60, 143, { type: "pedestal", refId: "digital-terminal" });

  wings.push({ id: "digital", name: "Digital Wing", bounds: { x: 50, y: 133, width: 24, height: 21 }, theme: "digital" });
  exhibits.push({
    id: "digital-crt", tileX: 62, tileY: 134,
    plaque: { title: "The CRT", subtitle: "1993",
      body: "The original terminal running TKA-OS v2. One of an estimated 3,400 copies " +
        "distributed before the Bureau detected the breach. " +
        "Press E to boot the system.",
      footer: "Serial: BKC-ASSET-7741" },
  });

  // ── Corridor: Digital → Suppression ──
  stampCorridor(tiles, 60, 125, 4, 9, "vertical", "marble");
  carveDoor(tiles, 60, 133, 4, "horizontal"); // overlap Digital north
  carveDoor(tiles, 60, 125, 4, "horizontal"); // overlap Suppression south

  // ── The Suppression ──
  stampRoom(tiles, 46, 95, 30, 31, "marble");
  carveDoor(tiles, 60, 125, 4, "horizontal"); // south door
  carveDoor(tiles, 60, 95, 4, "horizontal"); // north door to Crumble
  // Exhibits — this is the big reveal room
  for (let x = 56; x <= 65; x++) {
    placeTile(tiles, x, 96, { type: "exhibit-panel", refId: "supp-order", facing: "south" });
  }
  placeTile(tiles, 47, 108, { type: "exhibit-panel", refId: "supp-lethe", facing: "east" });
  placeTile(tiles, 74, 108, { type: "exhibit-panel", refId: "supp-youve-seen", facing: "west" });
  placeTile(tiles, 60, 124, { type: "exhibit-panel", refId: "supp-may8", facing: "north" });
  placeTile(tiles, 55, 115, { type: "pedestal", refId: "supp-filing-1" });
  placeTile(tiles, 66, 115, { type: "pedestal", refId: "supp-filing-2" });

  wings.push({ id: "suppression", name: "The Suppression", bounds: { x: 46, y: 95, width: 30, height: 31 }, theme: "institutional" });
  exhibits.push({
    id: "supp-order", tileX: 60, tileY: 96,
    plaque: { title: "The Order of the Closed Palm",
      body: "Founded before recorded history. Three names across three eras: " +
        "a symbol predating language, a secret society, a government bureau. " +
        "Their mission: observe, archive, revere — but never practice. " +
        "The hand that refuses to grip.",
      footer: "Bureau of Kinetic Containment, est. classified" },
  });

  // ── Continue with remaining rooms (Task 3, 4, 5) ──

  return {
    width: 150, height: 220, tileScale: 0.5,
    tiles, wings, exhibits, performers, triggers,
    spawn: { x: 80, y: 213, facing: "north" as Direction },
  };
}
```

This is a partial implementation — it builds the 7 Order-era rooms plus corridors. Tasks 3-5 add the remaining rooms.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/museum-2d/MuseumFloorPlan.test.ts`
Expected: PASS for spawn, dimensions, cave exhibits. Some sample points may fail until remaining rooms are built (that's fine — test drives the work).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/museum-2d/data/museum-floor-plan.ts tests/unit/museum-2d/MuseumFloorPlan.test.ts
git commit -m "feat(museum-2d): build Order-era rooms (Entrance through Suppression)"
```

---

### Task 3: Build Crumble, K's Gallery, and Ending Rooms

**Files:**
- Modify: `src/lib/features/museum-2d/data/museum-floor-plan.ts`
- Test: `tests/unit/museum-2d/MuseumFloorPlan.test.ts`

Add the post-Order rooms: The Crumble (seam), K's Gallery (Scribe-built), and three sequential ending rooms (Fear → Isolation → Collaboration), plus the Gift Shop.

- [ ] **Step 1: Add tests for post-Order rooms**

```typescript
// Add to the "Full Museum Grid" describe block
it("post-Order rooms have walkable floors", () => {
  const postOrderPoints = [
    { x: 63, y: 83, name: "Crumble" },
    { x: 60, y: 58, name: "K's Gallery" },
    { x: 60, y: 28, name: "Fear" },
    { x: 92, y: 26, name: "Isolation" },
    { x: 128, y: 20, name: "Collaboration" },
    { x: 128, y: 48, name: "Gift Shop" },
  ];
  for (const pt of postOrderPoints) {
    const tile = grid.tiles.get(tileKey(pt.x, pt.y));
    expect(tile, `${pt.name} at (${pt.x},${pt.y})`).toBeDefined();
    expect(isWalkable(tile!.type), `${pt.name} should be walkable`).toBe(true);
  }
});

it("Crumble uses dirt material (decay)", () => {
  const tile = grid.tiles.get(tileKey(63, 83));
  expect(tile?.material).toBe("dirt");
});

it("Collaboration room has open edges (no north/east walls)", () => {
  // North wall of Collaboration at y=10, x=115-138 should NOT be all walls
  // (spec says no north or east walls — void = open sky)
  const northTile = grid.tiles.get(tileKey(125, 10));
  expect(northTile?.type).not.toBe("wall");
});

it("Isolation has cubicle walls inside", () => {
  // Should have wall tiles inside the room forming cubicles
  // Check for a wall tile that's NOT on the room perimeter
  const wing = grid.wings.find(w => w.id === "isolation");
  expect(wing).toBeDefined();
  // Interior wall tiles exist (cubicle dividers)
  let interiorWalls = 0;
  const b = wing!.bounds;
  for (let y = b.y + 2; y < b.y + b.height - 2; y++) {
    for (let x = b.x + 2; x < b.x + b.width - 2; x++) {
      const tile = grid.tiles.get(tileKey(x, y));
      if (tile?.type === "wall") interiorWalls++;
    }
  }
  expect(interiorWalls).toBeGreaterThan(10); // cubicle walls
});
```

- [ ] **Step 2: Run tests to verify failures**

Run: `npx vitest run tests/unit/museum-2d/MuseumFloorPlan.test.ts`
Expected: FAIL — post-Order rooms not yet built

- [ ] **Step 3: Implement remaining rooms**

Add to `buildFullMuseum()` before the return statement, replacing the `// Continue with remaining rooms` comment:

```typescript
  // ── The Crumble (The Seam) ──
  // Narrow decay corridor — the visible transition from Order to Scribe
  stampRoom(tiles, 58, 73, 8, 23, "dirt");
  carveDoor(tiles, 60, 95, 4, "horizontal"); // south — connects to Suppression north
  carveDoor(tiles, 60, 73, 4, "horizontal"); // north — connects to K's Gallery south
  // Collapsed section: half-blocked with walls mid-passage
  placeTile(tiles, 59, 82, { type: "wall" });
  placeTile(tiles, 60, 82, { type: "wall" });
  placeTile(tiles, 61, 82, { type: "wall" });
  // Abandoned filing cabinets
  placeTile(tiles, 62, 78, { type: "pedestal", refId: "crumble-cabinet-1" });
  placeTile(tiles, 62, 88, { type: "pedestal", refId: "crumble-cabinet-2" });
  placeTile(tiles, 63, 85, { type: "torch" }); // flickering half-broken

  wings.push({ id: "crumble", name: "The Crumble", bounds: { x: 58, y: 73, width: 8, height: 23 }, theme: "construction" });

  // ── K's Gallery ──
  stampRoom(tiles, 46, 45, 28, 29, "wood");
  carveDoor(tiles, 58, 73, 4, "horizontal"); // south — from Crumble
  carveDoor(tiles, 58, 45, 4, "horizontal"); // north — to Fear corridor
  // Warm, maintained torches
  placeTile(tiles, 48, 47, { type: "torch" });
  placeTile(tiles, 72, 47, { type: "torch" });
  placeTile(tiles, 48, 70, { type: "torch" });
  placeTile(tiles, 72, 70, { type: "torch" });
  // Exhibits — K's own curation
  placeTile(tiles, 58, 46, { type: "exhibit-panel", refId: "gallery-spiral", facing: "south" });
  placeTile(tiles, 47, 58, { type: "exhibit-panel", refId: "gallery-scribes", facing: "east" });
  placeTile(tiles, 72, 58, { type: "exhibit-panel", refId: "gallery-practice", facing: "west" });
  placeTile(tiles, 58, 72, { type: "exhibit-panel", refId: "gallery-k-note", facing: "north" });
  placeTile(tiles, 56, 55, { type: "pedestal", refId: "gallery-artifact-1" });
  placeTile(tiles, 64, 55, { type: "pedestal", refId: "gallery-artifact-2" });
  // Performer — first inviting exhibit
  placeTile(tiles, 60, 60, { type: "performer-station", refId: "gallery-scribe", facing: "south" });

  wings.push({ id: "gallery", name: "K's Gallery", bounds: { x: 46, y: 45, width: 28, height: 29 }, theme: "gallery" });
  exhibits.push({
    id: "gallery-spiral", tileX: 58, tileY: 46,
    plaque: { title: "The Spiral",
      body: "You've seen it throughout the museum. On floor tiles, in frame corners, " +
        "woven into decoration. Every spin is a spiral through time. " +
        "The Scribes didn't choose it. It chose them.",
      footer: "— K" },
  });
  performers.push({
    id: "gallery-scribe", tileX: 60, tileY: 60,
    facing: "south", autoPlay: false,
  });

  // ── Corridor: K's Gallery → Fear ──
  stampCorridor(tiles, 58, 37, 4, 9, "vertical", "stone");
  carveDoor(tiles, 58, 45, 4, "horizontal");
  carveDoor(tiles, 58, 37, 4, "horizontal");

  // ── Room of Fear ──
  stampRoom(tiles, 50, 19, 20, 19, "stone");
  carveDoor(tiles, 58, 37, 4, "horizontal"); // south door
  carveDoor(tiles, 69, 27, 4, "vertical"); // east door to Isolation
  // Closed Palm everywhere
  for (let x = 55; x <= 64; x += 3) {
    placeTile(tiles, x, 20, { type: "exhibit-panel", refId: "fear-containment", facing: "south" });
  }
  placeTile(tiles, 60, 36, { type: "sign", refId: "fear-warning" });

  wings.push({ id: "fear", name: "Room of Fear", bounds: { x: 50, y: 19, width: 20, height: 19 }, theme: "institutional" });
  exhibits.push({
    id: "fear-containment", tileX: 58, tileY: 20,
    plaque: { title: "CONTAINMENT PROTOCOL ACTIVE",
      body: "This knowledge is a public health hazard. Seal the archive. Walk away. " +
        "Authorized handling personnel only. Do not attempt replication. " +
        "Report exposure immediately.",
      footer: "Bureau of Kinetic Containment — Form 7741-C" },
  });

  // ── Corridor: Fear → Isolation ──
  stampCorridor(tiles, 69, 27, 9, 4, "horizontal", "marble");
  carveDoor(tiles, 69, 27, 4, "vertical"); // overlap Fear east
  carveDoor(tiles, 77, 27, 4, "vertical"); // overlap Isolation west

  // ── Room of Isolation ──
  stampRoom(tiles, 77, 15, 30, 24, "marble");
  carveDoor(tiles, 77, 25, 4, "vertical"); // west door
  carveDoor(tiles, 106, 25, 4, "vertical"); // east door to Collaboration
  // Cubicle walls: 4x3 grid of 5x5 cells inside
  for (let cellRow = 0; cellRow < 3; cellRow++) {
    for (let cellCol = 0; cellCol < 4; cellCol++) {
      const cx = 80 + cellCol * 6;
      const cy = 18 + cellRow * 6;
      // Each cubicle: south wall and east wall (open top and left for walkability)
      for (let dx = 0; dx < 5; dx++) {
        placeTile(tiles, cx + dx, cy + 4, { type: "wall" }); // south wall of cubicle
      }
      for (let dy = 0; dy < 5; dy++) {
        placeTile(tiles, cx + 4, cy + dy, { type: "wall" }); // east wall of cubicle
      }
      // Performer inside each cubicle
      placeTile(tiles, cx + 2, cy + 2, {
        type: "performer-station", refId: "isolation-spinner", facing: "south",
      });
    }
  }
  placeTile(tiles, 92, 37, { type: "sign", refId: "isolation-protocol" });

  wings.push({ id: "isolation", name: "Room of Isolation", bounds: { x: 77, y: 15, width: 30, height: 24 }, theme: "institutional" });
  triggers.push({
    id: "isolation-protocol", tileX: 92, tileY: 37,
    action: "show-lore",
    content: { title: "INDIVIDUAL CONTAINMENT PROTOCOLS",
      body: "Maintain minimum 1-meter separation. Do not make eye contact during sessions. " +
        "Report any attempt at synchronized movement immediately." },
  });

  // ── Corridor: Isolation → Collaboration ──
  stampCorridor(tiles, 106, 25, 9, 4, "horizontal", "dirt");
  carveDoor(tiles, 106, 25, 4, "vertical"); // overlap Isolation east
  carveDoor(tiles, 114, 25, 4, "vertical"); // overlap Collaboration west

  // ── Room of Collaboration ──
  // Open north and east walls (void = sky)
  stampRoom(tiles, 114, 10, 26, 22, "dirt");
  carveDoor(tiles, 114, 25, 4, "vertical"); // west door
  carveDoor(tiles, 125, 31, 4, "horizontal"); // south door to Gift Shop
  // Remove north and east walls (open sky)
  for (let x = 115; x < 139; x++) {
    tiles.delete(tileKey(x, 10)); // remove north wall
  }
  for (let y = 11; y < 31; y++) {
    tiles.delete(tileKey(139, y)); // remove east wall
  }
  // Performers — scattered, playing together
  placeTile(tiles, 120, 18, { type: "performer-station", refId: "collab-spinner-1", facing: "east" });
  placeTile(tiles, 125, 16, { type: "performer-station", refId: "collab-spinner-2", facing: "west" });
  placeTile(tiles, 130, 20, { type: "performer-station", refId: "collab-spinner-3", facing: "north" });
  placeTile(tiles, 122, 24, { type: "performer-station", refId: "collab-spinner-4", facing: "south" });
  // Wax figure with pamphlet near exit
  placeTile(tiles, 126, 29, { type: "pedestal", refId: "collab-pamphlet" });

  wings.push({ id: "collaboration", name: "Room of Collaboration", bounds: { x: 114, y: 10, width: 26, height: 22 }, theme: "outdoor" });
  performers.push(
    { id: "collab-spinner-1", tileX: 120, tileY: 18, facing: "east", autoPlay: true },
    { id: "collab-spinner-2", tileX: 125, tileY: 16, facing: "west", autoPlay: true },
    { id: "collab-spinner-3", tileX: 130, tileY: 20, facing: "north", autoPlay: true },
    { id: "collab-spinner-4", tileX: 122, tileY: 24, facing: "south", autoPlay: true },
  );

  // ── Corridor: Collaboration → Gift Shop ──
  stampCorridor(tiles, 125, 31, 4, 9, "vertical", "marble");
  carveDoor(tiles, 125, 31, 4, "horizontal");
  carveDoor(tiles, 125, 39, 4, "horizontal");

  // ── Gift Shop ──
  stampRoom(tiles, 116, 39, 22, 18, "marble");
  carveDoor(tiles, 125, 39, 4, "horizontal"); // north door
  carveDoor(tiles, 125, 56, 4, "horizontal"); // south door (EXIT)
  // Shelves (pedestals)
  for (let i = 0; i < 4; i++) {
    placeTile(tiles, 120 + i * 4, 44, { type: "pedestal", refId: "shop-shelf-" + (i + 1) });
    placeTile(tiles, 120 + i * 4, 50, { type: "pedestal", refId: "shop-shelf-" + (i + 5) });
  }
  placeTile(tiles, 118, 41, { type: "pedestal", refId: "shop-found-money" });
  placeTile(tiles, 135, 48, { type: "performer-station", refId: "shop-cashier", facing: "west" });
  placeTile(tiles, 127, 40, { type: "sign", refId: "shop-welcome" });

  wings.push({ id: "gift-shop", name: "Gift Shop", bounds: { x: 116, y: 39, width: 22, height: 18 }, theme: "retail" });
  performers.push({
    id: "shop-cashier", tileX: 135, tileY: 48, facing: "west", autoPlay: false,
  });
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/museum-2d/MuseumFloorPlan.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/museum-2d/data/museum-floor-plan.ts tests/unit/museum-2d/MuseumFloorPlan.test.ts
git commit -m "feat(museum-2d): build post-Order rooms (Crumble through Gift Shop)"
```

---

### Task 4: Build Easter Egg Rooms (VTG Wing, Construction Zone, Janitor's Closet)

**Files:**
- Modify: `src/lib/features/museum-2d/data/museum-floor-plan.ts`
- Test: `tests/unit/museum-2d/MuseumFloorPlan.test.ts`

Add the three side-branch rooms that are optional discoveries.

- [ ] **Step 1: Add tests**

```typescript
it("VTG Wing is blocked by rope tiles", () => {
  // Rope tiles should exist between Digital Wing and VTG Wing
  let ropeCount = 0;
  for (let y = 140; y <= 145; y++) {
    const tile = grid.tiles.get(tileKey(50, y));
    if (tile?.type === "rope") ropeCount++;
  }
  expect(ropeCount).toBeGreaterThanOrEqual(4);
});

it("Construction Zone is accessible from Victorian Wing", () => {
  // Door tiles should exist at the Victorian south-east exit
  const doorTile = grid.tiles.get(tileKey(83, 186));
  expect(doorTile?.type).toBe("door");
});

it("Janitor's Closet has the whiteboard exhibit", () => {
  const janitorExhibit = grid.exhibits.find(e => e.id === "janitor-whiteboard");
  expect(janitorExhibit).toBeDefined();
});

it("VTG Wing has scaffolding tiles", () => {
  let scaffoldCount = 0;
  const vtgWing = grid.wings.find(w => w.id === "vtg-wing");
  expect(vtgWing).toBeDefined();
  const b = vtgWing!.bounds;
  for (let y = b.y + 1; y < b.y + b.height - 1; y++) {
    for (let x = b.x + 1; x < b.x + b.width - 1; x++) {
      const tile = grid.tiles.get(tileKey(x, y));
      if (tile?.type === "scaffolding") scaffoldCount++;
    }
  }
  expect(scaffoldCount).toBeGreaterThan(5);
});
```

- [ ] **Step 2: Run tests to verify failures**

- [ ] **Step 3: Implement easter egg rooms**

Add to `buildFullMuseum()`:

```typescript
  // ── VTG Wing (roped off) ──
  stampRoom(tiles, 30, 136, 18, 14, "stone");
  // Rope barrier: 2-tile gap between VTG (ends x=47) and Digital (west wall x=50)
  for (let y = 140; y <= 145; y++) {
    placeTile(tiles, 48, y, { type: "rope" });
    placeTile(tiles, 49, y, { type: "rope" });
  }
  // Internal scaffolding
  for (let x = 33; x < 45; x += 3) {
    for (let y = 139; y < 147; y += 3) {
      placeTile(tiles, x, y, { type: "scaffolding" });
    }
  }
  placeTile(tiles, 38, 137, { type: "sign", refId: "vtg-renovation" });
  placeTile(tiles, 36, 143, { type: "pedestal", refId: "vtg-dusty-1" });
  placeTile(tiles, 42, 143, { type: "pedestal", refId: "vtg-dusty-2" });

  wings.push({ id: "vtg-wing", name: "The Vulcan Wing", bounds: { x: 30, y: 136, width: 18, height: 14 }, theme: "construction" });
  exhibits.push({
    id: "vtg-renovation", tileX: 38, tileY: 137,
    plaque: { title: "THE VULCAN WING",
      subtitle: "Documenting the Oakland School, 1990s–Present",
      body: "NOTICE: This exhibit has been under renovation since 2024. " +
        "We appreciate your patience. Estimated completion: [DATE NOT FOUND]. " +
        "Visitors interested in the Vulcan notation tradition are encouraged " +
        "to consult external resources." },
  });

  // ── Corridor: Victorian → Construction Zone ──
  stampCorridor(tiles, 82, 186, 4, 9, "vertical", "dirt");
  carveDoor(tiles, 82, 186, 4, "horizontal"); // overlap Victorian south-east
  carveDoor(tiles, 82, 194, 4, "horizontal"); // overlap Construction Zone north

  // ── Construction Zone ──
  stampRoom(tiles, 74, 194, 16, 14, "dirt");
  carveDoor(tiles, 82, 194, 4, "horizontal"); // north door
  carveDoor(tiles, 89, 200, 2, "vertical"); // east door to Janitor's (shared wall)
  // Scaffolding
  for (let x = 77; x < 87; x += 3) {
    placeTile(tiles, x, 198, { type: "scaffolding" });
    placeTile(tiles, x, 203, { type: "scaffolding" });
  }
  placeTile(tiles, 80, 195, { type: "sign", refId: "cz-staff-only" });
  placeTile(tiles, 84, 200, { type: "pedestal", refId: "cz-unfinished-statue" });
  placeTile(tiles, 78, 196, { type: "sign", refId: "cz-coming-soon" });

  wings.push({ id: "construction-zone", name: "Construction Zone", bounds: { x: 74, y: 194, width: 16, height: 14 }, theme: "construction" });

  // ── Janitor's Closet ──
  stampRoom(tiles, 89, 197, 10, 8, "dirt");
  carveDoor(tiles, 89, 200, 2, "vertical"); // west door (shared wall with CZ)
  placeTile(tiles, 94, 198, { type: "torch" }); // bare bulb
  placeTile(tiles, 93, 201, { type: "pedestal", refId: "janitor-desk" });
  placeTile(tiles, 96, 198, { type: "exhibit-panel", refId: "janitor-whiteboard", facing: "south" });
  placeTile(tiles, 91, 200, { type: "exhibit-panel", refId: "janitor-mannequin", facing: "east" });

  wings.push({ id: "janitor", name: "Janitor's Closet", bounds: { x: 89, y: 197, width: 10, height: 8 }, theme: "construction" });
  exhibits.push({
    id: "janitor-whiteboard", tileX: 96, tileY: 198,
    plaque: { title: "AUSTEN'S FAKE MUSEUM IDEAS",
      body: "- Cave wing with fake tablets (DONE)\n" +
        "- Egyptian wing (TODO: need more hieroglyphs)\n" +
        "- Gift shop w/ fake money mechanic\n" +
        "- Statues of myself?? (too much?)\n" +
        "- VTG wing (ask Noel first)\n" +
        "- Three endings like Scrooge\n" +
        "- Janitor's closet reveal (you are here)" },
  });
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/museum-2d/MuseumFloorPlan.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/museum-2d/data/museum-floor-plan.ts tests/unit/museum-2d/MuseumFloorPlan.test.ts
git commit -m "feat(museum-2d): add easter egg rooms (VTG Wing, Construction Zone, Janitor's Closet)"
```

---

### Task 5: Add CSS for New Tile Types

**Files:**
- Modify: `src/lib/features/museum-2d/components/game/MuseumTileRenderer.svelte`

Add visual styles for `rope`, `scaffolding`, and `sign` tile types that were registered in the tile registry.

- [ ] **Step 1: Add CSS styles**

Add these CSS rules at the end of the `<style>` block in `MuseumTileRenderer.svelte`, before the closing `</style>` tag:

```css
  /* ---- Rope barrier (VTG Wing) ---- */

  .tile-rope {
    background: #2a2520;
    border: 1px solid rgba(255, 255, 255, 0.03);
    position: relative;
  }

  .tile-rope::after {
    content: "";
    position: absolute;
    top: 45%;
    left: 5%;
    right: 5%;
    height: 3px;
    background: linear-gradient(90deg, #c4a032, #e8c848, #c4a032);
    border-radius: 2px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }

  .tile-rope .tile-icon {
    color: #c4a032;
    opacity: 0.7;
  }

  /* ---- Scaffolding (Construction Zone) ---- */

  .tile-scaffolding {
    background:
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 3px,
        rgba(200, 140, 50, 0.08) 3px,
        rgba(200, 140, 50, 0.08) 6px
      ),
      #28201a;
    border: 2px dashed rgba(200, 140, 50, 0.25);
  }

  .tile-scaffolding .tile-icon {
    color: #d4940a;
    opacity: 0.8;
  }

  /* ---- Sign (readable) ---- */

  .tile-sign {
    background: #1a2030;
    border: 2px solid #4477aa;
    box-shadow:
      inset 0 0 8px rgba(68, 119, 170, 0.15),
      0 0 4px rgba(68, 119, 170, 0.2);
  }

  .tile-sign .tile-icon {
    color: #88bbdd;
    filter: drop-shadow(0 0 3px rgba(136, 187, 221, 0.6));
  }
```

- [ ] **Step 2: Also update the label rendering to include new tile types**

In the `{#if showLabel ...}` block, add sign to the list:

```svelte
{#if showLabel && (tile.type === "performer" || tile.type === "exhibit" || tile.type === "pedestal" || tile.type === "sign")}
```

Wait — looking at the actual code, the condition checks specific type strings. The existing code uses `tile.type === "performer"` but the actual type is `"performer-station"`. Let me check the current code.

Actually, reading the existing code at line 27:
```
{#if showLabel && (tile.type === "performer" || tile.type === "exhibit" || tile.type === "pedestal")}
```

This uses shortened names that don't match the actual TileType values. The types are `"performer-station"` and `"exhibit-panel"`. This might be a bug or intentional shorthand. Either way, for the new `sign` type the actual string is `"sign"`, which matches. Add it to the condition.

- [ ] **Step 3: Verify visually**

Run `npm run build` to confirm no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/museum-2d/components/game/MuseumTileRenderer.svelte
git commit -m "feat(museum-2d): add CSS for rope, scaffolding, sign tile types"
```

---

### Task 6: Wire Museum2DModule to Full Floor Plan

**Files:**
- Modify: `src/lib/features/museum-2d/Museum2DModule.svelte`

Replace the hardcoded Discovery Chamber with the full museum grid.

- [ ] **Step 1: Replace grid builder**

Replace the entire `buildDiscoveryChamber` function and its usage with:

```svelte
<script lang="ts">
  import { buildFullMuseum } from "./data/museum-floor-plan";
  import { createMuseum2DState } from "./state/museum-2d-state.svelte";
  import { setMuseum2DContext } from "./state/museum-2d-context";
  import SplitScreenLayout from "./components/layout/SplitScreenLayout.svelte";
  import Museum2DGame from "./components/game/Museum2DGame.svelte";
  import DetailPanel from "./components/panel/DetailPanel.svelte";

  const grid = buildFullMuseum();
  const state = createMuseum2DState(grid);

  setMuseum2DContext({ state });
</script>

<div class="museum-2d-module">
  <SplitScreenLayout>
    {#snippet left()}
      <Museum2DGame />
    {/snippet}
    {#snippet right()}
      <DetailPanel />
    {/snippet}
  </SplitScreenLayout>
</div>

<style>
  .museum-2d-module {
    width: 100%;
    height: 100%;
    background: #0a0a0a;
  }
</style>
```

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Run all museum tests**

Run: `npx vitest run tests/unit/museum-2d/`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/museum-2d/Museum2DModule.svelte
git commit -m "feat(museum-2d): wire full museum floor plan into module"
```

---

### Task 7: Final Verification

**Files:** None (read-only verification)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run tests/unit/museum-2d/`
Expected: All tests pass

- [ ] **Step 2: Run TypeScript check**

Run: `npm run check`
Expected: No errors related to museum-2d

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 4: Commit any fixes needed**

If any issues surfaced, fix and commit.
