/**
 * Layout Presets
 *
 * Built-in presets for common composition layouts.
 * Uses constraint-based positioning for flexible, responsive layouts.
 */

import type { LayoutPreset, CellMediaType, ConstraintCell, ContainerBounds } from "../domain/types";

let cellIdCounter = 0; // eslint-disable-line @typescript-eslint/no-unused-vars

/** Media type colors for visual distinction */
const MEDIA_COLORS: Record<CellMediaType, string> = {
  video: "#ef4444",       // Red
  animation: "#8b5cf6",   // Purple
  image: "#10b981",       // Emerald
  "choreo-card": "#3b82f6", // Blue
  "viewer-3d": "#f59e0b", // Amber
  empty: "#6b7280",       // Gray
};

/** Export media colors for use in other components */
export { MEDIA_COLORS };

/** Gap between cells in grid layouts */
const GRID_GAP = 12;

/** Create a cell with absolute positioning */
function createCell(
  id: string,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  zIndex: number = 1,
  mediaType: CellMediaType = "animation",
  color: string = MEDIA_COLORS.animation
): ConstraintCell {
  return {
    id,
    label,
    zIndex,
    color,
    mediaType,
    constraints: [
      {
        id: `${id}-left`,
        cellId: id,
        anchor: "left",
        target: { type: "parent", anchor: "left" },
        offset: x,
        priority: "required",
        relation: "equal",
      },
      {
        id: `${id}-top`,
        cellId: id,
        anchor: "top",
        target: { type: "parent", anchor: "top" },
        offset: y,
        priority: "required",
        relation: "equal",
      },
    ],
    sizeConstraints: [
      {
        id: `${id}-width`,
        cellId: id,
        dimension: "width",
        value: width,
        priority: "required",
        relation: "equal",
      },
      {
        id: `${id}-height`,
        cellId: id,
        dimension: "height",
        value: height,
        priority: "required",
        relation: "equal",
      },
    ],
    computed: { x, y, width, height },
  };
}

/**
 * Calculate square cell size that fits in container
 * Returns the largest square that fits, centered
 */
function getSquareSize(container: ContainerBounds, count: number, cols: number): { size: number; offsetX: number; offsetY: number } {
  const rows = Math.ceil(count / cols);
  const totalGapX = (cols - 1) * GRID_GAP;
  const totalGapY = (rows - 1) * GRID_GAP;

  // Calculate max cell size that fits
  const maxCellWidth = (container.width - totalGapX) / cols;
  const maxCellHeight = (container.height - totalGapY) / rows;
  const size = Math.floor(Math.min(maxCellWidth, maxCellHeight));

  // Calculate centering offsets
  const totalWidth = cols * size + totalGapX;
  const totalHeight = rows * size + totalGapY;
  const offsetX = Math.floor((container.width - totalWidth) / 2);
  const offsetY = Math.floor((container.height - totalHeight) / 2);

  return { size, offsetX, offsetY };
}

/**
 * Single - One centered square cell
 */
const SINGLE_PRESET: LayoutPreset = {
  id: "single",
  name: "Single",
  description: "Single centered view",
  icon: "square",
  createCells: (container: ContainerBounds): ConstraintCell[] => {
    const { size, offsetX, offsetY } = getSquareSize(container, 1, 1);
    return [
      createCell("cell-0", "Main", offsetX, offsetY, size, size, 1),
    ];
  },
};

/**
 * Mirror - Two square cells side by side
 */
const MIRROR_PRESET: LayoutPreset = {
  id: "mirror",
  name: "Mirror",
  description: "Side-by-side mirrored",
  icon: "clone",
  createCells: (container: ContainerBounds): ConstraintCell[] => {
    const { size, offsetX, offsetY } = getSquareSize(container, 2, 2);
    return [
      createCell("cell-0", "Original", offsetX, offsetY, size, size, 1),
      createCell("cell-1", "Mirror", offsetX + size + GRID_GAP, offsetY, size, size, 1),
    ];
  },
};

/**
 * Side by Side - Two square cells
 */
const SIDE_BY_SIDE_PRESET: LayoutPreset = {
  id: "side-by-side",
  name: "Side by Side",
  description: "Compare two sequences",
  icon: "columns",
  createCells: (container: ContainerBounds): ConstraintCell[] => {
    const { size, offsetX, offsetY } = getSquareSize(container, 2, 2);
    return [
      createCell("cell-0", "Left", offsetX, offsetY, size, size, 1),
      createCell("cell-1", "Right", offsetX + size + GRID_GAP, offsetY, size, size, 1),
    ];
  },
};

/**
 * Tunnel - One centered square (for overlaid sequences)
 */
const TUNNEL_PRESET: LayoutPreset = {
  id: "tunnel",
  name: "Tunnel",
  description: "Overlaid sequences",
  icon: "circle-notch",
  createCells: (container: ContainerBounds): ConstraintCell[] => {
    const { size, offsetX, offsetY } = getSquareSize(container, 1, 1);
    return [
      createCell("cell-0", "Tunnel", offsetX, offsetY, size, size, 1),
    ];
  },
};

/**
 * Grid - 2x2 grid of square cells
 */
const GRID_PRESET: LayoutPreset = {
  id: "grid",
  name: "Grid",
  description: "2x2 grid layout",
  icon: "th-large",
  createCells: (container: ContainerBounds): ConstraintCell[] => {
    const { size, offsetX, offsetY } = getSquareSize(container, 4, 2);
    return [
      createCell("cell-0", "Top Left", offsetX, offsetY, size, size, 1),
      createCell("cell-1", "Top Right", offsetX + size + GRID_GAP, offsetY, size, size, 1),
      createCell("cell-2", "Bottom Left", offsetX, offsetY + size + GRID_GAP, size, size, 1),
      createCell("cell-3", "Bottom Right", offsetX + size + GRID_GAP, offsetY + size + GRID_GAP, size, size, 1),
    ];
  },
};

/**
 * Vertical Stack - Two square cells stacked
 */
const VERTICAL_STACK_PRESET: LayoutPreset = {
  id: "vertical-stack",
  name: "Vertical Stack",
  description: "Two sequences stacked",
  icon: "layer-group",
  createCells: (container: ContainerBounds): ConstraintCell[] => {
    const { size, offsetX, offsetY } = getSquareSize(container, 2, 1);
    return [
      createCell("cell-0", "Top", offsetX, offsetY, size, size, 1),
      createCell("cell-1", "Bottom", offsetX, offsetY + size + GRID_GAP, size, size, 1),
    ];
  },
};

/**
 * Built-in presets for the composition editor
 */
export const LAYOUT_PRESETS: LayoutPreset[] = [
  SINGLE_PRESET,
  MIRROR_PRESET,
  SIDE_BY_SIDE_PRESET,
  TUNNEL_PRESET,
  GRID_PRESET,
  VERTICAL_STACK_PRESET,
];

/**
 * Find a preset by ID (checks both built-in and custom presets)
 */
export function findPresetById(presetId: string): LayoutPreset | undefined {
  return LAYOUT_PRESETS.find((p) => p.id === presetId);
}

/**
 * Reset the cell ID counter (useful for testing)
 */
export function resetCellIdCounter(): void {
  cellIdCounter = 0;
}
