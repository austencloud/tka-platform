/**
 * Draft Persistence Utility
 *
 * Handles localStorage persistence for feedback form drafts.
 * Prevents data loss from HMR, page refresh, or navigation.
 */

import type { FeedbackFormData } from "../domain/models/feedback-models";

const DRAFT_KEY = "tka-feedback-draft";

export interface FeedbackDraft {
  formData: FeedbackFormData;
  timestamp: number;
}

/**
 * Save draft to localStorage
 */
export function saveDraft(formData: FeedbackFormData): void {
  try {
    const draft: FeedbackDraft = {
      formData,
      timestamp: Date.now(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn("Failed to save feedback draft:", error);
  }
}

/**
 * Load draft from localStorage
 */
export function loadDraft(): FeedbackDraft | null {
  try {
    const stored = localStorage.getItem(DRAFT_KEY);
    if (!stored) return null;

    const draft: FeedbackDraft = JSON.parse(stored);
    return draft;
  } catch (error) {
    console.warn("Failed to load feedback draft:", error);
    return null;
  }
}

/**
 * Clear draft from localStorage
 */
export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    console.warn("Failed to clear feedback draft:", error);
  }
}

/**
 * Check if a draft exists
 */
export function hasDraft(): boolean {
  try {
    return localStorage.getItem(DRAFT_KEY) !== null;
  } catch {
    return false;
  }
}
