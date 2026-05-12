/**
 * Constraint Solver
 *
 * A simplified constraint solver for layout positioning.
 * Inspired by Cassowary but streamlined for our use case.
 *
 * The solver works by:
 * 1. Collecting all constraints for each cell
 * 2. Resolving constraints in priority order
 * 3. Computing final positions that satisfy as many constraints as possible
 */

import type {
  ConstraintCell,
  ContainerBounds,
  Constraint,
} from "../domain/types";

interface SolvedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AnchorValue {
  anchor: string;
  value: number;
  priority: number;
}

const PRIORITY_VALUES = {
  required: 1000,
  high: 100,
  medium: 10,
  low: 1,
};

/**
 * Solve constraints for all cells and return computed positions
 */
export function solveConstraints(
  cells: ConstraintCell[],
  container: ContainerBounds
): Map<string, SolvedBounds> {
  const results = new Map<string, SolvedBounds>();

  // Initialize with default positions
  for (const cell of cells) {
    results.set(cell.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  }

  // Build dependency graph and solve in order
  const sortedCells = topologicalSort(cells);

  // Multiple passes to converge on solution
  for (let pass = 0; pass < 3; pass++) {
    for (const cell of sortedCells) {
      const bounds = solveCell(cell, cells, container, results);
      results.set(cell.id, bounds);
    }
  }

  return results;
}

/**
 * Solve constraints for a single cell
 */
function solveCell(
  cell: ConstraintCell,
  allCells: ConstraintCell[],
  container: ContainerBounds,
  currentResults: Map<string, SolvedBounds>
): SolvedBounds {
  // Collect anchor values from constraints
  const anchorValues: AnchorValue[] = [];

  for (const constraint of cell.constraints) {
    const targetValue = getTargetAnchorValue(
      constraint,
      allCells,
      container,
      currentResults
    );

    if (targetValue !== null) {
      anchorValues.push({
        anchor: constraint.anchor,
        value: targetValue + constraint.offset,
        priority: PRIORITY_VALUES[constraint.priority],
      });
    }
  }

  // Start with current bounds
  const current = currentResults.get(cell.id) || {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  };

  // Resolve size constraints first
  let width = current.width;
  let height = current.height;

  for (const sc of cell.sizeConstraints) {
    if (sc.dimension === "width") {
      if (typeof sc.value === "number") {
        width = sc.value;
      } else if (sc.value.type === "ratio") {
        // Aspect ratio: width = height * ratio
        width = height * sc.value.value;
      }
    } else {
      if (typeof sc.value === "number") {
        height = sc.value;
      } else if (sc.value.type === "ratio") {
        // Aspect ratio: height = width / ratio
        height = width / sc.value.value;
      }
    }
  }

  // Group anchor values by anchor type
  const grouped = groupByAnchor(anchorValues);

  // Resolve position from anchors
  let x = current.x;
  let y = current.y;

  // Horizontal positioning
  const leftAnchors = grouped.left ?? [];
  const rightAnchors = grouped.right ?? [];
  const centerXAnchors = grouped.centerX ?? [];

  if (leftAnchors.length > 0) {
    x = weightedAverage(leftAnchors);
  } else if (rightAnchors.length > 0) {
    x = weightedAverage(rightAnchors) - width;
  } else if (centerXAnchors.length > 0) {
    x = weightedAverage(centerXAnchors) - width / 2;
  }

  // Vertical positioning
  const topAnchors = grouped.top ?? [];
  const bottomAnchors = grouped.bottom ?? [];
  const centerYAnchors = grouped.centerY ?? [];

  if (topAnchors.length > 0) {
    y = weightedAverage(topAnchors);
  } else if (bottomAnchors.length > 0) {
    y = weightedAverage(bottomAnchors) - height;
  } else if (centerYAnchors.length > 0) {
    y = weightedAverage(centerYAnchors) - height / 2;
  }

  // Handle opposing constraints (e.g., left AND right = stretch)
  if (leftAnchors.length > 0 && rightAnchors.length > 0) {
    const left = weightedAverage(leftAnchors);
    const right = weightedAverage(rightAnchors);
    x = left;
    width = right - left;
  }

  if (topAnchors.length > 0 && bottomAnchors.length > 0) {
    const top = weightedAverage(topAnchors);
    const bottom = weightedAverage(bottomAnchors);
    y = top;
    height = bottom - top;
  }

  // Ensure minimum size
  width = Math.max(20, width);
  height = Math.max(20, height);

  return { x, y, width, height };
}

/**
 * Get the value of a target anchor
 */
function getTargetAnchorValue(
  constraint: Constraint,
  allCells: ConstraintCell[],
  container: ContainerBounds,
  results: Map<string, SolvedBounds>
): number | null {
  if (constraint.target.type === "parent") {
    // Container anchor
    switch (constraint.target.anchor) {
      case "left":
        return 0;
      case "right":
        return container.width;
      case "top":
        return 0;
      case "bottom":
        return container.height;
      case "centerX":
        return container.width / 2;
      case "centerY":
        return container.height / 2;
    }
  } else if (constraint.target.cellId) {
    // Another cell's anchor
    const targetBounds = results.get(constraint.target.cellId);
    if (!targetBounds) return null;

    switch (constraint.target.anchor) {
      case "left":
        return targetBounds.x;
      case "right":
        return targetBounds.x + targetBounds.width;
      case "top":
        return targetBounds.y;
      case "bottom":
        return targetBounds.y + targetBounds.height;
      case "centerX":
        return targetBounds.x + targetBounds.width / 2;
      case "centerY":
        return targetBounds.y + targetBounds.height / 2;
    }
  }

  return null;
}

/**
 * Group anchor values by anchor type
 */
function groupByAnchor(values: AnchorValue[]): Record<string, AnchorValue[]> {
  const groups: Record<string, AnchorValue[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
    centerX: [],
    centerY: [],
  };

  for (const v of values) {
    const group = groups[v.anchor];
    if (group) {
      group.push(v);
    }
  }

  return groups;
}

/**
 * Calculate weighted average based on priority
 */
function weightedAverage(values: AnchorValue[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0]!.value;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const v of values) {
    totalWeight += v.priority;
    weightedSum += v.value * v.priority;
  }

  return weightedSum / totalWeight;
}

/**
 * Topological sort cells based on constraint dependencies
 */
function topologicalSort(cells: ConstraintCell[]): ConstraintCell[] {
  const visited = new Set<string>();
  const result: ConstraintCell[] = [];
  const cellMap = new Map(cells.map((c) => [c.id, c]));

  function visit(cell: ConstraintCell) {
    if (visited.has(cell.id)) return;
    visited.add(cell.id);

    // Visit dependencies first
    for (const constraint of cell.constraints) {
      if (constraint.target.type === "cell" && constraint.target.cellId) {
        const dep = cellMap.get(constraint.target.cellId);
        if (dep) visit(dep);
      }
    }

    result.push(cell);
  }

  for (const cell of cells) {
    visit(cell);
  }

  return result;
}

/** Grid size for snapping (matches visual grid in CompositionCanvas) */
export const GRID_SIZE = 50;

/** Half grid for finer snapping */
export const HALF_GRID = GRID_SIZE / 2;

/**
 * Generate snap guides from current cell positions and grid lines
 */
export function generateSnapGuides(
  cells: ConstraintCell[],
  container: ContainerBounds,
  excludeCellId?: string
): { x: number[]; y: number[] } {
  const xGuides = new Set<number>();
  const yGuides = new Set<number>();

  // Container edges and center
  xGuides.add(0);
  xGuides.add(container.width);
  xGuides.add(container.width / 2);
  yGuides.add(0);
  yGuides.add(container.height);
  yGuides.add(container.height / 2);

  // Grid lines (40px intervals matching visual grid)
  for (let x = 0; x <= container.width; x += GRID_SIZE) {
    xGuides.add(x);
  }
  for (let y = 0; y <= container.height; y += GRID_SIZE) {
    yGuides.add(y);
  }

  // Cell edges and centers
  for (const cell of cells) {
    if (cell.id === excludeCellId) continue;

    const { x, y, width, height } = cell.computed;
    xGuides.add(x);
    xGuides.add(x + width);
    xGuides.add(x + width / 2);
    yGuides.add(y);
    yGuides.add(y + height);
    yGuides.add(y + height / 2);
  }

  return {
    x: Array.from(xGuides).sort((a, b) => a - b),
    y: Array.from(yGuides).sort((a, b) => a - b),
  };
}

/**
 * Force snap to nearest half-grid position (25px intervals with 50px grid)
 */
export function findSnapPosition(
  value: number,
  _guides: number[] // Ignored - we always snap to half-grid
): { snapped: number; guide: number | null } {
  // Snap to nearest half-grid line (25px intervals)
  const snapped = Math.round(value / HALF_GRID) * HALF_GRID;
  return {
    snapped,
    guide: snapped,
  };
}
