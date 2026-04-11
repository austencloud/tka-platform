/**
 * Collision Lab Domain Types
 *
 * Shared types for the pose catalog, labels, and stance variants.
 * See docs/superpowers/specs/2026-04-10-collision-lab-design.md.
 */

import type { Plane } from "$lib/shared/3d/domain/enums/Plane";

export type DiamondPosition = "N" | "E" | "S" | "W";
export type HandOrientation = "in" | "out"; // radial | antiradial

export interface HandState {
  plane: Plane;
  position: DiamondPosition;
  orientation: HandOrientation;
}

export interface PoseDefinition {
  /**
   * Stable id encoding both hands' (plane, position, orientation).
   * Format: `{bluePlaneLetter}{bluePos}{blueOri}-{redPlaneLetter}{redPos}{redOri}`
   * where plane letter is w=wall, h=wheel, f=floor.
   * Example: `wNi-hEo` = blue on wall at N (in), red on wheel at E (out).
   */
  id: string;
  blueHand: HandState;
  redHand: HandState;
}

export type LabelStatus =
  | "unlabeled"
  | "clear"
  | "needs-adjustment"
  | "unreachable"
  | "skip";

export type ArmRouting =
  | "auto"
  | "left-under"
  | "left-over"
  | "right-under"
  | "right-over"
  | "both-under"
  | "both-over";

export type CollisionZoneType =
  | "arm-through-face"
  | "prop-through-torso"
  | "prop-through-head"
  | "prop-through-arm"
  | "prop-through-prop"
  | "arms-through-each-other";

export type SnapshotSeverity = "clear" | "graze" | "clip" | "penetrate";

export interface CollisionSnapshotZone {
  type: CollisionZoneType;
  depthCm: number;
  description: string;
}

export interface CollisionSnapshot {
  severity: SnapshotSeverity;
  zones: CollisionSnapshotZone[];
}

/**
 * The exact floor position and upper-body adjustment that was active
 * when the reviewer committed a label. Captured inline so labels are
 * self-describing — no external preset table needed.
 */
export interface StancePose {
  /** Side-to-side offset in meters. Positive = performer's right. */
  footOffsetX: number;
  /** Depth offset in meters. Positive = toward audience (forward). */
  footOffsetZ: number;
  /** Body yaw in radians around the Y axis. Positive = turn left. */
  rootYawRad: number;
  /** Forward torso lean in radians (0 = upright, positive = leaned in). */
  spinePitchRad: number;
}

export interface PoseLabel {
  poseId: string;
  status: LabelStatus;
  stance: StancePose;
  armRouting: ArmRouting;
  collisionSnapshot: CollisionSnapshot | null;
  notes?: string;
  labeledAt?: number;
}

/** On-disk format for the committable labels JSON */
export interface PoseLabelsFile {
  version: 1;
  mode: "diamond-in-out";
  generatedAt: number;
  labels: Record<string, PoseLabel>;
}

/**
 * Bounds for the floor-offset sliders in the stance controls panel.
 * 60 cm in each direction is more than enough to reach any reasonable
 * "safe zone" around the grid for a single-performer catalog.
 */
export const STANCE_BOUNDS = {
  footOffset: { min: -0.6, max: 0.6, step: 0.02 }, // 2 cm steps
  rootYawDeg: { min: -45, max: 45, step: 1 },
  spinePitchDeg: { min: -10, max: 40, step: 1 },
} as const;
