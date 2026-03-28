# 2D Museum Walker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT: This plan has 4 workstreams. Pre-Work runs first. Then Workstreams 1-3 run in parallel with non-overlapping file boundaries.**

**Goal:** Integrate Pressure Stones into TKA as a 2D museum exploration game with floor plan editor and 3D export pipeline.

**Architecture:** Shared tile grid types (pre-work) → three parallel workstreams: (1) Museum 2D walker game, (2) Floor plan editor, (3) 2D-to-3D pipeline via TileGridAnalyzer. All workstreams consume the same MuseumGrid data format. Pressure Stones code at `E:/_ARCHIVE/pressure-stones/` is the starting reference for game board, editor, and movement systems.

**Tech Stack:** Svelte 5 (runes), TypeScript, CSS Grid rendering, ITI DI, Firebase

**Spec:** `docs/superpowers/specs/2026-03-28-2d-museum-walker-design.md`

**Reference codebase:** `E:/_ARCHIVE/pressure-stones/` (Svelte 5 tile game with editor)

---

## File Structure

```
PRE-WORK (shared, read-only after creation):
src/lib/features/museum-2d/
  domain/
    museum-grid-types.ts             — MuseumGrid, MuseumTile, TileType, serialization
    tile-registry.ts                 — Tile metadata (walkable, interactable, renderable)

WORKSTREAM 1 — Museum 2D Walker (Agent 1):
src/lib/features/museum-2d/
  Museum2DModule.svelte              — Module entry point
  state/
    museum-2d-state.svelte.ts        — Game state factory
    museum-2d-context.ts             — Context distribution
  components/
    game/
      Museum2DGame.svelte            — Game board with CSS Grid
      MuseumTileRenderer.svelte      — Renders one tile by type
      MuseumPlayerView.svelte        — Player sprite with animation
      MuseumCamera.svelte            — Viewport/scroll management
      InteractionPrompt.svelte       — "Press E" prompt
    panel/
      DetailPanel.svelte             — Context-sensitive right panel
      PlaqueView.svelte              — Plaque text rendering
      SequenceView.svelte            — Pictograph display
    layout/
      SplitScreenLayout.svelte       — Resizable 50/50 split

WORKSTREAM 2 — Floor Plan Editor (Agent 2):
src/lib/features/museum-2d/
  state/
    editor-state.svelte.ts           — Editor state factory
    editor-context.ts                — Context distribution
  components/
    editor/
      Museum2DEditor.svelte          — Editor view
      EditorToolPalette.svelte       — Tile placement tools
      EditorCanvas.svelte            — Editable grid
      PropertyInspector.svelte       — Selected tile/wing properties
  data/
    wing-templates.ts                — Pre-built wing templates

WORKSTREAM 3 — 2D-to-3D Pipeline (Agent 3):
src/lib/features/museum-2d/
  services/
    contracts/
      ITileGridAnalyzer.ts
      IMuseumGridPersister.ts
    implementations/
      TileGridAnalyzer.ts            — Grid → RoomDefinition[] conversion
      MuseumGridPersister.ts         — Save/load to JSON + Firestore
  di/
    museum-2d-container.ts           — ITI container

tests/unit/museum-2d/
  TileGridAnalyzer.test.ts
  MuseumGridSerializer.test.ts

MODIFIED (module registration):
src/lib/shared/navigation/config/tab-definitions.ts  — Add museum-2d tab
src/lib/shared/modules/ModuleRenderer.svelte         — Add module loader
```

---

## Pre-Work: Shared Types (Run First, Before Any Agent)

### Task 0A: Museum Grid Types

**Files:**
- Create: `src/lib/features/museum-2d/domain/museum-grid-types.ts`

- [ ] **Step 1: Create directory and types file**

Read `E:/_ARCHIVE/pressure-stones/src/lib/shared/domain/Position.ts` and `Direction.ts` for reference on the coordinate model. Then create the museum grid types file with all types from the spec:

```typescript
// Types: MuseumGrid, MuseumGridSerialized, MuseumTile, TileType,
// FloorMaterial, Direction, WingRegion, WingTheme,
// ExhibitDefinition, PerformerDefinition, TriggerDefinition
// Functions: serializeGrid(), deserializeGrid()
// Use compass directions (north/south/east/west) NOT up/down/left/right
```

Include the `serializeGrid` and `deserializeGrid` functions that convert between `Map<string, MuseumTile>` (runtime) and `Record<string, MuseumTile>` (JSON-safe). These are critical — Map doesn't survive JSON roundtrips.

- [ ] **Step 2: Verify build**

Run: `npm run check 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/museum-2d/domain/museum-grid-types.ts
git commit -m "feat(museum-2d): add shared museum grid types and serialization

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 0B: Tile Registry

**Files:**
- Create: `src/lib/features/museum-2d/domain/tile-registry.ts`

- [ ] **Step 1: Create tile metadata registry**

Maps each `TileType` to its behavioral properties:

```typescript
interface TileMetadata {
  walkable: boolean;      // Can player walk on this tile?
  interactable: boolean;  // Does E key do something here?
  solid: boolean;         // Blocks movement?
  renders3D: boolean;     // Has a 3D equivalent?
  cssClass: string;       // CSS class for 2D rendering
  icon?: string;          // Font Awesome icon (optional)
  label: string;          // Human-readable name for editor
}

const TILE_REGISTRY: Record<TileType, TileMetadata> = {
  floor:             { walkable: true,  interactable: false, solid: false, renders3D: true,  cssClass: "tile-floor",     label: "Floor" },
  wall:              { walkable: false, interactable: false, solid: true,  renders3D: true,  cssClass: "tile-wall",      label: "Wall" },
  door:              { walkable: true,  interactable: false, solid: false, renders3D: true,  cssClass: "tile-door",      label: "Door" },
  "exhibit-panel":   { walkable: false, interactable: true,  solid: true,  renders3D: true,  cssClass: "tile-exhibit",   label: "Exhibit", icon: "fa-image" },
  "performer-station": { walkable: false, interactable: true, solid: true, renders3D: true, cssClass: "tile-performer", label: "Performer", icon: "fa-person" },
  torch:             { walkable: false, interactable: false, solid: false, renders3D: true,  cssClass: "tile-torch",     label: "Torch", icon: "fa-fire" },
  pedestal:          { walkable: false, interactable: true,  solid: true,  renders3D: true,  cssClass: "tile-pedestal",  label: "Pedestal" },
  trigger:           { walkable: true,  interactable: false, solid: false, renders3D: false, cssClass: "tile-trigger",   label: "Trigger" },
  corridor:          { walkable: true,  interactable: false, solid: false, renders3D: true,  cssClass: "tile-corridor",  label: "Corridor" },
};

export function getTileMetadata(type: TileType): TileMetadata;
export function isWalkable(type: TileType): boolean;
export function isSolid(type: TileType): boolean;
export function isInteractable(type: TileType): boolean;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/museum-2d/domain/tile-registry.ts
git commit -m "feat(museum-2d): add tile registry with behavioral metadata

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 0C: Register Module in TKA Navigation

**Files:**
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts`
- Modify: `src/lib/shared/modules/ModuleRenderer.svelte`

- [ ] **Step 1: Add museum-2d tab definition**

Read `tab-definitions.ts` to understand the pattern. Add a `museum-2d` tab under Realm, as a sibling to Archive, Museum, and 3D Controls.

- [ ] **Step 2: Add module loader**

Read `ModuleRenderer.svelte` to understand the lazy loading pattern. Add:
```typescript
"museum-2d": () => import("../../features/museum-2d/Museum2DModule.svelte"),
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/navigation/config/tab-definitions.ts \
        src/lib/shared/modules/ModuleRenderer.svelte
git commit -m "feat(museum-2d): register module in TKA navigation

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Workstream 1: Museum 2D Walker (Agent 1)

**Depends on:** Pre-Work (Tasks 0A-0C)
**File boundary:** `state/museum-2d-*`, `components/game/`, `components/panel/`, `components/layout/`, `Museum2DModule.svelte`

### Task 1A: Split-Screen Layout

**Files:**
- Create: `src/lib/features/museum-2d/components/layout/SplitScreenLayout.svelte`

- [ ] **Step 1: Build the resizable split layout**

Reference: This is the 50/50 layout from the spec. Features:
- Two slots (left panel, right panel) via Svelte snippets
- Draggable divider between them (40%-60% range)
- Swap button to flip left/right
- Persists ratio and side preference to localStorage

Read Pressure Stones' layout approach for reference: `E:/_ARCHIVE/pressure-stones/src/routes/+page.svelte`

Key implementation:
- Use CSS flexbox with `flex-basis` controlled by a reactive variable
- `mousedown` on divider → track `mousemove` → update ratio
- Swap button toggles a `reversed` boolean that swaps the snippet render order

- [ ] **Step 2: Verify it renders**

Create a minimal test harness in Museum2DModule.svelte:
```svelte
<SplitScreenLayout>
  {#snippet left()}<div>Game goes here</div>{/snippet}
  {#snippet right()}<div>Panel goes here</div>{/snippet}
</SplitScreenLayout>
```

- [ ] **Step 3: Commit**

### Task 1B: Game State

**Files:**
- Create: `src/lib/features/museum-2d/state/museum-2d-state.svelte.ts`
- Create: `src/lib/features/museum-2d/state/museum-2d-context.ts`

- [ ] **Step 1: Create state factory**

Follow TKA's factory + context pattern (see `.claude/rules/state-management.md`).

State to track:
```typescript
function createMuseum2DState(grid: MuseumGrid) {
  let playerX = $state(grid.spawn.x);
  let playerY = $state(grid.spawn.y);
  let playerFacing = $state(grid.spawn.facing);
  let isMoving = $state(false);
  let focusedExhibitId = $state<string | null>(null);
  let focusedPerformerId = $state<string | null>(null);
  let focusedTriggerId = $state<string | null>(null);
  let mode = $state<"play" | "edit">("play");

  // Derived: what's near the player (check adjacent tiles for interactables)
  // Derived: current wing (which WingRegion contains player position)

  return {
    // getters, setters, movePlayer(), interact(), etc.
  };
}
```

Reference `E:/_ARCHIVE/pressure-stones/src/lib/features/game/state/GameState.ts` for the movement and collision logic pattern.

- [ ] **Step 2: Create context file**

```typescript
import { getContext, setContext } from "svelte";
const KEY = Symbol("museum-2d");
export function setMuseum2DContext(state) { setContext(KEY, state); }
export function getMuseum2DContext() { return getContext(KEY); }
```

- [ ] **Step 3: Commit**

### Task 1C: Tile Renderer

**Files:**
- Create: `src/lib/features/museum-2d/components/game/MuseumTileRenderer.svelte`

- [ ] **Step 1: Create tile renderer component**

Reference `E:/_ARCHIVE/pressure-stones/src/lib/features/game/components/Tile.svelte` for the rendering pattern.

Props: `{ tile: MuseumTile | null, x: number, y: number }`

Renders a single tile as a styled `<div>` based on `tile.type`:
- `floor`: dark stone texture (CSS background)
- `wall`: raised stone with border depth
- `corridor`: slightly different floor color
- `door`: green-tinted floor
- `exhibit-panel`: display icon
- `performer-station`: person icon
- `torch`: fire glow effect (CSS animation)
- `pedestal`: grey block
- `trigger`: invisible (same as floor)
- `null` (void): completely dark

Use CSS classes from `tile-registry.ts` and Font Awesome icons.

Apply `material` variant for themed floors (stone/marble/wood/dirt/sandstone).

- [ ] **Step 2: Commit**

### Task 1D: Player View

**Files:**
- Create: `src/lib/features/museum-2d/components/game/MuseumPlayerView.svelte`

- [ ] **Step 1: Create player sprite component**

Reference `E:/_ARCHIVE/pressure-stones/src/lib/features/game/components/PlayerView.svelte` for animation.

Props: `{ x: number, y: number, facing: Direction, tileSize: number }`

Renders the player as an absolutely-positioned element over the tile grid:
- Circle with directional indicator (shows which way player faces)
- CSS transition for smooth movement between tiles (0.15s cubic-bezier)
- Position calculated from `x * tileSize, y * tileSize`

- [ ] **Step 2: Commit**

### Task 1E: Camera / Viewport

**Files:**
- Create: `src/lib/features/museum-2d/components/game/MuseumCamera.svelte`

- [ ] **Step 1: Create viewport component**

The camera component manages scrolling on large grids. It wraps the tile grid in a viewport that follows the player.

Props: `{ playerX: number, playerY: number, tileSize: number, gridWidth: number, gridHeight: number, children: Snippet }`

Implementation:
- Container div with `overflow: hidden` at the panel's available size
- Inner div sized to full grid (`gridWidth * tileSize × gridHeight * tileSize`)
- `transform: translate()` to center the viewport on the player
- Smooth CSS transition on transform for scrolling effect
- Clamp scroll so edges don't show void past the grid

- [ ] **Step 2: Commit**

### Task 1F: Game Board (Assembly)

**Files:**
- Create: `src/lib/features/museum-2d/components/game/Museum2DGame.svelte`
- Create: `src/lib/features/museum-2d/components/game/InteractionPrompt.svelte`

- [ ] **Step 1: Create game board**

Assembles the full game view:
- Reads game state from context
- Renders CSS Grid of `MuseumTileRenderer` for all tiles in the grid
- Overlays `MuseumPlayerView` at player position
- Wraps in `MuseumCamera` for scrolling
- Shows `InteractionPrompt` when player is adjacent to an interactable tile

Keyboard handling:
- WASD / Arrow keys → move player (tile-by-tile)
- Hold key → 200ms delay then auto-repeat at 100ms per tile
- E key → interact with adjacent interactable
- Movement blocked by solid tiles (`isSolid()` from tile-registry)

Reference `E:/_ARCHIVE/pressure-stones/src/lib/features/game/components/GameBoard.svelte` for grid rendering pattern.
Reference `E:/_ARCHIVE/pressure-stones/src/lib/features/game/components/PlayView.svelte` for keyboard input handling.

- [ ] **Step 2: Create interaction prompt**

Small overlay that appears when player is adjacent to an interactable tile. Shows "Press E — [tile label]".

- [ ] **Step 3: Commit**

### Task 1G: Detail Panel

**Files:**
- Create: `src/lib/features/museum-2d/components/panel/DetailPanel.svelte`
- Create: `src/lib/features/museum-2d/components/panel/PlaqueView.svelte`
- Create: `src/lib/features/museum-2d/components/panel/SequenceView.svelte`

- [ ] **Step 1: Create detail panel**

Context-sensitive right panel. Reads focused exhibit/performer/trigger from game state.

Tabs: Plaque | Sequence | Animation (only relevant tabs shown based on content type)

When nothing is focused: shows current wing name and description, or a welcome message.

- [ ] **Step 2: Create plaque view**

Renders plaque content (title, subtitle, body, footer) with museum-themed typography (Georgia/serif).

Reference the existing `PlaqueOverlay.svelte` from the Archive for the text rendering style: `src/lib/features/realm/destinations/archive/components/PlaqueOverlay.svelte`

- [ ] **Step 3: Create sequence view**

Renders a sequence pictograph. Imports and uses the existing `PictographRenderer` from the TKA codebase.

For Phase 1: show a static pictograph of the exhibit's sequence. Phase 2 adds animation playback.

- [ ] **Step 4: Commit**

### Task 1H: Module Entry Point

**Files:**
- Modify: `src/lib/features/museum-2d/Museum2DModule.svelte`

- [ ] **Step 1: Wire everything together**

The module entry point:
1. Loads a sample `MuseumGrid` (hardcoded Discovery Chamber for now, or from JSON)
2. Creates game state via `createMuseum2DState(grid)`
3. Sets context via `setMuseum2DContext()`
4. Renders `SplitScreenLayout` with `Museum2DGame` on left and `DetailPanel` on right

- [ ] **Step 2: Create a sample Discovery Chamber grid**

Hardcode a small MuseumGrid matching the Discovery Chamber layout:
- 20×24 tiles (10m × 12m at 0.5m/tile)
- Walls around perimeter
- Entrance gap at south
- Pedestal near north wall
- 4 torches
- 1 exhibit panel + 1 performer station
- Plaque content from existing `lascaux-plaque.ts`

- [ ] **Step 3: Verify in browser**

Navigate to the Museum 2D tab. Verify:
- Split-screen layout renders
- Tile grid is visible with walls, floor, objects
- Player sprite is visible
- WASD moves the player
- Can't walk through walls
- E key near exhibit shows plaque in detail panel

- [ ] **Step 4: Commit**

---

## Workstream 2: Floor Plan Editor (Agent 2)

**Depends on:** Pre-Work (Tasks 0A-0C)
**File boundary:** `state/editor-*`, `components/editor/`, `data/`

### Task 2A: Editor State

**Files:**
- Create: `src/lib/features/museum-2d/state/editor-state.svelte.ts`
- Create: `src/lib/features/museum-2d/state/editor-context.ts`

- [ ] **Step 1: Create editor state factory**

Reference `E:/_ARCHIVE/pressure-stones/src/lib/features/editor/state/EditorState.ts` — but rewrite using TKA's factory + context pattern (NO module-level singletons).

State to track:
```typescript
function createEditorState() {
  let grid = $state<MuseumGrid>(createEmptyGrid(40, 40));
  let selectedTool = $state<TileType | "eraser" | "wing-region">("floor");
  let selectedMaterial = $state<FloorMaterial>("stone");
  let selectedWingTheme = $state<WingTheme>("cave");
  let isDrawing = $state(false);
  let drawMode = $state<"paint" | "rectangle">("paint");

  // Undo stack
  let undoStack = $state<MuseumGridSerialized[]>([]);
  let redoStack = $state<MuseumGridSerialized[]>([]);

  return {
    // getters, setters
    // placeTile(x, y, type), eraseTile(x, y)
    // fillRectangle(x1, y1, x2, y2, type)
    // undo(), redo()
    // exportGrid(): MuseumGridSerialized
    // importGrid(data: MuseumGridSerialized)
  };
}
```

- [ ] **Step 2: Create context file**

Same pattern as museum-2d-context.ts.

- [ ] **Step 3: Commit**

### Task 2B: Tool Palette

**Files:**
- Create: `src/lib/features/museum-2d/components/editor/EditorToolPalette.svelte`

- [ ] **Step 1: Create tool palette**

Reference `E:/_ARCHIVE/pressure-stones/src/lib/features/editor/components/ToolPalette.svelte`.

Vertical toolbar with buttons for each tile type:
- Floor, Wall, Corridor, Door
- Exhibit Panel, Performer Station, Pedestal
- Torch, Trigger
- Eraser
- Wing Region tool

Each button shows icon + label. Selected tool highlighted.
Draw mode toggle: Paint / Rectangle.

- [ ] **Step 2: Commit**

### Task 2C: Editor Canvas

**Files:**
- Create: `src/lib/features/museum-2d/components/editor/EditorCanvas.svelte`

- [ ] **Step 1: Create editable grid**

Reference `E:/_ARCHIVE/pressure-stones/src/lib/features/editor/components/EditorCanvas.svelte`.

Renders the MuseumGrid as a CSS Grid. Click/drag to place tiles with the selected tool.

Features:
- Click to place single tile
- Drag to paint tiles (in paint mode)
- Click-drag to draw rectangle (in rectangle mode) — preview shown during drag
- Right-click to erase
- Hover shows tile type preview
- Grid lines visible
- Dynamic tile size based on container width (`containerWidth / gridWidth` clamped 16-48px)

- [ ] **Step 2: Commit**

### Task 2D: Property Inspector

**Files:**
- Create: `src/lib/features/museum-2d/components/editor/PropertyInspector.svelte`

- [ ] **Step 1: Create property inspector**

Right panel in editor mode. Shows properties for:
- **Selected tile:** Type, material, facing, refId
- **Selected wing region:** Name, theme, bounds
- **Grid:** Width, height, export/import buttons

For exhibit tiles: sequence picker (text input for sequence ID for now).
For performer tiles: facing direction picker + sequence ID.
For plaque content: title + body text inputs.

- [ ] **Step 2: Commit**

### Task 2E: Wing Templates

**Files:**
- Create: `src/lib/features/museum-2d/data/wing-templates.ts`

- [ ] **Step 1: Create wing template data**

Pre-built wing templates that can be stamped onto the grid:

```typescript
interface WingTemplate {
  id: string;
  name: string;
  width: number;   // tiles
  height: number;  // tiles
  tiles: Record<string, MuseumTile>;  // relative to template origin
  theme: WingTheme;
}

export const WING_TEMPLATES: WingTemplate[] = [
  { id: "cave-small", name: "Small Cave (10m×12m)", width: 20, height: 24, ... },
  { id: "gallery-hall", name: "Gallery Hall (20m×16m)", width: 40, height: 32, ... },
  { id: "corridor-long", name: "Long Corridor (4m×20m)", width: 8, height: 40, ... },
  { id: "grand-chamber", name: "Grand Chamber (16m×16m)", width: 32, height: 32, ... },
];
```

Each template includes walls, floor, entrance gaps, and torch placements.

- [ ] **Step 2: Commit**

### Task 2F: Editor Assembly

**Files:**
- Create: `src/lib/features/museum-2d/components/editor/Museum2DEditor.svelte`

- [ ] **Step 1: Assemble editor view**

Combines:
- `EditorToolPalette` on the left edge
- `EditorCanvas` as the main area
- `PropertyInspector` on the right (uses the SplitScreenLayout from Workstream 1)
- Template library as a bottom drawer/modal
- Export/import buttons
- Undo/redo buttons (Ctrl+Z, Ctrl+Shift+Z)

The editor replaces the game in the left panel when in edit mode. The Museum2DModule switches between game and editor based on `mode` state.

- [ ] **Step 2: Verify in browser**

Switch to edit mode. Place walls, floors, exhibits. Switch back to play mode and walk through what you built.

- [ ] **Step 3: Commit**

---

## Workstream 3: 2D-to-3D Pipeline (Agent 3)

**Depends on:** Pre-Work (Tasks 0A-0C)
**File boundary:** `services/`, `di/`, `tests/unit/museum-2d/`

### Task 3A: TileGridAnalyzer Interface

**Files:**
- Create: `src/lib/features/museum-2d/services/contracts/ITileGridAnalyzer.ts`

- [ ] **Step 1: Create analyzer interface**

```typescript
import type { MuseumGrid } from "../../domain/museum-grid-types";
import type { RoomDefinition, ConnectionDefinition } from "$lib/shared/3d/indoor/domain/room-types";

interface AnalyzedMuseum {
  rooms: RoomDefinition[];
  connections: ConnectionDef[];
  exhibits: ExhibitPlacement[];
  performers: PerformerPlacement[];
  lights: LightPlacement[];
}

interface ExhibitPlacement {
  id: string;
  position: [number, number, number]; // 3D world position
  facing: number; // yaw radians
  sequenceId?: string;
}

interface PerformerPlacement {
  id: string;
  position: [number, number, number];
  facing: number;
  sequenceId?: string;
  autoPlay: boolean;
}

interface LightPlacement {
  type: "torch" | "spotlight";
  position: [number, number, number];
  intensity?: number;
}

interface ConnectionDef {
  fromWingId: string;
  toWingId: string;
  position: [number, number, number]; // door position in 3D
}

export interface ITileGridAnalyzer {
  analyze(grid: MuseumGrid): AnalyzedMuseum;
}
```

- [ ] **Step 2: Commit**

### Task 3B: TileGridAnalyzer Tests

**Files:**
- Create: `tests/unit/museum-2d/TileGridAnalyzer.test.ts`

- [ ] **Step 1: Write failing tests**

Test scenarios:
1. Simple rectangular room → produces 1 RoomDefinition with correct dimensions
2. Room with walls → RoomDefinition has wall segments
3. Room with exhibit tile → ExhibitPlacement at correct 3D position
4. Room with performer tile → PerformerPlacement at correct 3D position
5. Room with torch tile → LightPlacement at correct 3D position
6. Two rooms connected by door tiles → 2 RoomDefinitions + 1 ConnectionDef
7. Tile (5, 10) at 0.5m scale → 3D position (2.5, 0, 5.0)
8. Direction "north" → facing yaw Math.PI

Helper: create test grids programmatically using `deserializeGrid()`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/museum-2d/TileGridAnalyzer.test.ts`

- [ ] **Step 3: Commit**

### Task 3C: TileGridAnalyzer Implementation

**Files:**
- Create: `src/lib/features/museum-2d/services/implementations/TileGridAnalyzer.ts`

- [ ] **Step 1: Implement analyzer**

Key algorithms:

**Wing extraction:**
1. For each `WingRegion` in the grid, collect all tiles within bounds
2. Find wall tiles → convert to RoomDefinition walls
3. Find floor/corridor tiles → determine room dimensions
4. Find door tiles at wing edges → create ConnectionDefs

**Coordinate conversion:**
```typescript
function tileToWorld(tileX: number, tileY: number, tileScale: number): [number, number, number] {
  return [tileX * tileScale, 0, tileY * tileScale];
}
```

**Direction to yaw:**
```typescript
function directionToYaw(dir: Direction): number {
  switch (dir) {
    case "north": return Math.PI;
    case "south": return 0;
    case "east": return -Math.PI / 2;
    case "west": return Math.PI / 2;
  }
}
```

**Wall detection:** Scan wing tiles, find wall tiles, merge adjacent walls into wall segments (horizontal runs and vertical runs) for efficient 3D geometry.

**Object extraction:** For each exhibit/performer/torch tile, create the corresponding placement with 3D coordinates.

- [ ] **Step 2: Run tests until green**

Run: `npx vitest run tests/unit/museum-2d/TileGridAnalyzer.test.ts`

- [ ] **Step 3: Commit**

### Task 3D: Grid Serializer Tests

**Files:**
- Create: `tests/unit/museum-2d/MuseumGridSerializer.test.ts`

- [ ] **Step 1: Write serialization round-trip tests**

Test that `serializeGrid(deserializeGrid(data))` produces the same data.
Test that Map keys survive the round-trip.
Test that empty grids serialize correctly.
Test with exhibits, performers, triggers.

- [ ] **Step 2: Run tests**

These should already pass since serialization was implemented in Task 0A. If not, fix.

- [ ] **Step 3: Commit**

### Task 3E: Museum Grid Persister

**Files:**
- Create: `src/lib/features/museum-2d/services/contracts/IMuseumGridPersister.ts`
- Create: `src/lib/features/museum-2d/services/implementations/MuseumGridPersister.ts`

- [ ] **Step 1: Create persister interface and implementation**

```typescript
interface IMuseumGridPersister {
  saveToJson(grid: MuseumGrid): string;
  loadFromJson(json: string): MuseumGrid;
  saveToFirestore(userId: string, grid: MuseumGrid): Promise<void>;
  loadFromFirestore(userId: string): Promise<MuseumGrid | null>;
}
```

Phase 1: implement JSON save/load only. Firestore methods can be stubs that throw "not implemented yet."

Uses `serializeGrid` / `deserializeGrid` from the shared types.

- [ ] **Step 2: Commit**

### Task 3F: DI Container

**Files:**
- Create: `src/lib/features/museum-2d/di/museum-2d-container.ts`

- [ ] **Step 1: Create ITI container**

Register `TileGridAnalyzer` and `MuseumGridPersister` in an ITI container. Follow the pattern in `src/lib/shared/di/containers/` — read an existing container file for reference.

- [ ] **Step 2: Commit**

---

## Final Integration

### Task F1: Verify Full Loop

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run tests/unit/museum-2d/ tests/unit/indoor/ 2>&1 | tail -15`

- [ ] **Step 2: Run typecheck**

Run: `npm run check 2>&1 | tail -5`

- [ ] **Step 3: Visual verification**

Navigate to Museum 2D tab:
- [ ] Split-screen renders (game left, panel right)
- [ ] Discovery Chamber tile grid visible
- [ ] WASD moves player through rooms
- [ ] Can't walk through walls
- [ ] E near exhibit shows plaque in detail panel
- [ ] Switch to editor mode → can place/erase tiles
- [ ] Export grid as JSON → import it back → same layout

Test 3D pipeline:
- [ ] Load exported JSON → run TileGridAnalyzer → produces RoomDefinitions
- [ ] RoomDefinitions have correct wall positions and dimensions

- [ ] **Step 4: Commit any final fixes**
