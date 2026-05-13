import type { Point3D } from "../services/projection";

export const BODY_CENTER = { x: 300, y: 330 } as const;
export const SHOULDER_DIST = 34;
export const MAX_REACH = 165;
export const BEHIND_THRESHOLD = 30;
export const MAX_ROTATION_SPEED = 3;
export const CANVAS_SIZE = 600;

export interface Preset {
  name: string;
  left: Point3D;
  right: Point3D;
}

export const PRESETS: Preset[] = [
  { name: "Both at E",    left: { x:  0.95, y: 0, z: 0 }, right: { x:  1, y: 0, z: 0 } },
  { name: "Both at W",    left: { x: -0.95, y: 0, z: 0 }, right: { x: -1, y: 0, z: 0 } },
  { name: "L:W R:E",      left: { x: -1, y: 0, z: 0 },    right: { x:  1, y: 0, z: 0 } },
  { name: "L:E R:W",      left: { x:  1, y: 0, z: 0 },    right: { x: -1, y: 0, z: 0 } },
  { name: "R Behind E",   left: { x:  1, y: 0, z: 0 },    right: { x:  1, y: 0, z: 1 } },
  { name: "L Behind W",   left: { x: -1, y: 0, z: 1 },    right: { x: -1, y: 0, z: 0 } },
  { name: "Both Behind",  left: { x: -1, y: 0, z: 1 },    right: { x:  1, y: 0, z: 1 } },
  { name: "Both N/S",     left: { x:  0, y: 0.95, z: 0 }, right: { x: 0, y: -0.95, z: 0 } },
];
