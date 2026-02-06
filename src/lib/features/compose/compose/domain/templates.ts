/**
 * Composition Templates
 *
 * Pre-configured layouts that users can apply as starting points.
 * Templates replace the old "mode" concept with more flexible presets.
 */

import type { CompositionTemplate, CellConfig, GridLayout } from "./types";
import { generateCellId, getDefaultTrailSettings } from "./types";

// ============================================================================
// Template Definitions
// ============================================================================

/**
 * Single - Full-screen single sequence
 * The simplest composition: one sequence fills the entire canvas
 */
const SINGLE_TEMPLATE: CompositionTemplate = {
  id: "single",
  name: "Single",
  icon: "fa-square",
  description: "Full-screen single sequence",
  layout: { rows: 1, cols: 1 },
  cellDefaults: [{ type: "single", rotationOffset: 0 }],
  color: "#3b82f6", // Blue
};

/**
 * Mirror - Side-by-side mirrored view
 * Same sequence on both sides, one mirrored horizontally
 */
const MIRROR_TEMPLATE: CompositionTemplate = {
  id: "mirror",
  name: "Mirror",
  icon: "fa-clone",
  description: "Side-by-side mirrored copy",
  layout: { rows: 1, cols: 2 },
  cellDefaults: [
    { type: "single", rotationOffset: 0, isMirrored: false },
    {
      type: "single",
      rotationOffset: 0,
      isMirrored: true,
      mirrorSourceCellId: "cell-0-0",
    },
  ],
  color: "#8b5cf6", // Purple
};

/**
 * Side-by-Side - Compare two different sequences
 * Two sequences playing next to each other (no mirroring)
 */
const SIDE_BY_SIDE_TEMPLATE: CompositionTemplate = {
  id: "side-by-side",
  name: "Side by Side",
  icon: "fa-columns",
  description: "Compare two sequences",
  layout: { rows: 1, cols: 2 },
  cellDefaults: [
    { type: "single", rotationOffset: 0 },
    { type: "single", rotationOffset: 0 },
  ],
  color: "#10b981", // Green
};

/**
 * Tunnel - Overlaid sequences in a single cell
 * 2-4 sequences stacked with different colors/opacities
 */
const TUNNEL_TEMPLATE: CompositionTemplate = {
  id: "tunnel",
  name: "Tunnel",
  icon: "fa-circle-notch",
  description: "2-4 sequences overlaid",
  layout: { rows: 1, cols: 1 },
  cellDefaults: [{ type: "tunnel" }],
  color: "#ec4899", // Pink
};

/**
 * Grid - 2x2 grid with rotation offsets
 * Classic 4-up view with each cell rotated 90 degrees
 */
const GRID_TEMPLATE: CompositionTemplate = {
  id: "grid",
  name: "Grid",
  icon: "fa-th-large",
  description: "2x2 grid with rotations",
  layout: { rows: 2, cols: 2 },
  cellDefaults: [
    { type: "single", rotationOffset: 0 },
    { type: "single", rotationOffset: 90 },
    { type: "single", rotationOffset: 180 },
    { type: "single", rotationOffset: 270 },
  ],
  color: "#f59e0b", // Orange
};

/**
 * Vertical Stack - Two sequences stacked vertically
 * Good for comparing sequences that are wide
 */
const VERTICAL_STACK_TEMPLATE: CompositionTemplate = {
  id: "vertical-stack",
  name: "Vertical Stack",
  icon: "fa-layer-group",
  description: "Two sequences stacked",
  layout: { rows: 2, cols: 1 },
  cellDefaults: [
    { type: "single", rotationOffset: 0 },
    { type: "single", rotationOffset: 0 },
  ],
  color: "#06b6d4", // Cyan
};

/**
 * Tunnel Grid - 2x2 where each cell is a tunnel
 * Advanced composition with overlaid sequences in each quadrant
 */
const TUNNEL_GRID_TEMPLATE: CompositionTemplate = {
  id: "tunnel-grid",
  name: "Tunnel Grid",
  icon: "fa-th",
  description: "2x2 grid of tunnels",
  layout: { rows: 2, cols: 2 },
  cellDefaults: [
    { type: "tunnel" },
    { type: "tunnel" },
    { type: "tunnel" },
    { type: "tunnel" },
  ],
  color: "#f43f5e", // Rose
};

// ============================================================================
// Template Registry
// ============================================================================

/**
 * All available composition templates
 * Order determines display order in the templates sheet
 */
export const COMPOSITION_TEMPLATES: CompositionTemplate[] = [
  SINGLE_TEMPLATE,
  MIRROR_TEMPLATE,
  SIDE_BY_SIDE_TEMPLATE,
  TUNNEL_TEMPLATE,
  GRID_TEMPLATE,
  VERTICAL_STACK_TEMPLATE,
  TUNNEL_GRID_TEMPLATE,
];

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): CompositionTemplate | undefined {
  return COMPOSITION_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get the basic/common templates (shown prominently)
 */
export function getBasicTemplates(): CompositionTemplate[] {
  return COMPOSITION_TEMPLATES.filter((t) =>
    ["single", "mirror", "tunnel", "grid", "side-by-side"].includes(t.id)
  );
}

/**
 * Get advanced templates (shown in expandable section)
 */
export function getAdvancedTemplates(): CompositionTemplate[] {
  return COMPOSITION_TEMPLATES.filter((t) =>
    ["vertical-stack", "tunnel-grid"].includes(t.id)
  );
}

// ============================================================================
// Template Application
// ============================================================================

/**
 * Create cells from a template
 * Applies the template's cell defaults to generate configured cells
 */
export function createCellsFromTemplate(
  template: CompositionTemplate
): CellConfig[] {
  const cells: CellConfig[] = [];
  const { rows, cols } = template.layout;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const cellDefault = template.cellDefaults[index] || {};

      cells.push({
        id: generateCellId(row, col),
        type: cellDefault.type || "single",
        sequences: [],
        trailSettings: getDefaultTrailSettings(),
        rotationOffset: cellDefault.rotationOffset ?? 0,
        isMirrored: cellDefault.isMirrored ?? false,
        mirrorSourceCellId: cellDefault.mirrorSourceCellId,
      });
    }
  }

  return cells;
}

/**
 * Get the template that matches the current composition layout
 * Returns undefined if no exact match found
 */
export function findMatchingTemplate(
  layout: GridLayout,
  cells: CellConfig[]
): CompositionTemplate | undefined {
  return COMPOSITION_TEMPLATES.find((template) => {
    // Check layout matches
    if (
      template.layout.rows !== layout.rows ||
      template.layout.cols !== layout.cols
    ) {
      return false;
    }

    // Check cell count matches
    if (template.cellDefaults.length !== cells.length) {
      return false;
    }

    // Check cell types and settings match
    return template.cellDefaults.every((defaultCell, index) => {
      const cell = cells[index];
      if (!cell) return false;

      return (
        cell.type === (defaultCell.type || "single") &&
        cell.rotationOffset === (defaultCell.rotationOffset ?? 0) &&
        cell.isMirrored === (defaultCell.isMirrored ?? false)
      );
    });
  });
}
