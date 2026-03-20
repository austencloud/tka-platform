import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface IArtifactExtractor {
  extract(sequence: SequenceData, userId: string): Promise<void>;
}
