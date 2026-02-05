/**
 * Motion Visualizer data constants
 */

export type HandPosition4 = "N" | "E" | "S" | "W";
export type MotionType = "shift" | "dash" | "static";
export type MotionTypeNumber = 1 | 2 | 3 | 4 | 5 | 6;

export interface GridPoint4 {
  x: number;
  y: number;
}

export const GRID_POINTS_4: Record<HandPosition4, GridPoint4> = {
  N: { x: 50, y: 15 },
  E: { x: 85, y: 50 },
  S: { x: 50, y: 85 },
  W: { x: 15, y: 50 },
};

export interface MotionTypeInfo {
  name: string;
  color: string;
  description: string;
}

export const MOTION_TYPE_INFO: Record<MotionTypeNumber, MotionTypeInfo> = {
  1: {
    name: "Dual-Shift",
    color: "#22D3EE",
    description: "Both hands shift to adjacent points",
  },
  2: {
    name: "Shift",
    color: "#4ADE80",
    description: "One hand shifts, one stays still",
  },
  3: {
    name: "Cross-Shift",
    color: "#F472B6",
    description: "One hand shifts, one dashes",
  },
  4: {
    name: "Dash",
    color: "#FB923C",
    description: "One hand dashes, one stays still",
  },
  5: {
    name: "Dual-Dash",
    color: "#A78BFA",
    description: "Both hands dash to opposite points",
  },
  6: {
    name: "Static",
    color: "#94A3B8",
    description: "Both hands remain still",
  },
};

export const MOTION_COLORS: Record<MotionType, string> = {
  shift: "#4ADE80",
  dash: "#FB923C",
  static: "#94A3B8",
};

export const LEFT_HAND_COLOR = "#4A9EFF";
export const RIGHT_HAND_COLOR = "#FF4A9E";

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function getArrowPath(
  startPos: HandPosition4,
  endPos: HandPosition4
): string {
  const start = GRID_POINTS_4[startPos];
  const end = GRID_POINTS_4[endPos];

  if (startPos === endPos) return "";

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = dx / len;
  const ny = dy / len;

  const offsetStart = { x: start.x + nx * 8, y: start.y + ny * 8 };
  const offsetEnd = { x: end.x - nx * 8, y: end.y - ny * 8 };

  return `M${offsetStart.x},${offsetStart.y} L${offsetEnd.x},${offsetEnd.y}`;
}

export function getLabelOffset(key: string): { x: number; y: number } {
  if (key === "N") return { x: 0, y: -8 };
  if (key === "S") return { x: 0, y: 12 };
  if (key === "E") return { x: 10, y: 0 };
  if (key === "W") return { x: -10, y: 0 };
  return { x: 0, y: 0 };
}
