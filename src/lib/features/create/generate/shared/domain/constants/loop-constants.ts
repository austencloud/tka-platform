/**
 * LOOP Component Constants
 * Defines the available LOOP transformation types with their display metadata
 */

import {
  LOOPComponent,
  type LOOPComponentInfo,
} from "../models/generate-models";

/**
 * Complete list of LOOP components with their display metadata
 * Used for UI rendering and user selection
 * Note: Descriptions are handled by LOOPExplanationTextGenerator service
 * Icons are Font Awesome icon names (without fa- prefix)
 */
export const LOOP_COMPONENTS: readonly LOOPComponentInfo[] = [
  {
    component: LOOPComponent.ROTATED,
    label: "Rotated",
    shortLabel: "Rotated",
    description: "Rotate 180° around the grid center",
    icon: "rotate", // Font Awesome: fa-rotate
    color: "#36c3ff",
  },
  {
    component: LOOPComponent.MIRRORED,
    label: "Mirrored",
    shortLabel: "Mirrored",
    description: "Flip left-to-right like a mirror",
    icon: "left-right", // Font Awesome: fa-left-right (horizontal flip)
    color: "#6F2DA8",
  },
  {
    component: LOOPComponent.SWAPPED,
    label: "Swapped",
    shortLabel: "Swapped",
    description: "Exchange which hand does what",
    icon: "shuffle", // Font Awesome: fa-shuffle
    color: "#26e600",
  },
  {
    component: LOOPComponent.INVERTED,
    label: "Inverted",
    shortLabel: "Inverted",
    description: "Transform motions to their opposites",
    icon: "yin-yang", // Font Awesome: fa-yin-yang
    color: "#eb7d00",
  },
] as const;
