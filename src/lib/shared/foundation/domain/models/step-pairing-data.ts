import type { Letter } from "./letter";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface StepPairingData {
  readonly letter: Letter | null;
  readonly leftReversal: boolean;
  readonly rightReversal: boolean;
  readonly startPosition: GridPosition | null;
  readonly endPosition: GridPosition | null;
  // Duration is NOT stored here - derived from solo prop steps
  // Blue's duration is authoritative when combining
}
