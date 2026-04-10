/**
 * Collision Lab Domain Types
 *
 * Shared types for the pose catalog, labels, and stance variants.
 * See docs/superpowers/specs/2026-04-10-collision-lab-design.md.
 */

import type { Plane } from "$lib/shared/3d/domain/enums/Plane";

export type DiamondPosition = "N" | "E" | "S" | "W";
export type HandOrientation = "in" | "out"; // radial | antiradial

export interface PoseDefinition {
  /** Stable id of the form "wall-Ni-Eo" — plane-bluePos+blueOri-redPos+redOri */
  id: string;
  plane: Plane;
  blueHand: {
    position: DiamondPosition;
    orientation: HandOrientation;
  };
  redHand: {
    position: DiamondPosition;
    orientation: HandOrientation;
  };
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

export interface PoseLabel {
  poseId: string;
  status: LabelStatus;
  stanceVariantIndex: number;
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

export interface StanceVariant {
  index: number;
  description: string;
  /** Body rotation around the Y axis in radians, applied to avatar root */
  rootYawRad: number;
  /** Forward torso lean in radians, applied to spine bones */
  spinePitchRad: number;
}
