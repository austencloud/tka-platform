import type { BackgroundType } from "@austencloud/backgrounds";
import type { SceneId } from "$lib/features/lab/tabs/scene-lab/domain/scene-lab-types";

export type ThemeId =
  | "ocean"
  | "cosmic"
  | "forest"
  | "blossom"
  | "pride"
  | "ember"
  | "winter"
  | "autumn"
  | "celestial"
  | "void";

export interface ThemeOption {
  id: ThemeId;
  label: string;
  icon: string;
  color: string;
  backgroundType: BackgroundType;
  sceneId: SceneId;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "ocean",
    label: "Ocean",
    icon: "fa-water",
    color: "#0ea5e9",
    backgroundType: "ocean" as BackgroundType,
    sceneId: "ocean",
  },
  {
    id: "cosmic",
    label: "Cosmic",
    icon: "fa-moon",
    color: "#8b5cf6",
    backgroundType: "cosmic" as BackgroundType,
    sceneId: "cosmic",
  },
  {
    id: "forest",
    label: "Forest",
    icon: "fa-tree",
    color: "#22c55e",
    backgroundType: "forest" as BackgroundType,
    sceneId: "forest",
  },
  {
    id: "blossom",
    label: "Blossom",
    icon: "fa-spa",
    color: "#f472b6",
    backgroundType: "blossom" as BackgroundType,
    sceneId: "blossom",
  },
  {
    id: "pride",
    label: "Rainbow",
    icon: "fa-rainbow",
    color: "#f59e0b",
    backgroundType: "pride" as BackgroundType,
    sceneId: "rainbow",
  },
  {
    id: "ember",
    label: "Ember",
    icon: "fa-fire",
    color: "#ef4444",
    backgroundType: "ember" as BackgroundType,
    sceneId: "ember",
  },
  {
    id: "winter",
    label: "Winter",
    icon: "fa-snowflake",
    color: "#67e8f9",
    backgroundType: "winter" as BackgroundType,
    sceneId: "winter",
  },
  {
    id: "autumn",
    label: "Autumn",
    icon: "fa-leaf",
    color: "#d97706",
    backgroundType: "autumn" as BackgroundType,
    sceneId: "autumn",
  },
  {
    id: "celestial",
    label: "Celestial",
    icon: "fa-star",
    color: "#e2e8f0",
    backgroundType: "celestial" as BackgroundType,
    sceneId: "celestial",
  },
  {
    id: "void",
    label: "Void",
    icon: "fa-square",
    color: "#6b7280",
    backgroundType: "void" as BackgroundType,
    sceneId: "void",
  },
];

export function getThemeOption(id: ThemeId): ThemeOption | undefined {
  return THEME_OPTIONS.find((t) => t.id === id);
}
