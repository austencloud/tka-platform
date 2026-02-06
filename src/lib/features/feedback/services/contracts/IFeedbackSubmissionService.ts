/**
 * IFeedbackSubmissionService
 *
 * Handles feedback submission, image uploads, and messaging integration.
 */

import type { FeedbackFormData } from "../../domain/models/feedback-models";

export interface IFeedbackSubmissionService {
  /**
   * Submit new feedback from a user
   * @returns The created feedback document ID
   */
  submitFeedback(
    formData: FeedbackFormData,
    capturedModule: string,
    capturedTab: string,
    images?: File[]
  ): Promise<string>;

  /**
   * Generate a title from description if none provided
   */
  generateTitleFromDescription(description: string): string;
}
