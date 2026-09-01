import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { SaveResult } from "$lib/shared/library/domain/library-contract-types";

export type VisualSequencePathShape = "arc" | "linear" | "concave";

export interface VisualSequenceSaveIntent {
  leftPropType?: string | null;
  rightPropType?: string | null;
  catDogModeEnabled?: boolean | null;
  pathShape?: VisualSequencePathShape;
}

export type VisualSequenceSaveOutcome =
  | {
      status: "saved";
      contentHash: string;
      sequence: SequenceData;
      result: SaveResult;
    }
  | {
      status: "already-saved";
      contentHash: string;
      sequence: SequenceData;
    }
  | {
      status: "failed";
      error: unknown;
    };

export interface IVisualSequenceSaveCoordinator {
  save(
    sequence: SequenceData,
    intent?: VisualSequenceSaveIntent
  ): Promise<VisualSequenceSaveOutcome>;
}
