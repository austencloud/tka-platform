/**
 * 2D Geometry Primitives for Gallery Layout
 *
 * These types represent 2D shapes used for floor plans, collision detection,
 * and room layout. The Y coordinate is not included - these are XZ plane projections.
 */

/**
 * A point in 2D space (XZ plane)
 */
export interface Point2D {
  readonly x: number;
  readonly z: number;
}

/**
 * A polygon defined by ordered vertices
 * Vertices should be in counter-clockwise order for consistent normal calculation
 */
export interface Polygon2D {
  readonly vertices: readonly Point2D[];
}

/**
 * A circle in 2D space
 */
export interface Circle2D {
  readonly center: Point2D;
  readonly radius: number;
}

/**
 * A line segment in 2D space
 */
export interface LineSegment2D {
  readonly start: Point2D;
  readonly end: Point2D;
}

/**
 * An axis-aligned bounding box in 2D
 */
export interface AABB2D {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate distance between two points
 */
export function distance2D(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Calculate squared distance between two points (faster, no sqrt)
 */
export function distanceSquared2D(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return dx * dx + dz * dz;
}

/**
 * Calculate the length of a line segment
 */
export function segmentLength(segment: LineSegment2D): number {
  return distance2D(segment.start, segment.end);
}

/**
 * Get the midpoint of a line segment
 */
export function segmentMidpoint(segment: LineSegment2D): Point2D {
  return {
    x: (segment.start.x + segment.end.x) / 2,
    z: (segment.start.z + segment.end.z) / 2,
  };
}

/**
 * Calculate the normal vector of a line segment (perpendicular, pointing "left")
 * Returns a normalized vector
 */
export function segmentNormal(segment: LineSegment2D): Point2D {
  const dx = segment.end.x - segment.start.x;
  const dz = segment.end.z - segment.start.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len === 0) return { x: 0, z: 1 };
  // Rotate 90 degrees counter-clockwise
  return { x: -dz / len, z: dx / len };
}

/**
 * Calculate the angle of a line segment in radians
 */
export function segmentAngle(segment: LineSegment2D): number {
  const dx = segment.end.x - segment.start.x;
  const dz = segment.end.z - segment.start.z;
  return Math.atan2(dx, dz);
}

/**
 * Project a point onto a line segment, returning the closest point on the segment
 */
export function projectPointOntoSegment(
  point: Point2D,
  segment: LineSegment2D
): Point2D {
  const dx = segment.end.x - segment.start.x;
  const dz = segment.end.z - segment.start.z;
  const lengthSquared = dx * dx + dz * dz;

  if (lengthSquared === 0) {
    return segment.start;
  }

  // Calculate projection parameter t (clamped to [0, 1])
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segment.start.x) * dx + (point.z - segment.start.z) * dz) /
        lengthSquared
    )
  );

  return {
    x: segment.start.x + t * dx,
    z: segment.start.z + t * dz,
  };
}

/**
 * Calculate the distance from a point to a line segment
 */
export function pointToSegmentDistance(
  point: Point2D,
  segment: LineSegment2D
): number {
  const closest = projectPointOntoSegment(point, segment);
  return distance2D(point, closest);
}

/**
 * Test if a point is inside a polygon using ray casting algorithm
 */
export function pointInPolygon(point: Point2D, polygon: Polygon2D): boolean {
  const { vertices } = polygon;
  const n = vertices.length;
  if (n < 3) return false;

  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = vertices[i]!;
    const vj = vertices[j]!;

    if (
      vi.z > point.z !== vj.z > point.z &&
      point.x < ((vj.x - vi.x) * (point.z - vi.z)) / (vj.z - vi.z) + vi.x
    ) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Test if a point is inside a circle
 */
export function pointInCircle(point: Point2D, circle: Circle2D): boolean {
  return distanceSquared2D(point, circle.center) <= circle.radius * circle.radius;
}

/**
 * Calculate the bounding box of a polygon
 */
export function polygonBounds(polygon: Polygon2D): AABB2D {
  const { vertices } = polygon;
  if (vertices.length === 0) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  }

  const first = vertices[0]!;
  let minX = first.x;
  let maxX = first.x;
  let minZ = first.z;
  let maxZ = first.z;

  for (let i = 1; i < vertices.length; i++) {
    const v = vertices[i]!;
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.z < minZ) minZ = v.z;
    if (v.z > maxZ) maxZ = v.z;
  }

  return { minX, maxX, minZ, maxZ };
}

/**
 * Calculate the bounding box of a circle
 */
export function circleBounds(circle: Circle2D): AABB2D {
  return {
    minX: circle.center.x - circle.radius,
    maxX: circle.center.x + circle.radius,
    minZ: circle.center.z - circle.radius,
    maxZ: circle.center.z + circle.radius,
  };
}

/**
 * Generate vertices for a regular polygon (circle approximation)
 */
export function generateCircleVertices(
  circle: Circle2D,
  segments: number
): readonly Point2D[] {
  const vertices: Point2D[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push({
      x: circle.center.x + Math.sin(angle) * circle.radius,
      z: circle.center.z + Math.cos(angle) * circle.radius,
    });
  }
  return vertices;
}
