/**
 * Tag Reviewer State
 *
 * Manages state for the tag review workflow.
 * Tags are generated on-the-fly when viewing each sequence for faster algorithm iteration.
 */

import { tryResolve } from "$lib/shared/inversify/di";
import { LOOPLabelerTypes } from "$lib/shared/inversify/types/loop-labeler.types";
import type { ISequenceFeatureExtractor } from "$lib/features/loop-labeler/services/contracts/ISequenceFeatureExtractor";
import type { IRuleBasedTagger } from "$lib/features/loop-labeler/services/contracts/IRuleBasedTagger";
import type { IBeatDataConverter } from "$lib/features/loop-labeler/services/contracts/IBeatDataConverter";
import type {
  TaggedSequenceEntry,
  SequenceTagReview,
  ReviewableTag,
  TagReviewFilterMode,
  TagReviewStats,
} from "../domain/models/tag-review-models";
import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { LOOPType } from "$lib/features/create/generate/circular/domain/models/circular-models";
import type { SequenceEntry, RawBeatData } from "$lib/features/loop-labeler/services/contracts/IBeatDataConverter";

// Clear any old persisted reviews from localStorage
const _OLD_STORAGE_KEY = "tka-tag-reviews";

/**
 * Create the tag reviewer state
 */
export function createTagReviewerState() {
  // === Core State ===
  let sequences = $state<TaggedSequenceEntry[]>([]);
  let reviews = $state<Map<string, SequenceTagReview>>(new Map());
  let currentIndex = $state(0);
  let filterMode = $state<TagReviewFilterMode>("all"); // Default to "all" since we're not persisting
  let loading = $state(true);
  let notes = $state("");

  // === Services ===
  let featureExtractor: ISequenceFeatureExtractor | null = null;
  let tagger: IRuleBasedTagger | null = null;
  let conversionService: IBeatDataConverter | null = null;

  // === Derived State ===
  const filteredSequences = $derived.by(() => {
    switch (filterMode) {
      case "pending":
        return sequences.filter((seq) => {
          const review = reviews.get(seq.word);
          return !review?.isFullyReviewed;
        });
      case "reviewed":
        return sequences.filter((seq) => {
          const review = reviews.get(seq.word);
          return review?.isFullyReviewed === true;
        });
      case "hasRejected":
        return sequences.filter((seq) => {
          const review = reviews.get(seq.word);
          return review?.suggestedTags.some(
            (t) => t.reviewState === "rejected"
          );
        });
      default:
        return sequences;
    }
  });

  const currentSequence = $derived(filteredSequences[currentIndex] ?? null);

  // Pure derived - just lookup (no side effects)
  const currentReview = $derived(
    reviews.get(currentSequence?.word ?? "") ?? null
  );

  const stats = $derived.by((): TagReviewStats => {
    const totalSequences = sequences.length;
    const reviewedSequences = Array.from(reviews.values()).filter(
      (r) => r.isFullyReviewed
    ).length;
    const pendingSequences = totalSequences - reviewedSequences;
    const percentComplete =
      totalSequences > 0
        ? Math.round((reviewedSequences / totalSequences) * 100)
        : 0;

    let totalTags = 0;
    let confirmedTags = 0;
    let rejectedTags = 0;

    for (const review of reviews.values()) {
      for (const tag of review.suggestedTags) {
        totalTags++;
        if (tag.reviewState === "confirmed") confirmedTags++;
        if (tag.reviewState === "rejected") rejectedTags++;
      }
    }

    return {
      totalSequences,
      reviewedSequences,
      pendingSequences,
      percentComplete,
      totalTags,
      confirmedTags,
      rejectedTags,
    };
  });

  /**
   * Generate tags for a single sequence on-the-fly
   */
  function generateTagsForSequence(
    seq: TaggedSequenceEntry
  ): SequenceTagReview | null {
    if (!featureExtractor || !tagger || !conversionService) {
      console.warn(
        "[TagReviewerState] Services not available for tag generation"
      );
      return null;
    }

    if (!seq.fullMetadata?.sequence) {
      return null;
    }

    try {
      // Convert TaggedSequenceEntry to SequenceEntry format for the converter
      const sequenceEntry: SequenceEntry = {
        id: seq.id,
        word: seq.word,
        isCircular: seq.isCircular ?? false,
        loopType: seq.loopType,
        thumbnails: seq.thumbnails,
        sequenceLength: seq.sequenceLength,
        gridMode: seq.gridMode,
        fullMetadata: seq.fullMetadata as { sequence?: RawBeatData[] },
      };
      const gridMode = conversionService.getAuthoritativeGridMode(sequenceEntry);
      const { beats, startPosition } = conversionService.convertRawToBeats(
        seq.word,
        (seq.fullMetadata.sequence ?? []) as RawBeatData[],
        gridMode
      );

      // Create a minimal SequenceData object
      // Include loopType for accurate tag generation (uses authoritative LOOP label)
      const sequenceData = createSequenceData({
        word: seq.word,
        beats,
        gridMode: gridMode as GridMode,
        isCircular: seq.isCircular,
        startPosition: startPosition ?? undefined,
        loopType: (seq.loopType as LOOPType) ?? undefined,
      });

      // Extract features and generate tags
      const features = featureExtractor.extractFeatures(sequenceData);
      const suggestedTags = tagger.suggestTags(features);

      // Create review with pending tags
      const reviewableTags: ReviewableTag[] = suggestedTags.map((tag) => ({
        ...tag,
        reviewState: "pending" as const,
      }));

      return {
        word: seq.word,
        suggestedTags: reviewableTags,
        customTags: [],
        reviewedAt: new Date().toISOString(),
        isFullyReviewed: false,
      };
    } catch (error) {
      console.warn(
        `[TagReviewerState] Failed to generate tags for ${seq.word}:`,
        error
      );
      return null;
    }
  }

  // === Initialize ===
  async function initialize() {
    loading = true;

    // Clear old persisted reviews from localStorage
    try {
      localStorage.removeItem(_OLD_STORAGE_KEY);
    } catch {
      // Ignore errors
    }

    // Resolve services
    featureExtractor = tryResolve<ISequenceFeatureExtractor>(
      LOOPLabelerTypes.ISequenceFeatureExtractor
    );
    tagger = tryResolve<IRuleBasedTagger>(LOOPLabelerTypes.IRuleBasedTagger);
    conversionService = tryResolve<IBeatDataConverter>(
      LOOPLabelerTypes.IBeatDataConverter
    );

    // Load sequences from sequence-index.json
    try {
      const response = await fetch("/data/sequence-index.json");
      const data = await response.json();

      sequences = data.sequences.map(
        (seq: Record<string, unknown>) =>
          ({
            id: seq.id as string,
            word: seq.word as string,
            thumbnails: (seq.thumbnails as string[]) ?? [],
            sequenceLength: seq.sequenceLength as number,
            gridMode: (seq.gridMode as string) ?? "diamond",
            isCircular: seq.isCircular as boolean,
            loopType: (seq.loopType as string) ?? null,
            fullMetadata: seq.fullMetadata as { sequence?: unknown[] },
          }) as TaggedSequenceEntry
      );

      // Tags will be generated on-the-fly when viewing each sequence
    } catch (error) {
      console.error("[TagReviewerState] Failed to load sequences:", error);
    }

    loading = false;
  }

  // === Actions ===
  function setFilterMode(mode: TagReviewFilterMode) {
    filterMode = mode;
    currentIndex = 0;
  }

  function nextSequence() {
    if (currentIndex < filteredSequences.length - 1) {
      currentIndex++;
      notes = "";
    }
  }

  function previousSequence() {
    if (currentIndex > 0) {
      currentIndex--;
      notes = "";
    }
  }

  function skipSequence() {
    nextSequence();
  }

  function jumpToSequence(id: string) {
    const idx = filteredSequences.findIndex((s) => s.id === id);
    if (idx !== -1) {
      currentIndex = idx;
      notes = "";
    }
  }

  function setNotes(value: string) {
    notes = value;
  }

  /**
   * Ensure tags are generated for the current sequence.
   * Call this from the component when the sequence changes.
   */
  function ensureTagsGenerated() {
    if (!currentSequence) {
      return;
    }
    if (reviews.has(currentSequence.word)) {
      return;
    }

    const generated = generateTagsForSequence(currentSequence);
    if (generated) {
      reviews.set(currentSequence.word, generated);
      reviews = new Map(reviews);
    } else {
      console.warn(
        `[TagReviewerState] Failed to generate tags for ${currentSequence.word}`
      );
    }
  }

  /**
   * Regenerate tags for current sequence (useful after algorithm changes)
   */
  function regenerateCurrentTags() {
    if (!currentSequence) return;

    // Remove existing review to force regeneration
    reviews.delete(currentSequence.word);
    reviews = new Map(reviews);

    // Now generate new tags
    ensureTagsGenerated();
  }

  function confirmTag(tagIndex: number) {
    if (!currentSequence) return;

    const review = reviews.get(currentSequence.word);
    if (!review || tagIndex >= review.suggestedTags.length) return;

    const existingTag = review.suggestedTags[tagIndex];
    if (!existingTag) return;

    // Create new tag with updated state
    const updatedTag: ReviewableTag = {
      tag: existingTag.tag,
      category: existingTag.category,
      confidence: existingTag.confidence,
      source: existingTag.source,
      reason: existingTag.reason,
      conflictsWith: existingTag.conflictsWith,
      reviewState: "confirmed",
      reviewedAt: new Date().toISOString(),
    };

    // Create a NEW review object (not mutate) for proper reactivity
    const updatedReview: SequenceTagReview = {
      ...review,
      suggestedTags: review.suggestedTags.map((t, i) =>
        i === tagIndex ? updatedTag : t
      ),
    };

    updateReviewStatus(updatedReview);
    // Set the new review object in a new Map for full reactivity
    const newReviews = new Map(reviews);
    newReviews.set(currentSequence.word, updatedReview);
    reviews = newReviews;
  }

  function rejectTag(tagIndex: number, reason?: string) {
    if (!currentSequence) return;

    const review = reviews.get(currentSequence.word);
    if (!review || tagIndex >= review.suggestedTags.length) return;

    const existingTag = review.suggestedTags[tagIndex];
    if (!existingTag) return;

    // Create new tag with updated state
    const updatedTag: ReviewableTag = {
      tag: existingTag.tag,
      category: existingTag.category,
      confidence: existingTag.confidence,
      source: existingTag.source,
      reason: existingTag.reason,
      conflictsWith: existingTag.conflictsWith,
      reviewState: "rejected",
      reviewedAt: new Date().toISOString(),
      reviewNote: reason,
    };

    // Create a NEW review object (not mutate) for proper reactivity
    const updatedReview: SequenceTagReview = {
      ...review,
      suggestedTags: review.suggestedTags.map((t, i) =>
        i === tagIndex ? updatedTag : t
      ),
    };

    updateReviewStatus(updatedReview);
    // Set the new review object in a new Map for full reactivity
    const newReviews = new Map(reviews);
    newReviews.set(currentSequence.word, updatedReview);
    reviews = newReviews;
  }

  function resetTag(tagIndex: number) {
    if (!currentSequence) return;

    const review = reviews.get(currentSequence.word);
    if (!review || tagIndex >= review.suggestedTags.length) return;

    const existingTag = review.suggestedTags[tagIndex];
    if (!existingTag) return;

    // Create new tag with reset state
    const updatedTag: ReviewableTag = {
      tag: existingTag.tag,
      category: existingTag.category,
      confidence: existingTag.confidence,
      source: existingTag.source,
      reason: existingTag.reason,
      conflictsWith: existingTag.conflictsWith,
      reviewState: "pending",
      reviewedAt: undefined,
      reviewNote: undefined,
    };

    // Create a NEW review object (not mutate) for proper reactivity
    const updatedReview: SequenceTagReview = {
      ...review,
      suggestedTags: review.suggestedTags.map((t, i) =>
        i === tagIndex ? updatedTag : t
      ),
    };

    updateReviewStatus(updatedReview);
    // Set the new review object in a new Map for full reactivity
    const newReviews = new Map(reviews);
    newReviews.set(currentSequence.word, updatedReview);
    reviews = newReviews;
  }

  function addCustomTag(tag: string, _category: string) {
    if (!currentSequence) return;

    const existingReview = reviews.get(currentSequence.word);

    // Create a NEW review object with the added tag
    const updatedReview: SequenceTagReview = existingReview
      ? {
          ...existingReview,
          customTags: existingReview.customTags.includes(tag)
            ? existingReview.customTags
            : [...existingReview.customTags, tag],
        }
      : {
          word: currentSequence.word,
          suggestedTags: [],
          customTags: [tag],
          reviewedAt: new Date().toISOString(),
          isFullyReviewed: false,
        };

    // Only update if tag was actually added
    if (!existingReview?.customTags.includes(tag)) {
      const newReviews = new Map(reviews);
      newReviews.set(currentSequence.word, updatedReview);
      reviews = newReviews;
    }
  }

  function removeCustomTag(tag: string) {
    if (!currentSequence) return;

    const review = reviews.get(currentSequence.word);
    if (!review) return;

    // Create a NEW review object without the tag
    const updatedReview: SequenceTagReview = {
      ...review,
      customTags: review.customTags.filter((t) => t !== tag),
    };

    const newReviews = new Map(reviews);
    newReviews.set(currentSequence.word, updatedReview);
    reviews = newReviews;
  }

  function confirmAllTags() {
    if (!currentSequence) return;

    const review = reviews.get(currentSequence.word);
    if (!review) return;

    // Create a NEW review object with all tags confirmed
    const updatedReview: SequenceTagReview = {
      ...review,
      suggestedTags: review.suggestedTags.map((tag) => ({
        ...tag,
        reviewState: "confirmed" as const,
        reviewedAt: new Date().toISOString(),
      })),
    };

    updateReviewStatus(updatedReview);
    const newReviews = new Map(reviews);
    newReviews.set(currentSequence.word, updatedReview);
    reviews = newReviews;
  }

  function updateReviewStatus(review: SequenceTagReview) {
    const allReviewed = review.suggestedTags.every(
      (t) => t.reviewState !== "pending"
    );
    review.isFullyReviewed = allReviewed;
    review.reviewedAt = new Date().toISOString();
    if (notes) {
      review.notes = notes;
    }
  }

  function dispose() {
    // No persistence - reviews are session-only
  }

  return {
    // State (getters)
    get sequences() {
      return sequences;
    },
    get filteredSequences() {
      return filteredSequences;
    },
    get currentSequence() {
      return currentSequence;
    },
    get currentReview() {
      return currentReview;
    },
    get currentIndex() {
      return currentIndex;
    },
    get filterMode() {
      return filterMode;
    },
    get loading() {
      return loading;
    },
    get notes() {
      return notes;
    },
    get stats() {
      return stats;
    },
    get reviews() {
      return reviews;
    },

    // Actions
    initialize,
    dispose,
    setFilterMode,
    nextSequence,
    previousSequence,
    skipSequence,
    jumpToSequence,
    setNotes,
    confirmTag,
    rejectTag,
    resetTag,
    addCustomTag,
    removeCustomTag,
    confirmAllTags,
    ensureTagsGenerated,
    regenerateCurrentTags,
  };
}

// Singleton state
export const tagReviewerState = createTagReviewerState();
