/**
 * Composition Builder Types
 *
 * Type definitions for the unified composition builder that replaces
 * the mode-first approach with a layout-first cell-based system.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import {
  type TrailSettings,
  DEFAULT_TRAIL_SETTINGS,
} from "$lib/features/compose/shared/domain/types/TrailTypes";

// ============================================================================
// Grid Layout
// ============================================================================

/**
 * Grid layout configuration
 * Defines how many rows and columns the composition canvas has
 */
export interface GridLayout {
  rows: number; // 1-4
  cols: number; // 1-4
}

/**
 * Common layout presets
 */
export const LAYOUT_PRESETS = {
  "1x1": { rows: 1, cols: 1 },
  "1x2": { rows: 1, cols: 2 },
  "2x1": { rows: 2, cols: 1 },
  "2x2": { rows: 2, cols: 2 },
  "1x3": { rows: 1, cols: 3 },
  "3x1": { rows: 3, cols: 1 },
  "2x3": { rows: 2, cols: 3 },
  "3x2": { rows: 3, cols: 2 },
  "3x3": { rows: 3, cols: 3 },
} as const;

export type LayoutPresetKey = keyof typeof LAYOUT_PRESETS;

// ============================================================================
// Cell Configuration
// ============================================================================

/**
 * Cell content type
 * - single: One sequence plays in this cell
 * - tunnel: Multiple sequences overlaid (2-4)
 */
export type CellType = "single" | "tunnel";

/**
 * Media display type for a cell
 * Controls how the sequence content is rendered
 */
export type MediaDisplayType = "animation" | "video" | "stepGrid" | "image";

/**
 * Individual cell configuration
 * Each cell in the grid has its own independent configuration
 */
export interface CellConfig {
  /** Unique cell identifier: "cell-{row}-{col}" */
  id: string;

  /** Cell content type */
  type: CellType;

  /** How to display the sequence content */
  mediaType?: MediaDisplayType;

  /** Sequences assigned to this cell (1 for single, 2-4 for tunnel) */
  sequences: SequenceData[];

  /** Trail effect settings for this cell */
  trailSettings: TrailSettings;

  /** Rotation offset in degrees (0, 90, 180, 270) for grid mode */
  rotationOffset?: number;

  /** Whether this cell mirrors another cell's sequence */
  isMirrored?: boolean;

  /** Cell this mirrors (for mirror template) */
  mirrorSourceCellId?: string;
}

/**
 * Generate cell ID from row and column
 */
export function generateCellId(row: number, col: number): string {
  return `cell-${row}-${col}`;
}

/**
 * Parse cell ID to get row and column
 */
export function parseCellId(
  cellId: string
): { row: number; col: number } | null {
  const match = cellId.match(/^cell-(\d+)-(\d+)$/);
  if (!match?.[1] || !match[2]) return null;
  return { row: parseInt(match[1], 10), col: parseInt(match[2], 10) };
}

// ============================================================================
// Composition
// ============================================================================

/**
 * Complete composition definition
 * This is what gets saved/loaded and rendered
 */
export interface Composition {
  /** Unique composition ID */
  id: string;

  /** User-provided name */
  name: string;

  /** Grid layout (rows x cols) */
  layout: GridLayout;

  /** Cell configurations (one per grid cell) */
  cells: CellConfig[];

  /** Creation timestamp */
  createdAt: Date;

  /** Last modified timestamp */
  updatedAt: Date;

  /** Creator identifier */
  creator: string;

  /** Whether this is a favorite */
  isFavorite: boolean;

  /** Thumbnail URL for gallery display */
  thumbnailUrl?: string;
}

// ============================================================================
// Builder State
// ============================================================================

/**
 * Playback speed options
 */
export type PlaybackSpeed = 0.25 | 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;

/**
 * Composition builder UI state
 * Manages the builder interface, playback, and configuration
 */
export interface CompositionBuilderState {
  /** The composition being built/edited */
  composition: Composition;

  // Playback state
  /** Whether animation is currently playing */
  isPlaying: boolean;

  /** Whether to show live preview or static thumbnails */
  isPreviewing: boolean;

  /** Playback speed multiplier */
  speed: PlaybackSpeed;

  /** Whether to loop playback */
  shouldLoop: boolean;

  /** Current beat position (for synchronized cells) */
  currentStep: number;

  // UI state
  /** Currently selected cell for configuration (null = none) */
  selectedCellId: string | null;

  /** Whether overlay controls are visible */
  showOverlayControls: boolean;

  /** Whether templates sheet is open */
  isTemplatesOpen: boolean;

  /** Whether cell config sheet is open */
  isCellConfigOpen: boolean;

  /** Whether global settings sheet is open */
  isSettingsOpen: boolean;
}

// ============================================================================
// Template Definition
// ============================================================================

/**
 * Composition template (preset)
 * Pre-configured layouts that users can apply as starting points
 */
export interface CompositionTemplate {
  /** Unique template ID */
  id: string;

  /** Display name */
  name: string;

  /** FontAwesome icon class */
  icon: string;

  /** Short description */
  description: string;

  /** Grid layout */
  layout: GridLayout;

  /** Default cell configurations */
  cellDefaults: Partial<CellConfig>[];

  /** Accent color for UI */
  color: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create empty cells for a given layout
 */
export function createEmptyCells(layout: GridLayout): CellConfig[] {
  const cells: CellConfig[] = [];
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      cells.push({
        id: generateCellId(row, col),
        type: "single",
        sequences: [],
        trailSettings: getDefaultTrailSettings(),
        rotationOffset: 0,
      });
    }
  }
  return cells;
}

/**
 * Get default trail settings
 * Returns a fresh copy of the default settings
 */
export function getDefaultTrailSettings(): TrailSettings {
  return { ...DEFAULT_TRAIL_SETTINGS };
}

/**
 * Check if a cell has sequences assigned
 */
export function isCellConfigured(cell: CellConfig): boolean {
  return cell.sequences.length > 0;
}

/**
 * Check if all cells in a composition have sequences
 */
export function isCompositionComplete(composition: Composition): boolean {
  return composition.cells.every(isCellConfigured);
}

/**
 * Get the total number of cells in a layout
 */
export function getCellCount(layout: GridLayout): number {
  return layout.rows * layout.cols;
}
