/**
 * CylinderGraspSolver - Computes anatomically correct finger curl angles
 * for grasping a cylinder of a given radius.
 *
 * The algorithm is geometric: each finger segment (proximal, middle, distal)
 * wraps a cylinder cross-section, and the joint angle at each knuckle is
 * determined by the segment length and cylinder radius.
 *
 * Joint flexion follows anatomical ratios observed in human grasping studies:
 *   MCP (base): full computed angle
 *   PIP (mid):  ~75% of computed angle
 *   DIP (tip):  ~50% of computed angle
 *
 * References:
 *   - Santello et al. 1998, "Postural Hand Synergies for Tool Use"
 *   - Feix et al. 2016, "The GRASP Taxonomy" (Yale)
 *   - ASME Finger Kinematic Models for Cylindrical Grasps
 */

import type { Bone } from "three";
import type { FingerBoneName } from "../../domain/models/GripPose";

/** Anatomical joint limits in radians */
const JOINT_LIMITS = {
  // MCP (metacarpophalangeal) - base knuckle
  MCP_MAX: Math.PI * 0.5, // 90°
  // PIP (proximal interphalangeal) - middle knuckle
  PIP_MAX: Math.PI * 0.55, // ~100°
  // DIP (distal interphalangeal) - tip knuckle
  DIP_MAX: Math.PI * 0.44, // ~80°
  // Thumb CMC abduction range
  THUMB_ABD_MAX: Math.PI * 0.33, // ~60°
};

/** Per-finger configuration */
interface FingerConfig {
  bones: [FingerBoneName, FingerBoneName, FingerBoneName];
  /** Which side of the cylinder this finger approaches from.
   *  Positive = palm side (fingers), negative = back side (thumb) */
  approachSign: 1 | -1;
  /** Additional abduction (Y rotation) for splay */
  abduction: number;
}

const FINGER_CONFIGS: FingerConfig[] = [
  // Thumb approaches from the opposite side, with abduction
  { bones: ["Thumb1", "Thumb2", "Thumb3"], approachSign: -1, abduction: 0 },
  { bones: ["Index1", "Index2", "Index3"], approachSign: 1, abduction: 0 },
  { bones: ["Middle1", "Middle2", "Middle3"], approachSign: 1, abduction: 0 },
  { bones: ["Ring1", "Ring2", "Ring3"], approachSign: 1, abduction: 0 },
  { bones: ["Pinky1", "Pinky2", "Pinky3"], approachSign: 1, abduction: 0 },
];

export interface GraspResult {
  /** Euler angles (degrees) for each of the 15 finger bones, in FINGER_BONES order */
  eulerAngles: { x: number; y: number; z: number }[];
}

/**
 * Measure the length of a bone segment (distance from bone to its first child).
 * Falls back to a default if measurement fails.
 */
function measureBoneLength(bone: Bone, defaultLength: number): number {
  const child = bone.children[0];
  if (child) {
    // Use the child's local position (offset from parent) as length
    const len = (child as Bone).position?.length() ?? 0;
    if (len > 0.001) return len;
  }
  return defaultLength;
}

/**
 * Compute the curl angle for a single finger segment wrapping a cylinder.
 *
 * The segment is tangent to the cylinder cross-section. The angle between
 * adjacent segments = 2 * arcsin(radius / segmentLength).
 * When the segment is shorter than the radius, the finger can't fully wrap
 * and we clamp to the anatomical maximum.
 */
function computeSegmentAngle(segmentLength: number, cylinderRadius: number, maxAngle: number): number {
  if (segmentLength <= 0.001) return 0;
  const ratio = cylinderRadius / segmentLength;
  if (ratio >= 1) return maxAngle; // segment too short to wrap - max curl
  const angle = 2 * Math.asin(ratio);
  return Math.min(angle, maxAngle);
}

/**
 * Solve finger curl angles for a cylindrical grasp.
 *
 * @param fingerBones Map of bone names to Bone objects
 * @param cylinderRadius Radius of the staff cylinder (in scene units)
 * @param gripTightness 0-1 multiplier. 1 = full geometric wrap, 0.5 = relaxed hold
 */
export function solveCylinderGrasp(
  fingerBones: Map<FingerBoneName, Bone>,
  cylinderRadius: number,
  gripTightness: number = 1.0,
): GraspResult {
  const eulerAngles: { x: number; y: number; z: number }[] = [];

  // Default bone length estimate (for a ~1.75m tall Mixamo character)
  const defaultLengths = {
    Thumb: [0.025, 0.02, 0.018],
    Index: [0.03, 0.022, 0.018],
    Middle: [0.033, 0.025, 0.02],
    Ring: [0.03, 0.022, 0.018],
    Pinky: [0.025, 0.018, 0.015],
  };

  for (const config of FINGER_CONFIGS) {
    const [b1Name, b2Name, b3Name] = config.bones;
    const bone1 = fingerBones.get(b1Name);
    const bone2 = fingerBones.get(b2Name);
    const bone3 = fingerBones.get(b3Name);

    // Determine finger family for defaults
    const fingerFamily = b1Name.replace(/\d+$/, "") as keyof typeof defaultLengths;
    const defs = defaultLengths[fingerFamily] ?? [0.03, 0.022, 0.018];
    const d1 = defs[0] ?? 0.03;
    const d2 = defs[1] ?? 0.022;
    const d3 = defs[2] ?? 0.018;

    // Measure actual bone lengths
    const len1 = bone1 ? measureBoneLength(bone1, d1) : d1;
    const len2 = bone2 ? measureBoneLength(bone2, d2) : d2;
    const len3 = bone3 ? measureBoneLength(bone3, d3) : d3;

    // Compute curl angles using geometric cylinder wrap
    const isThumb = config.approachSign === -1;

    if (isThumb) {
      // Thumb: CMC abduction + flexion on different axes
      const angle1 = computeSegmentAngle(len1, cylinderRadius, JOINT_LIMITS.THUMB_ABD_MAX) * gripTightness;
      const angle2 = computeSegmentAngle(len2, cylinderRadius, JOINT_LIMITS.MCP_MAX) * gripTightness;
      const angle3 = computeSegmentAngle(len3, cylinderRadius, JOINT_LIMITS.PIP_MAX * 0.5) * gripTightness;

      const deg1 = Math.round(angle1 * 180 / Math.PI);
      const deg2 = Math.round(angle2 * 180 / Math.PI);
      const deg3 = Math.round(angle3 * 180 / Math.PI);

      // Thumb1: flexion on X, abduction on Y (oppose toward fingers), slight Z rotation
      eulerAngles.push({ x: deg1, y: Math.round(deg1 * 1.2), z: Math.round(deg1 * 0.8) });
      // Thumb2: mainly X flexion
      eulerAngles.push({ x: deg2, y: 0, z: 0 });
      // Thumb3: tip curl
      eulerAngles.push({ x: deg3, y: 0, z: 0 });
    } else {
      // Non-thumb fingers: flexion primarily on X axis
      // Anatomical distribution: MCP gets full angle, PIP ~75%, DIP ~50%
      const baseAngle = computeSegmentAngle(len1, cylinderRadius, JOINT_LIMITS.MCP_MAX) * gripTightness;
      const midAngle = computeSegmentAngle(len2, cylinderRadius, JOINT_LIMITS.PIP_MAX) * gripTightness * 0.75;
      const tipAngle = computeSegmentAngle(len3, cylinderRadius, JOINT_LIMITS.DIP_MAX) * gripTightness * 0.5;

      const baseDeg = Math.round(baseAngle * 180 / Math.PI);
      const midDeg = Math.round(midAngle * 180 / Math.PI);
      const tipDeg = Math.round(tipAngle * 180 / Math.PI);

      eulerAngles.push({ x: baseDeg, y: config.abduction, z: 0 });
      eulerAngles.push({ x: midDeg, y: 0, z: 0 });
      eulerAngles.push({ x: tipDeg, y: 0, z: 0 });
    }
  }

  return { eulerAngles };
}
