# Floor Plan Editor Design

**Date:** 2026-03-29
**Status:** Draft
**Scope:** Full design spec for the museum floor plan editor that lets users polish algorithmically-generated room layouts by hand

---

## Problem

The museum layout pipeline generates a `MuseumGrid` from a room graph (`MuseumGridBuilder.build()`). The output is functional but rigid. Room shapes follow bounding rectangles, corridor routing uses L-shaped paths, and exhibit placement is formula-driven. The result is a playable museum, but it looks algorithmic.

Hand-polishing is the missing step. A level designer (Austen) needs to:
- Reshape room boundaries (round off corners, add alcoves, carve irregular walls)
- Adjust corridor widths and add decorative details
- Reposition exhibits that the algorithm placed in suboptimal spots
- Add environmental storytelling (scaffolding in construction zones, rope barriers in the VTG wing, signs near points of interest)
- Verify walkability after edits (no orphaned areas, no trapped player)

Without an editor, every adjustment requires editing coordinate arrays in TypeScript files and rebuilding. That's a 30-second-per-tile feedback loop where it should be instant.

## Solution

A paint-program-style tile editor integrated into the existing museum module. The editor sits in the pipeline between the layout engine and the game:

```
Room Graph --> Layout Engine --> Generated Grid --> EDITOR (human polishes) --> Final Grid --> Game
```

The editor takes the layout engine's output as its starting point. The user can modify anything: reshape walls, move exhibits, add new tile types, fill areas. The output is the same `MuseumGrid` data structure consumed by the 2D walker game and the future 3D pipeline.

An initial implementation already exists (see "Existing Code" below). This spec formalizes the full feature set, fills gaps in the current implementation, and defines the remaining work.

---

## Existing Code

The editor has a working skeleton. These files are already built and functional:

| File | Status | What it does |
|------|--------|-------------|
| `state/editor-state.svelte.ts` | Complete | State factory with undo/redo (50-step snapshot), tool selection, rectangle fill, tile placement/erasure, exhibit/performer property updates, wing management, template stamping, grid resize |
| `state/editor-context.ts` | Complete | Svelte context distribution |
| `components/editor/Museum2DEditor.svelte` | Complete | Three-column layout (palette, canvas, inspector) with Ctrl+Z/Y keyboard shortcuts |
| `components/editor/EditorCanvas.svelte` | Complete | CSS Grid renderer with click-to-paint, drag-paint, rectangle preview, hover ghost, right-click erase, resize observer |
| `components/editor/EditorToolPalette.svelte` | Complete | Tile type buttons, eraser, wing-region tool, draw mode toggle (paint/rectangle), material picker |
| `components/editor/PropertyInspector.svelte` | Complete | Selected tile info, exhibit plaque editor, performer facing/sequence editor, wing properties, grid stats, JSON export/import |
| `components/editor/TemplatePicker.svelte` | Complete | Wing template stamping overlay |
| `services/implementations/MuseumGridPersister.ts` | Partial | JSON serialize/deserialize works; Firestore persistence is stubbed |
| `services/implementations/LayoutValidator.ts` | Complete | Flood-fill reachability, overlap detection, spawn walkability check |

### What's Missing

The skeleton covers the MVP tool palette, canvas, and inspector. The gaps are:

1. **Play/Edit mode toggle** -- no way to switch between editing and walking the museum
2. **Validation overlay** -- the validator runs but results aren't visualized on the canvas
3. **Flood-fill tool** -- only paint and rectangle modes exist
4. **Spawn placement tool** -- spawn is set programmatically, not via the editor
5. **Canvas pan and zoom** -- the grid is fixed-position; large grids require scrolling
6. **Load from layout engine** -- the editor always starts with an empty 40x40 grid; no way to import the generated grid as a starting point
7. **Sign/trigger property editing** -- the inspector handles exhibits and performers but not signs or triggers
8. **Missing tile types in palette** -- rope, scaffolding, sign are defined in the tile registry but absent from the palette
9. **Keyboard shortcuts for tools** -- only undo/redo have shortcuts
10. **localStorage autosave** -- edits are lost on page refresh

---

## Architecture

### Pipeline Integration

The `Museum2DModule.svelte` currently builds the grid and passes it directly to the game. The editor inserts between them:

```
Museum2DModule.svelte
  |
  +--> buildMuseumGrid()           // algorithmic layout
  |       |
  |       v
  +--> createEditorState(grid)     // editor receives generated grid
  |       |
  |       v   (user edits)
  |       |
  +--> editor.grid                 // polished grid
  |       |
  |       v
  +--> createMuseum2DState(grid)   // game receives polished grid
```

The module toggles between showing `Museum2DEditor` and `Museum2DGame` based on a play/edit mode flag. Both consume the same `MuseumGrid` data structure.

### State Architecture

The editor state factory (`createEditorState`) already follows the project's Factory + Context pattern. The grid is the single source of truth. All mutations go through the state factory, which manages undo/redo snapshots.

#### Undo/Redo: Snapshot Approach (Already Implemented)

The current implementation uses full-grid snapshots (serialized `MuseumGridSerialized` objects) for undo/redo. This is the correct choice for this editor because:

1. **Grid size is bounded.** The museum grid is roughly 80x80 tiles (~6,400 cells). A serialized snapshot of the tile map is a few hundred KB at most. At 50 snapshots, that's ~15 MB peak -- acceptable for a desktop browser.

2. **Mutation operations are complex.** Rectangle fill modifies hundreds of tiles. Paint drag modifies an unpredictable sequence. The snapshot approach makes every operation undoable without tracking individual tile changes.

3. **Simplicity.** The command pattern would require an inverse for every mutation type (place, erase, fill, resize, stamp template, update exhibit, update performer, add/remove wing). Snapshots make this zero-effort.

The one optimization worth adding: **batch paint strokes into a single undo step.** Currently, each `placeTile()` call during a drag pushes a new snapshot. The fix is to push one snapshot at drag start and skip pushes during the drag. The rectangle fill already works this way.

### Component Tree

```
Museum2DModule.svelte
  |
  +-- ModeToggle (play/edit button)
  |
  +-- [if editMode]
  |     Museum2DEditor.svelte
  |       +-- EditorToolPalette.svelte
  |       +-- EditorCanvas.svelte
  |       |     +-- ValidationOverlay.svelte (unreachable area highlights)
  |       +-- PropertyInspector.svelte
  |       +-- TemplatePicker.svelte (overlay)
  |
  +-- [if playMode]
        Museum2DGame.svelte (existing walker)
```

---

## Feature Specifications

### 1. Play/Edit Mode Toggle

**Behavior:**
- A toggle button in the top-right corner of the module switches between "Edit" and "Play" modes
- Keyboard shortcut: `Tab` key
- When switching from Edit to Play, the game state is re-created from the current editor grid (`createMuseum2DState(editor.grid)`)
- When switching from Play to Edit, the editor state is preserved (the grid is not reset)
- The toggle is visible in both modes

**State changes to `Museum2DModule.svelte`:**

```typescript
let mode = $state<"play" | "edit">("play");
let editorState: EditorState | null = $state(null);

function enterEditMode() {
  if (!editorState) {
    editorState = createEditorState(grid.width, grid.height);
    editorState.importGrid(serializeGrid(grid));
  }
  mode = "edit";
}

function enterPlayMode() {
  // Rebuild game state from editor grid
  if (editorState) {
    gameState = createMuseum2DState(editorState.grid);
  }
  mode = "play";
}
```

**Why not SplitScreenLayout for editor?** The editor already uses its own three-column layout (palette | canvas | inspector). Nesting that inside SplitScreenLayout would create competing resize handles. The editor replaces the entire module content when active.

### 2. Validation Overlay

**Problem:** The `LayoutValidator` already computes reachability via flood-fill, but the results aren't shown to the user. After editing, unreachable areas are invisible until you walk the game and discover a dead end.

**Solution:** A toggleable overlay on the editor canvas that highlights unreachable tiles in red.

**Implementation:**

```typescript
// In editor-state.svelte.ts, add:
let showValidationOverlay = $state(false);
let validationResult = $state<EditorValidationResult | null>(null);

function runValidation(): void {
  const reachable = floodFillFrom(grid, grid.spawn.x, grid.spawn.y);
  const unreachableTiles: Set<string> = new Set();

  for (const [key, tile] of grid.tiles) {
    if (isWalkable(tile.type) && !reachable.has(key)) {
      unreachableTiles.add(key);
    }
  }

  validationResult = {
    reachableCount: reachable.size,
    unreachableCount: unreachableTiles.size,
    unreachableTiles,
    spawnValid: grid.tiles.has(tileKey(grid.spawn.x, grid.spawn.y)),
  };
}
```

The `EditorCanvas` renders a red semi-transparent overlay on cells that are in `validationResult.unreachableTiles`. The overlay is toggled via a toolbar button ("Validate" with a checkmark icon).

**Visual treatment:**
- Unreachable walkable tiles: red overlay at 35% opacity, pulsing border
- Spawn tile: green diamond marker (always visible when overlay is on)
- Non-walkable tiles: no overlay (walls, exhibits, etc. are expected to be non-walkable)

**Performance:** Flood-fill on an 80x80 grid visits at most 6,400 tiles. BFS completes in <1ms. Safe to run on every toggle or on a toolbar button press.

### 3. Flood-Fill Tool

**Problem:** Filling an irregular room interior requires clicking every tile individually or using rectangle fill (which overshoots on non-rectangular rooms).

**Solution:** Add a "flood fill" draw mode alongside paint and rectangle.

**Behavior:**
- Click a tile to fill all contiguous tiles of the same type (or all contiguous void tiles) with the selected tool's tile type
- Uses 4-directional BFS (not 8-directional, to prevent diagonal leaks through wall corners)
- Bounded by grid edges
- Pushes one undo snapshot for the entire fill

**State changes:**

Add `"fill"` to the `DrawMode` type:

```typescript
export type DrawMode = "paint" | "rectangle" | "fill";
```

Add a `floodFill` method to the editor state:

```typescript
function floodFill(startX: number, startY: number): void {
  pushUndoState();

  const startKey = tileKey(startX, startY);
  const startTile = grid.tiles.get(startKey);
  const targetType = startTile?.type ?? null; // null = void

  const visited = new Set<string>();
  const queue: [number, number][] = [[startX, startY]];
  visited.add(startKey);

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;

    // Place the selected tool's tile here
    if (selectedTool === "eraser") {
      eraseTileAt(cx, cy);
    } else {
      placeTileAt(cx, cy);
    }

    // Expand to 4-directional neighbors with same type
    for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;

      const nKey = tileKey(nx, ny);
      if (visited.has(nKey)) continue;

      const nTile = grid.tiles.get(nKey);
      const nType = nTile?.type ?? null;
      if (nType !== targetType) continue;

      visited.add(nKey);
      queue.push([nx, ny]);
    }
  }
}
```

**Palette integration:** Add a paint-bucket icon button to the draw mode toggle group.

### 4. Spawn Placement Tool

**Problem:** The spawn position is set by the layout engine or programmatically. The editor has `setSpawn()` but no UI to invoke it.

**Solution:** Add a "Set Spawn" button in the property inspector's Grid section. When clicked, the next tile click on the canvas sets the spawn position. A spawn marker is always visible on the canvas.

**Behavior:**
- Click "Set Spawn" in the inspector -- enters spawn placement mode
- Next click on a walkable tile sets spawn there
- If the clicked tile is not walkable, show a brief error indicator (red flash) and stay in spawn mode
- The spawn marker (a directional arrow icon) is always rendered on the canvas at `grid.spawn.x, grid.spawn.y`
- A direction picker in the inspector lets you change spawn facing after placement

**State changes:**

```typescript
let isPlacingSpawn = $state(false);

function beginSpawnPlacement(): void {
  isPlacingSpawn = true;
}

function trySetSpawn(x: number, y: number): boolean {
  const tile = grid.tiles.get(tileKey(x, y));
  if (!tile || !isWalkable(tile.type)) return false;

  setSpawn(x, y, grid.spawn.facing);
  isPlacingSpawn = false;
  return true;
}
```

### 5. Canvas Pan and Zoom

**Problem:** Large grids (80x80+) don't fit in the viewport at readable tile sizes. The current implementation calculates a tile size that fits the entire grid, which makes tiles tiny on large grids.

**Solution:** Add scroll-wheel zoom and middle-click-drag pan.

**Implementation approach:**

Apply a CSS `transform: scale(zoom) translate(panX, panY)` to the grid container inside the scrollable canvas area.

```typescript
// In EditorCanvas.svelte:
let zoom = $state(1.0);
let panX = $state(0);
let panY = $state(0);
let isPanning = $state(false);

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;

function handleWheel(event: WheelEvent): void {
  event.preventDefault();
  const delta = event.deltaY > 0 ? 0.9 : 1.1;
  zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * delta));
}

function handleMiddleDown(event: PointerEvent): void {
  if (event.button === 1) {
    isPanning = true;
    event.preventDefault();
  }
}

function handlePanMove(event: PointerEvent): void {
  if (!isPanning) return;
  panX += event.movementX;
  panY += event.movementY;
}
```

The tile size becomes fixed (e.g., 24px) rather than computed from container size. Zoom and pan control the viewport into the grid.

**Keyboard modifiers:**
- Scroll wheel: zoom in/out
- Middle mouse drag: pan
- Spacebar + left drag: pan (alternative for trackpads)

### 6. Load Generated Grid as Starting Point

**Problem:** The editor starts with an empty 40x40 grid. Users should be able to start from the layout engine's output.

**Solution:** Modify `createEditorState` to accept an optional initial grid:

```typescript
export function createEditorState(
  initialGrid?: MuseumGrid
) {
  let grid = $state<MuseumGrid>(
    initialGrid
      ? structuredClone(initialGrid) // deep copy so edits don't mutate the source
      : createEmptyGrid(40, 40)
  );
  // ... rest unchanged
}
```

Note: `structuredClone` won't copy a `Map` correctly in all environments. Use the existing `serializeGrid` / `deserializeGrid` round-trip instead:

```typescript
initialGrid
  ? deserializeGrid(serializeGrid(initialGrid))
  : createEmptyGrid(40, 40)
```

The `Museum2DModule` passes the generated grid when entering edit mode:

```typescript
function enterEditMode() {
  editorState = createEditorState(grid);
  mode = "edit";
}
```

### 7. Sign and Trigger Property Editing

**Problem:** The property inspector handles exhibits and performers but not signs or triggers.

**Solution:** Add derived state for the selected sign/trigger and inspector sections for each.

**State additions:**

```typescript
let selectedSign = $derived.by(() => {
  if (!selectedTilePos) return null;
  const tile = grid.tiles.get(tileKey(selectedTilePos.x, selectedTilePos.y));
  if (tile?.type !== "sign") return null;
  return { x: selectedTilePos.x, y: selectedTilePos.y, tile };
});

let selectedTrigger = $derived.by(() => {
  if (!selectedTilePos) return null;
  return (
    grid.triggers.find(
      (t) => t.tileX === selectedTilePos!.x && t.tileY === selectedTilePos!.y
    ) ?? null
  );
});
```

**Inspector sections:**

- **Sign:** Text input for `refId` (links to sign content in `museum-room-content.ts`), facing direction picker
- **Trigger:** Action type dropdown (`show-lore`, `play-audio`, `show-image`, `custom`), title input, body textarea

### 8. Complete Tile Palette

**Problem:** The palette lists 9 tile types but the registry defines 12 (missing: rope, scaffolding, sign).

**Solution:** Add the missing types to the `tileTypes` array in `EditorToolPalette.svelte`:

```typescript
const tileTypes: TileType[] = [
  "wall",
  "floor",
  "corridor",
  "door",
  "exhibit-panel",
  "performer-station",
  "torch",
  "pedestal",
  "trigger",
  "rope",
  "scaffolding",
  "sign",
];
```

All three types already have metadata (icon, label, cssClass) in the tile registry, so no further changes are needed.

### 9. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Z` | Undo (already implemented) |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo (already implemented) |
| `Tab` | Toggle play/edit mode |
| `1`-`9`, `0` | Select tile tool by palette position (1=wall, 2=floor, ..., 0=eraser) |
| `E` | Eraser |
| `P` | Paint mode |
| `R` | Rectangle mode |
| `F` | Flood fill mode |
| `V` | Toggle validation overlay |
| `S` | Set spawn mode |
| `Escape` | Cancel rectangle drag / cancel spawn placement / clear selection |

**Implementation:** Extend the existing `handleKeydown` in `Museum2DEditor.svelte`. Only fire shortcuts when no text input is focused (check `document.activeElement?.tagName !== "INPUT"` and `!== "TEXTAREA"`).

### 10. localStorage Autosave

**Problem:** Edits are lost on page refresh.

**Solution:** Autosave the serialized grid to localStorage on every mutation, debounced to 500ms. Load on editor creation if a saved grid exists.

```typescript
const AUTOSAVE_KEY = "museum-editor-autosave";
const AUTOSAVE_DEBOUNCE_MS = 500;

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutosave(): void {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    try {
      const data = serializeGrid(grid);
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable -- silent fail
    }
  }, AUTOSAVE_DEBOUNCE_MS);
}
```

Call `scheduleAutosave()` at the end of `pushUndoState()`.

On editor creation, check for autosaved data:

```typescript
function loadAutosave(): MuseumGrid | null {
  try {
    const json = localStorage.getItem(AUTOSAVE_KEY);
    if (!json) return null;
    return deserializeGrid(JSON.parse(json));
  } catch {
    return null;
  }
}
```

The inspector should show a "Clear Autosave" button and a "Last saved" timestamp.

---

## Data Flow

### Edit Session Lifecycle

```
1. User enters museum module
   --> buildMuseumGrid() produces initial grid
   --> Game mode loads with generated grid

2. User clicks "Edit" (or presses Tab)
   --> createEditorState(generatedGrid) clones the grid
   --> Editor UI renders
   --> If localStorage has autosave, offer "Resume previous session?" prompt

3. User edits tiles
   --> Each mutation calls pushUndoState() then modifies grid
   --> scheduleAutosave() queues a localStorage write
   --> Validation overlay updates if visible

4. User clicks "Play" (or presses Tab)
   --> createMuseum2DState(editor.grid) builds fresh game state
   --> Game UI renders with polished grid
   --> Editor state is preserved in memory

5. User clicks "Edit" again
   --> Editor UI renders with preserved state (no grid loss)

6. User exports
   --> serializeGrid() --> JSON.stringify() --> file download
```

### Validation Flow

```
1. User clicks "Validate" button (or presses V)
   --> showValidationOverlay = true
   --> runValidation() performs BFS flood-fill from spawn

2. Flood-fill produces:
   - Set<string> of reachable tile keys
   - Count of unreachable walkable tiles

3. Canvas overlay renders:
   - Each walkable tile NOT in reachable set gets red overlay
   - Spawn tile gets green marker
   - Inspector shows validation summary (reachable/unreachable counts)

4. User edits a tile
   --> Validation result is stale
   --> Show "Re-validate" indicator
   --> User can press V again to re-run
```

---

## File Structure

### New Files

```
src/lib/features/museum-2d/
  components/
    editor/
      ValidationOverlay.svelte       -- Red highlight layer for unreachable tiles
      SpawnMarker.svelte             -- Green arrow icon on the spawn tile
      EditorModeToggle.svelte        -- Play/Edit toggle button
  state/
    editor-state.svelte.ts           -- (modify) Add flood-fill, validation, spawn placement, autosave
  services/
    implementations/
      EditorFloodFiller.ts           -- BFS flood-fill for the fill tool
      EditorValidator.ts             -- Editor-specific validation (adapts LayoutValidator for live use)
    contracts/
      IEditorFloodFiller.ts          -- Interface
      IEditorValidator.ts            -- Interface
```

### Modified Files

```
src/lib/features/museum-2d/
  Museum2DModule.svelte              -- Add play/edit mode toggle, pass grid to editor
  state/editor-state.svelte.ts       -- Add flood-fill, validation, autosave, spawn placement, initial grid param
  components/editor/
    Museum2DEditor.svelte            -- Add keyboard shortcuts, validation button
    EditorCanvas.svelte              -- Add zoom/pan, spawn marker, validation overlay
    EditorToolPalette.svelte         -- Add rope/scaffolding/sign, flood fill mode, fix import path
    PropertyInspector.svelte         -- Add sign/trigger editing, spawn controls, validation summary
```

### Import Path Fix

`EditorToolPalette.svelte` line 10 imports from `../../state/editor-editor.svelte` which is a typo. Should be `../../state/editor-state.svelte`:

```typescript
// WRONG (current):
import type { EditorTool, DrawMode } from "../../state/editor-editor.svelte";

// CORRECT:
import type { EditorTool, DrawMode } from "../../state/editor-state.svelte";
```

---

## UX Guidelines

### The Editor Should Feel Like a Paint Program

The mental model is MS Paint, not VS Code. Users think in terms of "pick a color, click to fill" not "select an entity, configure properties."

**Primary interaction loop:**
1. Pick a tool from the left palette (one click)
2. Click or drag on the canvas (immediate visual feedback)
3. Inspect/edit properties in the right panel (only when needed)

**Feedback rules:**
- Every click produces an immediate visual change on the canvas
- Hover shows a ghost preview of what will be placed
- The current tool is highlighted in the palette at all times
- Grid lines are always visible in edit mode (they're the editing surface)
- Right-click always erases (consistent escape hatch)

### Grid Lines

- Edit mode: 1px borders on every cell, rgba(255, 255, 255, 0.06) -- subtle but visible
- Play mode: no grid lines (tiles render seamlessly)
- The grid itself IS the editing interface. Without grid lines, users can't tell where tiles begin and end.

### Cursor Feedback

| Tool | Cursor |
|------|--------|
| Any tile tool | Crosshair (already implemented) |
| Eraser | Crosshair with red tint (CSS `cursor: crosshair` -- consider custom cursor later) |
| Flood fill | Paint bucket icon (CSS custom cursor) |
| Spawn placement | Target icon |
| Panning (spacebar held) | Grab/grabbing |

### Color Coding in Edit Mode

The editor canvas uses simplified flat colors for tiles (already implemented in `EditorCanvas.svelte`). These are deliberately different from the game's textured rendering. The reason: in edit mode, you need to instantly distinguish tile types at a glance. Textures obscure boundaries.

| Tile | Editor Color | Game Color |
|------|-------------|------------|
| Void | Near-black (0.02 alpha) | Not rendered |
| Wall | Medium grey (#3a3a4a) | Textured stone with mortar lines |
| Floor | Dark brown (#2a2520) | Material-specific texture |
| Corridor | Dark purple-grey (#252228) | Material-specific texture |
| Door | Warm brown (#5a4a30) | Lighter brown with border |
| Exhibit | Navy (#1a3a5a) | Deep blue with gold frame |
| Performer | Purple (#3a1a5a) | Green stage |
| Torch | Orange-brown (#5a3a1a) | Animated flame |
| Pedestal | Teal-grey (#2a3a3a) | Raised stone block |
| Trigger | Green dashed (0.15 alpha) | Invisible in game |
| Rope | Gold stripe on dark | Gold horizontal rope |
| Scaffolding | Diagonal hatching on brown | Construction dashes |
| Sign | Steel blue (#1a2030) | Blue with sign icon |

---

## Implementation Order

The work is structured as incremental commits, each leaving the editor functional:

### Phase 1: Pipeline Integration (highest value)
1. Fix the import path typo in `EditorToolPalette.svelte`
2. Modify `createEditorState` to accept an initial grid
3. Add play/edit mode toggle to `Museum2DModule.svelte`
4. Add the three missing tile types to the palette

### Phase 2: Editing Power Tools
5. Implement flood-fill tool (BFS + draw mode integration)
6. Add canvas zoom and pan
7. Batch paint strokes into single undo steps

### Phase 3: Validation and Feedback
8. Implement validation overlay (flood-fill reachability visualization)
9. Add spawn placement tool and spawn marker on canvas
10. Add sign and trigger property editing to the inspector

### Phase 4: Persistence and Polish
11. Add localStorage autosave with debounce
12. Add keyboard shortcuts for all tools
13. Add "Resume previous session?" prompt on editor entry

---

## What's Explicitly Out of Scope

- **Multi-user collaboration** -- single-user editor only
- **Version history beyond undo/redo** -- no branching, no named saves
- **Template library management** -- templates are code-defined in `wing-templates.ts`, not user-created
- **Wing region editing** -- wing regions are derived from the room graph and not manually drawn (the wing-region tool exists in the palette but is a future feature)
- **3D preview** -- the editor output feeds the 3D pipeline, but preview is a separate workstream
- **Mobile layout** -- the three-column editor layout is desktop-only; mobile users play the game
- **Tile rotation** -- tiles don't have rotation; facing is a property of exhibits and performers only
- **Multi-layer editing** -- single-layer tile map (matching the `MuseumGrid` data structure)
- **Custom tile type creation** -- tile types are defined in the registry, not user-extensible
