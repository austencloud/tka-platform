import { BackgroundType } from "@austencloud/backgrounds";

const LEGACY_BACKGROUND_TYPES: Readonly<Record<string, BackgroundType>> = {
  nightSky: BackgroundType.COSMIC,
  deepOcean: BackgroundType.OCEAN,
  fireflyForest: BackgroundType.FOREST,
  cherryBlossom: BackgroundType.BLOSSOM,
  emberGlow: BackgroundType.EMBER,
  snowfall: BackgroundType.WINTER,
  autumnDrift: BackgroundType.AUTUMN,
  pureBlack: BackgroundType.VOID,
  solidColor: BackgroundType.VOID,
  linearGradient: BackgroundType.COSMIC,
  rainbow: BackgroundType.PRIDE,
};

const CURRENT_BACKGROUND_TYPES = new Set<string>(Object.values(BackgroundType));

/**
 * Converts persisted background identifiers to the current package enum.
 * Unknown values stay undefined so callers can apply their own fallback.
 */
export function normalizeBackgroundType(
  value: unknown
): BackgroundType | undefined {
  if (typeof value !== "string") return undefined;

  return (
    LEGACY_BACKGROUND_TYPES[value] ??
    (CURRENT_BACKGROUND_TYPES.has(value)
      ? (value as BackgroundType)
      : undefined)
  );
}
