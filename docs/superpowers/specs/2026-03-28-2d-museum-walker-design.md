# 2D Museum Walker Design

**Date:** 2026-03-28
**Status:** Draft
**Scope:** Integrate Pressure Stones into TKA as a 2D museum exploration game with floor plan editor and 3D export pipeline

---

## Problem

The Archive (3D museum) needs 5-8 wings with exhibits, corridors, and spatial flow. Designing these in 3D is slow — you can't see the layout, iteration requires walking through each change, and spatial relationships between wings are invisible.

A 2D top-down museum lets you design, play-test, and iterate on the full floor plan before committing to 3D. The tile grid becomes the single source of truth for both the 2D game and the 3D rendering.

## Solution

Three workstreams feeding one shared data format:

1. **Museum 2D Walker** — Adapt Pressure Stones (existing Svelte 5 tile game at `E:/_ARCHIVE/pressure-stones/`) into a museum exploration experience integrated into TKA. Split-screen: game on one side, context-sensitive detail panel on the other.

2. **Floor Plan Editor** — Extend Pressure Stones' level editor for museum design: larger grids, museum-specific tile types, wing templates, multi-room layout on one continuous grid.

3. **2D-to-3D Pipeline** — Convert the tile grid into RoomDefinitions that feed the existing RoomGeometryBuilder → IndoorScene pipeline.

---

## Shared Data Format

### Tile Grid Schema

The museum is one continuous grid. All wings, corridors, and spaces exist on this grid. 1 tile = 0.5m in real-world scale.

```typescript
// src/lib/features/museum-2d/domain/museum-grid-types.ts

interface MuseumGrid {
  /** Grid dimensions */
  width: number;   // tiles
  height: number;  // tiles

  /** Scale: meters per tile */
  tileScale: 0.5;

  /** Sparse tile map — only non-void tiles stored */
  /** Sparse tile map — runtime uses Map for O(1) lookups */
  tiles: Map<string, MuseumTile>;  // key: "x,y"

  /** Named regions for wing identification.
   *  Phase 1: rectangular only, no overlaps.
   *  Phase 2: irregular shapes via tile-set membership. */
  wings: WingRegion[];

  /** Player spawn */
  spawn: { x: number; y: number; facing: Direction };

  /** Exhibit definitions (content bound to exhibit tiles) */
  exhibits: ExhibitDefinition[];

  /** Performer definitions (bound to performer tiles) */
  performers: PerformerDefinition[];

  /** Trigger definitions (lore, audio, narrative content) */
  triggers: TriggerDefinition[];
}

/** Serialized format for JSON/Firestore persistence.
 *  Map doesn't survive JSON.stringify — use Record instead. */
interface MuseumGridSerialized {
  width: number;
  height: number;
  tileScale: 0.5;
  tiles: Record<string, MuseumTile>;  // plain object, not Map
  wings: WingRegion[];
  spawn: { x: number; y: number; facing: Direction };
  exhibits: ExhibitDefinition[];
  performers: PerformerDefinition[];
  triggers: TriggerDefinition[];
}

/** Convert between runtime Map and serialized Record formats */
function serializeGrid(grid: MuseumGrid): MuseumGridSerialized;
function deserializeGrid(data: MuseumGridSerialized): MuseumGrid;

type TileType =
  | "floor"              // walkable
  | "wall"               // solid barrier
  | "door"               // walkable, marks wing boundary
  | "exhibit-panel"      // interactable, triggers detail panel
  | "performer-station"  // NPC performer location
  | "torch"              // light source (decorative + maps to 3D light)
  | "pedestal"           // display object
  | "trigger"            // invisible interaction zone
  | "corridor"           // walkable, visually distinct from room floor

interface MuseumTile {
  type: TileType;
  /** Visual variant for themed floors */
  material?: FloorMaterial;
  /** Reference to exhibit/performer by ID */
  refId?: string;
  /** Facing direction for directional tiles (performers, panels) */
  facing?: Direction;
}

type FloorMaterial = "stone" | "marble" | "wood" | "dirt" | "sandstone";
type Direction = "north" | "south" | "east" | "west";

interface WingRegion {
  id: string;
  name: string;
  /** Bounding rectangle on the grid */
  bounds: { x: number; y: number; width: number; height: number };
  /** Theme affects visual rendering in both 2D and 3D */
  theme: WingTheme;
}

type WingTheme = "cave" | "classical" | "modern" | "futuristic" | "outdoor";

interface ExhibitDefinition {
  id: string;
  /** Tile position of the exhibit panel */
  tileX: number;
  tileY: number;
  /** Sequence to display */
  sequenceId?: string;
  /** Plaque content */
  plaque?: {
    title: string;
    subtitle?: string;
    body: string;
    footer?: string;
  };
}

interface PerformerDefinition {
  id: string;
  /** Tile position of the performer */
  tileX: number;
  tileY: number;
  facing: Direction;
  /** Sequence the performer plays */
  sequenceId?: string;
  /** Whether performer starts playing automatically or on trigger */
  autoPlay: boolean;
}

interface TriggerDefinition {
  id: string;
  tileX: number;
  tileY: number;
  /** What happens when player steps on this tile */
  action: "show-lore" | "play-audio" | "show-image" | "custom";
  /** Content to display in detail panel */
  content?: {
    title?: string;
    body: string;
  };
}
```

### Coordinate Convention

- **Origin (0,0):** Top-left of the grid
- **X axis:** Increases east (right)
- **Y axis:** Increases south (down) — standard screen coordinates
- **3D mapping:** tile (x, y) → world position (x × 0.5, 0, y × 0.5) — Y-up in 3D becomes the vertical axis, grid Y maps to 3D Z

### Tile Key Format

Tiles stored as `Map<string, MuseumTile>` with key `"${x},${y}"`. Sparse storage — void tiles (outside rooms) are simply absent from the map. This handles arbitrarily large grids efficiently.

---

## Workstream 1: Museum 2D Walker

### Overview

A new TKA module (`museum-2d`) that renders the tile grid as a playable 2D exploration game. Integrated into the TKA navigation system as a tab under Realm (sibling to Archive, Museum, 3D Controls).

### Integration from Pressure Stones

**Migrated (adapted):**
- `Room.ts` → museum tile grid model
- `Position.ts`, `Direction.ts` → reused directly
- `Player.ts` → museum player (stripped of health/damage)
- `GameBoard.svelte` → museum game board (CSS Grid renderer)
- `Tile.svelte` → museum tile renderer (new tile types)
- `PlayerView.svelte` → museum player sprite
- `AnimationService` → spring physics for movement
- `StorageService` → save/load museum state

**Dropped (puzzle mechanics):**
- Stone pushing, pressure pads, key sequences
- Health system, damage, game over
- Star collection, exit unlocking
- Win conditions

**New:**
- Split-screen layout (50/50, user-resizable, side-swappable)
- Detail panel (plaque text, choreo card, animation, 3D view)
- Exhibit interaction (walk near + press E → detail panel shows content)
- Performer interaction (press E → performer plays sequence)
- Camera viewport following player on large grid
- Wing name display when entering a new region
- Minimap (optional, shows full grid with player position)

### Split-Screen Layout

```
┌─────────────────────┬─────────────────────┐
│                     │                     │
│    2D Museum Game   │    Detail Panel     │
│                     │                     │
│  ┌───────────────┐  │  ┌───────────────┐  │
│  │ tile grid     │  │  │ PLAQUE        │  │
│  │ with player   │  │  │ title, body   │  │
│  │ walking       │  │  │               │  │
│  │ around        │  │  │ SEQUENCE      │  │
│  │               │  │  │ pictograph    │  │
│  └───────────────┘  │  │               │  │
│                     │  │ ▶ Play        │  │
│  [E] Examine        │  │ 🔄 3D View   │  │
│                     │  └───────────────┘  │
├─ ◀ ▶ drag to resize ┤                     │
└─────────────────────┴─────────────────────┘
```

- Default 50/50 split
- Draggable divider (user can resize 40/60 to 60/40)
- Swap button to flip game/panel sides
- Panel is context-sensitive: shows content for nearest/focused exhibit
- Panel tabs: Plaque | Sequence | Animation | 3D View

### Movement System

- **WASD / Arrow keys** for movement
- **Tile-by-tile** with held-key auto-repeat
- Tap: move one tile, smooth animation (0.15s spring)
- Hold: initial 200ms delay, then continuous movement (100ms per tile)
- **E key** to interact with adjacent exhibit/performer
- **Collision:** Cannot walk into wall, pedestal, or performer tiles
- **Camera:** Viewport centers on player, scrolls smoothly as player moves across the large grid

### Detail Panel Content

The panel renders existing TKA components based on what's being examined:

| Context | Panel Shows |
|---------|-------------|
| Near exhibit panel | Plaque text + sequence pictograph + play button |
| Near performer | Performer info + sequence + "Play" to trigger animation |
| Near pedestal | Artifact description |
| Trigger tile | Lore text, audio cue, narrative content |
| Nothing nearby | Wing overview or minimap |

The panel reuses:
- `PlaqueOverlay` content rendering (plaque text)
- `PictographRenderer` for sequence display
- Sequence animation player (existing choreo card animation)
- Eventually: embedded 3D view of the exhibit (IndoorScene rendering just this exhibit)

### Module Registration

New module in TKA navigation system:

```typescript
// In module-definitions.ts or tab-definitions.ts
{
  id: "museum-2d",
  label: "Museum 2D",
  // Registered under Realm as a sibling tab to Archive
}
```

Uses the standard module pattern: `ModuleRenderer` → lazy import → `Museum2DModule.svelte`.

---

## Workstream 2: Floor Plan Editor

### Overview

Extend Pressure Stones' level editor for museum design. The editor produces `MuseumGrid` data that both the 2D walker and 3D pipeline consume.

### Migrated from Pressure Stones Editor

- **Tool palette** → museum tile tools (floor, wall, door, exhibit, performer, torch, pedestal, trigger)
- **Shape drawing** → rectangle fill for rooms, paint mode for corridors
- **Room templates** → wing templates (10×12 cave, 20×16 gallery hall, 8×30 corridor, etc.)
- **Canvas expansion** → grid grows as you build
- **Import/export** → JSON serialization of MuseumGrid
- **Undo/redo** → from Pressure Stones (if implemented) or add

### New Editor Features

- **Wing region tool** — draw a rectangle to define a wing, assign name and theme
- **Exhibit placement** — place exhibit-panel tile, then configure which sequence it displays
- **Performer placement** — place performer-station tile, configure sequence and facing
- **Plaque editor** — inline text editor for plaque content (title, body, footer)
- **Theme preview** — tiles render with wing theme colors (cave = dark brown, modern = white/grey)
- **Grid overlay** — show wing boundaries, door connections, performer sight lines
- **Validation** — check that all rooms are reachable, all doors connect, no orphaned exhibits

### Editor Layout

The editor replaces the game in the left panel. Same split-screen — editor on left, property inspector on right.

```
┌─────────────────────┬─────────────────────┐
│  Tool Palette       │  Properties         │
│  [F][W][D][E][P][T] │                     │
│                     │  Selected: Exhibit   │
│  ┌───────────────┐  │  Sequence: BOOK      │
│  │ grid editor   │  │  Plaque: "The..."   │
│  │ click to      │  │                     │
│  │ place tiles   │  │  Wing: Discovery    │
│  │               │  │  Theme: Cave        │
│  │               │  │                     │
│  └───────────────┘  │  [Preview] [Export]  │
│                     │                     │
│  Templates | Wings  │  Validation         │
└─────────────────────┴─────────────────────┘
```

### Persistence

- **Local:** Save to localStorage (quick iteration)
- **Cloud:** Save to Firestore (share, publish)
- **Export:** Download as JSON file
- **Import:** Load JSON file

---

## Workstream 3: 2D-to-3D Pipeline

### Overview

Convert the tile grid into 3D geometry that the existing IndoorScene renders. This is the bridge that makes the 2D floor plan become a walkable 3D museum.

### Conversion Process

```
MuseumGrid
    ↓
TileGridAnalyzer (identifies rooms, walls, corridors, objects)
    ↓
RoomDefinition[] (one per wing, with connections)
    ↓
RoomGeometryBuilder (existing — grid-snapped geometry + colliders)
    ↓
SolvedRoom[] (walls, floors, ceilings, colliders, objects)
    ↓
IndoorScene (existing — renders with Rapier physics)
```

### TileGridAnalyzer

New service that reads the tile grid and produces RoomDefinitions:

```typescript
interface ITileGridAnalyzer {
  analyze(grid: MuseumGrid): AnalyzedMuseum;
}

interface AnalyzedMuseum {
  rooms: RoomDefinition[];      // One per wing
  connections: ConnectionDef[]; // Doors between wings
  exhibits: ExhibitPlacement[]; // 3D positions for exhibits
  performers: PerformerPlacement[]; // 3D positions for performers
  lights: LightPlacement[];     // 3D positions for torches
}
```

### Tile-to-3D Mapping

| 2D Tile | 3D Result |
|---------|-----------|
| floor | Floor surface at y=0 |
| wall | Box geometry (0.5m × height × 0.5m) + Rapier collider |
| corridor | Floor surface (different material) |
| door | Opening in wall (no geometry, no collider) |
| exhibit-panel | Flat mesh on wall (display surface). Wall attachment inferred: if tile opposite to `facing` is a wall tile, panel is wall-mounted; otherwise freestanding. |
| performer-station | Avatar3D + Staff3D + Grid3D at tile position |
| torch | PointLight + torch mesh |
| pedestal | Cylinder/box geometry + Rapier collider |
| trigger | Invisible proximity zone (no geometry) |

### Scale Conversion

- Tile (x, y) → 3D (x × 0.5, 0, y × 0.5)
- Wall height: derived from wing theme (cave: 4.5m, classical: 6m, modern: 3.5m)
- Ceiling: auto-generated at wall height
- Floor material: from tile's `material` field or wing theme default

### Room Detection Algorithm

1. Identify wing regions from `MuseumGrid.wings`
2. For each wing, extract all tiles within the wing's bounds
3. Find wall tiles → these become wall geometry
4. Find floor/corridor tiles → these become floor surfaces
5. Find door tiles at wing boundaries → these become connections between RoomDefinitions
6. Find object tiles (exhibit, performer, torch, pedestal) → these become placed objects

### Integration with Existing 3D

The analyzed museum feeds directly into the Archive destination:

```typescript
// In ArchiveDestination.svelte (future version)
const grid = loadMuseumGrid(); // From Firestore or JSON
const analyzer = new TileGridAnalyzer();
const analyzed = analyzer.analyze(grid);

// Render each wing as an IndoorScene
{#each analyzed.rooms as room}
  <IndoorScene room={roomGeometryBuilder.build(room)}>
    <!-- exhibits, performers, lights from analyzed data -->
  </IndoorScene>
{/each}
```

For Phase 1, the Archive renders one wing at a time (walk through door → load next wing's IndoorScene). Phase 2 adds seamless multi-wing rendering.

---

## File Structure

```
src/lib/features/museum-2d/
  Museum2DModule.svelte              — Module entry point

  domain/
    museum-grid-types.ts             — MuseumGrid, MuseumTile, TileType, etc.
    tile-registry.ts                 — Tile metadata (walkable, renderable, interactable)

  state/
    museum-2d-state.svelte.ts        — Game state (player position, focused exhibit, etc.)
    museum-2d-context.ts             — Context distribution for game state
    editor-state.svelte.ts           — Editor state (selected tool, grid, undo stack)
    editor-context.ts                — Context distribution for editor state

  components/
    game/
      Museum2DGame.svelte            — Game view (tile grid + player + camera)
      MuseumTileRenderer.svelte      — Renders individual tiles by type
      MuseumPlayerView.svelte        — Player sprite with movement animation
      MuseumCamera.svelte            — Viewport management for large grids
      InteractionPrompt.svelte       — "Press E" prompt near interactables

    panel/
      DetailPanel.svelte             — Context-sensitive right panel
      PlaqueView.svelte              — Plaque text rendering
      SequenceView.svelte            — Pictograph/choreo card display
      PerformerView.svelte           — Performer info + play controls

    editor/
      Museum2DEditor.svelte          — Editor view
      EditorToolPalette.svelte       — Tile placement tools
      EditorCanvas.svelte            — Editable grid
      WingRegionTool.svelte          — Draw wing boundaries
      PropertyInspector.svelte       — Selected tile/wing properties
      TemplateLibrary.svelte         — Pre-built wing templates
      ValidationPanel.svelte         — Reachability + connectivity checks

    layout/
      SplitScreenLayout.svelte       — Resizable, swappable 50/50 layout

  services/
    contracts/
      ITileGridAnalyzer.ts
      IMuseumGridPersister.ts
    implementations/
      TileGridAnalyzer.ts            — Grid → RoomDefinition[] conversion
      MuseumGridPersister.ts         — Save/load to Firestore + JSON export

  di/
    museum-2d-container.ts           — ITI container for museum-2d services

  data/
    wing-templates.ts                — Pre-built wing templates (cave, gallery, corridor)
```

---

## Migration Strategy: Pressure Stones → TKA

### What Migrates

| Pressure Stones File | TKA Destination | Adaptation |
|---------------------|-----------------|------------|
| `shared/domain/Position.ts` | `museum-2d/domain/` | Reuse as-is |
| `shared/domain/Direction.ts` | `museum-2d/domain/` | Rewrite: "up/down/left/right" → "north/south/east/west" to match 3D `WallId` |
| `shared/domain/Room.ts` | `museum-2d/domain/museum-grid-types.ts` | Replace tile types |
| `shared/animation/AnimationService.ts` | `museum-2d/services/` | Reuse spring physics |
| `features/game/components/GameBoard.svelte` | `museum-2d/components/game/Museum2DGame.svelte` | Replace puzzle rendering with museum |
| `features/game/components/Tile.svelte` | `museum-2d/components/game/MuseumTileRenderer.svelte` | New tile visuals |
| `features/game/components/PlayerView.svelte` | `museum-2d/components/game/MuseumPlayerView.svelte` | Remove health, add facing |
| `features/editor/components/EditorCanvas.svelte` | `museum-2d/components/editor/EditorCanvas.svelte` | New tools, larger grid |
| `features/editor/components/ToolPalette.svelte` | `museum-2d/components/editor/EditorToolPalette.svelte` | Museum tile tools |
| `features/editor/state/EditorState.ts` | `museum-2d/state/editor-state.svelte.ts` | Svelte 5 runes pattern |

### What Doesn't Migrate

- Puzzle mechanics (stones, pads, key sequences, health, damage)
- Win conditions / game over
- Campaign / level progression
- Feedback system (TKA has its own)
- Firebase config (TKA has its own)
- Navigation system (TKA has its own)
- Theme system (TKA has its own)
- DI container (merge into TKA's ITI container)

### Migration Approach

Not a copy-paste. Each file is read, understood, and rewritten to fit TKA's patterns:
- Svelte 5 runes (Pressure Stones already uses these)
- ITI dependency injection (Pressure Stones uses Inversify — similar but different API)
- TKA's CSS variable system for theming
- TKA's state management pattern (factory + context)
- TKA's service naming convention (no "Service" suffix)

---

## Parallel Workstream Boundaries

To prevent conflicts when three agents work simultaneously:

### Pre-Work (written before any agent starts)
- `src/lib/features/museum-2d/domain/museum-grid-types.ts` — shared data format (types + serialization helpers)
- `src/lib/features/museum-2d/domain/tile-registry.ts` — tile metadata (walkable, renderable, interactable)
- `src/lib/features/museum-2d/domain/` is **read-only for all agents** after pre-work

### Agent 1: Museum 2D Walker
**Touches only:**
- `src/lib/features/museum-2d/state/museum-2d-state.svelte.ts`
- `src/lib/features/museum-2d/state/museum-2d-context.ts`
- `src/lib/features/museum-2d/components/game/`
- `src/lib/features/museum-2d/components/panel/`
- `src/lib/features/museum-2d/components/layout/`
- `src/lib/features/museum-2d/Museum2DModule.svelte`

### Agent 2: Floor Plan Editor
**Touches only:**
- `src/lib/features/museum-2d/state/editor-state.svelte.ts`
- `src/lib/features/museum-2d/state/editor-context.ts`
- `src/lib/features/museum-2d/components/editor/`
- `src/lib/features/museum-2d/data/wing-templates.ts`

### Agent 3: 2D-to-3D Pipeline
**Touches only:**
- `src/lib/features/museum-2d/services/`
- `src/lib/features/museum-2d/di/museum-2d-container.ts` (DI container registration)
- `src/lib/shared/3d/indoor/` (extending existing RoomGeometryBuilder if needed)
- `tests/unit/museum-2d/` (new tests for TileGridAnalyzer)

---

## Phased Delivery

### Phase 1: Walking Museum (This Spec)

- Shared tile types and grid schema
- Museum 2D walker (game board, player, camera, movement)
- Split-screen layout with detail panel
- Basic exhibit interaction (walk near + E → show plaque)
- Floor plan editor (place tiles, draw rooms, export JSON)
- 2D-to-3D analyzer (tile grid → RoomDefinition[])
- Discovery Chamber defined in tile grid format
- Module registered in TKA navigation

### Phase 2: Rich Content

- Performer rendering in detail panel (play sequences)
- Embedded 3D view in detail panel
- Sequence browser integration (pick sequences for exhibits)
- Multiple wing templates
- Minimap overlay

### Phase 3: Full Pipeline

- Live 3D preview from editor (edit 2D → see 3D update in real-time)
- Multi-wing 3D rendering (walk through doors between IndoorScenes)
- Performer avatars in 3D from 2D performer station placements
- Save/load museum layouts to Firestore
- Publish museum for other users to explore

---

## Success Criteria

1. Walk through a 2D museum with WASD, see exhibits, read plaques in the detail panel
2. Use the editor to design a wing, place walls/exhibits/performers, export as JSON
3. Load that JSON into the 3D Archive and walk through the same room in first person
4. The 2D and 3D versions are recognizably the same space
5. Three agents can work on their workstreams without file conflicts
