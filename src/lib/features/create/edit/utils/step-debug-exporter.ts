/**
 * Beat Debug Exporter
 *
 * Utility for exporting comprehensive beat data including rotation calculations
 * for debugging arrow positioning issues.
 *
 * Properly distinguishes between:
 * - Start Position Pictographs - No motion, just prop orientations
 * - Beat Pictographs - Actual motions with arrows and props
 */

import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { IArrowRotationCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowRotationCalculator";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { isStartPosition } from "../../shared/domain/type-guards/pictograph-type-guards";
import { arrowRotationCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/implementations/ArrowRotationCalculator";

/**
 * Debug data for a start position pictograph
 * Start positions show initial prop orientations before sequence begins
 */
export interface StartPositionDebugData {
  // Identification
  type: "start-position";
  id: string;
  letter?: string | null;
  gridPosition?: string | null; // e.g. "gamma13"

  // Prop states (no motion occurring)
  propStates: {
    blue?: PropStateDebugData | null;
    red?: PropStateDebugData | null;
  };
}

/**
 * Simplified prop state for start positions (no motion, no arrows)
 */
export interface PropStateDebugData {
  location: string; // Grid location where prop is held
  orientation: string; // How prop is oriented (in/out/clock/counter)
  propType: string; // staff/buugeng/fan/etc

  // Prop rotation and placement
  propRotation: number; // Calculated prop rotation in degrees
  propPlacement: {
    x: number;
    y: number;
    rotation?: number;
    isVisible?: boolean;
  };
}

/**
 * Debug data for an actual beat pictograph
 * Steps show motions with arrows and props moving
 */
export interface StepDebugData {
  // Identification
  type: "beat";
  stepNumber: number;
  duration: number;
  id: string;

  // Beat context
  letter?: string | null;
  startPosition?: string | null; // Where sequence starts (e.g. "gamma13")
  endPosition?: string | null; // Where sequence ends (e.g. "alpha5")

  // Beat attributes
  blueReversal: boolean;
  redReversal: boolean;
  isBlank: boolean;

  // Motion data with rotation calculations
  motions: {
    blue?: MotionDebugData | null;
    red?: MotionDebugData | null;
  };
}

/**
 * Comprehensive debug data for a motion in a beat
 */
export interface MotionDebugData {
  // Motion identification
  motionType: string; // static/pro/anti/dash/float

  // Motion parameters
  rotationDirection: string;
  startLocation: string;
  endLocation: string;
  turns: number | "fl";
  startOrientation: string;
  endOrientation: string;
  propType: string;
  gridMode: string;
  isVisible: boolean;

  // Arrow data
  arrowLocation: string;
  arrowRotation: number; // Calculated ARROW rotation in degrees
  arrowRotationMethod: string; // How rotation was calculated
  arrowPlacement: {
    x: number;
    y: number;
    rotation?: number;
    isVisible?: boolean;
  };

  // Prop data
  propPlacement: {
    x: number;
    y: number;
    rotation?: number;
    isVisible?: boolean;
  };

  // Prefloat attributes (if applicable)
  prefloatMotionType?: string | null;
  prefloatRotationDirection?: string | null;
}

/**
 * Union type for all debug data
 */
export type PictographDebugData = StartPositionDebugData | StepDebugData;

/**
 * Export comprehensive pictograph data
 * Automatically detects if it's a start position or beat and exports appropriate structure
 */
export async function exportBeatDebugData(
  data: StepData | StartPositionData | PictographData,
  pictographData?: PictographData
): Promise<PictographDebugData> {
  // Use type guard to detect if this is a start position
  if (isStartPosition(data)) {
    return exportStartPositionDebugData(data);
  } else {
    return exportActualBeatDebugData(data as StepData, pictographData);
  }
}

/**
 * Export start position data (no motion, just prop states)
 */
async function exportStartPositionDebugData(
  startPosition: StartPositionData
): Promise<StartPositionDebugData> {

  const debugData: StartPositionDebugData = {
    type: "start-position",
    id: startPosition.id,
    letter: startPosition.letter || null,
    gridPosition: startPosition.gridPosition || null,
    propStates: {},
  };

  // Process blue prop state if it exists
  if (startPosition.motions.blue) {
    debugData.propStates.blue = await exportPropStateDebugData(
      startPosition.motions.blue,
      arrowRotationCalculator,
      startPosition
    );
  }

  // Process red prop state if it exists
  if (startPosition.motions.red) {
    debugData.propStates.red = await exportPropStateDebugData(
      startPosition.motions.red,
      arrowRotationCalculator,
      startPosition
    );
  }

  return debugData;
}

/**
 * Export prop state for start position (simplified, no arrows)
 */
async function exportPropStateDebugData(
  motion: MotionData,
  rotationCalculator: IArrowRotationCalculator,
  pictographData: PictographData
): Promise<PropStateDebugData> {
  // Calculate prop rotation (even though there's no arrow)
  // For start position, we calculate what the rotation would be
  const propRotation = await rotationCalculator.calculateRotation(
    motion,
    motion.startLocation, // Use start location since start/end are same
    pictographData
  );

  return {
    location: motion.startLocation, // Same as endLocation for start position
    orientation: motion.startOrientation, // Same as endOrientation for start position
    propType: motion.propType,
    propRotation,
    propPlacement: {
      x: motion.propPlacementData.positionX ?? 0,
      y: motion.propPlacementData.positionY ?? 0,
      rotation: motion.propPlacementData.rotationAngle,
      isVisible: true, // Props are always visible in start position
    },
  };
}

/**
 * Export actual beat data (with motions, arrows, etc.)
 */
async function exportActualBeatDebugData(
  stepData: StepData,
  pictographData?: PictographData
): Promise<StepDebugData> {

  const debugData: StepDebugData = {
    type: "beat",
    stepNumber: stepData.stepNumber,
    duration: stepData.duration,
    id: stepData.id,
    letter: stepData.letter || null,
    startPosition: stepData.startPosition || null,
    endPosition: stepData.endPosition || null,
    blueReversal: stepData.blueReversal,
    redReversal: stepData.redReversal,
    isBlank: stepData.isBlank,
    motions: {},
  };

  // Process blue motion if it exists
  if (stepData.motions.blue) {
    debugData.motions.blue = await exportMotionDebugData(
      stepData.motions.blue,
      arrowRotationCalculator,
      pictographData || stepData
    );
  }

  // Process red motion if it exists
  if (stepData.motions.red) {
    debugData.motions.red = await exportMotionDebugData(
      stepData.motions.red,
      arrowRotationCalculator,
      pictographData || stepData
    );
  }

  return debugData;
}

/**
 * Export comprehensive motion data for a beat (with arrows)
 */
async function exportMotionDebugData(
  motion: MotionData,
  rotationCalculator: IArrowRotationCalculator,
  pictographData: PictographData
): Promise<MotionDebugData> {
  // Calculate ARROW rotation using the same calculator used for rendering
  const arrowRotation = await rotationCalculator.calculateRotation(
    motion,
    motion.arrowLocation,
    pictographData
  );

  // Determine the calculation method for debugging
  const rotationMethod = getRotationCalculationMethod(motion);

  return {
    motionType: motion.motionType,
    rotationDirection: motion.rotationDirection,
    startLocation: motion.startLocation,
    endLocation: motion.endLocation,
    turns: motion.turns,
    startOrientation: motion.startOrientation,
    endOrientation: motion.endOrientation,
    propType: motion.propType,
    gridMode: motion.gridMode,
    isVisible: motion.isVisible,

    // Arrow rotation info (clearly labeled as ARROW rotation)
    arrowLocation: motion.arrowLocation,
    arrowRotation,
    arrowRotationMethod: rotationMethod,

    // Placement data
    arrowPlacement: {
      x: motion.arrowPlacementData.positionX ?? 0,
      y: motion.arrowPlacementData.positionY ?? 0,
      rotation: motion.arrowPlacementData.rotationAngle,
      isVisible: motion.isVisible, // Use motion's isVisible field
    },

    propPlacement: {
      x: motion.propPlacementData.positionX ?? 0,
      y: motion.propPlacementData.positionY ?? 0,
      rotation: motion.propPlacementData.rotationAngle,
      isVisible: true, // Props are always visible
    },

    // Prefloat attributes
    prefloatMotionType: motion.prefloatMotionType || null,
    prefloatRotationDirection: motion.prefloatRotationDirection || null,
  };
}

/**
 * Determine the rotation calculation method for debugging purposes
 */
function getRotationCalculationMethod(motion: MotionData): string {
  const motionType = motion.motionType.toLowerCase();
  const rotationDir = motion.rotationDirection.toLowerCase();

  switch (motionType) {
    case "static": {
      // Check if radial (IN/OUT) or non-radial (CLOCK/COUNTER)
      const orientation = motion.startOrientation.toLowerCase();
      const isRadial = orientation === "in" || orientation === "out";
      const mode = isRadial ? "radial" : "non-radial";
      return `static-${mode}-${rotationDir}`;
    }
    case "pro":
      return `pro-${rotationDir}`;
    case "anti":
      return `anti-${rotationDir}`;
    case "dash": {
      if (rotationDir === "no_rotation") {
        return `dash-no_rotation-${motion.startLocation}-${motion.endLocation}`;
      }
      return `dash-${rotationDir}`;
    }
    case "float": {
      // Float uses handpath direction, not rotation direction
      return `float-handpath-based`;
    }
    default:
      return `unknown-${motionType}`;
  }
}

/**
 * Copy pictograph debug data to clipboard as formatted JSON
 */
export async function copyBeatDebugDataToClipboard(
  data: StepData | StartPositionData | PictographData,
  pictographData?: PictographData
): Promise<void> {
  const debugData = await exportBeatDebugData(data, pictographData);
  const jsonString = JSON.stringify(debugData, null, 2);

  try {
    await navigator.clipboard.writeText(jsonString);
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    // Fallback: log to console
    console.log("Pictograph debug data (fallback):");
    console.log(jsonString);
    throw error;
  }
}
