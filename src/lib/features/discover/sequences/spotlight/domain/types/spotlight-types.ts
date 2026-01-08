/**
 * Spotlight Types
 *
 * Type definitions for the spotlight module.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export type SpotlightVariationIndex = number;
export type SpotlightTimestamp = number;
export type SpotlightAction = "edit" | "save" | "delete";
export type SpotlightCloseCallback = () => void;
export type SpotlightActionCallback = (
  action: string,
  sequence: SequenceData
) => void;
export type SpotlightImageLoadCallback = () => void;
