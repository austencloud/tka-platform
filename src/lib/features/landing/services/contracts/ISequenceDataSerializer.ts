import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { GenerationSettings } from "../../domain/models/spinner-models";

export interface ISequenceDataSerializer {
  toCompactDebug(sequence: SequenceData, settings?: GenerationSettings | null): string;
  toFullJson(sequence: SequenceData, settings?: GenerationSettings | null): string;
}
