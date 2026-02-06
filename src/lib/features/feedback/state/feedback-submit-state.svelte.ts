/**
 * Feedback Submit State
 *
 * State management for the feedback submission form.
 * Provides both a factory function and a shared singleton for use across
 * the submit tab and quick feedback panel.
 *
 * Note: Draft persistence is handled by FormDraftPersister service in FeedbackForm,
 * not here. This keeps state management separate from persistence concerns.
 */

import type {
  FeedbackFormData,
  FeedbackFormErrors,
  FeedbackSubmitStatus,
  FeedbackType,
} from "../domain/models/feedback-models";
import { feedbackService } from "../services/implementations/FeedbackRepository";
import {
  getCapturedModule,
  getCapturedTab,
} from "./feedback-context-tracker.svelte";

/**
 * Creates feedback submit form state
 */
export function createFeedbackSubmitState() {
  // Form data (simplified - just type, title, description)
  // Draft restoration is handled by FeedbackForm via FormDraftPersister
  let formData = $state<FeedbackFormData>({
    type: "general",
    title: "",
    description: "",
  });

  // Attached images
  let images = $state<File[]>([]);

  // Form errors
  let formErrors = $state<FeedbackFormErrors>({});

  // Submission status
  let submitStatus = $state<FeedbackSubmitStatus>("idle");

  // Derived state
  const isSubmitting = $derived(submitStatus === "submitting");

  // Actions
  function updateField<K extends keyof FeedbackFormData>(
    field: K,
    value: FeedbackFormData[K]
  ) {
    formData = { ...formData, [field]: value };

    // Clear error when field is updated
    if (formErrors[field as keyof FeedbackFormErrors]) {
      formErrors = { ...formErrors, [field]: undefined };
    }
  }

  function setType(type: FeedbackType) {
    updateField("type", type);
  }

  function validate(): boolean {
    const errors: FeedbackFormErrors = {};

    // Only description is required - title is optional (AI will generate if needed)

    if (!formData.description.trim()) {
      errors.description = "Description is required";
    } else if (formData.description.trim().length < 10) {
      errors.description =
        "Please provide a bit more detail (at least 10 characters)";
    }

    formErrors = errors;
    return Object.keys(errors).length === 0;
  }

  async function submit(): Promise<boolean> {
    if (!validate()) {
      return false;
    }

    submitStatus = "submitting";

    try {
      // Get captured context
      const capturedModule = getCapturedModule();
      const capturedTab = getCapturedTab();

      await feedbackService.submitFeedback(
        formData,
        capturedModule,
        capturedTab,
        images.length > 0 ? images : undefined
      );
      submitStatus = "success";
      // Draft clearing is handled by FeedbackForm via FormDraftPersister
      return true;
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      submitStatus = "error";
      return false;
    }
  }

  function reset() {
    formData = {
      type: "general",
      title: "",
      description: "",
    };
    images = [];
    formErrors = {};
    submitStatus = "idle";
    // Draft clearing is handled by FeedbackForm via FormDraftPersister
  }

  return {
    // State
    get formData() {
      return formData;
    },
    get images() {
      return images;
    },
    set images(value: File[]) {
      images = value;
    },
    get formErrors() {
      return formErrors;
    },
    get submitStatus() {
      return submitStatus;
    },
    get isSubmitting() {
      return isSubmitting;
    },
    get isFormValid() {
      // Compute directly to survive HMR - don't use $derived
      return formData.description.trim().length >= 10;
    },
    // Captured context (evaluated dynamically when accessed)
    get capturedModule() {
      return getCapturedModule();
    },
    get capturedTab() {
      return getCapturedTab();
    },

    // Actions
    updateField,
    setType,
    validate,
    submit,
    reset,
  };
}

export type FeedbackSubmitState = ReturnType<typeof createFeedbackSubmitState>;

/**
 * Shared singleton state for feedback submission.
 * Used by both FeedbackSubmitTab and QuickFeedbackPanel to share draft state.
 */
let sharedSubmitState: FeedbackSubmitState | null = null;

/**
 * Get or create the shared feedback submit state.
 * This ensures both the submit tab and quick panel use the same state,
 * so draft persistence works across both.
 */
export function getSharedFeedbackSubmitState(): FeedbackSubmitState {
  if (!sharedSubmitState) {
    sharedSubmitState = createFeedbackSubmitState();
  }
  return sharedSubmitState;
}

/**
 * Reset the shared state (e.g., after successful submission).
 * This should be called after a successful submission to clear the form.
 */
export function resetSharedFeedbackSubmitState(): void {
  if (sharedSubmitState) {
    sharedSubmitState.reset();
  }
}
