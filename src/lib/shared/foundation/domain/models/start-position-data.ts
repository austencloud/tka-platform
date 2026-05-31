/**
 * Start Position Domain Model
 *
 * Represents the initial prop configuration before a sequence begins.
 *
 * Start positions are NOT steps - they don't have:
 * - Duration (user holds position indefinitely until starting sequence)
 * - Beat numbers (not part of the sequence progression)
 * - Reversals (no motion means no reversal)
 * - Motion/arrows (props are stationary)
 *
 * Start positions only show WHERE and HOW props are held initially.
 */
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface StartPositionData extends PictographData {
  // Type discriminator for TypeScript type guards
  readonly isStartPosition: true;

  // Unique identifier
  readonly id: string;

  // Grid position where sequence starts (e.g., "gamma13")
  // This represents the location in the grid system, not a beat position
  readonly gridPosition?: GridPosition | null;

  // Selection state (for UI)
  readonly isSelected?: boolean;
}
