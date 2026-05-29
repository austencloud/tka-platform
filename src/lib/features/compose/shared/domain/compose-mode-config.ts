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
      "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.1) 100%)",
    accent: "var(--semantic-info)",
  },
  mirror: {
    icon: "fa-clone",
    label: "Mirror",
    gradient:
      "linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(109, 40, 217, 0.1) 100%)",
    accent: "#8b5cf6",
  },
  tunnel: {
    icon: "fa-layer-group",
    label: "Tunnel",
    gradient:
      "linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(219, 39, 119, 0.1) 100%)",
    accent: "#ec4899",
  },
  grid: {
    icon: "fa-th-large",
    label: "Grid",
    gradient:
      "linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.1) 100%)",
    accent: "var(--semantic-warning)",
  },
  "side-by-side": {
    icon: "fa-columns",
    label: "Side by Side",
    gradient:
      "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%)",
    accent: "var(--semantic-success)",
  },
};

/**
 * Get mode config by mode key
 */
export function getModeConfig(mode: AnimationMode): ComposeModeConfig {
  return COMPOSE_MODE_CONFIG[mode];
}

/**
 * Get mode label by mode key
 */
export function getModeLabel(mode: AnimationMode): string {
  return COMPOSE_MODE_CONFIG[mode].label;
}

/**
 * Get mode icon by mode key
 */
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
