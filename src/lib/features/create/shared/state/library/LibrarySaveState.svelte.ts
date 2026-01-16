/**
 * Library Save State
 *
 * Tracks whether the current sequence has been saved to the user's library
 * and whether it has been modified since the last save.
 *
 * Used to control:
 * - Visibility of "Add to Library" button (show when unsaved or dirty)
 * - Share flow (require save before sharing)
 * - Animated button states (idle → saving → success → hidden)
 *
 * RESPONSIBILITY: Pure state management for library save status
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { generateSequenceHash } from "../../utils/sequence-hash";

/**
 * Button animation states for the Add to Library button
 */
export type LibrarySaveButtonState = "idle" | "saving" | "success" | "hidden";

export interface LibrarySaveStateData {
  /** Firestore document ID of the saved sequence (null if never saved) */
  savedSequenceId: string | null;

  /** Content hash of the sequence when it was last saved */
  lastSavedHash: string | null;

  /** Timestamp of last successful save */
  lastSavedAt: Date | null;

  /** Whether a save operation is currently in progress */
  isSaving: boolean;

  /** Error from the last save attempt */
  saveError: string | null;

  /** Current button animation state */
  buttonState: LibrarySaveButtonState;
}

export function createLibrarySaveState() {
  const state = $state<LibrarySaveStateData>({
    savedSequenceId: null,
    lastSavedHash: null,
    lastSavedAt: null,
    isSaving: false,
    saveError: null,
    buttonState: "idle",
  });

  // Timer for auto-transitioning from success to hidden
  let successTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    // ============================================================================
    // GETTERS
    // ============================================================================

    get savedSequenceId() {
      return state.savedSequenceId;
    },

    get lastSavedHash() {
      return state.lastSavedHash;
    },

    get lastSavedAt() {
      return state.lastSavedAt;
    },

    get isSaving() {
      return state.isSaving;
    },

    get saveError() {
      return state.saveError;
    },

    get buttonState() {
      return state.buttonState;
    },

    // ============================================================================
    // COMPUTED PROPERTIES
    // ============================================================================

    /**
     * Check if the sequence has been saved to the library (has an ID)
     */
    isSequenceSaved(): boolean {
      return state.savedSequenceId !== null && state.lastSavedHash !== null;
    },

    /**
     * Check if the sequence content has changed since last save
     * @param currentSequence - The current sequence to compare against saved hash
     */
    isDirty(currentSequence: SequenceData | null): boolean {
      // Never saved = not "dirty" (it's just unsaved)
      if (!state.lastSavedHash) return false;

      const currentHash = generateSequenceHash(currentSequence);
      return currentHash !== state.lastSavedHash;
    },

    /**
     * Determine if the "Add to Library" button should be shown
     * Show when: sequence has content AND (not saved OR dirty)
     */
    shouldShowSaveButton(currentSequence: SequenceData | null): boolean {
      // Don't show if no sequence or empty
      if (!currentSequence) return false;

      // Need content to save
      const hasContent =
        currentSequence.steps.length > 0 ||
        currentSequence.startPosition ||
        currentSequence.startingPosition;

      if (!hasContent) return false;

      // Show if: never saved, currently saving, or has modifications
      if (!state.savedSequenceId) return true;
      if (state.isSaving) return true;
      if (state.buttonState === "saving") return true;
      if (state.buttonState === "success") return true; // Keep visible during success animation

      return this.isDirty(currentSequence);
    },

    /**
     * Check if share should proceed directly or require save first
     */
    canShareDirectly(currentSequence: SequenceData | null): boolean {
      return this.isSequenceSaved() && !this.isDirty(currentSequence);
    },

    // ============================================================================
    // ACTIONS - Save Flow
    // ============================================================================

    /**
     * Mark that a save operation has started
     */
    markSaveStarted() {
      if (successTimer) {
        clearTimeout(successTimer);
        successTimer = null;
      }
      state.isSaving = true;
      state.saveError = null;
      state.buttonState = "saving";
    },

    /**
     * Mark that save completed successfully
     * Triggers success animation → auto-hide flow
     * @param sequenceId - The Firestore document ID of the saved sequence
     * @param sequence - The sequence that was saved (for hashing)
     */
    markSaveComplete(sequenceId: string, sequence: SequenceData) {
      state.savedSequenceId = sequenceId;
      state.lastSavedHash = generateSequenceHash(sequence);
      state.lastSavedAt = new Date();
      state.isSaving = false;
      state.saveError = null;
      state.buttonState = "success";

      // Auto-transition to hidden after animation (1200ms total)
      if (successTimer) {
        clearTimeout(successTimer);
      }
      successTimer = setTimeout(() => {
        state.buttonState = "hidden";
        successTimer = null;
      }, 1200);
    },

    /**
     * Mark that save failed with an error
     */
    markSaveFailed(error: string) {
      if (successTimer) {
        clearTimeout(successTimer);
        successTimer = null;
      }
      state.isSaving = false;
      state.saveError = error;
      state.buttonState = "idle"; // Return to idle on error
    },

    // ============================================================================
    // ACTIONS - State Management
    // ============================================================================

    /**
     * Reset the button to idle state (e.g., when sequence is modified)
     * Called when user makes changes to a saved sequence
     */
    markDirty() {
      if (successTimer) {
        clearTimeout(successTimer);
        successTimer = null;
      }

      // Only reset if currently hidden or success
      if (state.buttonState === "hidden" || state.buttonState === "success") {
        state.buttonState = "idle";
      }
    },

    /**
     * Manually set button to hidden (for when button should not show)
     */
    hideButton() {
      if (successTimer) {
        clearTimeout(successTimer);
        successTimer = null;
      }
      state.buttonState = "hidden";
    },

    /**
     * Reset all library save state (e.g., when sequence is cleared)
     */
    reset() {
      if (successTimer) {
        clearTimeout(successTimer);
        successTimer = null;
      }
      state.savedSequenceId = null;
      state.lastSavedHash = null;
      state.lastSavedAt = null;
      state.isSaving = false;
      state.saveError = null;
      state.buttonState = "idle";
    },

    /**
     * Initialize state from a loaded sequence (e.g., loaded from library)
     * Used when user opens a sequence that's already in their library
     */
    initializeFromSavedSequence(sequenceId: string, sequence: SequenceData) {
      if (successTimer) {
        clearTimeout(successTimer);
        successTimer = null;
      }
      state.savedSequenceId = sequenceId;
      state.lastSavedHash = generateSequenceHash(sequence);
      state.lastSavedAt = null; // Unknown when it was last saved
      state.isSaving = false;
      state.saveError = null;
      state.buttonState = "hidden"; // Already saved, hide button
    },
  };
}

export type LibrarySaveState = ReturnType<typeof createLibrarySaveState>;
