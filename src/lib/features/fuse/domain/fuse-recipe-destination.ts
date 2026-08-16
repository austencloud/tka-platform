export const FUSE_RECIPE_DESTINATIONS = [
  "length",
  "level",
  "grid",
  "style",
  "starting",
  "pairing",
] as const;

export type FuseRecipeDestination = (typeof FUSE_RECIPE_DESTINATIONS)[number];

export type FuseSettingsDestination = FuseRecipeDestination | null;

export function isFuseRecipeDestination(
  value: string
): value is FuseRecipeDestination {
  return FUSE_RECIPE_DESTINATIONS.includes(value as FuseRecipeDestination);
}
