/**
 * Arrange Grid State
 *
 * State management for the Arrange tab grid composition mode.
 * Supports a freeform 4×4 grid where each position can be enabled/disabled,
 * allowing for non-rectangular layouts (L-shapes, T-shapes, scattered, etc.).
 *
 * Each enabled cell is a "tunnel" that can hold up to 4 performers/layers.
 * Global sync playback: one play button controls all cells together,
 * with optional per-cell beat offsets.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import {
  type TunnelLayerConfig,
  getTunnelLayerColors,
} from "../../../compose/domain/types";
import type { CellMediaType } from "$lib/features/constraint-layout-lab/domain/types";

// LocalStorage key (v5 = 4x4 grid with cell spanning)
const STORAGE_KEY = "compose-arrange-grid-v5";
const STORAGE_KEY_V4 = "compose-arrange-grid-v4";

// Grid dimensions (fixed 4x4 grid)
export const GRID_SIZE = 4;
const MAX_LAYERS_PER_CELL = 4;

/**
 * A single cell in the grid - each cell is a mini-tunnel
 */
export interface GridCell {
  id: string;
  /** Row position (0-3) */
  row: number;
  /** Column position (0-3) */
  col: number;
  /** Is this cell enabled/visible? */
  enabled: boolean;
  layers: TunnelLayerConfig[];
  beatOffset: number; // Cell-level offset for staggered playback
  /** Number of columns this cell spans (1-3) */
  colSpan: number;
  /** Number of rows this cell spans (1-3) */
  rowSpan: number;
  /** Media type for this cell (default: animation for tunnel mode) */
  mediaType: CellMediaType;
}

/**
 * Grid configuration - now stores all 16 positions
 */
export interface GridConfig {
  cells: GridCell[];
}

// LCM calculation for polyrhythmic beat counts
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

function calculateCellBeats(cell: GridCell, skipStart: boolean): number {
  if (cell.layers.length === 0) return 0;

  const beatCounts = cell.layers.map((layer) => {
    const stepCount = layer.sequence.steps?.length || 1;
    // steps.length = number of motion beats (start position is stored separately
    // in sequence.startPosition, NOT in the steps array).
    // When skipStart=true (seamless loop): total = stepCount
    // When skipStart=false (show start pose): total = stepCount + 1
    return skipStart ? stepCount : stepCount + 1;
  });

  const firstCount = beatCounts[0];
  if (firstCount === undefined) return 1;
  return beatCounts.reduce((acc, count) => lcm(acc, count), firstCount);
}

function calculateTotalBeats(cells: GridCell[], skipStart: boolean): number {
  const enabledCellsWithLayers = cells.filter(
    (c) => c.enabled && c.layers.length > 0
  );
  if (enabledCellsWithLayers.length === 0) return 0;

  const beatCounts = enabledCellsWithLayers.map((cell) =>
    calculateCellBeats(cell, skipStart)
  );
  const firstCount = beatCounts[0];
  if (firstCount === undefined) return 0;
  return beatCounts.reduce((acc, count) => lcm(acc, count), firstCount);
}

function generateCellId(row: number, col: number): string {
  return `cell-${row}-${col}`;
}

function createCell(row: number, col: number, enabled: boolean): GridCell {
  return {
    id: generateCellId(row, col),
    row,
    col,
    enabled,
    layers: [],
    beatOffset: 0,
    colSpan: 1,
    rowSpan: 1,
    mediaType: "animation",
  };
}

function createInitialGrid(): GridCell[] {
  const cells: GridCell[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      // Start with just cell (0,0) enabled
      cells.push(createCell(row, col, row === 0 && col === 0));
    }
  }
  return cells;
}

// LocalStorage helpers
function loadFromStorage(): GridConfig {
  if (typeof window === "undefined") {
    return { cells: createInitialGrid() };
  }

  try {
    // Try v5 first (4x4 grid)
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const config = JSON.parse(stored) as GridConfig;
      if (config.cells.length === GRID_SIZE * GRID_SIZE) {
        // Ensure all cells have mediaType (migration for older data)
        const migratedCells = config.cells.map((cell) => ({
          ...cell,
          mediaType: cell.mediaType ?? "animation",
        }));
        return { cells: migratedCells };
      }
    }

    // Try migrating from v4 (3x3 grid -> 4x4 grid)
    const storedV4 = localStorage.getItem(STORAGE_KEY_V4);
    if (storedV4) {
      const configV4 = JSON.parse(storedV4) as GridConfig;
      // v4 was 3x3 = 9 cells, we need 4x4 = 16 cells
      if (configV4.cells.length === 9) {
        // Create fresh 4x4 grid
        const newCells = createInitialGrid();
        // Copy over the 3x3 data into the top-left 3x3 of the 4x4 grid
        for (const oldCell of configV4.cells) {
          // Find matching cell in new grid (same row/col position)
          const newIndex = oldCell.row * GRID_SIZE + oldCell.col;
          const newCell = newCells[newIndex];
          if (newCell && oldCell.row < 3 && oldCell.col < 3) {
            newCells[newIndex] = {
              ...newCell,
              enabled: oldCell.enabled,
              layers: oldCell.layers ?? [],
              beatOffset: oldCell.beatOffset ?? 0,
              colSpan: Math.min(oldCell.colSpan ?? 1, GRID_SIZE - oldCell.col),
              rowSpan: Math.min(oldCell.rowSpan ?? 1, GRID_SIZE - oldCell.row),
              mediaType: oldCell.mediaType ?? "animation",
            };
          }
        }
        const migratedConfig = { cells: newCells };
        // Save migrated config to v5 key
        saveToStorage(migratedConfig);
        // Clean up old key
        localStorage.removeItem(STORAGE_KEY_V4);
        return migratedConfig;
      }
    }
  } catch (err) {
    console.warn("Failed to load grid config from localStorage:", err);
  }

  return { cells: createInitialGrid() };
}

function saveToStorage(config: GridConfig): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn("Failed to save grid config to localStorage:", err);
  }
}

/**
 * Create the grid state
 */
function createArrangeGridState() {
  // Load initial state
  const initialConfig = loadFromStorage();

  // Core reactive state
  let cells = $state<GridCell[]>(initialConfig.cells);
  let isPlaying = $state(false);
  let currentBeat = $state(0);
  let selectedCellId = $state<string | null>(null);
  let showSequencePicker = $state(false);

  // When true, step 0 (start position) is skipped during playback.
  // Sequences loop from final beat directly back to beat 1.
  let skipStartPosition = $state(true);

  // Playback BPM (reactive so BpmChips can display it)
  let playbackBpm = $state(120);

  // Non-reactive playback state
  let animationFrameId: number | null = null;
  let lastFrameTime: number = 0;
  let stepAnimating = false;

  // Helper to save current state
  function save() {
    saveToStorage({ cells });
  }

  // Get cell by position
  function getCellAt(row: number, col: number): GridCell | undefined {
    return cells.find((c) => c.row === row && c.col === col);
  }

  // Get cell index by position
  function getCellIndex(row: number, col: number): number {
    return row * GRID_SIZE + col;
  }

  // Playback loop using requestAnimationFrame for smooth fractional beats
  function startPlaybackLoop(bpm: number = 120) {
    stopPlaybackLoop();
    playbackBpm = bpm;
    lastFrameTime = performance.now();

    function tick(now: number) {
      if (!isPlaying) return;

      const deltaMs = now - lastFrameTime;
      lastFrameTime = now;

      // Calculate beat increment based on BPM
      // At 120 BPM: 2 beats per second = 0.002 beats per ms
      const beatsPerMs = playbackBpm / 60 / 1000;
      const beatIncrement = deltaMs * beatsPerMs;

      const total = calculateTotalBeats(cells, skipStartPosition);
      if (total > 0) {
        currentBeat = (currentBeat + beatIncrement) % total;
      }

      animationFrameId = requestAnimationFrame(tick);
    }

    animationFrameId = requestAnimationFrame(tick);
  }

  function stopPlaybackLoop() {
    stepAnimating = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  /**
   * Animate currentBeat smoothly toward a target by the given amount.
   * Used by step buttons so props visibly rotate/move to the next position.
   */
  function animateStep(amount: number) {
    if (isPlaying) return;
    stopPlaybackLoop();

    const total = calculateTotalBeats(cells, skipStartPosition);
    if (total <= 0) return;

    const startBeat = currentBeat;
    const targetBeat = ((currentBeat + amount) % total + total) % total;
    const direction = amount > 0 ? 1 : -1;
    const distance = Math.abs(amount);
    let traveled = 0;

    stepAnimating = true;
    lastFrameTime = performance.now();

    function tick(now: number) {
      if (!stepAnimating) return;

      const deltaMs = now - lastFrameTime;
      lastFrameTime = now;

      // Animate at current BPM rate
      const beatsPerMs = playbackBpm / 60000;
      const increment = deltaMs * beatsPerMs;
      traveled += increment;

      if (traveled >= distance) {
        currentBeat = targetBeat;
        stepAnimating = false;
        animationFrameId = null;
        return;
      }

      currentBeat = ((startBeat + direction * traveled) % total + total) % total;
      animationFrameId = requestAnimationFrame(tick);
    }

    animationFrameId = requestAnimationFrame(tick);
  }

  return {
    // Getters for reactive state
    get cells() {
      return cells;
    },
    get isPlaying() {
      return isPlaying;
    },
    get currentBeat() {
      return currentBeat;
    },
    get selectedCellId() {
      return selectedCellId;
    },
    get showSequencePicker() {
      return showSequencePicker;
    },

    // Computed getters
    get enabledCells() {
      return cells.filter((c) => c.enabled);
    },
    get enabledCount() {
      return cells.filter((c) => c.enabled).length;
    },
    get totalBeats() {
      return calculateTotalBeats(cells, skipStartPosition);
    },
    get skipStartPosition() {
      return skipStartPosition;
    },
    get hasAnyLayers() {
      return cells.some((c) => c.enabled && c.layers.length > 0);
    },
    get selectedCell() {
      if (selectedCellId === null) return null;
      return cells.find((c) => c.id === selectedCellId) ?? null;
    },
    get selectedCellIndex() {
      if (selectedCellId === null) return null;
      const idx = cells.findIndex((c) => c.id === selectedCellId);
      return idx >= 0 ? idx : null;
    },

    /**
     * Map of grid positions that are "occupied" by spanning cells.
     * Key is "row-col", value is the ID of the cell that occupies it.
     * Only includes positions that are NOT the cell's origin.
     */
    get occupiedPositions(): Map<string, string> {
      const occupied = new Map<string, string>();
      for (const cell of cells.filter((c) => c.enabled)) {
        for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
          for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
            // Skip the origin position
            if (r === cell.row && c === cell.col) continue;
            occupied.set(`${r}-${c}`, cell.id);
          }
        }
      }
      return occupied;
    },

    // Grid layout bounds (for rendering) - accounts for cell spans
    get gridBounds() {
      const enabled = cells.filter((c) => c.enabled);
      if (enabled.length === 0) {
        return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0, rows: 1, cols: 1 };
      }

      // Account for spans: a cell at (0,0) with colSpan=3 contributes cols 0,1,2
      const rowStarts = enabled.map((c) => c.row);
      const rowEnds = enabled.map((c) => c.row + c.rowSpan - 1);
      const colStarts = enabled.map((c) => c.col);
      const colEnds = enabled.map((c) => c.col + c.colSpan - 1);

      const minRow = Math.min(...rowStarts);
      const maxRow = Math.max(...rowEnds);
      const minCol = Math.min(...colStarts);
      const maxCol = Math.max(...colEnds);

      return {
        minRow,
        maxRow,
        minCol,
        maxCol,
        rows: maxRow - minRow + 1,
        cols: maxCol - minCol + 1,
      };
    },

    // For backward compatibility with existing components
    get rows() {
      return this.gridBounds.rows;
    },
    get cols() {
      return this.gridBounds.cols;
    },

    // Cell toggle
    toggleCell(row: number, col: number) {
      const index = getCellIndex(row, col);
      const cell = cells[index];
      if (!cell) return;

      // Check if this position is occupied by a spanning cell
      const occupyingId = this.occupiedPositions.get(`${row}-${col}`);
      if (occupyingId) {
        // Can't toggle a position that's under another cell's span
        return;
      }

      // If disabling a cell with content, warn/confirm
      const isDisabling = cell.enabled;
      const hasContent = cell.layers.length > 0;

      const newCells = [...cells];
      newCells[index] = {
        ...cell,
        enabled: !cell.enabled,
        // Clear layers if disabling a cell with content
        layers: isDisabling && hasContent ? [] : cell.layers,
        // Reset span if disabling
        colSpan: isDisabling ? 1 : cell.colSpan,
        rowSpan: isDisabling ? 1 : cell.rowSpan,
      };
      cells = newCells;

      // Clear selection if we just disabled the selected cell
      if (isDisabling && selectedCellId === cell.id) {
        selectedCellId = null;
      }

      save();
    },

    // Check if cell is enabled
    isCellEnabled(row: number, col: number): boolean {
      const cell = getCellAt(row, col);
      return cell?.enabled ?? false;
    },

    /**
     * Check if a cell position is occupied by another spanning cell.
     * Returns the ID of the occupying cell, or null if not occupied.
     */
    getOccupyingCell(row: number, col: number): string | null {
      return this.occupiedPositions.get(`${row}-${col}`) ?? null;
    },

    /**
     * Set the span for a cell. Validates bounds and disables overlapping cells.
     * Optionally moves the cell to a new origin position (for resizing from left/top edges).
     * When moving, the cell's content is transferred to the new position.
     * @returns true if span was set successfully, false if invalid
     */
    setCellSpan(
      cellId: string,
      colSpan: number,
      rowSpan: number,
      newCol?: number,
      newRow?: number
    ): boolean {
      const cellIndex = cells.findIndex((c) => c.id === cellId);
      const cell = cells[cellIndex];
      if (!cell || !cell.enabled) return false;

      // Validate spans
      colSpan = Math.max(1, Math.min(colSpan, GRID_SIZE));
      rowSpan = Math.max(1, Math.min(rowSpan, GRID_SIZE));

      // Use new position if provided, otherwise keep current
      const targetCol = newCol !== undefined ? Math.max(0, Math.min(newCol, GRID_SIZE - 1)) : cell.col;
      const targetRow = newRow !== undefined ? Math.max(0, Math.min(newRow, GRID_SIZE - 1)) : cell.row;

      // Check bounds with new position
      if (targetCol + colSpan > GRID_SIZE) return false;
      if (targetRow + rowSpan > GRID_SIZE) return false;

      const isMoving = targetCol !== cell.col || targetRow !== cell.row;
      const newCells = [...cells];

      if (isMoving) {
        // Moving the cell to a new origin position
        // 1. Transfer content to the new origin cell
        // 2. Disable the old origin cell
        // 3. Disable any cells under the new span

        const newOriginIdx = getCellIndex(targetRow, targetCol);
        const oldOriginIdx = cellIndex;

        // Get the cell at the new origin (might be enabled or disabled)
        const newOriginCell = newCells[newOriginIdx];

        // Transfer content from old cell to new origin
        if (newOriginCell) {
          newCells[newOriginIdx] = {
            ...newOriginCell,
            enabled: true,
            layers: cell.layers, // Transfer layers
            beatOffset: cell.beatOffset, // Transfer offset
            colSpan,
            rowSpan,
          };
        }

        // Disable the old origin (it's no longer the active cell)
        if (oldOriginIdx !== newOriginIdx) {
          newCells[oldOriginIdx] = {
            ...cell,
            enabled: false,
            layers: [],
            beatOffset: 0,
            colSpan: 1,
            rowSpan: 1,
          };
        }

        // Disable any other cells under the new span
        for (let r = targetRow; r < targetRow + rowSpan; r++) {
          for (let c = targetCol; c < targetCol + colSpan; c++) {
            const idx = getCellIndex(r, c);
            // Skip the new origin and old origin (already handled)
            if (idx === newOriginIdx || idx === oldOriginIdx) continue;
            const targetCell = newCells[idx];
            if (targetCell?.enabled) {
              newCells[idx] = {
                ...targetCell,
                enabled: false,
                layers: [],
                colSpan: 1,
                rowSpan: 1,
              };
            }
          }
        }

        // Update selection to the new cell
        if (selectedCellId === cellId) {
          selectedCellId = newOriginCell?.id ?? null;
        }
      } else {
        // Not moving, just update span
        // Find cells that would be "under" this span and need to be disabled
        for (let r = cell.row; r < cell.row + rowSpan; r++) {
          for (let c = cell.col; c < cell.col + colSpan; c++) {
            if (r === cell.row && c === cell.col) continue; // Skip origin
            const idx = getCellIndex(r, c);
            const targetCell = newCells[idx];
            if (targetCell?.enabled) {
              newCells[idx] = {
                ...targetCell,
                enabled: false,
                layers: [],
                colSpan: 1,
                rowSpan: 1,
              };
            }
          }
        }

        // Update the spanning cell
        newCells[cellIndex] = {
          ...cell,
          colSpan,
          rowSpan,
        };
      }

      cells = newCells;
      save();
      return true;
    },

    /**
     * Reset a cell's span back to 1x1
     */
    resetCellSpan(cellId: string) {
      this.setCellSpan(cellId, 1, 1);
    },

    // Preset layouts (for 4x4 grid) - includes spanning presets
    setPresetLayout(
      preset:
        | "single"
        | "vertical"
        | "horizontal"
        | "line"
        | "square"
        | "all"
        | "hero-thumbs"
        | "main-banner"
        | "pip"
    ) {
      // Spanning presets have special handling
      if (preset === "hero-thumbs" || preset === "main-banner" || preset === "pip") {
        this.setSpanningPreset(preset);
        return;
      }

      // Non-spanning presets: reset all spans to 1x1
      const newCells = cells.map((cell) => {
        let enabled = false;

        switch (preset) {
          case "single":
            enabled = cell.row === 0 && cell.col === 0;
            break;
          case "vertical":
            // 2 cells vertically stacked in first column
            enabled = cell.col === 0 && cell.row < 2;
            break;
          case "horizontal":
            // 2 cells horizontally in first row
            enabled = cell.row === 0 && cell.col < 2;
            break;
          case "line":
            // Top row (4 cells)
            enabled = cell.row === 0;
            break;
          case "square":
            // 2x2 in top-left
            enabled = cell.row < 2 && cell.col < 2;
            break;
          case "all":
            // Full 4x4
            enabled = true;
            break;
        }

        return {
          ...cell,
          enabled,
          colSpan: 1,
          rowSpan: 1,
          // Clear layers for disabled cells
          layers: enabled ? cell.layers : [],
        };
      });

      cells = newCells;
      selectedCellId = null;
      save();
    },

    /**
     * Apply a spanning layout preset (for 4x4 grid)
     */
    setSpanningPreset(preset: "hero-thumbs" | "main-banner" | "pip") {
      // First reset all cells to disabled with 1x1 span
      const newCells = cells.map((cell) => ({
        ...cell,
        enabled: false,
        colSpan: 1,
        rowSpan: 1,
        layers: [],
      }));

      switch (preset) {
        case "hero-thumbs":
          // 3×3 hero at top-left + three 1×1 thumbnails below
          // [XXX][_]
          // [XXX][_]
          // [XXX][_]
          // [A][B][C][_]
          {
            const heroIdx = getCellIndex(0, 0);
            const heroCell = newCells[heroIdx];
            if (heroCell) {
              newCells[heroIdx] = { ...heroCell, enabled: true, colSpan: 3, rowSpan: 3 };
            }
            const thumbLeft = newCells[getCellIndex(3, 0)];
            if (thumbLeft) {
              newCells[getCellIndex(3, 0)] = { ...thumbLeft, enabled: true };
            }
            const thumbMid = newCells[getCellIndex(3, 1)];
            if (thumbMid) {
              newCells[getCellIndex(3, 1)] = { ...thumbMid, enabled: true };
            }
            const thumbRight = newCells[getCellIndex(3, 2)];
            if (thumbRight) {
              newCells[getCellIndex(3, 2)] = { ...thumbRight, enabled: true };
            }
          }
          break;

        case "main-banner":
          // 4×3 main video at top + 4×1 full-width banner below
          // [XXXXXXX]
          // [XXXXXXX]
          // [XXXXXXX]
          // [BBBBBBB]
          {
            const mainIdx = getCellIndex(0, 0);
            const mainCell = newCells[mainIdx];
            if (mainCell) {
              newCells[mainIdx] = { ...mainCell, enabled: true, colSpan: 4, rowSpan: 3 };
            }
            const banner = newCells[getCellIndex(3, 0)];
            if (banner) {
              newCells[getCellIndex(3, 0)] = { ...banner, enabled: true, colSpan: 4 };
            }
          }
          break;

        case "pip":
          // Picture-in-picture: 3×4 main + 1×1 overlay in corner
          // [XXXXXX][P]
          // [XXXXXX][_]
          // [XXXXXX][_]
          // [XXXXXX][_]
          {
            const mainIdx = getCellIndex(0, 0);
            const mainCell = newCells[mainIdx];
            if (mainCell) {
              newCells[mainIdx] = { ...mainCell, enabled: true, colSpan: 3, rowSpan: 4 };
            }
            const pip = newCells[getCellIndex(0, 3)];
            if (pip) {
              newCells[getCellIndex(0, 3)] = { ...pip, enabled: true };
            }
          }
          break;
      }

      cells = newCells;
      selectedCellId = null;
      save();
    },

    // Cell selection
    selectCell(cellId: string) {
      const cell = cells.find((c) => c.id === cellId);
      if (cell && cell.enabled) {
        selectedCellId = cellId;
      }
    },

    selectCellAt(row: number, col: number) {
      const cell = getCellAt(row, col);
      if (cell && cell.enabled) {
        selectedCellId = cell.id;
      }
    },

    deselectCell() {
      selectedCellId = null;
    },

    /**
     * Get the required beat count for new sequences.
     * Returns null if no sequences exist yet (any length allowed).
     */
    getRequiredBeatCount(): number | null {
      for (const cell of cells) {
        const firstLayer = cell.layers[0];
        if (cell.enabled && firstLayer) {
          return firstLayer.sequence.steps?.length ?? null;
        }
      }
      return null;
    },

    // Layer operations on selected cell
    addLayerToCell(
      cellId: string,
      sequence: SequenceData
    ): { success: boolean; error?: string } {
      const cellIndex = cells.findIndex((c) => c.id === cellId);
      const cell = cells[cellIndex];
      if (!cell || !cell.enabled || cell.layers.length >= MAX_LAYERS_PER_CELL) {
        return {
          success: false,
          error: "Cannot add layer - cell full, disabled, or invalid",
        };
      }

      // Validate sequence length matches existing sequences
      const requiredBeats = this.getRequiredBeatCount();
      const sequenceBeats = sequence.steps?.length ?? 0;
      if (requiredBeats !== null && sequenceBeats !== requiredBeats) {
        return {
          success: false,
          error: `Sequence has ${sequenceBeats} beats but composition requires ${requiredBeats} beats. All sequences must be the same length.`,
        };
      }

      const newLayer: TunnelLayerConfig = {
        sequence,
        beatOffset: 0,
        propColors: getTunnelLayerColors(cell.layers.length),
      };

      const newCells = [...cells];
      newCells[cellIndex] = {
        ...cell,
        layers: [...cell.layers, newLayer],
      };
      cells = newCells;
      save();
      return { success: true };
    },

    removeLayerFromCell(cellId: string, layerIndex: number) {
      const cellIndex = cells.findIndex((c) => c.id === cellId);
      const cell = cells[cellIndex];
      if (!cell || layerIndex < 0 || layerIndex >= cell.layers.length) return;

      const newLayers = cell.layers
        .filter((_, i) => i !== layerIndex)
        .map((layer, i) => ({
          ...layer,
          propColors: getTunnelLayerColors(i),
        }));

      const newCells = [...cells];
      newCells[cellIndex] = {
        ...cell,
        layers: newLayers,
      };
      cells = newCells;
      save();
    },

    updateLayerBeatOffset(cellId: string, layerIndex: number, offset: number) {
      const cellIndex = cells.findIndex((c) => c.id === cellId);
      const cell = cells[cellIndex];
      if (!cell || layerIndex < 0 || layerIndex >= cell.layers.length) return;

      const newLayers = [...cell.layers];
      const existingLayer = newLayers[layerIndex];
      if (!existingLayer) return;

      newLayers[layerIndex] = {
        ...existingLayer,
        beatOffset: Math.max(0, offset),
      };

      const newCells = [...cells];
      newCells[cellIndex] = {
        ...cell,
        layers: newLayers,
      };
      cells = newCells;
      save();
    },

    updateCellBeatOffset(cellId: string, offset: number) {
      const cellIndex = cells.findIndex((c) => c.id === cellId);
      const cell = cells[cellIndex];
      if (!cell) return;

      const newCells = [...cells];
      newCells[cellIndex] = {
        ...cell,
        beatOffset: Math.max(0, offset),
      };
      cells = newCells;
      save();
    },

    clearCell(cellId: string) {
      const cellIndex = cells.findIndex((c) => c.id === cellId);
      const cell = cells[cellIndex];
      if (!cell) return;

      const newCells = [...cells];
      newCells[cellIndex] = {
        ...cell,
        layers: [],
        beatOffset: 0,
      };
      cells = newCells;
      save();
    },

    /**
     * Update the media type for a cell
     */
    setCellMediaType(cellId: string, mediaType: CellMediaType) {
      const cellIndex = cells.findIndex((c) => c.id === cellId);
      const cell = cells[cellIndex];
      if (!cell) return;

      const newCells = [...cells];
      newCells[cellIndex] = {
        ...cell,
        mediaType,
        // Layers preserved - both animation and choreo-card display the same sequence data
      };
      cells = newCells;
      save();
    },

    // Playback (global sync)
    play() {
      if (!cells.some((c) => c.enabled && c.layers.length > 0)) return;
      isPlaying = true;
      startPlaybackLoop();
    },

    pause() {
      isPlaying = false;
      stopPlaybackLoop();
    },

    stop() {
      isPlaying = false;
      stopPlaybackLoop();
      currentBeat = 0;
    },

    togglePlayPause() {
      if (isPlaying) {
        isPlaying = false;
        stopPlaybackLoop();
      } else if (cells.some((c) => c.enabled && c.layers.length > 0)) {
        isPlaying = true;
        startPlaybackLoop();
      }
    },

    // Step controls - animate smoothly to the next position
    stepFullForward() {
      animateStep(1);
    },

    stepFullBack() {
      // If partway through a beat, animate back to its start first
      const floored = Math.floor(currentBeat);
      if (currentBeat - floored > 0.01) {
        animateStep(floored - currentBeat);
      } else {
        animateStep(-1);
      }
    },

    stepHalfForward() {
      animateStep(0.5);
    },

    stepHalfBack() {
      const snapped = Math.round(currentBeat * 2) / 2;
      const diff = snapped - currentBeat;
      if (Math.abs(diff) > 0.01 && diff < 0) {
        animateStep(diff);
      } else {
        animateStep(-0.5);
      }
    },

    // Loop mode
    toggleSkipStartPosition() {
      skipStartPosition = !skipStartPosition;
      // Reset beat to 0 when changing mode to avoid out-of-bounds
      currentBeat = 0;
    },

    // BPM control
    get bpm() {
      return playbackBpm;
    },

    setBpm(bpm: number) {
      playbackBpm = Math.max(5, Math.min(300, bpm));
    },

    // UI
    openSequencePicker() {
      showSequencePicker = true;
    },

    closeSequencePicker() {
      showSequencePicker = false;
    },

    // Reset
    reset() {
      isPlaying = false;
      stopPlaybackLoop();
      cells = createInitialGrid();
      currentBeat = 0;
      selectedCellId = null;
      showSequencePicker = false;
      save();
    },
  };
}

// Export singleton instance
export const arrangeGridState = createArrangeGridState();

// Type for the state object
export type ArrangeGridState = typeof arrangeGridState;

// HMR: Force full reload when this module changes
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}
