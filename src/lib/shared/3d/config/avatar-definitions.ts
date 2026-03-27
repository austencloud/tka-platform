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
