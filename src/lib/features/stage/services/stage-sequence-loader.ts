import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { loadStaticSequence } from "$lib/shared/foundation/services/static-sequence-catalog";
import { loadByIdentifier } from "$lib/shared/sequence-viewer/services/sequence-data-provider";

export const DEFAULT_STAGE_SEQUENCE_ID = "tnd-quarter-opp-mpmp";
export const DEFAULT_STAGE_SEQUENCE_CATALOG = "/data/hero/tnd-base-words.json";

export async function loadStageSequence(
  sequenceId: string,
  fetcher: typeof fetch = fetch
): Promise<SequenceData> {
  if (sequenceId === DEFAULT_STAGE_SEQUENCE_ID) {
    return loadStaticSequence(
      DEFAULT_STAGE_SEQUENCE_CATALOG,
      sequenceId,
      fetcher
    );
  }

  const sequence = await loadByIdentifier(sequenceId);
  if (!sequence) {
    throw new Error(`Sequence ${sequenceId} could not be resolved`);
  }
  return sequence;
}
