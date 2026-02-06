/**
 * Layout Presets for Conjoined Lab
 *
 * Quick configurations for common arrangements.
 */

import type { ConjoinedLayout } from "./types";

export interface LayoutPreset {
  id: string;
  name: string;
  icon: string;
  layout: ConjoinedLayout;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "side-by-side",
    name: "Side by Side",
    icon: "fa-arrows-left-right",
    layout: {
      arrangement: "left-right",
      conjoinedEdge: "e",
      spacing: 0,
      showConjoinedPoint: false,
    },
  },
  {
    id: "stacked",
    name: "Stacked",
    icon: "fa-arrows-up-down",
    layout: {
      arrangement: "top-bottom",
      conjoinedEdge: "s",
      spacing: 0,
      showConjoinedPoint: false,
    },
  },
  {
    id: "diagonal-down",
    name: "Diagonal Down",
    icon: "fa-arrow-down-long",
    layout: {
      arrangement: "diagonal-tl-br",
      conjoinedEdge: "se",
      spacing: 0,
      showConjoinedPoint: false,
    },
  },
  {
    id: "diagonal-up",
    name: "Diagonal Up",
    icon: "fa-arrow-up-long",
    layout: {
      arrangement: "diagonal-tr-bl",
      conjoinedEdge: "sw",
      spacing: 0,
      showConjoinedPoint: false,
    },
  },
];

/**
 * Get the default conjoined edge for a given arrangement
 */
export function getDefaultEdgeForArrangement(
  arrangement: ConjoinedLayout["arrangement"]
): ConjoinedLayout["conjoinedEdge"] {
  switch (arrangement) {
    case "left-right":
      return "e";
    case "top-bottom":
      return "s";
    case "diagonal-tl-br":
      return "se";
    case "diagonal-tr-bl":
      return "sw";
    default:
      return "e";
  }
}
