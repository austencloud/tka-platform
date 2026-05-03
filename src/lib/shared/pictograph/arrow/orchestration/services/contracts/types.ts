// --- From ArrowLifecycleManager ---
/**
 * Arrow Lifecycle Manager Contract
 *
 * Single responsibility service for coordinating all arrow lifecycle operations.
 * Separates concerns from components and provides clean coordination.
 */

import type { PictographData } from "../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../shared/domain/models/MotionData";
import type {
  ArrowAssets,
  ArrowLifecycleResult,
  ArrowPosition,
  ArrowState,
} from "../../domain/arrow-models";
import type { ThemeMode } from "../../../../../utils/svg-color-utils";
import type { GridMode } from "../../../../grid/domain/enums/grid-enums";

/**
 * Options for arrow lifecycle operations
 */
export interface ArrowLifecycleOptions {
  /** Theme mode for color selection ("dark" or "light"). If not provided, uses global state. */
  themeMode?: ThemeMode;
  /** Grid mode for positioning. Derived from motion locations if not provided. */
  gridMode?: GridMode;
}

/**
 * Arrow Lifecycle Manager - Single point of coordination for all arrow operations
 */

