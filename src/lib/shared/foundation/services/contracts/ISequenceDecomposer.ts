import type { SequenceData } from "../../domain/models/SequenceData";
import type { SoloPropData } from "../../domain/models/SoloPropData";
import type { StepPairingData } from "../../domain/models/StepPairingData";

export interface ISequenceDecomposer {
  extractBlueSoloProp(sequence: SequenceData): SoloPropData;
  extractRedSoloProp(sequence: SequenceData): SoloPropData;
  extractStepPairings(sequence: SequenceData): readonly StepPairingData[];
}
