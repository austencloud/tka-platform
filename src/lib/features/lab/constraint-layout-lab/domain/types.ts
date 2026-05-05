/**
 * Constraint-Based Layout Engine Types
 *
 * A Figma/SwiftUI-inspired layout system where cells are positioned
 * using constraints rather than fixed grid positions.
 */

/** Anchor point on a cell or container */
export type Anchor = "top" | "bottom" | "left" | "right" | "centerX" | "centerY";

/** Constraint relationship types */
export type ConstraintRelation = "equal" | "greaterOrEqual" | "lessOrEqual";

/** A constraint ties an anchor to another anchor or a fixed value */
export interface Constraint {
  id: string;
  /** The cell this constraint belongs to */
  cellId: string;
  /** Which anchor on this cell */
  anchor: Anchor;
  /** Target: either another cell's anchor or "parent" (container) */
  target: {
    type: "parent" | "cell";
    cellId?: string; // Only if type === "cell"
    anchor: Anchor;
  };
  /** Offset from the target anchor (positive = inward/right/down) */
  offset: number;
  /** Constraint strength (higher = harder to break) */
  priority: "required" | "high" | "medium" | "low";
  /** Relationship type */
  relation: ConstraintRelation;
}

/** Size constraint for width or height */
export interface SizeConstraint {
  id: string;
  cellId: string;
  dimension: "width" | "height";
  value: number | { type: "ratio"; value: number }; // Fixed or aspect ratio
  priority: "required" | "high" | "medium" | "low";
  relation: ConstraintRelation;
}

/** Media type that can be assigned to a cell */
export type CellMediaType =
  | "video"           // Recorded/uploaded video
  | "animation"       // Pictograph animation
  | "image"           // Static image or composite
  | "choreo-card"     // Sequence choreo card
  | "viewer-3d"       // 3D animation viewer
  | "empty";          // Placeholder/empty cell

/** A cell in the constraint-based layout */
export interface ConstraintCell {
  id: string;
  /** Display label */
  label: string;
  /** Z-index for stacking (higher = on top) */
  zIndex: number;
  /** Background color for visualization */
  color: string;
  /** What type of media this cell is intended for */
  mediaType: CellMediaType;
  /** Position constraints */
  constraints: Constraint[];
  /** Size constraints */
  sizeConstraints: SizeConstraint[];
  /** Computed position (output of solver) */
  computed: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Optional: layers/content (for future integration) */
  layers?: unknown[];
}

/** Container dimensions */
export interface ContainerBounds {
  width: number;
  height: number;
}

/** Complete layout state */
export interface ConstraintLayout {
  id: string;
  name: string;
  cells: ConstraintCell[];
  containerBounds: ContainerBounds;
}

/** Preset template */
export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Factory function that creates cells for given container size */
  createCells: (container: ContainerBounds) => ConstraintCell[];
}

/** Snap guide for visual alignment feedback */
export interface SnapGuide {
  type: "vertical" | "horizontal";
  position: number; // x for vertical, y for horizontal
  label?: string;
}

/** Drag state during cell manipulation */
export interface DragState {
  cellId: string;
  mode: "move" | "resize";
  handle?: "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Alt+drag creates a duplicate - this is the new cell's ID */
  duplicateId?: string;
  startX: number;
  startY: number;
  startCellBounds: { x: number; y: number; width: number; height: number };
  activeSnapGuides: SnapGuide[];
  /** For multi-cell dragging: store start bounds of all selected cells */
  groupStartBounds?: Map<string, { x: number; y: number; width: number; height: number }>;
}
