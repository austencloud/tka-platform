import type { Point2D } from "./body-rotation-solver";

export type ViewProjection = "floor" | "wall" | "wheel";

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface ViewConfig {
  label: string;
  xAxisLabel: string;
  yAxisLabel: string;
  freeAxisLabel: string;
}

export interface ProjectedGridPoint {
  name: string;
  x: number;
  y: number;
}

const CANVAS_CENTER = { x: 300, y: 330 };
const GRID_SCALE = 160;

export const GRID_POINTS_3D: { name: string; pos: Point3D; plane: 1 | 2 }[] = [
  // Plane 1 (front) — at z=0 (performer's plane)
  { name: "E",   pos: { x:  1,  y: 0, z: 0 }, plane: 1 },
  { name: "W",   pos: { x: -1,  y: 0, z: 0 }, plane: 1 },
  { name: "N",   pos: { x:  0,  y: 1, z: 0 }, plane: 1 },
  { name: "S",   pos: { x:  0, y: -1, z: 0 }, plane: 1 },
  // Plane 2 (behind) — at z=1 (upstage)
  { name: "E",   pos: { x:  1,  y: 0, z: 1 }, plane: 2 },
  { name: "W",   pos: { x: -1,  y: 0, z: 1 }, plane: 2 },
  { name: "N",   pos: { x:  0,  y: 1, z: 1 }, plane: 2 },
  { name: "S",   pos: { x:  0, y: -1, z: 1 }, plane: 2 },
];

export function project3Dto2D(pt: Point3D, view: ViewProjection): Point2D {
  switch (view) {
    case "floor":
      return {
        x: CANVAS_CENTER.x + pt.x * GRID_SCALE,
        y: CANVAS_CENTER.y + pt.z * GRID_SCALE,
      };
    case "wall":
      return {
        x: CANVAS_CENTER.x + pt.x * GRID_SCALE,
        y: CANVAS_CENTER.y - pt.y * GRID_SCALE,
      };
    case "wheel":
      return {
        x: CANVAS_CENTER.x + pt.z * GRID_SCALE,
        y: CANVAS_CENTER.y - pt.y * GRID_SCALE,
      };
  }
}

export function unproject2Dto3D(
  svgPt: Point2D,
  view: ViewProjection,
  freeAxisValue: number,
): Point3D {
  const dx = (svgPt.x - CANVAS_CENTER.x) / GRID_SCALE;
  const dy = (svgPt.y - CANVAS_CENTER.y) / GRID_SCALE;
  switch (view) {
    case "floor":
      return { x: dx, y: freeAxisValue, z: dy };
    case "wall":
      return { x: dx, y: -dy, z: freeAxisValue };
    case "wheel":
      return { x: freeAxisValue, y: -dy, z: dx };
  }
}

export function getProjectedGridPoints(
  view: ViewProjection,
  planeSplitActive: boolean,
): ProjectedGridPoint[] {
  const points = GRID_POINTS_3D.filter(
    (gp) => gp.plane === 1 || (gp.plane === 2 && planeSplitActive),
  );

  const seen = new Map<string, ProjectedGridPoint>();
  for (const gp of points) {
    const projected = project3Dto2D(gp.pos, view);
    const key = `${Math.round(projected.x)},${Math.round(projected.y)}`;
    const existing = seen.get(key);
    if (existing) {
      // Stack label: "N/S" when N and S map to same point
      if (!existing.name.includes(gp.name)) {
        existing.name += `/${gp.name}`;
      }
    } else {
      const label = gp.plane === 2 ? `${gp.name}·P2` : gp.name;
      seen.set(key, { name: label, x: projected.x, y: projected.y });
    }
  }
  return Array.from(seen.values());
}

export function getViewConfig(view: ViewProjection): ViewConfig {
  switch (view) {
    case "floor":
      return {
        label: "Floor View (Bird's Eye) — X and Z visible, Y hidden",
        xAxisLabel: "Stage X (L/R)",
        yAxisLabel: "Stage Z (depth)",
        freeAxisLabel: "Y (height)",
      };
    case "wall":
      return {
        label: "Wall View (Front) — X and Y visible, Z hidden",
        xAxisLabel: "Stage X (L/R)",
        yAxisLabel: "Stage Y (up/down)",
        freeAxisLabel: "Z (depth)",
      };
    case "wheel":
      return {
        label: "Wheel View (Side) — Z and Y visible, X hidden",
        xAxisLabel: "Stage Z (depth)",
        yAxisLabel: "Stage Y (up/down)",
        freeAxisLabel: "X (lateral)",
      };
  }
}

export function getBodyEllipseParams(view: ViewProjection): { rx: number; ry: number; rotationOffset: number } {
  switch (view) {
    case "floor":
      return { rx: 28, ry: 20, rotationOffset: 0 };
    case "wall":
      return { rx: 28, ry: 36, rotationOffset: 0 };
    case "wheel":
      return { rx: 20, ry: 36, rotationOffset: 0 };
  }
}
