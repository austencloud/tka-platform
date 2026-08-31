/**
 * Collision Lab Domain Types
 *
 * Shared types for the pose catalog, labels, and stance variants.
 * See docs/superpowers/specs/2026-04-10-collision-lab-design.md.
 */

import type { Plane } from "@austencloud/scene-3d";
import type { SimResult } from "../services/types";

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
  leftHand: HandState;
  rightHand: HandState;
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
  | "arm-through-neck"
  | "arm-through-torso"
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
 * self-describing - no external preset table needed.
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
  /**
   * Upper-body twist in radians about the body centerline, layered ON TOP of
   * rootYaw and applied only to spine2/neck/head/shoulders (hips + feet keep
   * rootYaw). Lets the torso turn edge-on to skim a prop past its thin axis —
   * the TKA "turn to pass the prop into the plane behind you" technique. Optional
   * so pre-existing Collision Lab labels (4-DOF) stay valid; treated as 0 when
   * absent. Positive = upper body turns left relative to the hips.
   */
  torsoTwistRad?: number;
}

export interface PoseLabel {
  poseId: string;
  status: LabelStatus;
  /**
   * The committed stance - either the picked candidate's stance, or
   * (if the reviewer dragged the tweak sliders after picking) the
   * manually adjusted version of it. Always what the reviewer said "yes,
   * this is the stance to remember for this pose".
   */
  stance: StancePose;
  /**
   * The full set of candidates the reviewer saw at time of picking,
   * in the order they were displayed. Captures the preference signal
   * (picked one over the others) for future learned-prior training.
   * When the reviewer gave up on a pose and labeled it unreachable via
   * the "Give up on this pose" button, this contains every candidate
   * the reviewer saw across all regeneration clicks, flattened.
   */
  candidateStances?: StancePose[];
  /**
   * Which candidate in `candidateStances` the reviewer picked.
   *   - 0..N  → picked that candidate.
   *   - null  → reviewer picked a candidate then manually adjusted via
   *             sliders, so the committed stance no longer matches any
   *             candidate exactly. The picked-then-adjusted case.
   *   - undefined on older labels that predate this field.
   */
  pickedIndex?: number | null;
  armRouting: ArmRouting;
  collisionSnapshot: CollisionSnapshot | null;
  notes?: string;
  labeledAt?: number;
}

/**
 * One candidate stance shown in the 2×3 grid. Bundles the stance, its
 * simulator verdict, and a short human-readable label ("face-forward",
 * "rotated 90° left", etc.) so the UI can title each thumbnail without
 * re-deriving the seed strategy from raw numbers.
 */
export interface StanceCandidate {
  /** Position within the current candidate set (0..5). */
  index: number;
  /** The optimized stance after running the optimizer from this seed. */
  stance: StancePose;
  /** Scalar loss from the optimizer. Lower is better. */
  loss: number;
  /** Whether the simulator flagged the final stance as feasible. */
  feasible: boolean;
  /**
   * A short description of the seed strategy that produced this
   * candidate. E.g., "Face forward, step behind", "Rotated 90° right".
   * Used as the thumbnail title.
   */
  label: string;
  /**
   * Raw simulator result for the final stance. Exposes reach shortfall,
   * collision depths, balance margin, and joint violations so the
   * thumbnail can show a status pill without re-running the sim.
   */
  simResult: SimResult;
}

/**
 * A generated set of candidates for one pose. The reviewer either picks
 * one, asks for a different set (fresh diverse seeds), asks for a
 * refinement set (perturbations of the picked one), or gives up on the
 * pose entirely.
 */
export interface CandidateSet {
  /** Which pose these candidates belong to. */
  poseId: string;
  /** The 6 (or fewer after dedupe) candidates in display order. */
  candidates: StanceCandidate[];
  /** Index into `candidates` of whichever one is currently picked,
   *  or null if nothing is picked yet. */
  pickedIndex: number | null;
  /**
   * True if the reviewer has dragged the sliders after picking, so the
   * live stance no longer matches `candidates[pickedIndex].stance`.
   */
  manuallyAdjusted: boolean;
  /**
   * Generation mode of the current set:
   *   - "diverse" → first call or "Different options" button.
   *   - "refine"  → "Refine" button, candidates are perturbations of
   *                 the previously-picked stance.
   */
  mode: "diverse" | "refine";
  /**
   * Every candidate the reviewer has seen for this pose across all
   * regenerate clicks, flattened in order. Feeds the `candidateStances`
   * field of the final PoseLabel when the reviewer gives up.
   */
  history: StancePose[];
}

/** On-disk format for the committable labels JSON */
export interface PoseLabelsFile {
  version: 1;
  mode: "diamond-in-out";
  generatedAt: number;
  labels: Record<string, PoseLabel>;
}

/**
 * Bounds for the stance controls. Intentionally generous because a real
 * TKA performer can stand anywhere around the props and face any direction:
 *
 * - footOffset: ±1.0 m. Large enough to walk AROUND the grid, not just
 *   shuffle within it. The grid is ~1 m across, so ±1 m lets the performer
 *   stand on any side of it.
 * - rootYawDeg: ±180°. Full 360° rotation. Cross-plane poses routinely
 *   require the performer to turn most of the way around so the correct
 *   arm is on the correct side to reach each prop.
 * - spinePitchDeg: -10° to +40°. A slight back-lean and a substantial
 *   forward-lean cover almost all TKA work. Extreme backbends are rare.
 * - torsoTwistDeg: ±60°. Thoracic-spine rotation relative to the hips. A
 *   performer can present the torso edge-on without moving the feet; beyond
 *   ~60° the shoulders would have to drag the hips around (that's rootYaw's job).
 */
export const STANCE_BOUNDS = {
  footOffset: { min: -1.0, max: 1.0, step: 0.02 }, // 2 cm steps
  rootYawDeg: { min: -180, max: 180, step: 1 },
  spinePitchDeg: { min: -10, max: 40, step: 1 },
  torsoTwistDeg: { min: -60, max: 60, step: 1 },
} as const;
