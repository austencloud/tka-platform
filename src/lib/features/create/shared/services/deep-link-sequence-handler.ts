/**
 * Deep Link Sequence Service Implementation
 *
 * Handles loading sequences from deep links and pending edits.
 * Encapsulates the complex sequence enrichment logic that was
 * previously in CreateModule.svelte onMount (80+ lines).
 *
 * Domain: Create module - Sequence Loading
 */

import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * Deep Link Sequence Service Contract
 */
export interface DeepLinkLoadResult {
  /** Whether a sequence was loaded */
  loaded: boolean;
  /** The tab to navigate to (if specified in deep link) */
  targetTab?: string;
  /** Source of the loaded sequence */
  source?: "deepLink" | "pendingEdit";
}
import type { DeepLinker } from "$lib/shared/navigation/services/deep-linker";
import type { LetterDeriver } from '$lib/shared/navigation/services/letter-deriver'
import type { PositionDeriver } from '$lib/shared/navigation/services/position-deriver'

const PENDING_EDIT_KEY = "tka-pending-edit-sequence";

/**
 * Session-level flag indicating a pending edit was processed this session.
 * This survives localStorage clearing and prevents persistence restoration
 * from overwriting the loaded sequence.
 */
let pendingEditProcessedThisSession = false;

export class DeepLinkSequenceHandler {
  constructor(
    private deepLinkService: DeepLinker | null,
    private LetterDeriver: LetterDeriver | null,
    private positionDeriverService: PositionDeriver | null
  ) {}

  hasDeepLink(): boolean {
    return this.deepLinkService?.hasDataForModule("create") ?? false;
  }

  hasPendingEdit(): boolean {
    try {
      return localStorage.getItem(PENDING_EDIT_KEY) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Check if a pending edit was processed this session.
   * This flag survives localStorage clearing and can be used by persistence
   * restoration code to avoid overwriting the loaded sequence.
   */
  wasPendingEditProcessedThisSession(): boolean {
    return pendingEditProcessedThisSession;
  }

  async loadFromDeepLink(
    setSequence: (sequence: SequenceData) => void
  ): Promise<DeepLinkLoadResult> {
    const deepLinkData = this.deepLinkService?.consumeData("create");

    if (!deepLinkData) {
      return { loaded: false };
    }

    try {
      // Set sequence immediately (positions/letters enriched async)
      setSequence(deepLinkData.sequence);

      // Enrich sequence with derived data in background
      this.enrichSequenceAsync(deepLinkData.sequence, setSequence);

      // Clear the deep link from URL now that we've consumed it
      this.deepLinkService?.clearDeepLinkFromURL();

      return {
        loaded: true,
        source: "deepLink",
        targetTab: deepLinkData.tabId,
      };
    } catch (err) {
      console.error("Failed to load deep link sequence:", err);
      return { loaded: false };
    }
  }

  async loadFromPendingEdit(
    setSequence: (sequence: SequenceData) => void
  ): Promise<DeepLinkLoadResult> {
    try {
      const pendingData = localStorage.getItem(PENDING_EDIT_KEY);
      if (!pendingData) {
        return { loaded: false };
      }

      const rawData = JSON.parse(pendingData);
      const sequence = createSequenceData(rawData);
      setSequence(sequence);

      // Enrich sequence with derived positions/letters in background
      // This is critical for imported sequences from Browse which have null positions
      this.enrichSequenceAsync(sequence, setSequence);

      // Set session flag BEFORE clearing localStorage
      // This flag survives localStorage clearing and prevents persistence restoration
      // from overwriting the loaded sequence
      pendingEditProcessedThisSession = true;

      this.clearPendingEdit();

      return {
        loaded: true,
        source: "pendingEdit",
      };
    } catch (err) {
      console.error("Failed to load pending edit sequence:", err);
      this.clearPendingEdit(); // Clear invalid data
      return { loaded: false };
    }
  }

  async loadFromAnySource(
    setSequence: (sequence: SequenceData) => void
  ): Promise<DeepLinkLoadResult> {
    // Deep link takes priority
    if (this.hasDeepLink()) {
      return this.loadFromDeepLink(setSequence);
    }

    // Fall back to pending edit
    if (this.hasPendingEdit()) {
      return this.loadFromPendingEdit(setSequence);
    }

    return { loaded: false };
  }

  clearPendingEdit(): void {
    try {
      localStorage.removeItem(PENDING_EDIT_KEY);
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Enrich sequence with derived positions and letters asynchronously.
   * This is the complex merging logic extracted from CreateModule.svelte.
   */
  private enrichSequenceAsync(
    sequence: SequenceData,
    setSequence: (sequence: SequenceData) => void
  ): void {
    // If services aren't available, skip enrichment
    if (!this.positionDeriverService || !this.LetterDeriver) {
      console.warn(
        "Deriver services not available - sequence will not be enriched"
      );
      return;
    }

    Promise.all([
      this.positionDeriverService.derivePositionsForSequence(sequence),
      this.LetterDeriver.deriveLettersForSequence(sequence),
    ])
      .then(([sequenceWithPositions, sequenceWithLetters]) => {
        const enrichedSequence = this.mergeEnrichedSequence(
          sequenceWithPositions,
          sequenceWithLetters
        );
        setSequence(enrichedSequence);
      })
      .catch((err) => {
        console.warn("Position/letter derivation failed:", err);
        // Original sequence already loaded, no action needed
      });
  }

  /**
   * Merge position-enriched and letter-enriched sequences.
   * Letters take precedence but preserve positions from position derivation.
   */
  private mergeEnrichedSequence(
    sequenceWithPositions: SequenceData,
    sequenceWithLetters: SequenceData
  ): SequenceData {
    return {
      ...sequenceWithLetters,
      steps: sequenceWithLetters.steps.map((step, index) => ({
        ...step,
        startPosition:
          step.startPosition ??
          sequenceWithPositions.steps[index]?.startPosition,
        endPosition:
          step.endPosition ?? sequenceWithPositions.steps[index]?.endPosition,
      })),
      startPosition: sequenceWithLetters.startPosition
        ? {
            ...sequenceWithLetters.startPosition,
            startPosition:
              sequenceWithLetters.startPosition.startPosition ??
              sequenceWithPositions.startPosition?.startPosition,
            endPosition:
              sequenceWithLetters.startPosition.endPosition ??
              sequenceWithPositions.startPosition?.endPosition,
          }
        : sequenceWithPositions.startPosition,
      startingPosition: sequenceWithLetters.startingPosition
        ? {
            ...sequenceWithLetters.startingPosition,
            startPosition:
              sequenceWithLetters.startingPosition.startPosition ??
              sequenceWithPositions.startingPosition?.startPosition,
            endPosition:
              sequenceWithLetters.startingPosition.endPosition ??
              sequenceWithPositions.startingPosition?.endPosition,
          }
        : sequenceWithPositions.startingPosition,
      // Add timestamp to ensure reactivity
      metadata: {
        ...sequenceWithLetters.metadata,
        _enrichedAt: Date.now(),
      },
    } as SequenceData;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Dependencies are optional - pass null since they come from navigation layer
export const deepLinkSequenceHandler = new DeepLinkSequenceHandler(
  null,
  null,
  null
);
