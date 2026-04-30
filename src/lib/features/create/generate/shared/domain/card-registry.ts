/**
 * Card Registry - Single source of truth for generator card metadata
 *
 * Both the real CardConfigurator and the onboarding tour derive their
 * card lists from this registry. Adding a card here automatically makes
 * it available in the tour, so they never diverge.
 */

import type { GeneratorHelpId } from "../../domain/generator-help-content";
import type { CardColors } from "./card-colors";

export interface CardRegistryEntry {
  /** Card ID used by CardConfigurator (e.g. "word-input", "preset") */
  id: string;
  /** Display header shown in the tour mini card (e.g. "WORD", "LEVEL") */
  tourHeader: string;
  /** Default display value in the tour mini card (e.g. "A - Z", "2") */
  tourDefaultValue: string;
  /** Grid column span in the tour mini card grid (out of 6) */
  tourSpan: number;
  /** Maps to the help content entry for this card's explanation */
  helpId: GeneratorHelpId;
  /** Key into CardColors for this card's gradient */
  colorKey: keyof CardColors;
}

/**
 * Ordered list of all generator cards. The tour renders them in this order.
 * The CardConfigurator may conditionally hide some (e.g. turn-intensity at L1,
 * period when not in LOOP), but this is the canonical superset.
 */
/**
 * Use `as const satisfies` so TypeScript infers the literal ID strings
 * while still validating the shape. This gives us a union type of all
 * card IDs that the CardConfigurator is forced to use.
 */
export const CARD_REGISTRY = [
  {
    id: "word-input",
    tourHeader: "WORD",
    tourDefaultValue: "A - Z",
    tourSpan: 2,
    helpId: "generation-mode",
    colorKey: "wordInput",
  },
  {
    id: "preset",
    tourHeader: "FAVORITE",
    tourDefaultValue: "Pick",
    tourSpan: 2,
    helpId: "favorite",
    colorKey: "favorite",
  },
  {
    id: "length",
    tourHeader: "LENGTH",
    tourDefaultValue: "16",
    tourSpan: 2,
    helpId: "length",
    colorKey: "length",
  },
  {
    id: "level",
    tourHeader: "LEVEL",
    tourDefaultValue: "2",
    tourSpan: 2,
    helpId: "level",
    colorKey: "level",
  },
  {
    id: "grid-mode",
    tourHeader: "GRID",
    tourDefaultValue: "Diamond",
    tourSpan: 2,
    helpId: "grid-mode",
    colorKey: "gridMode",
  },
  {
    id: "turn-intensity",
    tourHeader: "TURNS",
    tourDefaultValue: "≤1",
    tourSpan: 2,
    helpId: "turn-intensity",
    colorKey: "turnIntensity",
  },
  {
    id: "customize",
    tourHeader: "CUSTOMIZE",
    tourDefaultValue: "Default",
    tourSpan: 2,
    helpId: "prop-continuity",
    colorKey: "customize",
  },
  {
    id: "loop",
    tourHeader: "LOOP",
    tourDefaultValue: "Rotated",
    tourSpan: 2,
    helpId: "loop-type",
    colorKey: "mode",
  },
  {
    id: "period",
    tourHeader: "PERIOD",
    tourDefaultValue: "Halved",
    tourSpan: 2,
    helpId: "period",
    colorKey: "period",
  },
  {
    id: "generate-button",
    tourHeader: "",
    tourDefaultValue: "Generate",
    tourSpan: 6,
    helpId: "generate",
    colorKey: "turnIntensity",
  },
] as const satisfies readonly CardRegistryEntry[];

/**
 * Union type of all valid card IDs. The CardConfigurator's CardDescriptor.id
 * is constrained to this type, so adding a card to the configurator without
 * adding it to the registry is a compile error.
 */
export type GeneratorCardId = (typeof CARD_REGISTRY)[number]["id"];

/**
 * Tour stop IDs derived from the registry. Used by generate-tour-state
 * so the stop list stays in sync with the card list.
 */
export const TOUR_STOP_IDS = CARD_REGISTRY.map((c) => c.id);
