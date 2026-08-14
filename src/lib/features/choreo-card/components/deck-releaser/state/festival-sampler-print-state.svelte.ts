import type { DeckReleaserSessionStorage } from "./deck-releaser-session";

const FESTIVAL_PACK_COUNT_KEY = "deckReleaser.festivalSampler.packCount";
const DEFAULT_PACK_COUNT = 60;

export function normalizeFestivalPackCount(
  value: number,
  maxPackCount = DEFAULT_PACK_COUNT
): number {
  const fallback = Math.min(DEFAULT_PACK_COUNT, maxPackCount);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maxPackCount, Math.max(1, Math.round(value)));
}

function loadPackCount(
  storage: DeckReleaserSessionStorage,
  maxPackCount: number
): number {
  if (!storage) return Math.min(DEFAULT_PACK_COUNT, maxPackCount);
  try {
    const saved = storage.getItem(FESTIVAL_PACK_COUNT_KEY);
    return saved === null
      ? Math.min(DEFAULT_PACK_COUNT, maxPackCount)
      : normalizeFestivalPackCount(Number(saved), maxPackCount);
  } catch {
    return Math.min(DEFAULT_PACK_COUNT, maxPackCount);
  }
}

export function createFestivalSamplerPrintState(
  storage: DeckReleaserSessionStorage,
  maxPackCount = DEFAULT_PACK_COUNT
) {
  let packCount = $state(loadPackCount(storage, maxPackCount));

  return {
    get packCount() {
      return packCount;
    },
    set packCount(value: number) {
      packCount = normalizeFestivalPackCount(value, maxPackCount);
      try {
        storage?.setItem(FESTIVAL_PACK_COUNT_KEY, String(packCount));
      } catch {
        // The print job still works when preference storage is unavailable.
      }
    },
  };
}
