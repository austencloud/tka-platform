/**
 * Arrange Grid State
 *
 * State management for the Arrange tab grid composition mode.
 * Supports a freeform 4x4 grid where each position can be enabled/disabled,
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

// LocalStorage key (v4 = 3x3 grid with cell spanning)
const STORAGE_KEY = "compose-arrange-grid-v4";
const STORAGE_KEY_V3 = "compose-arrange-grid-v3";

// Grid dimensions (fixed 3x3 grid)
export const GRID_SIZE = 3;
const MAX_LAYERS_PER_CELL = 4;

/**
 * A single cell in the grid - each cell is a mini-tunnel
 */
export interface GridCell {
  id: string;
  /** Row position (0-2) */
  row: number;
  /** Column position (0-2) */
  col: number;
  /** Is this cell enabled/visible? */
  enabled: boolean;
  layers: TunnelLayerConfig[];
  beatOffset: number; // Cell-level offset for staggered playback
  /** Number of columns this cell spans (1-3) */
  colSpan: number;
  /** Number of rows this cell spans (1-3) */
  rowSpan: number;
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

function calculateCellBeats(cell: GridCell): number {
  if (cell.layers.length === 0) return 0;

  const beatCounts = cell.layers.map((layer) => {
    return layer.sequence.steps?.length || 1;
  });

  const firstCount = beatCounts[0];
  if (firstCount === undefined) return 1;
  return beatCounts.reduce((acc, count) => lcm(acc, count), firstCount);
}

function calculateTotalBeats(cells: GridCell[]): number {
  const enabledCellsWithLayers = cells.filter(
    (c) => c.enabled && c.layers.length > 0
  );
  if (enabledCellsWithLayers.length === 0) return 0;

  const beatCounts = enabledCellsWithLayers.map((cell) =>
    calculateCellBeats(cell)
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
    // Try v4 first
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const config = JSON.parse(stored) as GridConfig;
      if (config.cells.length === GRID_SIZE * GRID_SIZE) {
        return config;
      }
    }

    // Try migrating from v3
    const storedV3 = localStorage.getItem(STORAGE_KEY_V3);
    if (storedV3) {
      const configV3 = JSON.parse(storedV3) as GridConfig;
      if (configV3.cells.length === GRID_SIZE * GRID_SIZE) {
        // Migrate: add colSpan and rowSpan to all cells
        const migratedCells = configV3.cells.map((cell) => ({
          ...cell,
          colSpan: cell.colSpan ?? 1,
          rowSpan: cell.rowSpan ?? 1,
        }));
        const migratedConfig = { cells: migratedCells };
        // Save migrated config to v4 key
        saveToStorage(migratedConfig);
        // Clean up old key
        localStorage.removeItem(STORAGE_KEY_V3);
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

  // Non-reactive
  let playbackInterval: ReturnType<typeof setInterval> | null = null;

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

  // Playback loop
  function startPlaybackLoop(bpm: number = 120) {
    if (playbackInterval) {
      clearInterval(playbackInterval);
    }

    const msPerBeat = (60 / bpm) * 1000;

    playbackInterval = setInterval(() => {
      const total = calculateTotalBeats(cells);
      if (total > 0) {
        currentBeat = (currentBeat + 1) % total;
      }
    }, msPerBeat);
  }

  function stopPlaybackLoop() {
    if (playbackInterval) {
      clearInterval(playbackInterval);
      playbackInterval = null;
    }
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
      return calculateTotalBeats(cells);
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
     * @returns true if span was set successfully, false if invalid
     */
    setCellSpan(
      cellId: string,
      colSpan: number,
      rowSpan: number
    ): boolean {
      const cellIndex = cells.findIndex((c) => c.id === cellId);
      const cell = cells[cellIndex];
      if (!cell || !cell.enabled) return false;

      // Validate spans
      colSpan = Math.max(1, Math.min(colSpan, GRID_SIZE));
      rowSpan = Math.max(1, Math.min(rowSpan, GRID_SIZE));

      // Check bounds
      if (cell.col + colSpan > GRID_SIZE) return false;
      if (cell.row + rowSpan > GRID_SIZE) return false;

      // Find cells that would be "under" this span and need to be disabled
      const cellsToDisable: number[] = [];
      for (let r = cell.row; r < cell.row + rowSpan; r++) {
        for (let c = cell.col; c < cell.col + colSpan; c++) {
          if (r === cell.row && c === cell.col) continue; // Skip origin
          const idx = getCellIndex(r, c);
          const targetCell = cells[idx];
          if (targetCell?.enabled) {
            cellsToDisable.push(idx);
          }
        }
      }

      // Apply changes
      const newCells = [...cells];

      // Update the spanning cell
      newCells[cellIndex] = {
        ...cell,
        colSpan,
        rowSpan,
      };

      // Disable cells under the span
      for (const idx of cellsToDisable) {
        const targetCell = newCells[idx];
        if (targetCell) {
          newCells[idx] = {
            ...targetCell,
            enabled: false,
            layers: [], // Clear content
            colSpan: 1,
            rowSpan: 1,
          };
        }
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

    // Preset layouts (for 3x3 grid) - includes spanning presets
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
            // Top row (3 cells)
            enabled = cell.row === 0;
            break;
          case "square":
            // 2x2 in top-left
            enabled = cell.row < 2 && cell.col < 2;
            break;
          case "all":
            // Full 3x3
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
     * Apply a spanning layout preset
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
          // 2×2 hero at top-left + two 1×1 thumbnails below
          // [XX][_]
          // [XX][_]
          // [A][B][_]
          {
            const heroIdx = getCellIndex(0, 0);
            const heroCell = newCells[heroIdx];
            if (heroCell) {
              newCells[heroIdx] = { ...heroCell, enabled: true, colSpan: 2, rowSpan: 2 };
            }
            const thumbLeft = newCells[getCellIndex(2, 0)];
            if (thumbLeft) {
              newCells[getCellIndex(2, 0)] = { ...thumbLeft, enabled: true };
            }
            const thumbRight = newCells[getCellIndex(2, 1)];
            if (thumbRight) {
              newCells[getCellIndex(2, 1)] = { ...thumbRight, enabled: true };
            }
          }
          break;

        case "main-banner":
          // 3×2 main video at top + 3×1 full-width banner below
          // [XXXXX]
          // [XXXXX]
          // [BBBBB]
          {
            const mainIdx = getCellIndex(0, 0);
            const mainCell = newCells[mainIdx];
            if (mainCell) {
              newCells[mainIdx] = { ...mainCell, enabled: true, colSpan: 3, rowSpan: 2 };
            }
            const banner = newCells[getCellIndex(2, 0)];
            if (banner) {
              newCells[getCellIndex(2, 0)] = { ...banner, enabled: true, colSpan: 3 };
            }
          }
          break;

        case "pip":
          // Picture-in-picture: 3×3 main + 1×1 overlay in corner
          // This enables all cells but the main spans most of the grid
          // [XXXXX][P]
          // [XXXXX][_]
          // [XXXXX][_]
          {
            const mainIdx = getCellIndex(0, 0);
            const mainCell = newCells[mainIdx];
            if (mainCell) {
              newCells[mainIdx] = { ...mainCell, enabled: true, colSpan: 2, rowSpan: 3 };
            }
            const pip = newCells[getCellIndex(0, 2)];
            if (pip) {
              newCells[getCellIndex(0, 2)] = { ...pip, enabled: true };
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

    // Layer operations on selected cell
    addLayerToCell(cellId: string, sequence: SequenceData) {
      const cellIndex = cells.findIndex((c) => c.id === cellId);
      const cell = cells[cellIndex];
      if (!cell || !cell.enabled || cell.layers.length >= MAX_LAYERS_PER_CELL) {
        console.warn("Cannot add layer - cell full, disabled, or invalid");
        return;
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
