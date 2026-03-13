import type { SoloPropData } from "../../domain/models/SoloPropData";
import type { StepPairingData } from "../../domain/models/StepPairingData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export interface ViewerPreferences {
  readonly propType: PropType;
}

export interface IStepDeriver {
  /**
   * Rehydrates StepData[] from a pair of SoloPropData objects and their
   * per-beat pairing metadata (letter, positions, reversals).
   *
   * Blue is authoritative for duration when the two props disagree.
   * Each returned StepData is 1-indexed (stepNumber starts at 1).
   */
  deriveSteps(
    blueSoloProp: SoloPropData,
    redSoloProp: SoloPropData,
    stepPairings: readonly StepPairingData[],
    viewerPrefs?: ViewerPreferences
  ): StepData[];

  /**
   * Builds a StartPositionData from the initial state of both solo props.
   * The start position reflects where the props rest before beat 1.
   */
  deriveStartPosition(
    blueSoloProp: SoloPropData,
    redSoloProp: SoloPropData
  ): StartPositionData;
}
