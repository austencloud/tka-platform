/**
 * Navigation Icon IDs
 *
 * Centralized icon identifiers for navigation elements.
 * These map to FontAwesome icon classes. Keeping them separate from
 * HTML markup allows for future icon library changes and better testability.
 */

/** Icon IDs for modules */
export const MODULE_ICONS = {
  create: "fa-tools",
  browse: "fa-compass",
  learn: "fa-graduation-cap",
  compose: "fa-layer-group",
  train: "fa-running",
  library: "fa-book",
  feedback: "fa-comment-dots",
  "ml-training": "fa-brain",
  admin: "fa-crown",
  settings: "fa-cog",
} as const;

/** Icon IDs for create tabs */
export const CREATE_TAB_ICONS = {
  assembler: "fa-puzzle-piece",
  constructor: "fa-hammer",
  generator: "fa-wand-magic-sparkles",
} as const;

/** Icon IDs for learn tabs */
export const LEARN_TAB_ICONS = {
  concepts: "fa-lightbulb",
  play: "fa-gamepad",
  codex: "fa-book-open",
} as const;

/** Icon IDs for browse tabs */
export const BROWSE_TAB_ICONS = {
  gallery: "fa-layer-group",
  collections: "fa-folder",
  creators: "fa-users",
} as const;

/** Icon IDs for library tabs */
export const LIBRARY_TAB_ICONS = {
  sequences: "fa-film",
  collections: "fa-folder-open",
  compositions: "fa-music",
  favorites: "fa-heart",
} as const;

/** Icon IDs for settings tabs */
export const SETTINGS_TAB_ICONS = {
  profile: "fa-user",
  props: "fa-wand-magic-sparkles",
  background: "fa-image",
  visibility: "fa-eye",
  misc: "fa-sliders-h",
  ai: "fa-robot",
} as const;

/** Icon IDs for admin tabs */
export const ADMIN_TAB_ICONS = {
  users: "fa-users",
  content: "fa-database",
  system: "fa-server",
} as const;

/**
 * Helper to generate FontAwesome icon HTML from an icon ID
 * @param iconId - The icon ID (e.g., "fa-home")
 * @param color - Optional color for the icon
 * @returns HTML string for the icon
 */
export function iconHtml(iconId: string, color?: string): string {
  const style = color ? ` style="color: ${color};"` : "";
  return `<i class="fas ${iconId}"${style} aria-hidden="true"></i>`;
}
