import {
  normalizeLegacyHandPair,
  normalizeLegacyPropConfig,
} from "@tka/tka-types";
import type {
  DeckRelease,
  DeckReleaseCard,
  DeckRecipe,
} from "./models/DeckRelease";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeDeckReleaseCard(
  value: DeckReleaseCard
): DeckReleaseCard {
  if (!value.variation?.startOriPair) return value;
  return {
    ...value,
    variation: {
      ...value.variation,
      startOriPair: normalizeLegacyHandPair(value.variation.startOriPair),
    },
  };
}

function normalizeDeckRecipe(value: DeckRecipe): DeckRecipe {
  const source = value as DeckRecipe & UnknownRecord;
  const normalized: DeckRecipe & UnknownRecord = { ...source };
  normalized.startOriLeft ??= source.startOriBlue as string | undefined;
  normalized.startOriRight ??= source.startOriRed as string | undefined;
  delete normalized.startOriBlue;
  delete normalized.startOriRed;
  return normalized;
}

/** Read-time compatibility for deck manifests already stored in Firestore. */
export function normalizeDeckRelease(value: DeckRelease): DeckRelease {
  if (!isRecord(value)) return value;
  const propConfig = normalizeLegacyPropConfig(value);
  return {
    ...propConfig,
    ...(value.recipe && { recipe: normalizeDeckRecipe(value.recipe) }),
    sequences: Array.isArray(value.sequences)
      ? value.sequences.map(normalizeDeckReleaseCard)
      : [],
  };
}
