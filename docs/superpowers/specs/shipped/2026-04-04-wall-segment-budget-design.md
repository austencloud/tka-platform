# Wall Segment Budget System — Design Spec

**Date:** 2026-04-04
**Status:** Approved
**Scope:** Museum layout pipeline rewrite — replace fractional exhibit placement with wall segment budgets

---

## Problem Statement

The current museum layout pipeline places exhibits using fractional positions (0.0-1.0 along a wall), then discovers conflicts with doorway flares at runtime and attempts repositioning. This produces ~98 design violations because:

1. **Doorway flares carve away wall tiles** where exhibits expect them (8 tiles centered on each door)
2. **The validator checks intended positions**, not actual positions after repositioning
3. **Exhibits at `position: 0.5` on walls with doors always fail** regardless of room size
4. **No amount of room resizing fixes this** — the data model allows invalid states

The fundamental flaw: exhibits and doors are defined independently and collide at runtime. The fix: make invalid placements unrepresentable.

---

## Solution: Wall Segment Budgets

Each wall becomes an **ordered array of typed segments**. Exhibits and doors are separate segment types on the same wall — they can never overlap because they occupy different slots. Room dimensions are computed from segment totals, not guessed.

### Core Principle

**Valid by construction.** The builder stamps exactly what's defined. No searching, no repositioning, no fallbacks. If the data compiles, the layout is correct.

---

## Data Model

### Segment Types

```typescript
type DoorSegment = {
  type: "door";
  edgeId: string;       // which RoomEdge this connects to
  width: number;        // tiles (typically 4)
};

type ExhibitSegment = {
  type: "exhibit";
  refId: string;        // links to museum-room-content.ts
  size: "standard" | "large" | "dev-whiteboard";
  facing: Direction;
  isAnchor?: boolean;
  group?: string;
};

type TorchSegment = {
  type: "torch";
};

type ScreenSegment = {
  type: "screen";
  refId: string;
  facing: Direction;
  decade?: ScreenDecade;
};

type RopeSegment = {
  type: "rope";
  edgeId: string;       // which edge this barrier represents
  width: number;        // tiles of rope barrier (visual, non-walkable)
};

type SignSegment = {
  type: "sign";
  refId: string;        // links to content
};

type GapSegment = {
  type: "gap";
  minTiles: number;     // enforced breathing room
};

type WallSegment =
  | DoorSegment | ExhibitSegment | TorchSegment | ScreenSegment
  | RopeSegment | SignSegment | GapSegment;
```

### Wall Definition

```typescript
type WallDefinition = {
  segments: WallSegment[];  // ordered start-to-end along the wall
  minMargin: number;        // tiles before first and after last segment
};
```

### Room Definition (replaces current RoomNode)

```typescript
type RoomNode = {
  id: string;
  name: string;
  material: FloorMaterial;
  theme: WingTheme;
  description?: string;
  devNotes?: string;

  walls: {
    north: WallDefinition;
    south: WallDefinition;
    east: WallDefinition;
    west: WallDefinition;
  };

  // Interior placements (unchanged)
  performers?: PerformerPlacement[];
  furniture?: FurniturePlacement[];

  // Optional interior size overrides (for rooms needing floor space beyond wall demands)
  minInteriorWidth?: number;
  minInteriorHeight?: number;
};
```

### What's Removed from RoomNode

- `minWidth` / `maxWidth` / `minHeight` / `maxHeight` — derived from wall budgets
- `exhibits[]` — moved into wall segments
- `torches[]` — moved into wall segments
- `screens[]` — moved into wall segments

### Segment Tile Widths

Each segment type has a known tile width used for budget computation:

| Segment | Tile Width |
|---------|-----------|
| `door` | `segment.width` (typically 4) |
| `exhibit` standard | 2 |
| `exhibit` large | 4 |
| `exhibit` dev-whiteboard | 6 |
| `torch` | 1 |
| `screen` | 3 |
| `rope` | `segment.width` (typically 6) |
| `sign` | 2 |
| `gap` | `segment.minTiles` |

---

## Room Auto-Sizing

Room dimensions are derived from wall segment totals. No manual min/max guessing.

```
wallLength(wall) = wall.minMargin * 2 + sum(segmentWidth(s) for s in wall.segments)

roomWidth  = max(wallLength(north), wallLength(south)) + 2  // +2 for wall tiles
roomHeight = max(wallLength(east), wallLength(west)) + 2
```

The `+ 2` accounts for the wall tiles on each end. The layout engine uses these computed dimensions instead of author-specified ranges.

### Padding for Aesthetics

Room auto-sizing computes the **minimum** valid dimensions. For rooms that should feel spacious, authors can add larger gap segments or increase `minMargin`. The room graph also accepts an optional `minInterior` override for rooms that need breathing room beyond what the walls demand (e.g., collaboration room with 4 performers needs floor space).

```typescript
type RoomNode = {
  // ...wall definitions...
  minInteriorWidth?: number;   // minimum interior width (overrides wall-derived if larger)
  minInteriorHeight?: number;  // minimum interior height
};
```

Final dimensions: `max(wallDerived, minInterior + 2)`.

---

## Segment Stamping Pipeline

The builder's exhibit/torch placement logic is replaced by deterministic segment stamping.

### Current Pipeline (broken)

```
carveRoomFloor → deriveWalls → carveDoorwayFlare → placeExhibits (with repositioning) → validate
```

### New Pipeline

```
carveRoomFloor → stampWallSegments → deriveWalls → validate (assertions only)
```

Key change: **segments are stamped BEFORE walls are derived.** Segment tiles (exhibit-panel, door, torch) are placed directly on the room boundary. The wall derivation pass then fills in walls around them. This guarantees every non-door segment has wall behind it — the derived wall wraps around the room exterior, and segments sit on the room edge.

### Segment Stamping Algorithm

For each wall of each room:

1. Compute the starting position: `wallStart + minMargin`
2. For each segment in order:
   a. Compute the tile width of this segment
   b. Place the segment's tile(s) at the current position along the wall
   c. Advance the position by the segment width
3. After all segments, verify remaining space >= `minMargin` (should always pass if sizing is correct)

For horizontal walls (north/south): segments advance along X.
For vertical walls (east/west): segments advance along Y.

### Door Segment Stamping

Door segments carve floor tiles (not wall tiles) at their position. The corridor router reads door positions from the stamped grid rather than computing them from room centers. This means corridors connect to exactly where the door segment is, not always at the wall midpoint.

**Change to CorridorRouter:** `getDoorPosition()` currently always returns the wall center. It will instead receive the stamped door position from the segment layout.

### Exhibit Segment Stamping

Exhibit segments place `exhibit-panel` tiles at their position along the wall, flush against the room boundary. The facing direction comes from the segment definition.

### Torch Segment Stamping

Torch segments place `torch` tiles at their position.

### Gap Segment Stamping

Gap segments place nothing — they're floor tiles (already carved). They exist only for budget accounting.

---

## Corridor Connection Changes

### Current System

- `CorridorRouter.getDoorPosition()` always returns wall center
- `carveDoorwayFlare()` carves an 8-tile-wide area outside the door to smooth the transition
- The flare overwrites derived walls, causing wall-backed violations

### New System

- Door segments have explicit positions (from segment stamping)
- `CorridorRouter.getDoorPosition()` reads the stamped door position
- Doorway flares are replaced by the door segment's own width
- The corridor meets the door at its actual position, not always at center

The door segment's `width` field IS the opening width. No separate flare calculation. The corridor router routes to the door's stamped position.

### Door Position Reporting

After segment stamping, the builder produces a `doorPositionMap: Map<string, { x, y, wall }>` keyed by `edgeId`. The corridor router consumes this map instead of computing positions from room geometry.

---

## JSON Persistence Layer

The room definitions support JSON serialization for the visual editor (floor plan editor in the app).

### Schema

A JSON Schema is generated from the TypeScript types using `ts-json-schema-generator` (or equivalent). This schema:
- Validates room JSON files at runtime
- Provides autocomplete in VS Code for `.json` room files
- Is consumed by the visual editor for validation

### Serialization

```typescript
interface IMuseumRoomSerializer {
  /** Serialize room definitions to JSON (for editor export) */
  serialize(rooms: RoomNode[], edges: RoomEdge[]): string;

  /** Deserialize JSON to room definitions (for editor import) */
  deserialize(json: string): { rooms: RoomNode[]; edges: RoomEdge[] };

  /** Validate JSON against the schema without deserializing */
  validate(json: string): { valid: boolean; errors: string[] };
}
```

### File Format

Room definitions can live as either:
- **TypeScript** (`museum-room-graph.ts`) — primary authoring format, compile-time safety
- **JSON** (`museum-rooms.json`) — editor export/import format, runtime-validated

Both formats represent the same data. The TypeScript file is the source of truth. The editor can export to JSON, which can be imported back. The serializer handles conversion.

### Editor Integration

The existing `EditorState` in the museum module will gain:
- `exportRoomGraph(): string` — serializes current layout to JSON
- `importRoomGraph(json: string): void` — loads a room graph from JSON, rebuilds grid

This is a future integration point, not part of the initial implementation. The serializer and schema are built now; the editor wiring comes later.

---

## Design Validation Changes

### Rules Eliminated (valid by construction)

| Rule | Why It's Gone |
|------|--------------|
| wall-backed | Segments are stamped on the room boundary; derived walls wrap around them |
| entrance-clearance | Door and exhibit are separate segments with explicit gaps |
| corner-avoidance | `minMargin` on each wall keeps segments away from corners |
| spacing | Gap segments enforce minimum distance between exhibits |
| wall-coverage | Segment totals vs wall length is computed at definition time |

### Rules Retained (still need runtime checking)

| Rule | Why It Stays |
|------|-------------|
| sightline | Requires tracing a line through the grid — can't be checked from segments alone |
| anchor-presence | Metadata check on segment definitions |
| anchor-placement | Checks anchor is on the correct wall (opposite entrance) |

### Validator Simplification

The `MuseumDesignValidator` shrinks dramatically. Most checks become build-time assertions in the segment stamping code (throw if segments exceed wall length, etc.). The remaining runtime checks (sightline, anchor) operate on the stamped grid.

---

## Migration: Converting 16 Rooms

Each room's current definition maps to the new format:

### Mechanical Conversion Rules

1. **Exhibits on walls without doors** → exhibit segments with gap segments between them
2. **Exhibits on walls with doors** → exhibit segment, gap, door segment (ordered by position along wall)
3. **Torches** → torch segments on their current walls
4. **Door positions** → door segments on the walls specified by `RoomEdge.fromWall` / `toWall`
5. **Room dimensions** → deleted (auto-computed from segments)

### Which Walls Have Doors (from edge definitions)

| Room | Door Walls |
|------|-----------|
| entrance | north |
| vulcan-cave | south, east |
| egyptian | west, south |
| renaissance | north, west |
| victorian | east, north, south |
| digital | south, north, west(rope) |
| suppression | south, north |
| vtg-wing | east |
| crumble | south, north |
| gallery | south, north |
| fear | south, east |
| isolation | west, east |
| collaboration | west, south |
| gift-shop | north |
| construction-zone | north, east |
| janitor | west |

### Conversion Example: Digital Wing

**Current:**
```typescript
{
  id: "digital",
  minWidth: 20, maxWidth: 26,
  minHeight: 18, maxHeight: 22,
  exhibits: [
    { wall: "north", position: 0.5, refId: "digital-crt", facing: "south" },
    { wall: "west", position: 0.35, refId: "digital-bbs", facing: "east" },
    { wall: "east", position: 0.5, refId: "digital-3400", facing: "west" },
    { wall: "south", position: 0.5, refId: "digital-team", facing: "north" },
  ],
}
```

**New:**
```typescript
{
  id: "digital",
  walls: {
    north: {  // has door to suppression
      segments: [
        { type: "gap", minTiles: 3 },
        { type: "exhibit", refId: "digital-crt", size: "standard", facing: "south" },
        { type: "gap", minTiles: 4 },
        { type: "door", edgeId: "digital->suppression", width: 4 },
        { type: "gap", minTiles: 3 },
      ],
      minMargin: 2,
    },
    south: {  // has door from victorian
      segments: [
        { type: "gap", minTiles: 3 },
        { type: "door", edgeId: "victorian->digital", width: 4 },
        { type: "gap", minTiles: 4 },
        { type: "exhibit", refId: "digital-team", size: "standard", facing: "north" },
        { type: "gap", minTiles: 3 },
      ],
      minMargin: 2,
    },
    west: {  // rope barrier to VTG wing
      segments: [
        { type: "torch" },
        { type: "gap", minTiles: 2 },
        { type: "exhibit", refId: "digital-bbs", size: "standard", facing: "east" },
        { type: "gap", minTiles: 2 },
        { type: "rope", edgeId: "digital->vtg-wing", width: 6 },
        { type: "gap", minTiles: 2 },
        { type: "torch" },
      ],
      minMargin: 2,
    },
    east: {
      segments: [
        { type: "gap", minTiles: 3 },
        { type: "exhibit", refId: "digital-3400", size: "standard", facing: "west" },
        { type: "gap", minTiles: 3 },
      ],
      minMargin: 2,
    },
  },
  // ...performers, furniture
}
```

**Auto-computed dimensions:**
- North: margin(2) + gap(3) + exhibit(2) + gap(4) + door(4) + gap(3) + margin(2) = 20 interior → 22 total width
- South: margin(2) + gap(3) + door(4) + gap(4) + exhibit(2) + gap(3) + margin(2) = 20 interior → 22 total width
- East: margin(2) + gap(3) + exhibit(2) + gap(3) + margin(2) = 12 interior → 14 total height
- West: margin(2) + torch(1) + gap(2) + exhibit(2) + gap(2) + rope(6) + gap(2) + torch(1) + margin(2) = 20 interior → 22 total height
- Room: 22 × 22 tiles

---

## Special Tile Handling

### Rope Barriers

The digital wing's west wall has a rope barrier to VTG wing — non-walkable visual tiles, not a door. Rope segments stamp `rope` tiles at their position. The corridor router **skips edges with rope connections** — no corridor is carved between digital and VTG. The rope segment simply replaces wall tiles with rope tiles on the room boundary.

### Scaffolding (VTG Wing, Construction Zone)

The current floor plan scatters `scaffolding` tiles across VTG wing and construction zone interiors via hardcoded `placeTile` calls. These are **interior decorations**, not wall-mounted content.

Solution: Add `"scaffolding"` as a furniture role:

```typescript
type FurniturePlacement = {
  role: "bench" | "pedestal" | "bookshelf" | "lamp" | "plant" | "scaffolding";
  // ...existing fields
};
```

The builder stamps scaffolding furniture as `scaffolding` tiles (like it stamps `pedestal` tiles for pedestals). VTG and construction zone room definitions get `furniture: [{ role: "scaffolding", offsetX: ..., offsetY: ... }, ...]` entries.

### Sign Tiles

The current system has `sign` tiles (e.g., VTG renovation notice, construction zone "STAFF ONLY"). In the current `museum-room-graph.ts`, these are defined as exhibits with `refId: "vtg-renovation"`. In the new system, signs that are wall-mounted use the `SignSegment` type in wall definitions. Signs that are freestanding interior elements become furniture with `role: "sign"` (or remain as exhibit segments if they have plaque content).

### Dev Whiteboards

The current `placeDevWhiteboards()` method auto-places large exhibits on each room's anchor wall. In the new system, dev whiteboards are handled as follows:

- When `DEV_WHITEBOARDS_ENABLED` is true, the `WallSegmentStamper` appends a dev-whiteboard exhibit segment to the anchor wall (opposite the entrance) of every room with `devNotes`
- This happens at stamp time, not at definition time — the room graph does NOT include dev whiteboard segments
- The stamper checks if the anchor wall has enough remaining space (wall length minus segment total) for the whiteboard's 6-tile width + margins
- If there's not enough space, the whiteboard is skipped for that room (same as current behavior)
- When `DEV_WHITEBOARDS_ENABLED` is false, no whiteboard segments are injected

This keeps dev whiteboards as a build-time toggle without polluting the room definitions.

---

## PlacedRoom Type Changes

The `PlacedRoom` type in `layout-types.ts` must be updated to match the new `RoomNode`:

```typescript
interface PlacedRoom {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  material: FloorMaterial;
  theme: WingTheme;
  description?: string;
  devNotes?: string;

  // NEW: wall segment definitions (replaces exhibits[], torches[], screens[])
  walls: {
    north: WallDefinition;
    south: WallDefinition;
    east: WallDefinition;
    west: WallDefinition;
  };

  // UNCHANGED
  performers?: PerformerPlacement[];
  furniture?: FurniturePlacement[];
}
```

The `GraphLayoutEngine.createPlacedRoom()` copies `walls` from `RoomNode` to `PlacedRoom` (replacing the current `exhibits`, `torches`, `screens` copy).

The dev validation block in `MuseumModule.svelte` (lines 163-197) reconstructs `PlacedRoom` objects from grid wings + original room data. This reconstruction must be updated to pull `walls` from the original `RoomNode` instead of `exhibits`/`torches`.

---

## Room Dimension Computation

The `GraphLayoutEngine` needs to compute room dimensions from wall segment budgets. This computation is a pure function that belongs in a shared utility, not buried inside the layout engine.

### Location

New function `computeRoomDimensions()` in `domain/wall-segment-types.ts` (alongside the segment type definitions and width constants).

### Algorithm

```typescript
function computeRoomDimensions(room: RoomNode): { w: number; h: number } {
  const northLen = computeWallLength(room.walls.north);
  const southLen = computeWallLength(room.walls.south);
  const eastLen = computeWallLength(room.walls.east);
  const westLen = computeWallLength(room.walls.west);

  const interiorW = Math.max(northLen, southLen, room.minInteriorWidth ?? 0);
  const interiorH = Math.max(eastLen, westLen, room.minInteriorHeight ?? 0);

  return {
    w: interiorW + 2,  // +2 for wall tiles on each end
    h: interiorH + 2,
  };
}
```

The `GraphLayoutEngine` calls `computeRoomDimensions()` instead of computing `midpoint(minWidth, maxWidth)`. This is the only change to the layout engine — the overlap resolution, shift-to-positive, and topological sort remain identical.

### Asymmetric Wall Note

When north and south walls have different segment totals, the shorter wall gets extra empty space. This is intentional and correct — it means one side of the room is sparser. Authors control the visual balance by adjusting gap sizes on the shorter wall.

---

## GridConfig Implications

`GridConfig.cellWidth`/`cellHeight` were used by the old layout system as fixed cell sizes. The current `GraphLayoutEngine` already ignores them (it uses `config.padding` only for the `corridorGap` calculation). After this migration, `GridConfig` is unchanged — `padding` continues to set the corridor gap.

---

## museum-floor-plan.ts Fate

This file currently exports:
- `stampRoom()`, `stampCorridor()`, `carveDoor()`, `placeTile()` — low-level helpers used by `MuseumGridBuilder`
- `buildFullMuseum()` and all `build*()` functions — dead code (never imported)

After migration:
- `placeTile()` moves to `WallSegmentStamper` as a private method (it's only used there and in `MuseumGridBuilder`)
- `stampRoom()` and `stampCorridor()` are NOT used by the graph pipeline (`MuseumGridBuilder` has its own `carveRoomFloor`/`carveCorridorFloor`). They are dead code.
- `carveDoor()` is dead code (doors are now segments)
- The entire `museum-floor-plan.ts` file is deleted

---

## Files Changed

### New Files

| File | Purpose |
|------|---------|
| `domain/wall-segment-types.ts` | WallSegment, WallDefinition, segment width constants, `computeRoomDimensions()`, `computeWallLength()` |
| `services/contracts/IWallSegmentStamper.ts` | Interface for the segment stamping service |
| `services/implementations/WallSegmentStamper.ts` | Stamps segments onto the tile grid, produces door position map |
| `services/contracts/IMuseumRoomSerializer.ts` | JSON serialization interface |
| `services/implementations/MuseumRoomSerializer.ts` | JSON serialize/deserialize/validate |
| `domain/museum-room-schema.json` | Generated JSON Schema for room definitions |

### Modified Files

| File | Change |
|------|--------|
| `domain/layout-types.ts` | Remove `ExhibitPlacement`, `TorchPlacement`, `ScreenPlacement` types. Remove `minWidth`/`maxWidth`/`minHeight`/`maxHeight` from `RoomNode`. Add `walls` property and `minInteriorWidth`/`minInteriorHeight`. Update `PlacedRoom` to carry `walls` instead of old arrays. Keep `PerformerPlacement` and `FurniturePlacement` (add `"scaffolding"` and `"sign"` to furniture roles). |
| `data/museum-room-graph.ts` | Rewrite all 16 room definitions to use wall segments. Add scaffolding/sign furniture entries for VTG and construction zone. |
| `services/implementations/MuseumGridBuilder.ts` | Replace `placeExhibits`/`placeTorches` with call to `WallSegmentStamper.stampRoom()`. Remove `findWallBackedPosition`, `findNonOverlappingPosition`, `hasWallBehindSpan`, `hasWallBehind`, `carveDoorwayFlare`, wall occupancy tracking, `EXHIBIT_HALF_SPAN`. Dev whiteboard injection moves to `WallSegmentStamper`. |
| `services/implementations/GraphLayoutEngine.ts` | Import `computeRoomDimensions` from wall-segment-types. Replace `midpoint(min, max)` sizing with `computeRoomDimensions(room)`. `createPlacedRoom` copies `walls` instead of `exhibits`/`torches`/`screens`. |
| `services/implementations/CorridorRouter.ts` | `routeCorridor()` accepts an optional door position map. `getDoorPosition()` checks the map first, falls back to wall center if not found. |
| `services/implementations/MuseumDesignValidator.ts` | Remove `checkWallBacked`, `checkCornerAvoidance`, `checkEntranceClearance`, `checkSpacing`, `checkWallCoverage` and their helpers. Keep `checkSightline`, `checkAnchorPresence`, `checkAnchorPlacement`. Update `computeWallPosition` to read segment positions instead of fractional positions. |
| `domain/museum-design-rules.ts` | Remove `CORNER_AVOIDANCE`, `ENTRANCE_CLEARANCE`, `EXHIBIT_SPACING`, `MAX_WALL_COVERAGE`. Keep `OPPOSITE_WALL`, `DEV_WHITEBOARDS_ENABLED`. |
| `MuseumModule.svelte` | Update dev validation block to reconstruct `PlacedRoom` with `walls` from room graph instead of old `exhibits`/`torches`. |

### Deleted Files / Dead Code

| Item | Why |
|------|-----|
| `data/museum-floor-plan.ts` (entire file) | All exports are dead code or moved to `WallSegmentStamper` |
| `ExhibitPlacement` type | Replaced by `ExhibitSegment` in wall definitions |
| `TorchPlacement` type | Replaced by `TorchSegment` |
| `ScreenPlacement` type | Replaced by `ScreenSegment` |

### Unchanged Files

| File | Why |
|------|-----|
| `data/museum-room-content.ts` | Plaque text keyed by refId — segments use the same refIds |
| `domain/museum-grid-types.ts` | Tile types, grid structure — unchanged |
| `domain/tile-registry.ts` | Tile metadata — unchanged |
| `domain/fixture-registry.ts` | Lighting fixtures — unchanged |
| `services/implementations/LayoutValidator.ts` | Post-build grid validation (reachability, overlaps) — unchanged |
| All 3D rendering code | Consumes `MuseumGrid` which has the same output shape |

---

## Invariants (Must Hold After Migration)

1. **Zero wall-backed violations** — every exhibit-panel tile has a wall tile behind it
2. **Zero entrance-clearance violations** — door and exhibit segments are separated by explicit gaps
3. **All 16 rooms render with same content** — same exhibits, same performers, same plaque text
4. **Corridor connectivity preserved** — all rooms reachable, no dead ends introduced
5. **JSON round-trip fidelity** — `deserialize(serialize(rooms))` produces identical room definitions
6. **Build-time failure on invalid data** — segments exceeding wall length throw at grid build, not at runtime validation
7. **No regression in 3D rendering** — `MuseumGrid` output shape is unchanged
8. **Rope barrier preserved** — digital/VTG connection renders as rope tiles, not a walkable corridor
9. **Scaffolding preserved** — VTG wing and construction zone interior decoration intact
10. **Dev whiteboards toggle works** — `DEV_WHITEBOARDS_ENABLED = false` produces zero whiteboard exhibits

---

## What This Does NOT Change

- **Room topology** (which rooms connect to which) — same edges
- **Room content** (plaque text, performer sequences) — same content keyed by same refIds
- **Interior placement** (performers, furniture) — same center-relative offset system
- **The 3D renderer** — consumes `MuseumGrid` which has the same tiles, exhibits, performers
- **The 2D walker** — consumes `MuseumGrid` tiles
- **The editor's in-memory grid** — still a `MuseumGrid` tile map
- **Corridor routing algorithm** — same L-shaped routing, just reads door positions from a map
