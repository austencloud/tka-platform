import type { Point3D } from "./projection";

export interface SequenceBeat {
  left: Point3D;
  right: Point3D;
  label?: string;
}

export interface DemoSequence {
  name: string;
  description: string;
  beats: SequenceBeat[];
}

export const DEMO_SEQUENCES: DemoSequence[] = [
  {
    name: "Mirror Sweep",
    description: "Symmetric east-west sweep — no body turn needed",
    beats: [
      { left: { x: -1, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, label: "L:W R:E" },
      { left: { x: -1, y: 1, z: 0 }, right: { x: 1, y: 1, z: 0 }, label: "L:NW R:NE" },
      { left: { x: 0, y: 1, z: 0 }, right: { x: 0, y: 1, z: 0 }, label: "Both N" },
      { left: { x: 1, y: 1, z: 0 }, right: { x: -1, y: 1, z: 0 }, label: "L:NE R:NW" },
      { left: { x: 1, y: 0, z: 0 }, right: { x: -1, y: 0, z: 0 }, label: "L:E R:W" },
      { left: { x: 1, y: -1, z: 0 }, right: { x: -1, y: -1, z: 0 }, label: "L:SE R:SW" },
      { left: { x: 0, y: -1, z: 0 }, right: { x: 0, y: -1, z: 0 }, label: "Both S" },
      { left: { x: -1, y: -1, z: 0 }, right: { x: 1, y: -1, z: 0 }, label: "L:SW R:SE" },
    ],
  },
  {
    name: "Plane Split",
    description: "Right prop peels behind — triggers plane split + body turn",
    beats: [
      { left: { x: -1, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, label: "L:W R:E (front)" },
      { left: { x: -1, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0.5 }, label: "R drifts back" },
      { left: { x: -1, y: 0, z: 0 }, right: { x: 1, y: 0, z: 1 }, label: "R fully behind" },
      { left: { x: -1, y: 0, z: 0 }, right: { x: 0, y: 0, z: 1 }, label: "R moves to center-back" },
      { left: { x: -1, y: 0, z: 0 }, right: { x: -1, y: 0, z: 1 }, label: "R at W-back" },
      { left: { x: -1, y: 0, z: 0 }, right: { x: -1, y: 0, z: 0.5 }, label: "R returns" },
      { left: { x: -1, y: 0, z: 0 }, right: { x: -1, y: 0, z: 0 }, label: "Both W (front)" },
      { left: { x: -1, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, label: "Back to start" },
    ],
  },
  {
    name: "Crossing",
    description: "Arms cross center — crossing detector fires",
    beats: [
      { left: { x: -1, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, label: "L:W R:E" },
      { left: { x: -0.5, y: 0, z: 0 }, right: { x: 0.5, y: 0, z: 0 }, label: "Moving in" },
      { left: { x: 0, y: 0, z: 0 }, right: { x: 0, y: 0, z: 0 }, label: "Center — crossing!" },
      { left: { x: 0.5, y: 0, z: 0 }, right: { x: -0.5, y: 0, z: 0 }, label: "Crossed!" },
      { left: { x: 1, y: 0, z: 0 }, right: { x: -1, y: 0, z: 0 }, label: "L:E R:W" },
      { left: { x: 0.5, y: 0, z: 0 }, right: { x: -0.5, y: 0, z: 0 }, label: "Returning" },
      { left: { x: 0, y: 0, z: 0 }, right: { x: 0, y: 0, z: 0 }, label: "Center — crossing!" },
      { left: { x: -1, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, label: "Back to start" },
    ],
  },
  {
    name: "Body Turn 90°",
    description: "Both props shift east — body auto-turns to face stage-right",
    beats: [
      { left: { x: -1, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, label: "L:W R:E (neutral)" },
      { left: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, label: "L moves center" },
      { left: { x: 0.5, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, label: "L to mid-E" },
      { left: { x: 1, y: 0, z: -0.5 }, right: { x: 1, y: 0, z: 0.5 }, label: "Split at E" },
      { left: { x: 1, y: 0, z: -1 }, right: { x: 1, y: 0, z: 1 }, label: "Turned 90° east" },
      { left: { x: 1, y: 0, z: -0.5 }, right: { x: 1, y: 0, z: 0.5 }, label: "Closing back" },
      { left: { x: 0.5, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, label: "Returning" },
      { left: { x: -1, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, label: "Back to neutral" },
    ],
  },
  {
    name: "Height Sweep",
    description: "Props sweep vertically — visible in wall/wheel views",
    beats: [
      { left: { x: -1, y: -1, z: 0 }, right: { x: 1, y: -1, z: 0 }, label: "Both low (S)" },
      { left: { x: -1, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, label: "Both mid (E/W)" },
      { left: { x: -1, y: 1, z: 0 }, right: { x: 1, y: 1, z: 0 }, label: "Both high (N)" },
      { left: { x: 0, y: 1, z: 0 }, right: { x: 0, y: 1, z: 0 }, label: "Both center-high" },
      { left: { x: 0, y: 0, z: 0 }, right: { x: 0, y: 0, z: 0 }, label: "Both center" },
      { left: { x: 0, y: -1, z: 0 }, right: { x: 0, y: -1, z: 0 }, label: "Both center-low" },
      { left: { x: -1, y: -1, z: 0 }, right: { x: 1, y: -1, z: 0 }, label: "Spread low" },
      { left: { x: -1, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, label: "Back to E/W" },
    ],
  },
];
