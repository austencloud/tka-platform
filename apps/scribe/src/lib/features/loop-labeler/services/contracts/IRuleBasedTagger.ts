/**
 * Rule-Based Tagger Service Contract
 *
 * Suggests tags using deterministic heuristics (no ML).
 * Consumes SequenceFeatures and returns SuggestedTag[] with confidence scores.
 */

import type { SequenceFeatures } from "../../domain/models/sequence-features";
import type {
  SuggestedTag,
  TagSuggestionResult,
} from "../../domain/models/suggested-tag";

export interface IRuleBasedTagger {
  /**
   * Suggest tags for a sequence based on its extracted features
   *
   * @param features - Extracted sequence features from SequenceFeatureExtractor
   * @returns Array of suggested tags with confidence scores
   */
  suggestTags(features: SequenceFeatures): SuggestedTag[];

  /**
   * Suggest tags and group by confidence level
   *
   * @param features - Extracted sequence features
   * @returns Grouped tag suggestions with analysis
   */
  suggestTagsGrouped(features: SequenceFeatures): TagSuggestionResult;
}
