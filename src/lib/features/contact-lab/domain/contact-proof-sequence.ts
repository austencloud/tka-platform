import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

export const CONTACT_PROOF_SEQUENCE_ID = "tnd-quarter-opp-mpmp";
export const CONTACT_PROOF_SEQUENCE_URL = "/data/hero/tnd-base-words.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasMotionPair(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value["motions"])) return false;
  const motions = value["motions"];
  return isRecord(motions["blue"]) && isRecord(motions["red"]);
}

/**
 * The proof route reads the same catalog entry used elsewhere in TKA. If that
 * entry changes shape or disappears, the proof stops instead of quietly
 * substituting a hand-authored imitation.
 */
export function selectContactProofSequence(
  payload: unknown
): SequenceData | null {
  if (!Array.isArray(payload)) return null;
  const candidate = payload.find(
    (entry) => isRecord(entry) && entry["id"] === CONTACT_PROOF_SEQUENCE_ID
  );
  if (!isRecord(candidate) || !Array.isArray(candidate["steps"])) return null;
  if (
    candidate["steps"].length === 0 ||
    !candidate["steps"].every(hasMotionPair)
  ) {
    return null;
  }
  return candidate as unknown as SequenceData;
}

export async function loadContactProofSequence(
  fetcher: typeof fetch = fetch
): Promise<SequenceData> {
  const response = await fetcher(CONTACT_PROOF_SEQUENCE_URL);
  if (!response.ok) {
    throw new Error(`Contact proof catalog returned ${response.status}`);
  }
  const sequence = selectContactProofSequence(await response.json());
  if (!sequence) {
    throw new Error(
      `Contact proof sequence ${CONTACT_PROOF_SEQUENCE_ID} is missing or malformed`
    );
  }
  return sequence;
}
