import type { DeckReleaserSessionStorage } from "./deck-releaser-session";

const FESTIVAL_PACK_COUNT_KEY = "deckReleaser.festivalSampler.packCount";
const DEFAULT_PACK_COUNT = 60;
const MAX_PACK_COUNT = 200;

export function normalizeFestivalPackCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PACK_COUNT;
  return Math.min(MAX_PACK_COUNT, Math.max(1, Math.round(value)));
}

function loadPackCount(storage: DeckReleaserSessionStorage): number {
  if (!storage) return DEFAULT_PACK_COUNT;
  try {
    const saved = storage.getItem(FESTIVAL_PACK_COUNT_KEY);
    return saved === null
      ? DEFAULT_PACK_COUNT
      : normalizeFestivalPackCount(Number(saved));
  } catch {
    return DEFAULT_PACK_COUNT;
  }
}

export function createFestivalSamplerPrintState(
  storage: DeckReleaserSessionStorage
) {
  let packCount = $state(loadPackCount(storage));

  return {
    get packCount() {
      return packCount;
    },
    set packCount(value: number) {
      packCount = normalizeFestivalPackCount(value);
      try {
        storage?.setItem(FESTIVAL_PACK_COUNT_KEY, String(packCount));
      } catch {
        // The print job still works when preference storage is unavailable.
      }
    },
  };
}
