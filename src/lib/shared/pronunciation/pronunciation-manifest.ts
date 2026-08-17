import {
  PRONUNCIATION_POSITIONS,
  type AnyPronunciationManifest,
  type PronunciationManifest,
  type PronunciationToken,
  type PronunciationTokenBank,
} from "./pronunciation-plan";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPosition(value: unknown): boolean {
  return PRONUNCIATION_POSITIONS.includes(
    value as (typeof PRONUNCIATION_POSITIONS)[number]
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNullableLetter(value: unknown): boolean {
  return value === null || isNonEmptyString(value);
}

export function isPronunciationManifestV1(
  value: unknown
): value is PronunciationManifest {
  if (!isObject(value) || value.version !== 1 || !isObject(value.recordings)) {
    return false;
  }

  return Object.values(value.recordings).every((recordingSet) => {
    if (!isObject(recordingSet)) return false;
    return Object.entries(recordingSet).every(
      ([position, path]) => isPosition(position) && isNonEmptyString(path)
    );
  });
}

function isToken(value: unknown): value is PronunciationToken {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.path) &&
    isPosition(value.position) &&
    isNullableLetter(value.previousLetter) &&
    isNullableLetter(value.nextLetter) &&
    typeof value.sourceWord === "string" &&
    isFiniteNumber(value.indexInWord) &&
    isFiniteNumber(value.wordLength) &&
    isFiniteNumber(value.durationMs) &&
    isFiniteNumber(value.rmsDb) &&
    isFiniteNumber(value.f0StartHz) &&
    isFiniteNumber(value.f0EndHz)
  );
}

export function isPronunciationTokenBank(
  value: unknown
): value is PronunciationTokenBank {
  if (!isObject(value) || value.version !== 2 || !isObject(value.tokens)) {
    return false;
  }

  return Object.values(value.tokens).every(
    (tokens) => Array.isArray(tokens) && tokens.every(isToken)
  );
}

/**
 * Parse either manifest format. Returning null keeps a malformed manifest from
 * silently degrading playback into a half-loaded bank; the player falls through
 * to speech synthesis instead.
 */
export function parsePronunciationManifest(
  value: unknown
): AnyPronunciationManifest | null {
  if (isPronunciationTokenBank(value)) return value;
  if (isPronunciationManifestV1(value)) return value;
  return null;
}
