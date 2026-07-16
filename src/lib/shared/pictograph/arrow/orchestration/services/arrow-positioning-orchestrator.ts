/**
 * Arrow Positioning Orchestrator
 *
 * Main implementation of the arrow positioning pipeline.
 * Coordinates with other services to compute final arrow positions.
 */

import type { ArrowPlacementData } from "../../positioning/placement/domain/arrow-placement-data";
import {
  isVisibleMotion,
  type MotionData,
} from "../../../shared/domain/models/motion-data";
import type { PictographData } from "../../../shared/domain/models/pictograph-data";
import { GridMode } from "../../../grid/domain/enums/grid-enums";
import { getInitialPosition, getSceneCenter } from "./arrow-grid-coordinator";
import {
  ensureValidPosition,
  extractAdjustmentValues,
  updateArrowInPictograph,
} from "./arrow-data-processor";
import { arrowLocationCalculator } from "../../positioning/calculation/services/arrow-location-calculator";
import { arrowRotationCalculator } from "../../positioning/calculation/services/arrow-rotation-calculator";
import { arrowAdjustmentCalculator } from "../../positioning/calculation/services/arrow-adjustment-calculator";
import { arrowPlacer, type SegmentPlacementKey } from "../../positioning/placement/services/arrow-placer";

export async function calculateArrowPoint(
  pictographData: PictographData,
  motionData: MotionData,
  gridMode?: GridMode,
  soloMode?: boolean
): Promise<[number, number, number]> {
  try {
    const motion = motionData;
    if (!motion) {
      console.warn(
        "🚫 ArrowPositioningOrchestrator: No motion data provided, using scene center"
      );
      const center = getSceneCenter();
      return [center.x, center.y, 0];
    }

    const location = arrowLocationCalculator.calculateLocation(
      motion,
      pictographData
    );
    const initialPosition = getInitialPosition(motion, location, gridMode);

    const validPosition = ensureValidPosition(initialPosition);

    const rotation = await arrowRotationCalculator.calculateRotation(
      motion,
      location,
      pictographData
    );

    // Half-motion frames are letterless by construction; route them AROUND the
    // letter-based adjustment tiers (Special/Global calibrated for real letters —
    // a "A" default would mis-adjust) and straight to the default-tier `_half`
    // bucket instead. The lookup key is the basic motion-type key ("pro", not
    // a letter-derived placement key) since there's no letter to key off of.
    // Today's `_half` data files are empty ({}), so the lookup falls through
    // to {0,0} — same baseline as before, but now real nudges are a pure data
    // edit away instead of requiring another code change.
    let adjustmentX: number;
    let adjustmentY: number;
    if (motion.segment) {
      const local = await arrowPlacer.getDefaultAdjustment(
        `${motion.motionType}_half` as SegmentPlacementKey,
        motion.motionType,
        motion.turns,
        gridMode ?? GridMode.DIAMOND
      );
      // Segment default adjustments are authored in GLYPH-LOCAL space (the
      // extracted asset's frame, staff along +x — extract-half-glyphs.mjs), so
      // one (motionType, turns) value serves every location/direction: rotate
      // it with the glyph, flipping local y when the pipeline mirrors
      // (ArrowSvg's segment scale(1,-1) is a pre-rotation local-y flip).
      const mirrored = shouldMirrorArrow(
        {} as ArrowPlacementData,
        pictographData,
        motion
      );
      const rad = (rotation * Math.PI) / 180;
      const ly = mirrored ? -local.y : local.y;
      adjustmentX = local.x * Math.cos(rad) - ly * Math.sin(rad);
      adjustmentY = local.x * Math.sin(rad) + ly * Math.cos(rad);
    } else {
      const adjustment = await arrowAdjustmentCalculator.calculateAdjustment(
        pictographData,
        motion,
        pictographData.letter || "A",
        location,
        motion.color,
        soloMode
      );
      [adjustmentX, adjustmentY] = extractAdjustmentValues(adjustment);
    }

    const finalX = validPosition.x + adjustmentX;
    const finalY = validPosition.y + adjustmentY;

    return [finalX, finalY, rotation];
  } catch (error) {
    console.error("Arrow positioning calculation failed:", error);
    const center = getSceneCenter();
    return [center.x, center.y, 0];
  }
}

export async function updateArrowPosition(
  pictographData: PictographData,
  color: string,
  _motionData?: MotionData
): Promise<PictographData> {
  try {
    const motionData =
      pictographData.motions[color as keyof typeof pictographData.motions];
    const arrowData = motionData?.arrowPlacementData;
    if (!arrowData || !motionData) {
      console.warn(`No arrow data found for color: ${color}`);
      return pictographData;
    }

    const [x, y, rotation] = await calculateArrowPoint(
      pictographData,
      motionData
    );

    const shouldMirror = shouldMirrorArrow(arrowData, pictographData, motionData);

    const manualAdjustX = arrowData.manualAdjustmentX || 0;
    const manualAdjustY = arrowData.manualAdjustmentY || 0;

    const updates: Partial<ArrowPlacementData> = {
      positionX: x + manualAdjustX,
      positionY: y + manualAdjustY,
      rotationAngle: rotation,
      svgMirrored: shouldMirror,
      manualAdjustmentX: manualAdjustX,
      manualAdjustmentY: manualAdjustY,
    };

    const motionUpdates = {
      arrowLocation: location,
    } as unknown as Partial<MotionData>;

    return updateArrowInPictograph(pictographData, color, updates, motionUpdates);
  } catch (error) {
    console.error("Arrow position update failed:", error);
    return pictographData;
  }
}

export async function calculateAllArrowPoints(
  pictographData: PictographData
): Promise<PictographData> {
  try {
    if (!pictographData.motions) {
      return pictographData;
    }

    let updatedPictograph = { ...pictographData };

    for (const color of Object.keys(pictographData.motions)) {
      const motionData =
        pictographData.motions[color as keyof typeof pictographData.motions];
      const arrowData = motionData?.arrowPlacementData;
      if (arrowData && isVisibleMotion(motionData)) {
        const calculatedLocation = arrowLocationCalculator.calculateLocation(
          motionData,
          updatedPictograph
        );

        const [x, y, rotation] = await calculateArrowPoint(
          updatedPictograph,
          motionData
        );

        const currentMotionData =
          updatedPictograph.motions[
            color as keyof typeof updatedPictograph.motions
          ];
        const shouldMirror = shouldMirrorArrow(
          arrowData,
          updatedPictograph,
          currentMotionData
        );

        const manualAdjustX = arrowData.manualAdjustmentX || 0;
        const manualAdjustY = arrowData.manualAdjustmentY || 0;

        const updates: Partial<ArrowPlacementData> = {
          positionX: x + manualAdjustX,
          positionY: y + manualAdjustY,
          rotationAngle: rotation,
          svgMirrored: shouldMirror,
          manualAdjustmentX: manualAdjustX,
          manualAdjustmentY: manualAdjustY,
        };

        const motionUpdates = {
          arrowLocation: calculatedLocation,
        } as unknown as Partial<MotionData>;

        updatedPictograph = updateArrowInPictograph(
          updatedPictograph,
          color,
          updates,
          motionUpdates
        );
      }
    }

    return updatedPictograph;
  } catch (error) {
    console.error("Failed to calculate all arrow positions:", error);
    return pictographData;
  }
}

export function shouldMirrorArrow(
  _arrowData: ArrowPlacementData,
  pictographData?: PictographData,
  motionData?: MotionData
): boolean {
  if (!pictographData?.motions || !motionData) {
    return false;
  }

  const motionType = motionData.motionType.toLowerCase();
  const propRotDir = motionData.rotationDirection.toLowerCase();

  if (!motionType || !propRotDir) {
    return false;
  }

  const mirrorConditions = {
    anti: { cw: true, ccw: false },
    other: { cw: false, ccw: true },
  };

  const conditionKey = motionType === "anti" ? "anti" : "other";
  const shouldMirror =
    mirrorConditions[conditionKey][
      propRotDir as keyof typeof mirrorConditions.anti
    ] ?? false;

  return shouldMirror;
}

export function applyMirrorTransform(
  arrowItem: HTMLElement | SVGElement,
  shouldMirror: boolean
): void {
  if (shouldMirror) {
    arrowItem.style.transform = `${arrowItem.style.transform || ""} scaleX(-1)`;
  } else {
    const transform = arrowItem.style.transform || "";
    arrowItem.style.transform = transform
      .replace(/scaleX\(-1\)\s*/g, "")
      .trim();
  }
}
