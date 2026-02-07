/**
 * Arrange Grid State
 *
 * State management for the Arrange tab grid composition mode.
 * Supports a freeform 6x6 grid where each position can be enabled/disabled,
 * allowing for non-rectangular layouts (L-shapes, T-shapes, scattered, etc.).
 *
 * Each enabled cell is a "tunnel" that can hold up to 4 performers/layers.
 * Global sync playback: one play button controls all cells together,
 * with optional per-cell beat offsets.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import {
  type TunnelLayerConfig,
  type TransformType,
  getTunnelLayerColors,
} from "../../../compose/domain/types";

import type { CellMediaType } from "../../../compose/domain/types";
import { sequenceTransformer } from "$lib/features/create/shared/services/implementations/sequence-transforms/SequenceTransformer";
import { container } from "$lib/shared/di";
import type {
  ArrangeUndoOperationType,
  ArrangeGridSnapshot,
} from "../services/contracts/IArrangeUndoManager";

import { ArrangeGridSerializer } from "../services/implementations/ArrangeGridSerializer";

// Grid dimensions (fixed 6x6 grid)
export const GRID_SIZE = 6;
const MAX_LAYERS_PER_CELL = 4;

/**
 * A single cell in the grid - each cell is a mini-tunnel
 */
export interface GridCell {
  id: string;
  /** Row position (0-5) */
  row: number;
  /** Column position (0-5) */
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
 * Grid configuration - stores all 36 positions (6x6 grid)
 */
export interface GridConfig {
  cells: GridCell[];
}

/**
 * A saved composition — full grid state with a name
 */
export interface SavedComposition {
  id: string;
  name: string;
  createdAt: number;
  cells: GridCell[];
  bpm: number;
  skipStartPosition: boolean;
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

export function generateCellId(row: number, col: number): string {
  return `cell-${row}-${col}`;
}

export function createCell(row: number, col: number, enabled: boolean): GridCell {
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

export function createInitialGrid(): GridCell[] {
  const cells: GridCell[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      // Start with just cell (0,0) enabled
      cells.push(createCell(row, col, row === 0 && col === 0));
    }
  }
  return cells;
}

/**
 * Deep-clone cells array. Unwraps Svelte 5 reactive proxies first
 * via $state.snapshot() so structuredClone doesn't choke on Proxy objects.
 */
function deepCloneCells(source: GridCell[]): GridCell[] {
  return structuredClone($state.snapshot(source));
}

// =========================================================================
// LocalStorage persistence (inline to avoid circular imports)
// =========================================================================

const STORAGE_KEY = "compose-arrange-grid-v6";
const STORAGE_KEY_V5 = "compose-arrange-grid-v5";
const STORAGE_KEY_V4 = "compose-arrange-grid-v4";
const SAVED_COMPOSITIONS_KEY = "compose-saved-compositions";

function loadFromStorage(): GridConfig {
  if (typeof window === "undefined") {
    return { cells: createInitialGrid() };
  }

  try {
    // Try v6 first (6x6 grid)
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const config = JSON.parse(stored) as GridConfig;
      if (config.cells.length === GRID_SIZE * GRID_SIZE) {
        const migratedCells = config.cells.map((cell) => ({
          ...cell,
          mediaType: cell.mediaType ?? "animation",
        }));
        return { cells: migratedCells };
      }
    }

    // Try migrating from v5 (4x4 grid -> 6x6 grid)
    const storedV5 = localStorage.getItem(STORAGE_KEY_V5);
    if (storedV5) {
      const configV5 = JSON.parse(storedV5) as GridConfig;
      if (configV5.cells.length === 16) {
        const newCells = createInitialGrid();
        for (const oldCell of configV5.cells) {
          if (oldCell.row < 4 && oldCell.col < 4) {
            const newIndex = oldCell.row * GRID_SIZE + oldCell.col;
            const newCell = newCells[newIndex];
            if (newCell) {
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
        }
        const migratedConfig = { cells: newCells };
        saveToStorage(migratedConfig);
        localStorage.removeItem(STORAGE_KEY_V5);
        return migratedConfig;
      }
    }

    // Try migrating from v4 (3x3 grid -> 6x6 grid)
    const storedV4 = localStorage.getItem(STORAGE_KEY_V4);
    if (storedV4) {
      const configV4 = JSON.parse(storedV4) as GridConfig;
      if (configV4.cells.length === 9) {
        const newCells = createInitialGrid();
        for (const oldCell of configV4.cells) {
          if (oldCell.row < 3 && oldCell.col < 3) {
            const newIndex = oldCell.row * GRID_SIZE + oldCell.col;
            const newCell = newCells[newIndex];
            if (newCell) {
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
        }
        const migratedConfig = { cells: newCells };
        saveToStorage(migratedConfig);
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

function loadSavedCompositions(): SavedComposition[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(SAVED_COMPOSITIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function persistSavedCompositions(compositions: SavedComposition[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      SAVED_COMPOSITIONS_KEY,
      JSON.stringify(compositions)
    );
  } catch (err) {
    console.warn("Failed to save compositions:", err);
  }
}

/**
 * Create the grid state
 */
function createArrangeGridState() {
  const serializer = new ArrangeGridSerializer();

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

  // Clipboard for copy/paste between cells
  let clipboard = $state<{
    sequence: SequenceData;
    mediaType: CellMediaType;
    appliedTransforms: TransformType[];
  } | null>(null);
  let transformingLayer = $state<{ cellId: string; layerIndex: number } | null>(
    null
  );

  // Playback BPM (reactive so BpmChips can display it)
  let playbackBpm = $state(120);

  // Non-reactive playback state
  let animationFrameId: number | null = null;
  let lastFrameTime: number = 0;
  let stepAnimating = false;

  // =========================================================================
  // Undo / Redo
  // =========================================================================

  const undoManager = container.items.arrangeUndoManager;
  undoManager.init(() => ({
    cells: deepCloneCells(cells),
  }));

  // Reactive undo state driven by subscriber
  let canUndo = $state(false);
  let canRedo = $state(false);
  let undoDescription = $state<string | null>(null);
  let redoDescription = $state<string | null>(null);

  undoManager.subscribe(() => {
    canUndo = undoManager.canUndo;
    canRedo = undoManager.canRedo;
    undoDescription = undoManager.undoDescription;
    redoDescription = undoManager.redoDescription;
  });

  /**
   * Wrap a synchronous mutation in undo capture/commit.
   * The fn receives no args and should mutate cells/selectedCellId directly.
   * Guard clauses that exit early must run BEFORE calling withUndo.
   */
  function withUndo(
    type: ArrangeUndoOperationType,
    description: string,
    fn: () => void
  ): void {
    undoManager.captureState(type, description);
    try {
      fn();
      undoManager.commitState();
    } catch (err) {
      undoManager.cancelPending();
      throw err;
    }
  }

  /**
   * Wrap a synchronous mutation with coalescing for rapid same-type operations.
   * If the previous undo entry has the same coalescingKey and was committed
   * within 500ms, the entries merge (one undo step for the entire drag/slider).
   */
  function withCoalescingUndo(
    type: ArrangeUndoOperationType,
    description: string,
    coalescingKey: string,
    fn: () => void
  ): void {
    undoManager.captureState(type, description);
    try {
      fn();
      undoManager.commitStateCoalescing(coalescingKey);
    } catch (err) {
      undoManager.cancelPending();
      throw err;
    }
  }

  /**
   * Restore a snapshot returned by undo/redo.
   * Selection state is not part of the snapshot - undo is for mutations, not navigation.
   */
  function restoreSnapshot(snapshot: ArrangeGridSnapshot): void {
    cells = snapshot.cells;
    save();
  }

  // =========================================================================
  // Helpers
  // =========================================================================

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

  /**
   * Compute occupied positions map from current cells.
   * Used internally for guard clauses that need this before `this` is available.
   */
  function computeOccupiedPositions(): Map<string, string> {
    const occupied = new Map<string, string>();
    for (const cell of cells.filter((c) => c.enabled)) {
      for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
        for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
          if (r === cell.row && c === cell.col) continue;
          occupied.set(`${r}-${c}`, cell.id);
        }
      }
    }
    return occupied;
  }

  /**
   * Apply a spanning layout preset. Shared by setPresetLayout and setSpanningPreset
   * so that preset layouts can wrap the entire operation (including spanning) in one undo entry.
   */
  function applySpanningPreset(preset: "hero-thumbs" | "main-banner" | "pip"): void {
    // Reset all cells to disabled with 1x1 span
    const newCells = cells.map((cell) => ({
      ...cell,
      enabled: false,
      colSpan: 1,
      rowSpan: 1,
      layers: [],
    }));

    switch (preset) {
      case "hero-thumbs": {
        // Large hero (5x5) + 5 thumbnails across bottom row
        const heroIdx = getCellIndex(0, 0);
        const heroCell = newCells[heroIdx];
        if (heroCell) {
          newCells[heroIdx] = { ...heroCell, enabled: true, colSpan: 5, rowSpan: 5 };
        }
        for (let col = 0; col < 5; col++) {
          const thumbIdx = getCellIndex(5, col);
          const thumb = newCells[thumbIdx];
          if (thumb) {
            newCells[thumbIdx] = { ...thumb, enabled: true };
          }
        }
        break;
      }
      case "main-banner": {
        // Full-width main (6x5) + full-width banner (6x1)
        const mainIdx = getCellIndex(0, 0);
        const mainCell = newCells[mainIdx];
        if (mainCell) {
          newCells[mainIdx] = { ...mainCell, enabled: true, colSpan: 6, rowSpan: 5 };
        }
        const banner = newCells[getCellIndex(5, 0)];
        if (banner) {
          newCells[getCellIndex(5, 0)] = { ...banner, enabled: true, colSpan: 6 };
        }
        break;
      }
      case "pip": {
        // Large main (5x6) + small PIP overlay
        const mainIdx = getCellIndex(0, 0);
        const mainCell = newCells[mainIdx];
        if (mainCell) {
          newCells[mainIdx] = { ...mainCell, enabled: true, colSpan: 5, rowSpan: 6 };
        }
        const pip = newCells[getCellIndex(0, 5)];
        if (pip) {
          newCells[getCellIndex(0, 5)] = { ...pip, enabled: true };
        }
        break;
      }
    }

    cells = newCells;
    selectedCellId = null;
    save();
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
    get clipboard() {
      return clipboard;
    },
    get transformingLayer() {
      return transformingLayer;
    },

    // Undo/redo reactive state
    get canUndo() {
      return canUndo;
    },
    get canRedo() {
      return canRedo;
    },
    get undoDescription() {
      return undoDescription;
    },
    get redoDescription() {
      return redoDescription;
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
     * Get 1-based display index for a cell (sorted by row, then column).
     * Returns 0 if the cell is not found among enabled cells.
     */
    getCellDisplayIndex(cellId: string): number {
      const enabled = cells.filter((c) => c.enabled);
      const sorted = [...enabled].sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
      });
      return sorted.findIndex((c) => c.id === cellId) + 1;
    },

    /**
     * Map of grid positions that are "occupied" by spanning cells.
     * Key is "row-col", value is the ID of the cell that occupies it.
     * Only includes positions that are NOT the cell's origin.
     */
    get occupiedPositions(): Map<string, string> {
      return computeOccupiedPositions();
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
      const occupyingId = computeOccupiedPositions().get(`${row}-${col}`);
      if (occupyingId) return;

      const isDisabling = cell.enabled;
      const hasContent = cell.layers.length > 0;

      withUndo(
        "TOGGLE_CELL",
        isDisabling ? `Disable cell (${row},${col})` : `Enable cell (${row},${col})`,
        () => {
          const newCells = [...cells];
          newCells[index] = {
            ...cell,
            enabled: !cell.enabled,
            layers: isDisabling && hasContent ? [] : cell.layers,
            colSpan: isDisabling ? 1 : cell.colSpan,
            rowSpan: isDisabling ? 1 : cell.rowSpan,
          };
          cells = newCells;

          if (isDisabling && selectedCellId === cell.id) {
            selectedCellId = null;
          }

          save();
        }
      );
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
      return computeOccupiedPositions().get(`${row}-${col}`) ?? null;
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

      withUndo("SET_CELL_SPAN", `Resize cell to ${colSpan}x${rowSpan}`, () => {
        const newCells = [...cells];

        if (isMoving) {
          const newOriginIdx = getCellIndex(targetRow, targetCol);
          const oldOriginIdx = cellIndex;
          const newOriginCell = newCells[newOriginIdx];

          if (newOriginCell) {
            newCells[newOriginIdx] = {
              ...cell,
              id: newOriginCell.id,
              row: newOriginCell.row,
              col: newOriginCell.col,
              enabled: true,
              colSpan,
              rowSpan,
            };
          }

          if (oldOriginIdx !== newOriginIdx) {
            newCells[oldOriginIdx] = createCell(cell.row, cell.col, false);
          }

          for (let r = targetRow; r < targetRow + rowSpan; r++) {
            for (let c = targetCol; c < targetCol + colSpan; c++) {
              const idx = getCellIndex(r, c);
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

          if (selectedCellId === cellId) {
            selectedCellId = newOriginCell?.id ?? null;
          }
        } else {
          for (let r = cell.row; r < cell.row + rowSpan; r++) {
            for (let c = cell.col; c < cell.col + colSpan; c++) {
              if (r === cell.row && c === cell.col) continue;
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

          newCells[cellIndex] = {
            ...cell,
            colSpan,
            rowSpan,
          };
        }

        cells = newCells;
        save();
      });

      return true;
    },

    /**
     * Reset a cell's span back to 1x1
     */
    resetCellSpan(cellId: string) {
      this.setCellSpan(cellId, 1, 1);
    },

    // Preset layouts (for 6x6 grid) - includes spanning presets
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
      withUndo("SET_PRESET_LAYOUT", `Set layout: ${preset}`, () => {
        // Spanning presets
        if (preset === "hero-thumbs" || preset === "main-banner" || preset === "pip") {
          applySpanningPreset(preset);
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
              enabled = cell.col === 0 && cell.row < 2;
              break;
            case "horizontal":
              enabled = cell.row === 0 && cell.col < 2;
              break;
            case "line":
              enabled = cell.row === 0;
              break;
            case "square":
              enabled = cell.row < 2 && cell.col < 2;
              break;
            case "all":
              enabled = true;
              break;
          }

          return {
            ...cell,
            enabled,
            colSpan: 1,
            rowSpan: 1,
            layers: enabled ? cell.layers : [],
          };
        });

        cells = newCells;
        selectedCellId = null;
        save();
      });
    },

    /**
     * Apply a spanning layout preset (for 6x6 grid).
     * Public entry point wraps in its own undo entry.
     */
    setSpanningPreset(preset: "hero-thumbs" | "main-banner" | "pip") {
      withUndo("SET_PRESET_LAYOUT", `Set layout: ${preset}`, () => {
        applySpanningPreset(preset);
      });
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

      const word = sequence.word || sequence.name || "sequence";

      withUndo("ADD_LAYER", `Add ${word}`, () => {
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
      });

      return { success: true };
    },

    removeLayerFromCell(cellId: string, layerIndex: number) {
      const cellIndex = cells.findIndex((c) => c.id === cellId);
      const cell = cells[cellIndex];
      if (!cell || layerIndex < 0 || layerIndex >= cell.layers.length) return;

      const layer = cell.layers[layerIndex];
      const word = layer?.sequence.word || layer?.sequence.name || "layer";

      withUndo("REMOVE_LAYER", `Remove ${word}`, () => {
        const newLayers = cell.layers
          .filter((_, i) => i !== layerIndex)
          .map((l, i) => ({
            ...l,
            propColors: getTunnelLayerColors(i),
          }));

        const newCells = [...cells];
        newCells[cellIndex] = {
          ...cell,
          layers: newLayers,
        };
        cells = newCells;
        save();
      });
    },

    updateLayerBeatOffset(cellId: string, layerIndex: number, offset: number) {
      const cellIndex = cells.findIndex((c) => c.id === cellId);
      const cell = cells[cellIndex];
      if (!cell || layerIndex < 0 || layerIndex >= cell.layers.length) return;

      const existingLayer = cell.layers[layerIndex];
      if (!existingLayer) return;

      withCoalescingUndo(
        "UPDATE_LAYER_OFFSET",
        `Change layer offset to ${offset}`,
        `layer-offset-${cellId}-${layerIndex}`,
        () => {
          const newLayers = [...cell.layers];
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
        }
      );
    },

    updateCellBeatOffset(cellId: string, offset: number) {
      const cellIndex = cells.findIndex((c) => c.id === cellId);
      const cell = cells[cellIndex];
      if (!cell) return;

      withCoalescingUndo(
        "UPDATE_CELL_OFFSET",
        `Change cell offset to ${offset}`,
        `cell-offset-${cellId}`,
        () => {
          const newCells = [...cells];
          newCells[cellIndex] = {
            ...cell,
            beatOffset: Math.max(0, offset),
          };
          cells = newCells;
          save();
        }
      );
    },

    clearCell(cellId: string) {
      const cellIndex = cells.findIndex((c) => c.id === cellId);
      const cell = cells[cellIndex];
      if (!cell) return;

      withUndo("CLEAR_CELL", `Clear cell (${cell.row},${cell.col})`, () => {
        const newCells = [...cells];
        newCells[cellIndex] = {
          ...cell,
          layers: [],
          beatOffset: 0,
        };
        cells = newCells;
        save();
      });
    },

    /**
     * Update the media type for a cell
     */
    setCellMediaType(cellId: string, mediaType: CellMediaType) {
      const cellIndex = cells.findIndex((c) => c.id === cellId);
      const cell = cells[cellIndex];
      if (!cell) return;

      withUndo("SET_MEDIA_TYPE", `Set display to ${mediaType}`, () => {
        const newCells = [...cells];
        newCells[cellIndex] = {
          ...cell,
          mediaType,
        };
        cells = newCells;
        save();
      });
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

    // Clipboard operations
    copyLayerSequence(cellId: string, layerIndex: number) {
      const cell = cells.find((c) => c.id === cellId);
      const layer = cell?.layers[layerIndex];
      if (cell && layer) {
        clipboard = {
          sequence: structuredClone($state.snapshot(layer.sequence)),
          mediaType: cell.mediaType,
          appliedTransforms: [...(layer.appliedTransforms ?? [])],
        };
      }
    },

    pasteSequenceToCell(
      cellId: string
    ): { success: boolean; error?: string } {
      if (!clipboard) {
        return { success: false, error: "Nothing copied" };
      }

      // Run guard clauses before undo capture
      const cellIndex = cells.findIndex((c) => c.id === cellId);
      const cell = cells[cellIndex];
      if (!cell || !cell.enabled || cell.layers.length >= MAX_LAYERS_PER_CELL) {
        return {
          success: false,
          error: "Cannot add layer - cell full, disabled, or invalid",
        };
      }

      const requiredBeats = this.getRequiredBeatCount();
      const sequenceBeats = clipboard.sequence.steps?.length ?? 0;
      if (requiredBeats !== null && sequenceBeats !== requiredBeats) {
        return {
          success: false,
          error: `Sequence has ${sequenceBeats} beats but composition requires ${requiredBeats} beats. All sequences must be the same length.`,
        };
      }

      // Single undo entry for the entire paste (add layer + set media type)
      const word = clipboard.sequence.word || clipboard.sequence.name || "sequence";

      withUndo("PASTE_SEQUENCE", `Paste ${word}`, () => {
        const newLayer: TunnelLayerConfig = {
          sequence: structuredClone($state.snapshot(clipboard!.sequence)),
          beatOffset: 0,
          propColors: getTunnelLayerColors(cell.layers.length),
          appliedTransforms: [...(clipboard!.appliedTransforms ?? [])],
        };

        const newCells = [...cells];
        newCells[cellIndex] = {
          ...cell,
          layers: [...cell.layers, newLayer],
          mediaType: clipboard!.mediaType,
        };
        cells = newCells;
        save();
      });

      return { success: true };
    },

    // Transform operations
    async transformLayer(
      cellId: string,
      layerIndex: number,
      transformType: TransformType
    ): Promise<{ success: boolean; error?: string }> {
      const cellIdx = cells.findIndex((c) => c.id === cellId);
      const cell = cells[cellIdx];
      const layer = cell?.layers[layerIndex];
      if (!cell || !layer) {
        return { success: false, error: "Invalid cell or layer" };
      }

      // Snapshot reactive proxies BEFORE async work. Svelte 5 proxies passed
      // through an await boundary and then spread via { ...proxy } can produce
      // stale or inconsistent results. Snapshotting here gives the transformer
      // and the subsequent mutation plain objects to work with.
      const sequenceSnapshot = $state.snapshot(layer.sequence) as SequenceData;
      const layerSnapshot = $state.snapshot(layer) as TunnelLayerConfig;
      const cellSnapshot = $state.snapshot(cell) as GridCell;

      // Manual capture/commit for async operation
      undoManager.captureState("TRANSFORM_LAYER", `Transform: ${transformType}`);

      transformingLayer = { cellId, layerIndex };
      try {
        let transformed: SequenceData;
        switch (transformType) {
          case "rotate90":
            transformed = await sequenceTransformer.rotateSequence(
              sequenceSnapshot,
              2
            );
            break;
          case "rotate180":
            transformed = await sequenceTransformer.rotateSequence(
              sequenceSnapshot,
              4
            );
            break;
          case "rotate270":
            transformed = await sequenceTransformer.rotateSequence(
              sequenceSnapshot,
              6
            );
            break;
          case "mirror":
            transformed = await sequenceTransformer.mirrorSequence(
              sequenceSnapshot
            );
            break;
          case "flip":
            transformed = await sequenceTransformer.flipSequence(
              sequenceSnapshot
            );
            break;
          case "swapColors":
            transformed = sequenceTransformer.swapColors(sequenceSnapshot);
            break;
          case "invert":
            transformed = await sequenceTransformer.invertSequence(
              sequenceSnapshot
            );
            break;
          case "rewind":
            transformed = await sequenceTransformer.rewindSequence(
              sequenceSnapshot
            );
            break;
        }

        const newLayers = [...cellSnapshot.layers];
        const prevTransforms = layerSnapshot.appliedTransforms ?? [];
        newLayers[layerIndex] = {
          ...layerSnapshot,
          sequence: transformed,
          appliedTransforms: [...prevTransforms, transformType],
        };
        const newCells = [...$state.snapshot(cells) as GridCell[]];
        newCells[cellIdx] = { ...cellSnapshot, layers: newLayers };
        cells = newCells;
        save();

        undoManager.commitState();
        return { success: true };
      } catch (err) {
        console.error("Transform failed:", err);
        undoManager.cancelPending();
        return { success: false, error: "Transform failed" };
      } finally {
        transformingLayer = null;
      }
    },

    // UI
    openSequencePicker() {
      showSequencePicker = true;
    },

    closeSequencePicker() {
      showSequencePicker = false;
    },

    // =========================================================================
    // Serialize / Save / Load
    // =========================================================================

    /**
     * Suggest a composition name based on current grid content.
     */
    suggestCompositionName(): string {
      const enabled = cells.filter((c) => c.enabled);
      const cellCount = enabled.length;
      const words = new Set<string>();
      for (const cell of enabled) {
        for (const layer of cell.layers) {
          const word = layer.sequence.intendedWord || layer.sequence.word;
          if (word) words.add(word);
        }
      }

      if (words.size === 0) return `${cellCount}-cell composition`;
      if (words.size === 1) {
        const word = [...words][0]!;
        return `${word} (${cellCount} cells)`;
      }
      const wordList = [...words].slice(0, 3).join(" + ");
      const suffix = words.size > 3 ? " + ..." : "";
      return `${wordList}${suffix} (${cellCount} cells)`;
    },

    /**
     * Serialize current grid state to a template-style clipboard format.
     */
    serializeState(): string {
      return serializer.serialize({
        cells,
        bpm: playbackBpm,
        skipStartPosition,
        gridSize: GRID_SIZE,
      });
    },

    /**
     * Save current grid state as a named composition.
     * @returns The saved composition's ID
     */
    saveComposition(name: string): string {
      const id = `comp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const composition: SavedComposition = {
        id,
        name,
        createdAt: Date.now(),
        cells: deepCloneCells(cells),
        bpm: playbackBpm,
        skipStartPosition,
      };
      const all = loadSavedCompositions();
      all.push(composition);
      persistSavedCompositions(all);
      return id;
    },

    /**
     * Load a saved composition into the working grid.
     */
    loadComposition(id: string): boolean {
      const all = loadSavedCompositions();
      const comp = all.find((c) => c.id === id);
      if (!comp) return false;

      withUndo("LOAD_COMPOSITION", `Load: ${comp.name}`, () => {
        cells = deepCloneCells(comp.cells);
        playbackBpm = comp.bpm;
        skipStartPosition = comp.skipStartPosition;
        selectedCellId = null;
        isPlaying = false;
        stopPlaybackLoop();
        currentBeat = 0;
        save();
      });
      return true;
    },

    /**
     * List all saved compositions (newest first).
     */
    getSavedCompositions(): SavedComposition[] {
      return loadSavedCompositions().sort((a, b) => b.createdAt - a.createdAt);
    },

    /**
     * Delete a saved composition.
     */
    deleteSavedComposition(id: string): void {
      const all = loadSavedCompositions();
      persistSavedCompositions(all.filter((c) => c.id !== id));
    },

    // Reset
    reset() {
      withUndo("RESET", "Reset grid", () => {
        isPlaying = false;
        stopPlaybackLoop();
        cells = createInitialGrid();
        currentBeat = 0;
        selectedCellId = null;
        showSequencePicker = false;
        save();
      });
    },

    // Undo / Redo
    undo(): string | null {
      const result = undoManager.undo();
      if (!result) return null;
      restoreSnapshot(result.snapshot);
      return result.description;
    },

    redo(): string | null {
      const result = undoManager.redo();
      if (!result) return null;
      restoreSnapshot(result.snapshot);
      return result.description;
    },

    clearUndoHistory() {
      undoManager.clear();
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
