import { BackgroundType } from "@austencloud/backgrounds";

type BackgroundTypeCompatibility = {
  readonly PRIDE?: BackgroundType;
  readonly RAINBOW?: BackgroundType;
};

/**
 * A running development tab can briefly retain the previous optimized
 * backgrounds bundle after the dependency has been upgraded. That bundle calls
 * this environment Rainbow; the current package calls it Pride. Resolve the
 * name the loaded package actually understands so opening Settings still works
 * while Vite catches up.
 */
export function resolvePrideBackgroundType(
  backgroundTypes: BackgroundTypeCompatibility
): BackgroundType {
  return (
    backgroundTypes.PRIDE ??
    backgroundTypes.RAINBOW ??
    ("pride" as BackgroundType)
  );
}

export const PRIDE_BACKGROUND_TYPE = resolvePrideBackgroundType(
  BackgroundType as BackgroundTypeCompatibility
);

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
  rainbow: PRIDE_BACKGROUND_TYPE,
  pride: PRIDE_BACKGROUND_TYPE,
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
