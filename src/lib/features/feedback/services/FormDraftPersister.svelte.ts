import type { DraftSaveStatus } from "$lib/shared/feedback/domain/feedback-contract-types";
import type {
  FeedbackFormData,
  FeedbackDraft,
} from "$lib/shared/feedback/domain/models/feedback-models";
import {
  saveDraft as saveToStorage,
  loadDraft as loadFromStorage,
  clearDraft as clearFromStorage,
  hasDraft as hasStoredDraft,
} from "../utils/draft-persistence";

/**
 * Manages auto-saving feedback form drafts with debouncing.
 */
export class FormDraftPersister {
  private _saveStatus = $state<DraftSaveStatus>("idle");
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  get saveStatus(): DraftSaveStatus {
    return this._saveStatus;
  }

  scheduleSave(formData: FeedbackFormData, debounceMs = 500): void {
    // Clear existing timers
    this.cancelPendingSave();

    // Only save if there's content
    if (
      formData.description.trim().length === 0 &&
      formData.title.trim().length === 0
    ) {
      clearFromStorage();
      this._saveStatus = "idle";
      return;
    }

    // Set status to saving
    this._saveStatus = "saving";

    // Debounce save
    this.saveTimer = setTimeout(() => {
      saveToStorage(formData);
      this._saveStatus = "saved";

      // Reset to idle after 2 seconds
      this.resetTimer = setTimeout(() => {
        this._saveStatus = "idle";
      }, 2000);
    }, debounceMs);
  }

  loadDraft(): FeedbackDraft | null {
    return loadFromStorage();
  }

  clearDraft(): void {
    clearFromStorage();
    this._saveStatus = "idle";
  }

  hasDraft(): boolean {
    return hasStoredDraft();
  }

  cancelPendingSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }
}
