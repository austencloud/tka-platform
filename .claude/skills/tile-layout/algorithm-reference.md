# Tile Layout Algorithm Reference

Detailed data structures, code examples, and anti-patterns for the graph-first layout algorithm.

---

## The Graph-First Algorithm

### Step 1: Define the Room Graph

```typescript
interface RoomNode {
  id: string;
  name: string;
  minWidth: number;   // tiles
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  material: FloorMaterial;
  theme: WingTheme;
  description?: string;
  exhibits?: ExhibitPlacement[];
  performers?: PerformerPlacement[];
  torches?: TorchPlacement[];
}

interface RoomEdge {
  from: string;  // room ID
  to: string;    // room ID
  type: 'main-path' | 'side-branch' | 'secret';
  fromWall: 'north' | 'south' | 'east' | 'west';
  toWall: 'north' | 'south' | 'east' | 'west';
  corridorWidth?: number;  // tiles, default 4
}
```

The graph defines WHAT connects to WHAT. No coordinates yet.

### Step 2: Assign Grid Positions

```typescript
interface GridConfig {
  cellWidth: number;   // tiles per cell (e.g., 40)
  cellHeight: number;  // tiles per cell (e.g., 40)
  padding: number;     // tiles between rooms (e.g., 2)
}

interface GridAssignment {
  roomId: string;
  gridCol: number;
  gridRow: number;
}
```

For a linear museum:
- Topological order of the room graph
- Snake pattern: row 0 left-to-right, row 1 right-to-left
- Side branches go perpendicular to the main path

### Step 3: Compute Absolute Positions

```typescript
function computeRoomPosition(
  assignment: GridAssignment,
  roomNode: RoomNode,
  config: GridConfig,
): { x: number; y: number; w: number; h: number } {
  const cellX = assignment.gridCol * config.cellWidth;
  const cellY = assignment.gridRow * config.cellHeight;
  const w = roomNode.minWidth + Math.floor(Math.random() * (roomNode.maxWidth - roomNode.minWidth));
  const h = roomNode.minHeight + Math.floor(Math.random() * (roomNode.maxHeight - roomNode.minHeight));
  const x = cellX + Math.floor((config.cellWidth - w) / 2);
  const y = cellY + Math.floor((config.cellHeight - h) / 2);
  return { x, y, w, h };
}
```

### Step 4: Route Corridors

For each edge: find door positions on source and target rooms, route L-shaped corridor between them.

```typescript
function routeCorridor(
  fromRoom: PlacedRoom,
  toRoom: PlacedRoom,
  edge: RoomEdge,
): CorridorSegment[] {
  const fromDoor = getDoorPosition(fromRoom, edge.fromWall);
  const toDoor = getDoorPosition(toRoom, edge.toWall);
  const width = edge.corridorWidth ?? 4;

  if (edge.fromWall === 'east' || edge.fromWall === 'west') {
    const midX = Math.floor((fromDoor.x + toDoor.x) / 2);
    return [
      { x1: fromDoor.x, y1: fromDoor.y, x2: midX, y2: fromDoor.y, width },
      { x1: midX, y1: fromDoor.y, x2: midX, y2: toDoor.y, width },
      { x1: midX, y1: toDoor.y, x2: toDoor.x, y2: toDoor.y, width },
    ];
  }
  const midY = Math.floor((fromDoor.y + toDoor.y) / 2);
  return [
    { x1: fromDoor.x, y1: fromDoor.y, x2: fromDoor.x, y2: midY, width },
    { x1: fromDoor.x, y1: midY, x2: toDoor.x, y2: midY, width },
    { x1: toDoor.x, y1: midY, x2: toDoor.x, y2: toDoor.y, width },
  ];
}
```

### Step 5: Carve-Then-Wall Rendering

**The most important rendering rule.** Corridors NEVER stamp walls. Walls are derived.

Three tile states during construction:
- `SOLID` — uncarved void (initial fill, not rendered)
- `FLOOR` — walkable space (carved during Phase 1)
- `WALL` — visible barrier (derived in Phase 2, NEVER carved directly)

**Phase 1: Carve (monotonic — tiles can only become MORE walkable)**

```typescript
// 1. Initialize grid as all SOLID (void)
// 2. Carve room INTERIORS as FLOOR (no walls — just the walkable rectangle)
for (const room of placedRooms) {
  for (let y = room.y; y < room.y + room.h; y++)
    for (let x = room.x; x < room.x + room.w; x++)
      tiles.set(tileKey(x, y), { type: "floor", material: room.material });
}
// 3. Carve corridors as FLOOR (no walls — just the walkable strip)
for (const segment of corridorSegments) {
  for (const {x, y} of segmentTiles(segment)) {
    tiles.set(tileKey(x, y), { type: "corridor", material });
  }
}
```

**Phase 2: Derive walls from adjacency**

```typescript
// Any SOLID tile (not yet in map) adjacent to a FLOOR/CORRIDOR tile becomes WALL
const NEIGHBORS = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];

for (let y = 0; y < gridHeight; y++) {
  for (let x = 0; x < gridWidth; x++) {
    if (tiles.has(tileKey(x, y))) continue; // already carved
    const adjacentToFloor = NEIGHBORS.some(([dx, dy]) => {
      const tile = tiles.get(tileKey(x + dx, y + dy));
      return tile && isWalkable(tile.type);
    });
    if (adjacentToFloor) {
      tiles.set(tileKey(x, y), { type: "wall" });
    }
  }
}
```

**Phase 3: Place content and validate**

1. Place exhibits, performers, torches inside rooms (room-relative positions)
2. Set spawn point
3. Run flood-fill validation from spawn
4. Run overlap detection between all room bounds

**Why this works for junctions:** Multiple corridors meeting at a point all write FLOOR. FLOOR + FLOOR = FLOOR (idempotent). The post-process generates walls around the combined walkable shape. Elbows, T-junctions, and crossroads need zero special handling.

---

## Room-Relative Content Placement

### Exhibits (wall-mounted)

```typescript
interface ExhibitPlacement {
  wall: 'north' | 'south' | 'east' | 'west';
  position: number;  // 0.0 to 1.0 along the wall (0.5 = center)
  refId: string;
  facing: Direction;
}

function placeExhibitOnWall(room: PlacedRoom, placement: ExhibitPlacement): { x: number; y: number } {
  switch (placement.wall) {
    case 'north':
      return { x: room.x + 1 + Math.floor(placement.position * (room.w - 2)), y: room.y + 1 };
    case 'south':
      return { x: room.x + 1 + Math.floor(placement.position * (room.w - 2)), y: room.y + room.h - 2 };
    case 'east':
      return { x: room.x + room.w - 2, y: room.y + 1 + Math.floor(placement.position * (room.h - 2)) };
    case 'west':
      return { x: room.x + 1, y: room.y + 1 + Math.floor(placement.position * (room.h - 2)) };
  }
}
```

### Performers (floor-placed)

```typescript
interface PerformerPlacement {
  offsetX: number;  // -0.5 to 0.5 from center (0 = center)
  offsetY: number;
  facing: Direction;
  refId: string;
}
```

### Torches (wall-mounted)

Same wall-relative system as exhibits. Evenly spaced or at specified positions.

---

## Flood-Fill Validation

```typescript
function validateConnectivity(grid: MuseumGrid): ValidationResult {
  const visited = floodFill(grid, grid.spawn.x, grid.spawn.y);
  const unreachable = grid.wings.filter(wing => {
    const b = wing.bounds;
    for (let y = b.y + 1; y < b.y + b.height - 1; y++) {
      for (let x = b.x + 1; x < b.x + b.width - 1; x++) {
        if (visited.has(tileKey(x, y))) return false;
      }
    }
    return true;
  });
  return { valid: unreachable.length === 0, unreachable };
}
```

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Do Instead |
|---|---|---|
| Corridors stamping their own walls | Second segment's walls overwrite first segment's floor at elbows | Carve-then-wall: corridors write FLOOR only, walls derived as post-process |
| Hand-typing coordinates | Math errors compound across rooms | Compute from graph + grid |
| "It looks right in the spec" | Spec coordinates had overlaps and gaps | Run validation code |
| Place rooms then hope corridors connect | Corridors miss targets | Define connections first, route algorithmically |
| Visual inspection only | Human eyes miss 1-tile gaps | Flood-fill catches everything |
| One giant function with all room data | Impossible to debug or test | Room graph (data) separate from placement (algorithm) |
| Absolute exhibit coordinates | Move the room, all exhibits break | Wall-relative placement |

---

## Recommended File Structure

```
src/lib/features/museum-2d/
  data/
    museum-room-graph.ts      — Room nodes + edges (abstract topology)
    museum-room-content.ts    — Exhibit/performer/trigger definitions per room
  services/
    contracts/
      ILayoutEngine.ts        — Interface for the layout algorithm
    implementations/
      GraphLayoutEngine.ts    — Graph-first placement algorithm
      CorridorRouter.ts       — L-shaped corridor routing
      LayoutValidator.ts      — Flood-fill, overlap, door alignment checks
  domain/
    layout-types.ts           — RoomNode, RoomEdge, GridConfig, PlacedRoom, etc.
```

---

## Research Sources

Algorithms documented here draw from established procedural generation techniques:
- BSP Trees (RogueBasin)
- TinyKeep scatter+separate+Delaunay+MST (Vazgriz, GameDeveloper.com)
- Spelunky critical-path grid (Derek Yu)
- Bob Nystrom's Rooms and Mazes
- Graph-first topology-driven placement (PCG Book, MDPI Virtual Museum PCG)
