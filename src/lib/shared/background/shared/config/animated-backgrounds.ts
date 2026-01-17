import { BackgroundType } from "../domain/enums/background-enums";

/**
 * Animated background options for public pages and landing.
 * All pages should use this same list for consistency.
 */
export const ANIMATED_BACKGROUNDS = [
  { type: BackgroundType.NIGHT_SKY, icon: "fa-moon", label: "Night Sky" },
  { type: BackgroundType.SNOWFALL, icon: "fa-snowflake", label: "Snowfall" },
  { type: BackgroundType.DEEP_OCEAN, icon: "fa-water", label: "Deep Ocean" },
  { type: BackgroundType.EMBER_GLOW, icon: "fa-fire", label: "Ember Glow" },
  { type: BackgroundType.SAKURA_DRIFT, icon: "fa-spa", label: "Cherry Blossom" },
  { type: BackgroundType.FIREFLY_FOREST, icon: "fa-tree", label: "Firefly Forest" },
  { type: BackgroundType.AUTUMN_DRIFT, icon: "fa-leaf", label: "Autumn" },
  { type: BackgroundType.PRIDE, icon: "fa-rainbow", label: "Pride" },
] as const;

export type AnimatedBackground = (typeof ANIMATED_BACKGROUNDS)[number];
