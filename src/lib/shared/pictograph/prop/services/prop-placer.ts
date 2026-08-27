/**
 * Prop Placement Service
 *
 * Dedicated service for calculating prop placement data.
 * Follows separation of concerns by focusing only on placement calculations.
 * Returns PropPlacementData that can be attached to PropPlacementData.
 */

import { GridMode } from "../../grid/domain/enums/grid-enums";
import { deriveGridMode as _deriveGridMode } from "../../grid/services/grid-mode-deriver";
import { MotionColor } from "../../shared/domain/enums/pictograph-enums";
import {
  isVisibleMotion,
  type MotionData,
} from "../../shared/domain/models/motion-data";
import type { PictographData } from "../../shared/domain/models/pictograph-data";
import { pictographRequiresStrictHandpoints } from "../domain/enums/prop-classification";

// Settings interface for Node.js contexts where getSettings() isn't available
interface PropPlacerSettings {
  bluePropType?: string;
  redPropType?: string;
  blueBuugengFlipped?: boolean;
  redBuugengFlipped?: boolean;
}

import { createPropPlacementFromPosition } from "../domain/factories/create-prop-placement-data";
// Removed: import { getSettings } from app-state.svelte
// That import chain pulls in Firebase auth → window access → crashes in Web Workers.
// Callers pass settings via constructor or motion data; STAFF is the safe default.
import type { PropPlacementData } from "../domain/models/prop-placement-data";
import type { BetaDetector } from "./beta-detector";
import type { PropPlacementVisibility } from "./types";
import DefaultPropPositioner from "./default-prop-positioner";
import { PropRotAngleManager } from "./prop-rot-angle-manager";
import {
  calculateBetaOffset,
  type BetaOffsetInput,
  type BetaMotionInput,
} from "$lib/shared/render/core/calculations/beta-offset";

export class PropPlacer {
  constructor(
    private BetaDetector: BetaDetector,
    private settings?: PropPlacerSettings
  ) {}

  async calculatePlacement(
    pictographData: PictographData,
    motionData: MotionData,
    visibility?: PropPlacementVisibility,
    propSettings?: PropPlacerSettings
  ): Promise<PropPlacementData> {
    // DEBUG: Log motion data

    // Derive gridMode from both motions when available. For single-motion pictographs
    // (e.g. orientation explainer, start position), use the pictograph's explicit gridMode
    // before falling back to DIAMOND.
    const gridMode =
      pictographData.motions.blue && pictographData.motions.red
        ? _deriveGridMode(
            pictographData.motions.blue,
            pictographData.motions.red
          )
        : pictographData.gridMode ?? GridMode.DIAMOND;

    const position = await this.calculatePosition(
      pictographData,
      motionData,
      gridMode,
      visibility,
      propSettings
    );

    // IMPORTANT: Hands should never rotate - always use default orientation (0 degrees)
    const rotation =
      motionData.propType === "hand"
        ? 0
        : PropRotAngleManager.calculateRotation(
            motionData.endLocation,
            motionData.endOrientation,
            gridMode
          );

    return createPropPlacementFromPosition(position.x, position.y, rotation);
  }

  private async calculatePosition(
    pictographData: PictographData,
    motionData: MotionData,
    gridMode: GridMode,
    visibility?: PropPlacementVisibility,
    propSettings?: PropPlacerSettings
  ): Promise<{ x: number; y: number }> {
    // Determine if strict handpoints are needed (large props like bighoop)
    // Legacy: pictograph_checker.has_strict_placed_props() - true when BOTH props are strict types
    const resolvedSettings = propSettings ?? this.settings ?? {
      bluePropType: pictographData.motions.blue?.propType ?? "staff",
      redPropType: pictographData.motions.red?.propType ?? "staff",
    };
    const bluePropType =
      resolvedSettings.bluePropType ??
      pictographData.motions.blue?.propType ??
      "staff";
    const redPropType =
      resolvedSettings.redPropType ??
      pictographData.motions.red?.propType ??
      "staff";
    const useStrict = pictographRequiresStrictHandpoints(
      bluePropType,
      redPropType
    );

    // Calculate base position from motion data (not from existing propPlacementData)
    const basePosition = DefaultPropPositioner.calculatePosition(
      motionData.endLocation,
      gridMode,
      useStrict
    );

    // Apply beta offset if this is a beta position
    const betaOffset = await this.calculateBetaOffset(
      pictographData,
      motionData,
      gridMode,
      visibility,
      propSettings
    );

    return {
      x: basePosition.x + betaOffset.x,
      y: basePosition.y + betaOffset.y,
    };
  }

  private async calculateBetaOffset(
    pictographData: PictographData,
    motionData: MotionData,
    gridMode: GridMode,
    visibility?: PropPlacementVisibility,
    propSettings?: PropPlacerSettings
  ): Promise<{ x: number; y: number }> {
    // If this prop's partner is hidden, there is no collision - skip offset.
    // Beta offset exists purely to separate two overlapping props; with one
    // hidden the remaining prop should snap back to the default hand point.
    const thisIsBlue = motionData.color === MotionColor.BLUE;
    const partnerHidden = thisIsBlue
      ? visibility?.showRed === false
      : visibility?.showBlue === false;
    if (partnerHidden) {
      return { x: 0, y: 0 };
    }

    // App-specific check: does this pictograph end in a beta position?
    const needsBetaOffset = this.BetaDetector.endsWithBeta(pictographData);

    if (!needsBetaOffset) {
      return { x: 0, y: 0 };
    }

    const redMotion = pictographData.motions.red;
    const blueMotion = pictographData.motions.blue;

    // invisible placeholder = hand not really there (both-required Step shape)
    if (!isVisibleMotion(redMotion) || !isVisibleMotion(blueMotion)) {
      return { x: 0, y: 0 };
    }

    // App-specific: resolve actual prop types from user settings
    // (user may have "staff" stored in data but render as "club"/"buugeng" via settings).
    // Per-call propSettings wins because the in-app singleton carries no settings —
    // without this the beta calc falls back to the stored "staff" type and the
    // unilateral-skip in render-core never fires for club/fan/etc.
    const settings = propSettings ?? this.settings ?? {
      bluePropType: blueMotion.propType ?? "staff",
      redPropType: redMotion.propType ?? "staff",
    };

    // Build the render-core input objects
    const blueMotionInput: BetaMotionInput = {
      startLocation: blueMotion.startLocation,
      endLocation: blueMotion.endLocation,
      endOrientation: blueMotion.endOrientation,
      motionType: blueMotion.motionType,
      color: "blue",
      propType: blueMotion.propType,
    };

    const redMotionInput: BetaMotionInput = {
      startLocation: redMotion.startLocation,
      endLocation: redMotion.endLocation,
      endOrientation: redMotion.endOrientation,
      motionType: redMotion.motionType,
      color: "red",
      propType: redMotion.propType,
    };

    const targetMotionInput: BetaMotionInput =
      motionData.color === MotionColor.BLUE ? blueMotionInput : redMotionInput;

    // Determine gridMode string for render-core ("diamond" | "box" | "skewed")
    // GridMode enum values are the same strings, so a direct cast works.
    const gridModeStr = gridMode as unknown as "diamond" | "box" | "skewed";

    const input: BetaOffsetInput = {
      blueMotion: blueMotionInput,
      redMotion: redMotionInput,
      letter: pictographData.letter || "",
      gridMode: gridModeStr,
      bluePropType: settings.bluePropType,
      redPropType: settings.redPropType,
      blueBuugengFlipped: settings.blueBuugengFlipped,
      redBuugengFlipped: settings.redBuugengFlipped,
    };

    const offset = calculateBetaOffset(input, targetMotionInput);

    if (pictographData.betaSwapped) {
      return { x: -offset.x, y: -offset.y };
    }

    return offset;
  }
}

// Use this instead of propPlacer to avoid DI container rebuilds.

import { betaDetector } from "./beta-detector";

export const propPlacer = new PropPlacer(betaDetector);
