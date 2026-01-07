/**
 * Room Shape Definitions
 *
 * These types define the geometric shapes that rooms can have.
 * Each shape type has specific properties for generating walls,
 * floors, and collision geometry.
 */

import type { Point2D, Polygon2D } from "./geometry";
import { generateCircleVertices } from "./geometry";

// =============================================================================
// Shape Type Definitions
// =============================================================================

/**
 * A rectangular room shape
 */
export interface RectangularShape {
  readonly type: "rectangular";
  /** Center point of the rectangle */
  readonly center: Point2D;
  /** Width of the room (X axis) */
  readonly width: number;
  /** Depth of the room (Z axis) */
  readonly depth: number;
  /** Rotation around Y axis in radians */
  readonly rotation: number;
}

/**
 * A circular room shape
 */
export interface CircularShape {
  readonly type: "circular";
  /** Center point of the circle */
  readonly center: Point2D;
  /** Radius of the circle */
  readonly radius: number;
  /** Number of segments for polygon approximation (16-64 for smooth circles) */
  readonly segments: number;
}

/**
 * A custom polygonal room shape
 */
export interface PolygonalShape {
  readonly type: "polygonal";
  /** The polygon defining the room boundary */
  readonly polygon: Polygon2D;
}

/**
 * Union type for all room shapes
 */
export type RoomShape = RectangularShape | CircularShape | PolygonalShape;

// =============================================================================
// Shape Utility Functions
// =============================================================================

/**
 * Get the center point of any room shape
 */
export function getShapeCenter(shape: RoomShape): Point2D {
  switch (shape.type) {
    case "rectangular":
    case "circular":
      return shape.center;
    case "polygonal": {
      // Calculate centroid of polygon
      const { vertices } = shape.polygon;
      if (vertices.length === 0) return { x: 0, z: 0 };
      const sum = vertices.reduce(
        (acc, v) => ({ x: acc.x + v.x, z: acc.z + v.z }),
        { x: 0, z: 0 }
      );
      return {
        x: sum.x / vertices.length,
        z: sum.z / vertices.length,
      };
    }
  }
}

/**
 * Convert any room shape to a polygon (for rendering and collision)
 */
export function shapeToPolygon(shape: RoomShape): Polygon2D {
  switch (shape.type) {
    case "rectangular":
      return rectangleToPolygon(shape);
    case "circular":
      return circleToPolygon(shape);
    case "polygonal":
      return shape.polygon;
  }
}

/**
 * Convert a rectangular shape to a polygon
 */
function rectangleToPolygon(rect: RectangularShape): Polygon2D {
  const halfW = rect.width / 2;
  const halfD = rect.depth / 2;
  const cos = Math.cos(rect.rotation);
  const sin = Math.sin(rect.rotation);

  // Corners before rotation
  const corners: [number, number][] = [
    [-halfW, -halfD], // bottom-left
    [halfW, -halfD], // bottom-right
    [halfW, halfD], // top-right
    [-halfW, halfD], // top-left
  ];

  // Apply rotation and translation
  const vertices: Point2D[] = corners.map(([lx, lz]) => ({
    x: rect.center.x + lx * cos - lz * sin,
    z: rect.center.z + lx * sin + lz * cos,
  }));

  return { vertices };
}

/**
 * Convert a circular shape to a polygon
 */
function circleToPolygon(circle: CircularShape): Polygon2D {
  const vertices = generateCircleVertices(
    { center: circle.center, radius: circle.radius },
    circle.segments
  );
  return { vertices: [...vertices] };
}

/**
 * Get the approximate area of a room shape
 */
export function getShapeArea(shape: RoomShape): number {
  switch (shape.type) {
    case "rectangular":
      return shape.width * shape.depth;
    case "circular":
      return Math.PI * shape.radius * shape.radius;
    case "polygonal":
      return calculatePolygonArea(shape.polygon);
  }
}

/**
 * Calculate the area of a polygon using the shoelace formula
 */
function calculatePolygonArea(polygon: Polygon2D): number {
  const { vertices } = polygon;
  const n = vertices.length;
  if (n < 3) return 0;

  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const vi = vertices[i]!;
    const vj = vertices[j]!;
    area += vi.x * vj.z;
    area -= vj.x * vi.z;
  }

  return Math.abs(area) / 2;
}

/**
 * Get the bounding radius of a shape (for broad-phase collision)
 */
export function getShapeBoundingRadius(shape: RoomShape): number {
  switch (shape.type) {
    case "circular":
      return shape.radius;
    case "rectangular": {
      const halfW = shape.width / 2;
      const halfD = shape.depth / 2;
      return Math.sqrt(halfW * halfW + halfD * halfD);
    }
    case "polygonal": {
      const center = getShapeCenter(shape);
      let maxDist = 0;
      for (const v of shape.polygon.vertices) {
        const dx = v.x - center.x;
        const dz = v.z - center.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > maxDist) maxDist = dist;
      }
      return maxDist;
    }
  }
}
