/**
 * Browser Variation Provider Interface
 *
 * Extends the engine's IVariationProvider with browser-specific lifecycle:
 * async initialization (CSV loading) and initialization status check.
 */

import type { IVariationProvider } from "@tka/sequence-engine/generation";

export interface IBrowserVariationProvider extends IVariationProvider {
  /** Load and index all pictograph variations for the given grid mode */
  initialize(gridMode: string): Promise<void>;

  /** Whether CSV data has been loaded and indexed */
  isInitialized(): boolean;
}
