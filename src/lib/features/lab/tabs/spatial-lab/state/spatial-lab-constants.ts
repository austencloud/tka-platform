export const BODY_CENTER = { x: 300, y: 330 } as const;
export const SHOULDER_DIST = 34;
export const MAX_REACH = 165;
export const BEHIND_THRESHOLD = 30;
export const MAX_ROTATION_SPEED = 3;
export const PLANE_1_Y = 180;
export const PLANE_2_Y = 480;
export const CANVAS_SIZE = 600;

export const GRID_POINTS_P1 = [
  { name: "W", x: 140, y: 180 },
  { name: "N/S", x: 300, y: 180 },
  { name: "E", x: 460, y: 180 },
] as const;

export const GRID_POINTS_P2 = [
  { name: "W", x: 140, y: 480 },
  { name: "N/S", x: 300, y: 480 },
  { name: "E", x: 460, y: 480 },
] as const;

export interface Preset {
  name: string;
  left: { x: number; y: number };
  right: { x: number; y: number };
}

export const PRESETS: Preset[] = [
  { name: "Both at E", left: { x: 450, y: 180 }, right: { x: 460, y: 180 } },
  { name: "Both at W", left: { x: 130, y: 180 }, right: { x: 150, y: 180 } },
  { name: "L:W R:E", left: { x: 140, y: 180 }, right: { x: 460, y: 180 } },
  { name: "L:E R:W", left: { x: 460, y: 180 }, right: { x: 140, y: 180 } },
  { name: "R Behind E", left: { x: 460, y: 180 }, right: { x: 460, y: 480 } },
  { name: "L Behind W", left: { x: 140, y: 480 }, right: { x: 140, y: 180 } },
  { name: "Both Behind", left: { x: 140, y: 480 }, right: { x: 460, y: 480 } },
  { name: "Both N/S", left: { x: 290, y: 180 }, right: { x: 310, y: 180 } },
];
