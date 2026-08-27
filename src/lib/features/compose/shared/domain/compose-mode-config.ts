/**
 * Compose Mode Configuration
 *
 * Centralized definitions for animation mode display properties.
 * Single source of truth for icons, names, gradients, and accent colors.
 */

import type { AnimationMode } from "./animation-mode";

export interface ComposeModeConfig {
  icon: string;
  label: string;
  gradient: string;
  accent: string;
}

/**
 * Display configuration for each animation mode
 */
export const COMPOSE_MODE_CONFIG: Record<AnimationMode, ComposeModeConfig> = {
  single: {
    icon: "fa-play",
    label: "Single",
    gradient:
      "linear-gradient(135deg, color-mix(in srgb, var(--semantic-info, #3b82f6) 20%, transparent) 0%, color-mix(in srgb, var(--semantic-info, #3b82f6) 10%, transparent) 100%)",
    accent: "var(--semantic-info, #3b82f6)",
  },
  mirror: {
    icon: "fa-clone",
    label: "Mirror",
    gradient:
      "linear-gradient(135deg, color-mix(in srgb, var(--feature-edit, #8b5cf6) 20%, transparent) 0%, color-mix(in srgb, var(--feature-edit, #8b5cf6) 10%, transparent) 100%)",
    accent: "var(--feature-edit, #8b5cf6)",
  },
  tunnel: {
    icon: "fa-layer-group",
    label: "Tunnel",
    gradient:
      "linear-gradient(135deg, color-mix(in srgb, var(--accent-pink, #ec4899) 20%, transparent) 0%, color-mix(in srgb, var(--accent-pink, #ec4899) 10%, transparent) 100%)",
    accent: "var(--accent-pink, #ec4899)",
  },
  grid: {
    icon: "fa-th-large",
    label: "Grid",
    gradient:
      "linear-gradient(135deg, color-mix(in srgb, var(--semantic-warning, #f59e0b) 20%, transparent) 0%, color-mix(in srgb, var(--semantic-warning, #f59e0b) 10%, transparent) 100%)",
    accent: "var(--semantic-warning, #f59e0b)",
  },
  "side-by-side": {
    icon: "fa-columns",
    label: "Side by Side",
    gradient:
      "linear-gradient(135deg, color-mix(in srgb, var(--semantic-success, #22c55e) 20%, transparent) 0%, color-mix(in srgb, var(--semantic-success, #22c55e) 10%, transparent) 100%)",
    accent: "var(--semantic-success, #22c55e)",
  },
};

export function getModeConfig(mode: AnimationMode): ComposeModeConfig {
  return COMPOSE_MODE_CONFIG[mode];
}

export function getModeLabel(mode: AnimationMode): string {
  return COMPOSE_MODE_CONFIG[mode].label;
}

export function getModeIcon(mode: AnimationMode): string {
  return COMPOSE_MODE_CONFIG[mode].icon;
}

/**
 * All modes as array for iteration (e.g., filter chips)
 */
export const ALL_MODES: AnimationMode[] = [
  "single",
  "mirror",
  "tunnel",
  "grid",
  "side-by-side",
];
