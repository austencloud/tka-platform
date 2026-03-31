import { GripType, type GripPose } from "../../domain/models/GripPose";

// Quaternion helper: rotation of `degrees` around X axis → [x, y, z, w]
function xRot(degrees: number): [number, number, number, number] {
  const rad = (degrees * Math.PI) / 180;
  return [Math.sin(rad / 2), 0, 0, Math.cos(rad / 2)];
}

// Quaternion helper: rotation of `degrees` around Z axis
function zRot(degrees: number): [number, number, number, number] {
  const rad = (degrees * Math.PI) / 180;
  return [0, 0, Math.sin(rad / 2), Math.cos(rad / 2)];
}

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

// Relaxed open hand — fingers barely curl inward, w stays above 0.9 for all bones.
// Thumb has a mild Z splay to sit naturally alongside the index finger.
const IDLE_POSE: GripPose = {
  name: "Relaxed Idle",
  type: GripType.IDLE,
  rotations: [
    zRot(10), zRot(5), IDENTITY,       // Thumb (proximal → distal)
    xRot(10), xRot(15), xRot(10),      // Index
    xRot(12), xRot(18), xRot(12),      // Middle
    xRot(15), xRot(20), xRot(15),      // Ring
    xRot(18), xRot(22), xRot(18),      // Pinky
  ],
};

// Full palm wrap — wrist-driven rotation, fingers at ~75-90° curl.
// Thumb adds Z rotation to press against index finger for a secure shaft grip.
const SQUARE_POSE: GripPose = {
  name: "Square Staff Grip",
  type: GripType.SQUARE,
  rotations: [
    zRot(35), xRot(40), xRot(30),      // Thumb
    xRot(75), xRot(85), xRot(60),      // Index
    xRot(78), xRot(88), xRot(62),      // Middle
    xRot(80), xRot(90), xRot(65),      // Ring
    xRot(82), xRot(90), xRot(68),      // Pinky
  ],
};

// The remaining grip types are placeholder copies of IDLE, to be authored
// through the in-engine debug editor once the hand rig is live.
const PENCIL_POSE: GripPose = {
  name: "Pencil Grip",
  type: GripType.PENCIL,
  rotations: [...IDLE_POSE.rotations] as [number, number, number, number][],
};

const CRADLE_POSE: GripPose = {
  name: "Cradle",
  type: GripType.CRADLE,
  rotations: [...IDLE_POSE.rotations] as [number, number, number, number][],
};

const OPEN_PALM_POSE: GripPose = {
  name: "Open Palm",
  type: GripType.OPEN_PALM,
  rotations: [...IDLE_POSE.rotations] as [number, number, number, number][],
};

const RELEASE_POSE: GripPose = {
  name: "Release",
  type: GripType.RELEASE,
  rotations: [...IDLE_POSE.rotations] as [number, number, number, number][],
};

export const STAFF_GRIP_POSES: Record<GripType, GripPose> = {
  [GripType.IDLE]: IDLE_POSE,
  [GripType.SQUARE]: SQUARE_POSE,
  [GripType.PENCIL]: PENCIL_POSE,
  [GripType.CRADLE]: CRADLE_POSE,
  [GripType.OPEN_PALM]: OPEN_PALM_POSE,
  [GripType.RELEASE]: RELEASE_POSE,
};
