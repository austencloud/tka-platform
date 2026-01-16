/**
 * Hand Path Assemble State
 *
 * Svelte 5 reactive state management for the simplified tap-based hand path assembly.
 * Manages the three-phase construction flow:
 * 1. Blue hand construction (tap positions)
 * 2. Red hand construction (tap positions)
 * 3. Rotation selection (choose CW or CCW for SHIFT motions)
 */

import type {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  RotationDirection,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { HandPathSequenceConverter } from "../services/HandPathSequenceConverter";
import { HandPathMotionCalculator } from "../services/HandPathMotionCalculator";

export type HandPathPhase = "blue" | "red" | "rotation-selection" | "complete";

export interface HandPathAssembleConfig {
  gridMode: GridMode;
  startingPosition?: GridLocation; // Optional: first tap sets this
  // Note: PropType is always HAND in hand path assembly mode

  // Optional: Initialize with existing path data (for restoring state after tab switch)
  initialBlueHandPath?: GridLocation[];
  initialRedHandPath?: GridLocation[];
  initialPhase?: HandPathPhase;
}

/**
 * Create hand path assemble state
 */
export function createHandPathAssembleState(config: HandPathAssembleConfig) {
  // Services
  const converter = new HandPathSequenceConverter();
  const calculator = new HandPathMotionCalculator();

  // Reactive state - initialize from config if restoring from existing data
  let currentPhase = $state<HandPathPhase>(config.initialPhase ?? "blue");
  let blueHandPath = $state<GridLocation[]>(config.initialBlueHandPath ?? []);
  let redHandPath = $state<GridLocation[]>(config.initialRedHandPath ?? []);
  let currentPosition = $state<GridLocation | null>(
    // Set current position to last position in the active path
    config.initialPhase === "red"
      ? (config.initialRedHandPath?.[config.initialRedHandPath.length - 1] ??
          null)
      : (config.initialBlueHandPath?.[config.initialBlueHandPath.length - 1] ??
          null)
  );
  let selectedRotation = $state<RotationDirection | null>(null);
  let gridMode = $state<GridMode>(config.gridMode);
  // PropType is always HAND in hand path assembly mode (forced in converter)

  // Derived state
  const currentStepNumber = $derived(
    currentPhase === "blue" ? blueHandPath.length : redHandPath.length
  );

  const hasBlueHand = $derived(blueHandPath.length > 0);
  const hasRedHand = $derived(redHandPath.length > 0);
  const canSelectRotation = $derived(hasBlueHand && hasRedHand);
  const isComplete = $derived(currentPhase === "complete");

  const activePositions = $derived(calculator.getActivePositions(gridMode));

  /**
   * Add a position to the current hand path
   */
  function addPosition(position: GridLocation): void {
    // Validate position is enabled for current grid mode
    if (!calculator.isPositionEnabled(position, gridMode)) {
      throw new Error(
        `Position ${position} is not enabled in ${gridMode} mode`
      );
    }

    if (currentPhase === "blue") {
      blueHandPath = [...blueHandPath, position];
      currentPosition = position;
    } else if (currentPhase === "red") {
      redHandPath = [...redHandPath, position];
      currentPosition = position;
    } else {
      throw new Error(`Cannot add position in phase: ${currentPhase}`);
    }
  }

  /**
   * Complete the blue hand and move to red hand phase
   */
  function completeBlueHand(): void {
    if (blueHandPath.length < 2) {
      throw new Error(
        "Blue hand must have at least 2 positions (start + 1 move)"
      );
    }

    currentPhase = "red";
    currentPosition = null; // Reset for red hand
  }

  /**
   * Complete the red hand and move to rotation selection
   */
  function completeRedHand(): void {
    if (redHandPath.length < 2) {
      throw new Error(
        "Red hand must have at least 2 positions (start + 1 move)"
      );
    }

    // Validate both hands are same length
    if (blueHandPath.length !== redHandPath.length) {
      throw new Error(
        `Both hands must be the same length. Blue: ${blueHandPath.length}, Red: ${redHandPath.length}`
      );
    }

    currentPhase = "rotation-selection";
  }

  /**
   * Select rotation direction and complete the sequence
   */
  function selectRotation(rotation: RotationDirection): void {
    if (currentPhase !== "rotation-selection") {
      throw new Error("Can only select rotation in rotation-selection phase");
    }

    if (
      rotation !== RotationDirection.CLOCKWISE &&
      rotation !== RotationDirection.COUNTER_CLOCKWISE
    ) {
      throw new Error("Must select CLOCKWISE or COUNTER_CLOCKWISE rotation");
    }

    selectedRotation = rotation;
    currentPhase = "complete";
  }

  /**
   * Get the final merged sequence (only available when complete)
   * @param bluePropType - User's selected prop type for blue hand (defaults to HAND)
   * @param redPropType - User's selected prop type for red hand (defaults to HAND)
   */
  function getFinalSequence(
    bluePropType: PropType = PropType.HAND,
    redPropType: PropType = PropType.HAND
  ): PictographData[] {
    if (!selectedRotation) {
      throw new Error("Must select rotation before getting final sequence");
    }

    if (blueHandPath.length === 0 || redHandPath.length === 0) {
      throw new Error("Both blue and red hands must be built");
    }

    // First create sequence with HAND prop type
    const handSequence = converter.mergeToDualPropSequence(
      blueHandPath,
      redHandPath,
      selectedRotation,
      gridMode
    );

    // Then apply user's selected prop types
    return converter.applyUserPropTypes(
      handSequence,
      bluePropType,
      redPropType
    );
  }

  /**
   * Get preview of current hand as pictographs
   * IMPORTANT: When in red phase, shows ALL blue steps with red overlaid progressively.
   * This ensures blue steps don't disappear while building the red hand.
   */
  function getCurrentHandPreview(): PictographData[] {
    if (currentPhase === "blue" && blueHandPath.length >= 2) {
      // Show only blue hand during blue phase
      return converter.convertHandPathToPictographs(
        blueHandPath,
        MotionColor.BLUE,
        RotationDirection.CLOCKWISE, // Temporary rotation for preview
        gridMode
      );
    } else if (currentPhase === "red" && blueHandPath.length >= 2) {
      // Show ALL blue steps, with red overlaid where available
      const allBlueBeats = converter.convertHandPathToPictographs(
        blueHandPath,
        MotionColor.BLUE,
        RotationDirection.CLOCKWISE,
        gridMode
      );

      if (redHandPath.length >= 2) {
        // Convert red hand path to pictographs
        const redBeats = converter.convertHandPathToPictographs(
          redHandPath,
          MotionColor.RED,
          RotationDirection.CLOCKWISE,
          gridMode
        );

        // Merge red motions into blue pictographs progressively
        return allBlueBeats.map((bluePictograph, index) => {
          if (index < redBeats.length) {
            const redPictograph = redBeats[index];
            // Merge both hands into one pictograph
            return {
              ...bluePictograph,
              motions: {
                ...bluePictograph.motions,
                [MotionColor.RED]: redPictograph?.motions?.[MotionColor.RED],
              },
            } as PictographData;
          }
          // Return blue-only for steps not yet constructed with red
          return bluePictograph;
        });
      }

      // Show all blue steps while red hand is being started
      return allBlueBeats;
    }

    return [];
  }

  /**
   * Remove last position from current hand (undo)
   */
  function undoLastPosition(): void {
    if (currentPhase === "blue" && blueHandPath.length > 0) {
      blueHandPath = blueHandPath.slice(0, -1);
      currentPosition = blueHandPath[blueHandPath.length - 1] || null;
    } else if (currentPhase === "red" && redHandPath.length > 0) {
      redHandPath = redHandPath.slice(0, -1);
      currentPosition = redHandPath[redHandPath.length - 1] || null;
    }
  }

  /**
   * Reset to initial state
   */
  function reset(): void {
    currentPhase = "blue";
    currentPosition = null;
    blueHandPath = [];
    redHandPath = [];
    selectedRotation = null;
  }

  /**
   * Update grid mode (resets state)
   */
  function updateGridMode(newGridMode: GridMode): void {
    gridMode = newGridMode;
    reset();
  }

  /**
   * Go back to previous phase
   */
  function goBackPhase(): void {
    if (currentPhase === "red") {
      currentPhase = "blue";
      currentPosition = blueHandPath[blueHandPath.length - 1] || null;
      // Clear red hand when going back
      redHandPath = [];
    } else if (currentPhase === "rotation-selection") {
      currentPhase = "red";
      currentPosition = redHandPath[redHandPath.length - 1] || null;
      selectedRotation = null;
    } else if (currentPhase === "complete") {
      currentPhase = "rotation-selection";
      selectedRotation = null;
    }
  }

  // Return reactive state object
  return {
    // Getters for reactive state
    get currentPhase() {
      return currentPhase;
    },
    get currentPosition() {
      return currentPosition;
    },
    get blueHandPath() {
      return blueHandPath;
    },
    get redHandPath() {
      return redHandPath;
    },
    get selectedRotation() {
      return selectedRotation;
    },
    get gridMode() {
      return gridMode;
    },

    // Derived state
    get currentStepNumber() {
      return currentStepNumber;
    },
    get hasBlueHand() {
      return hasBlueHand;
    },
    get hasRedHand() {
      return hasRedHand;
    },
    get canSelectRotation() {
      return canSelectRotation;
    },
    get isComplete() {
      return isComplete;
    },
    get activePositions() {
      return activePositions;
    },

    // Actions
    addPosition,
    completeBlueHand,
    completeRedHand,
    selectRotation,
    getFinalSequence,
    getCurrentHandPreview,
    undoLastPosition,
    reset,
    updateGridMode,
    goBackPhase,
  };
}

export type HandPathAssembleState = ReturnType<
  typeof createHandPathAssembleState
>;
