import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { PictographVisibilityOptions } from "$lib/shared/render/utils/pictograph-to-svg";
import { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
// getSettings loaded dynamically to avoid pulling $app/environment into worker bundle

interface MotionKeyData {
  motionType: string;
  startLocation: string;
  endLocation: string;
  turns: number | string;
  startOrientation: string;
  endOrientation: string;
  rotationDirection: string;
  propType: string;
  gridMode: string;
}

interface PictographKeyInput {
  letter: string | undefined;
  blue: MotionKeyData | null;
  red: MotionKeyData | null;
  visibility: {
    showTKA: boolean;
    showTnD: boolean;
    showElemental: boolean;
    showPositions: boolean;
    showReversals: boolean;
    showNonRadialPoints: boolean;
    showGrid: boolean;
    darkMode: boolean;
    bluePropType: string | undefined;
    redPropType: string | undefined;
    handPathMode: boolean;
    handPointVisibility: string;
    printMode: boolean;
    showBlueMotion: boolean;
    showRedMotion: boolean;
  };
}

export class PictographKeyHasher {
  deriveKey(
    data: StepData | PictographData,
    visibility: PictographVisibilityOptions
  ): string {
    const input = this.buildKeyInput(data, visibility);
    return JSON.stringify(input, this.sortedReplacer);
  }

  private buildKeyInput(
    data: StepData | PictographData,
    visibility: PictographVisibilityOptions
  ): PictographKeyInput {
    const motions = data.motions ?? { blue: undefined, red: undefined };

    // Callers (ImageComposer.getVisibilitySettings) always resolve prop types before
    // calling deriveKey, so visibility.bluePropType/redPropType are always set.
    // Default to "staff" for safety. Previously this called getSettings() which pulled
    // $app/environment into the worker bundle via the static import chain.
    const resolvedBlueProp = visibility.bluePropType ?? "staff";
    const resolvedRedProp = visibility.redPropType ?? "staff";

    return {
      letter: data.letter ?? undefined,
      blue: this.extractMotionKey(motions.blue),
      red: this.extractMotionKey(motions.red),
      visibility: {
        showTKA: visibility.showTKA ?? true,
        showTnD: visibility.showTnD ?? false,
        showElemental: visibility.showElemental ?? false,
        showPositions: visibility.showPositions ?? false,
        showReversals: visibility.showReversals ?? true,
        showNonRadialPoints: visibility.showNonRadialPoints ?? true,
        showGrid: visibility.showGrid ?? true,
        darkMode: visibility.darkMode ?? false,
        bluePropType: resolvedBlueProp,
        redPropType: resolvedRedProp,
        handPathMode: visibility.handPathMode ?? false,
        handPointVisibility: visibility.handPointVisibility ?? "all",
        printMode: visibility.printMode ?? false,
        showBlueMotion: visibility.showBlueMotion ?? true,
        showRedMotion: visibility.showRedMotion ?? true,
      },
    };
  }

  private extractMotionKey(motion: MotionData | undefined): MotionKeyData | null {
    if (!motion) return null;

    const derivedGridMode = this.deriveGridModeFromLocations(
      motion.startLocation,
      motion.endLocation
    );

    return {
      motionType: motion.motionType ?? "",
      startLocation: motion.startLocation ?? "",
      endLocation: motion.endLocation ?? "",
      turns: motion.turns ?? 0,
      startOrientation: motion.startOrientation ?? "",
      endOrientation: motion.endOrientation ?? "",
      rotationDirection: motion.rotationDirection ?? "",
      propType: motion.propType ?? "staff",
      gridMode: derivedGridMode,
    };
  }

  private deriveGridModeFromLocations(
    startLocation: GridLocation | undefined,
    endLocation: GridLocation | undefined
  ): string {
    const intercardinalLocations: GridLocation[] = [
      GridLocation.NORTHEAST,
      GridLocation.SOUTHEAST,
      GridLocation.SOUTHWEST,
      GridLocation.NORTHWEST,
    ];

    if (
      (startLocation && intercardinalLocations.includes(startLocation)) ||
      (endLocation && intercardinalLocations.includes(endLocation))
    ) {
      return GridMode.BOX;
    }

    return GridMode.DIAMOND;
  }

  private sortedReplacer = (_key: string, value: unknown): unknown => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce(
          (sorted, key) => {
            sorted[key] = (value as Record<string, unknown>)[key];
            return sorted;
          },
          {} as Record<string, unknown>
        );
    }
    return value;
  };
}

export const pictographKeyHasher = new PictographKeyHasher();
