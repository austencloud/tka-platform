/**
 * Deep Link Resolver Types
 *
 * Co-exported types for the deep link resolution system.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export type DeepLinkSource = "cache" | "local" | "public" | null;
export type DeepLinkError = "not_found" | "network" | null;

export interface DeepLinkResult {
  /** The resolved sequence data, or null if not found */
  sequence: SequenceData | null;
  /** Where the sequence was found */
  source: DeepLinkSource;
  /** Error type if resolution failed */
  error: DeepLinkError;
}

