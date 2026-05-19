/**
 * Scene Lab Types
 *
 * Scene identifier union - add new IDs here as we build new scenes.
 */

export type SceneId =
  | "winter"
  | "forest-firefly"
  | "forest-autumn"
  | "cosmic-night"
  | "cosmic-aurora"
  | "ocean-abyss"
  | "ocean-reef"
  | "ocean-mystical"
  | "ocean-cinematic";

export interface SceneOption {
  id: SceneId;
  label: string;
  description: string;
}

export const SCENE_OPTIONS: SceneOption[] = [
  {
    id: "winter",
    label: "Winter",
    description: "Snowy forest clearing with frozen pond and campfire",
  },
  {
    id: "forest-firefly",
    label: "Forest (Firefly)",
    description: "Moonlit forest with fireflies and warm campfire",
  },
  {
    id: "forest-autumn",
    label: "Forest (Autumn)",
    description: "Golden-hour forest clearing with falling leaves",
  },
  {
    id: "cosmic-night",
    label: "Cosmic (Night)",
    description: "Deep space with lunar surface, station platform, and Earth rise",
  },
  {
    id: "cosmic-aurora",
    label: "Cosmic (Aurora)",
    description: "Aurora-lit space with nebula wash and teal-green accents",
  },
  {
    id: "ocean-abyss",
    label: "Ocean (Abyss)",
    description: "Dark deep-sea with bioluminescent jellyfish, pulsing plankton, and faint god rays",
  },
  {
    id: "ocean-reef",
    label: "Ocean (Reef)",
    description: "Sun-drenched coral reef with warm golden caustics and colorful fish schools",
  },
  {
    id: "ocean-mystical",
    label: "Ocean (Mystical)",
    description: "Fantasy underwater with aurora caustics, glowing kelp, and ethereal jellyfish",
  },
  {
    id: "ocean-cinematic",
    label: "Ocean (Cinematic)",
    description: "Documentary-quality ocean with realistic caustics, volumetric god rays, and muted tones",
  },
];
