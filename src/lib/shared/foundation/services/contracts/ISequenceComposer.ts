import type { SoloPropData } from "../../domain/models/SoloPropData";
import type { SequenceData } from "../../domain/models/SequenceData";

export interface ISequenceComposer {
  combine(
    assignments: { blue: SoloPropData; red: SoloPropData },
    metadata?: { name?: string; author?: string; notes?: string }
  ): SequenceData;
}
