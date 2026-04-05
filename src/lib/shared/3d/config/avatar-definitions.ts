/**
 * Avatar Definitions
 *
 * Defines available avatar models for the 3D viewer.
 * Each avatar has an ID, display name, model path, and optional icon.
 */

/** R2 CDN base URL for large assets */
const R2_CDN = "https://pub-f5505ed75927471cb198c54336317370.r2.dev";

export interface AvatarDefinition {
  id: string;
  name: string;
  modelPath: string;
  icon?: string; // FontAwesome icon class
  description?: string;
}

/**
 * Available avatars
 * Note: Height scaling is handled automatically based on model proportions
 */
export const AVATAR_DEFINITIONS: AvatarDefinition[] = [
  {
    id: "x-bot",
    name: "X-Bot",
    modelPath: `${R2_CDN}/models/avatars/x-bot.glb`,
    icon: "fa-robot",
    description: "Mixamo masculine robot",
  },
  {
    id: "y-bot",
    name: "Y-Bot",
    modelPath: `${R2_CDN}/models/avatars/y-bot.glb`,
    icon: "fa-robot",
    description: "Mixamo feminine robot",
  },
  {
    id: "remy",
    name: "Remy",
    modelPath: `${R2_CDN}/models/avatars/remy.glb`,
    icon: "fa-person",
    description: "Mixamo Remy character",
  },
  {
    id: "ch26",
    name: "Character 26",
    modelPath: `${R2_CDN}/models/avatars/ch26.glb`,
    icon: "fa-person",
    description: "Mixamo detailed character",
  },
  {
    id: "ch01",
    name: "Marcus",
    modelPath: "/models/avatars/ch01.glb",
    icon: "fa-person",
    description: "Mixamo Marcus",
  },
  {
    id: "ch07",
    name: "Jade",
    modelPath: "/models/avatars/ch07.glb",
    icon: "fa-person",
    description: "Mixamo Jade",
  },
  {
    id: "ch10",
    name: "Viktor",
    modelPath: "/models/avatars/ch10.glb",
    icon: "fa-person",
    description: "Mixamo Viktor",
  },
  {
    id: "ch12",
    name: "Luna",
    modelPath: "/models/avatars/ch12.glb",
    icon: "fa-person",
    description: "Mixamo Luna",
  },
  {
    id: "ch18",
    name: "Nora",
    modelPath: "/models/avatars/ch18.glb",
    icon: "fa-person",
    description: "Mixamo Nora",
  },
  {
    id: "ch21",
    name: "Felix",
    modelPath: "/models/avatars/ch21.glb",
    icon: "fa-person",
    description: "Mixamo Felix",
  },
  {
    id: "ch22",
    name: "Maya",
    modelPath: "/models/avatars/ch22.glb",
    icon: "fa-person",
    description: "Mixamo Maya",
  },
  {
    id: "ch24",
    name: "Leo",
    modelPath: "/models/avatars/ch24.glb",
    icon: "fa-person",
    description: "Mixamo Leo",
  },
  {
    id: "ch34",
    name: "Suki",
    modelPath: "/models/avatars/ch34.glb",
    icon: "fa-person",
    description: "Mixamo Suki",
  },
  {
    id: "ch41",
    name: "Blake",
    modelPath: "/models/avatars/ch41.glb",
    icon: "fa-person",
    description: "Mixamo Blake",
  },
  {
    id: "ch42",
    name: "Sage",
    modelPath: "/models/avatars/ch42.glb",
    icon: "fa-person",
    description: "Mixamo Sage",
  },
  {
    id: "ch44",
    name: "Quinn",
    modelPath: "/models/avatars/ch44.glb",
    icon: "fa-person",
    description: "Mixamo Quinn",
  },
];

export type AvatarId = (typeof AVATAR_DEFINITIONS)[number]["id"];

/**
 * Get avatar definition by ID
 */
export function getAvatarById(id: string): AvatarDefinition | undefined {
  return AVATAR_DEFINITIONS.find((a) => a.id === id);
}

/**
 * Get model path for an avatar ID
 */
export function getAvatarModelPath(id: string): string {
  const avatar = getAvatarById(id);
  return avatar?.modelPath ?? `${R2_CDN}/models/avatars/x-bot.glb`;
}

/**
 * Default avatar ID
 */
export const DEFAULT_AVATAR_ID: AvatarId = "x-bot";
