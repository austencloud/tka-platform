export type SceneId =
  | "winter"
  | "forest"
  | "autumn"
  | "cosmic"
  | "ocean"
  | "ember"
  | "blossom"
  | "rainbow"
  | "celestial"
  | "void";

export interface SceneOption {
  id: SceneId;
  label: string;
  icon: string;
  description: string;
}

export const SCENE_OPTIONS: SceneOption[] = [
  {
    id: "winter",
    label: "Winter",
    icon: "fa-snowflake",
    description: "Snowy forest clearing with frozen pond and campfire",
  },
  {
    id: "forest",
    label: "Forest",
    icon: "fa-tree",
    description: "Moonlit forest with fireflies and warm campfire",
  },
  {
    id: "autumn",
    label: "Autumn",
    icon: "fa-leaf",
    description: "Golden-hour forest clearing with falling leaves",
  },
  {
    id: "cosmic",
    label: "Cosmic",
    icon: "fa-moon",
    description: "Deep space with lunar surface, station platform, and Earth rise",
  },
  {
    id: "ocean",
    label: "Ocean",
    icon: "fa-water",
    description: "Sun-drenched coral reef with warm golden caustics and colorful fish",
  },
  {
    id: "ember",
    label: "Ember",
    icon: "fa-fire",
    description: "Volcanic landscape with lava cracks, obsidian pillars, and rising embers",
  },
  {
    id: "blossom",
    label: "Blossom",
    icon: "fa-spa",
    description: "Moonlit cherry blossom grove with falling petals and stone lanterns",
  },
  {
    id: "rainbow",
    label: "Rainbow",
    icon: "fa-rainbow",
    description: "Rainbow aurora with flowing color bands and colorful particles",
  },
  {
    id: "celestial",
    label: "Celestial",
    icon: "fa-star",
    description: "Heavenly cloudscape with golden god rays and floating islands",
  },
  {
    id: "void",
    label: "Void",
    icon: "fa-square",
    description: "Pure black void — isolated performer view",
  },
];
