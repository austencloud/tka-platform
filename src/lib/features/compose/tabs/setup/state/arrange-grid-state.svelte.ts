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

// LocalStorage key (v3 = 3x3 grid)
const STORAGE_KEY = "compose-arrange-grid-v3";

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

  return beatCounts.reduce((acc, count) => lcm(acc, count), beatCounts[0]);
}

function calculateTotalBeats(cells: GridCell[]): number {
  const enabledCellsWithLayers = cells.filter(
    (c) => c.enabled && c.layers.length > 0
  );
  if (enabledCellsWithLayers.length === 0) return 0;

  const beatCounts = enabledCellsWithLayers.map((cell) =>
    calculateCellBeats(cell)
  );
  return beatCounts.reduce((acc, count) => lcm(acc, count), beatCounts[0]);
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
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const config = JSON.parse(stored) as GridConfig;
      // Validate cell count
      if (config.cells.length === GRID_SIZE * GRID_SIZE) {
        return config;
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

    // Grid layout bounds (for rendering)
    get gridBounds() {
      const enabled = cells.filter((c) => c.enabled);
      if (enabled.length === 0) {
        return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0, rows: 1, cols: 1 };
      }

      const rows = enabled.map((c) => c.row);
      const colsArr = enabled.map((c) => c.col);

      const minRow = Math.min(...rows);
      const maxRow = Math.max(...rows);
      const minCol = Math.min(...colsArr);
      const maxCol = Math.max(...colsArr);

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

      // If disabling a cell with content, warn/confirm
      const isDisabling = cell.enabled;
      const hasContent = cell.layers.length > 0;

      const newCells = [...cells];
      newCells[index] = {
        ...cell,
        enabled: !cell.enabled,
        // Clear layers if disabling a cell with content
        layers: isDisabling && hasContent ? [] : cell.layers,
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

    // Preset layouts (for 3x3 grid)
    setPresetLayout(preset: "single" | "line" | "square" | "all") {
      const newCells = cells.map((cell) => {
        let enabled = false;

        switch (preset) {
          case "single":
            enabled = cell.row === 0 && cell.col === 0;
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
          // Clear layers for disabled cells
          layers: enabled ? cell.layers : [],
        };
      });

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
      newLayers[layerIndex] = {
        ...newLayers[layerIndex],
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
