/**
 * ITikaCapabilityLookup - Contract for finding app capabilities
 *
 * Searches the static app capabilities manifest by keyword scoring
 * to answer "How do I...?" questions about the application.
 */

import type { AppCapability } from "../../knowledge/app-capabilities-manifest";

export interface CapabilityMatch {
  capability: AppCapability;
  relevance: number; // 0-1
}

export interface ITikaCapabilityLookup {
  /**
   * Find capabilities matching a user query.
   * Returns matches sorted by relevance, capped at limit.
   */
  findCapabilities(query: string, limit?: number): CapabilityMatch[];
}
