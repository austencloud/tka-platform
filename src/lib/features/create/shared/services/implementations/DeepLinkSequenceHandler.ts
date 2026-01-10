/**
 * Deep Link Sequence Service Implementation
 *
 * Handles loading sequences from deep links and pending edits.
 * Encapsulates the complex sequence enrichment logic that was
 * previously in CreateModule.svelte onMount (80+ lines).
 *
 * Domain: Create module - Sequence Loading
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  DeepLinkLoadResult,
  IDeepLinkSequenceHandler,
} from "../contracts/IDeepLinkSequenceHandler";
import type { IDeepLinker } from "$lib/shared/navigation/services/contracts/IDeepLinker";
import type { ILetterDeriver } from "$lib/shared/navigation/services/contracts/ILetterDeriver";
import type { IPositionDeriver } from "$lib/shared/navigation/services/contracts/IPositionDeriver";

const PENDING_EDIT_KEY = "tka-pending-edit-sequence";

/**
 * Session-level flag indicating a pending edit was processed this session.
 * This survives localStorage clearing and prevents persistence restoration
 * from overwriting the loaded sequence.
 */
let pendingEditProcessedThisSession = false;

export class DeepLinkSequenceHandler implements IDeepLinkSequenceHandler {
  constructor(
    private deepLinkService: IDeepLinker | null,
    private LetterDeriver: ILetterDeriver | null,
    private positionDeriverService: IPositionDeriver | null
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

      const sequence = JSON.parse(pendingData) as SequenceData;
      setSequence(sequence);

      // Enrich sequence with derived positions/letters in background
      // This is critical for imported sequences from Discover which have null positions
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
      beats: sequenceWithLetters.beats.map((beat, index) => ({
        ...beat,
        startPosition:
          beat.startPosition ??
          sequenceWithPositions.beats[index]?.startPosition,
        endPosition:
          beat.endPosition ?? sequenceWithPositions.beats[index]?.endPosition,
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
      startingPositionBeat: sequenceWithLetters.startingPositionBeat
        ? {
            ...sequenceWithLetters.startingPositionBeat,
            startPosition:
              sequenceWithLetters.startingPositionBeat.startPosition ??
              sequenceWithPositions.startingPositionBeat?.startPosition,
            endPosition:
              sequenceWithLetters.startingPositionBeat.endPosition ??
              sequenceWithPositions.startingPositionBeat?.endPosition,
          }
        : sequenceWithPositions.startingPositionBeat,
      // Add timestamp to ensure reactivity
      metadata: {
        ...sequenceWithLetters.metadata,
        _enrichedAt: Date.now(),
      },
    } as SequenceData;
  }
}
