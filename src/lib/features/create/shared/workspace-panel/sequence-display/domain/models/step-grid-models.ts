/**
 * Beat Grid Domain Models
 *
 * Pure TypeScript interfaces for beat grid layout and positioning.
 * Moved from main workbench/domain to sequence-display specific domain.
 */

import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface BeatGridConfig {
  /** Number of columns allocated for BEATS (excludes the Start tile column) */
  columns: number;
  beatSize: number;
  gap: number;
  gridMode: GridMode;
  cellSize: number;

  /** Whether to reserve the first column for the Start Position tile */
  hasStartTile: boolean;
  enableHover: boolean;
  enableDrag: boolean;
}

export interface ContainerDimensions {
  width: number;
  height: number;
  isFullscreen: boolean;
}

export interface LayoutInfo {
  rows: number;
  columns: number;
  cellSize: number;
  totalWidth: number;
  totalHeight: number;
  shouldScroll: boolean;
}

export interface ImageCanvasCoordinate {
  x: number;
  y: number;
}
