/**
 * Prop Interpolation Service
 *
 * Focused service for angle interpolation and motion calculations.
 * Single responsibility: Motion interpolation between keyframes.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { MotionEndpoints } from "$lib/shared/pictograph/shared/domain/models/motion-endpoints";
import type { InterpolationResult } from "./animation-state-manager";
import { lerpAngle, normalizeAnglePositive } from "./angle-calculator";
import { calculateMotionEndpoints } from "./endpoint-calculator";
import { concaveRadiusProfile } from "$lib/shared/3d/services/petal-path";
import {
  getAnimationVisibilityManager,
  type AnimationVisibilityStateManager,
} from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

// `vm` lets a caller pass a per-instance (e.g. landing-page ephemeral) visibility
// manager so path-shape settings stay scoped to that surface. When omitted we
// fall back to the global singleton — unchanged behavior for the main app.
function resolvePathType(
  motionType: MotionType,
  motionPathShape?: "arc" | "linear" | "concave",
  vm?: AnimationVisibilityStateManager
): "arc" | "linear" | "concave" {
  if (motionPathShape) return motionPathShape;
  if (motionType === MotionType.DASH) return "linear";
  if (motionType === MotionType.STATIC) return "arc";

  const manager = vm ?? getAnimationVisibilityManager();

  if (manager.getMotionAwarePaths()) {
    if (motionType === MotionType.PRO) return "arc";
    if (motionType === MotionType.ANTI) return "concave";
  }

  return manager.getPathShape();
}

/**
 * Calculate interpolated prop angles for current beat progress
 * Uses Cartesian interpolation for DASH motions (straight through center)
 * Uses angular interpolation for all other motions
 */
export function interpolatePropAngles(
  currentStepData: StepData,
  stepProgress: number,
  vm?: AnimationVisibilityStateManager
): InterpolationResult {
  // Get motion data directly from domain beat (PURE DOMAIN!)
  // A hand that is "not really there" is an invisible placeholder under the
  // both-required Step shape — treat it exactly like the old absent hand
  // (solo/mandala animations and blank beats rely on this skip).
  const blueMotion = isVisibleMotion(currentStepData.motions?.blue)
    ? currentStepData.motions.blue
    : undefined;
  const redMotion = isVisibleMotion(currentStepData.motions?.red)
    ? currentStepData.motions.red
    : undefined;

  // Both hands missing = truly invalid
  if (!blueMotion && !redMotion) {
    return {
      blueAngles: null,
      redAngles: null,
      isValid: false,
    };
  }

  // Interpolate blue prop (null if not present)
  let blueAngles: InterpolationResult["blueAngles"] = null;
  if (blueMotion) {
    const blueEndpoints = calculateMotionEndpoints(blueMotion);
    blueAngles = interpolateMotion(
      blueEndpoints,
      blueMotion.motionType,
      stepProgress,
      blueMotion.pathShape,
      vm,
      typeof blueMotion.turns === "number" ? blueMotion.turns : 0
    );
  }

  // Interpolate red prop (null if not present)
  let redAngles: InterpolationResult["redAngles"] = null;
  if (redMotion) {
    const redEndpoints = calculateMotionEndpoints(redMotion);
    redAngles = interpolateMotion(
      redEndpoints,
      redMotion.motionType,
      stepProgress,
      redMotion.pathShape,
      vm,
      typeof redMotion.turns === "number" ? redMotion.turns : 0
    );
  }

  return {
    blueAngles,
    redAngles,
    isValid: true,
  };
}

function interpolateMotion(
  endpoints: MotionEndpoints,
  motionType: MotionType,
  progress: number,
  motionPathShape?: "arc" | "linear" | "concave",
  vm?: AnimationVisibilityStateManager,
  turns?: number,
  concaveDepth?: number
): {
  centerPathAngle: number;
  staffRotationAngle: number;
  x?: number;
  y?: number;
} {
  const pathType = resolvePathType(motionType, motionPathShape, vm);

  if (pathType === "linear") {
    return interpolateLinearMotion(endpoints, progress);
  }

  if (pathType === "concave") {
    return interpolateConcaveMotion(endpoints, progress, turns ?? 0, concaveDepth ?? 0);
  }

  return {
    centerPathAngle: lerpAngle(
      endpoints.startCenterAngle,
      endpoints.targetCenterAngle,
      progress
    ),
    staffRotationAngle: normalizeAnglePositive(
      endpoints.startStaffAngle +
        endpoints.staffRotationDelta * progress
    ),
  };
}

/**
 * Interpolate motion using Cartesian coordinates (straight line path)
 * Used for DASH motions and shifts when pathShape is "linear"
 * Returns angle for compatibility, but the angle will be recalculated from x,y in the renderer
 */
function interpolateLinearMotion(
  endpoints: MotionEndpoints,
  progress: number
): {
  centerPathAngle: number;
  staffRotationAngle: number;
  x?: number;
  y?: number;
} {
  // Convert start and end angles to Cartesian coordinates (unit circle)
  const startX = Math.cos(endpoints.startCenterAngle);
  const startY = Math.sin(endpoints.startCenterAngle);
  const endX = Math.cos(endpoints.targetCenterAngle);
  const endY = Math.sin(endpoints.targetCenterAngle);

  // Linear interpolation in Cartesian space (straight line through center)
  const currentX = startX + (endX - startX) * progress;
  const currentY = startY + (endY - startY) * progress;

  // Convert back to angle for compatibility
  const centerPathAngle = Math.atan2(currentY, currentX);

  // Staff rotation: Use total rotation delta to respect turns (NOT shortest path!)
  // This ensures 1.5 turns rotates +270°, not -90° via shortest path
  const staffRotationAngle = normalizeAnglePositive(
    endpoints.startStaffAngle + endpoints.staffRotationDelta * progress
  );

  // Return x,y coordinates so renderer can use them directly
  return { centerPathAngle, staffRotationAngle, x: currentX, y: currentY };
}

/**
 * Concave path: petal model (see $lib/shared/3d/services/petal-path). Angle
 * rides the arc; radius dips toward center once per petal
 * (petalsPerStep = 1 + turns), replacing the legacy chord-reflection math.
 */
function interpolateConcaveMotion(
  endpoints: MotionEndpoints,
  progress: number,
  turns: number,
  concaveDepth: number
): {
  centerPathAngle: number;
  staffRotationAngle: number;
  x?: number;
  y?: number;
} {
  const centerPathAngle = lerpAngle(
    endpoints.startCenterAngle,
    endpoints.targetCenterAngle,
    progress
  );
  const radius = concaveRadiusProfile(progress, turns, concaveDepth);
  const concaveX = Math.cos(centerPathAngle) * radius;
  const concaveY = Math.sin(centerPathAngle) * radius;

  const staffRotationAngle = normalizeAnglePositive(
    endpoints.startStaffAngle + endpoints.staffRotationDelta * progress
  );

  return { centerPathAngle, staffRotationAngle, x: concaveX, y: concaveY };
}

/**
 * Calculate initial prop angles from first beat
 */
export function calculateInitialAngles(firstStep: StepData): InterpolationResult {
  // Get motion data directly from domain beat (PURE DOMAIN!)
  // Invisible placeholders count as "not there" (see interpolatePropAngles).
  const blueStartMotion = isVisibleMotion(firstStep.motions?.blue)
    ? firstStep.motions.blue
    : undefined;
  const redStartMotion = isVisibleMotion(firstStep.motions?.red)
    ? firstStep.motions.red
    : undefined;

  // Both hands missing = truly invalid
  if (!blueStartMotion && !redStartMotion) {
    return {
      blueAngles: null,
      redAngles: null,
      isValid: false,
    };
  }

  // Calculate angles for whichever hand is present (null for missing hand)
  let blueAngles: InterpolationResult["blueAngles"] = null;
  if (blueStartMotion) {
    const blueStartEndpoints = calculateMotionEndpoints(blueStartMotion);
    blueAngles = {
      centerPathAngle: blueStartEndpoints.startCenterAngle,
      staffRotationAngle: blueStartEndpoints.startStaffAngle,
    };
  }

  let redAngles: InterpolationResult["redAngles"] = null;
  if (redStartMotion) {
    const redStartEndpoints = calculateMotionEndpoints(redStartMotion);
    redAngles = {
      centerPathAngle: redStartEndpoints.startCenterAngle,
      staffRotationAngle: redStartEndpoints.startStaffAngle,
    };
  }

  return {
    blueAngles,
    redAngles,
    isValid: true,
  };
}

/**
 * Get motion data for debugging (supports single-hand beats)
 */
export function getMotionData(stepData: StepData): {
  blue: MotionData | null;
  red: MotionData | null;
} {
  return {
    blue: stepData.motions?.blue ?? null,
    red: stepData.motions?.red ?? null,
  };
}

/**
 * Calculate endpoints for debugging (supports single-hand beats)
 */
export function getEndpoints(stepData: StepData): {
  blue: MotionEndpoints | null;
  red: MotionEndpoints | null;
} {
  const motionData = getMotionData(stepData);
  return {
    blue: motionData.blue
      ? calculateMotionEndpoints(motionData.blue)
      : null,
    red: motionData.red
      ? calculateMotionEndpoints(motionData.red)
      : null,
  };
}
