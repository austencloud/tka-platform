import type {
  FeedbackFormData,
  FeedbackDraft,
} from "../../domain/models/feedback-models";

export type DraftSaveStatus = "idle" | "saving" | "saved";

/**
 * Manages auto-saving feedback form drafts with debouncing.
 *
 * Prevents data loss from HMR, page refresh, or navigation by persisting
 * form state to localStorage with debounced saves.
 */
export interface IFormDraftPersister {
  /**
   * Current save status for UI feedback.
   */
  readonly saveStatus: DraftSaveStatus;

  /**
   * Schedule a debounced save of the form data.
   *
   * @param formData - Form data to save
   * @param debounceMs - Debounce delay in milliseconds (default: 500)
   */
  scheduleSave(formData: FeedbackFormData, debounceMs?: number): void;

  /**
   * Load the most recent draft from storage.
   *
   * @returns The saved draft or null if none exists
   */
  loadDraft(): FeedbackDraft | null;

  /**
   * Clear the saved draft from storage.
   */
  clearDraft(): void;

  /**
   * Check if a draft exists in storage.
   */
  hasDraft(): boolean;

  /**
   * Cancel any pending save operations.
   */
  cancelPendingSave(): void;
}
