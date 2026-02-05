/**
 * IFeedbackTesterWorkflow
 *
 * Handles admin-tester interactions: responses, confirmations, and notifications.
 */

import type { TesterConfirmationStatus } from "../../domain/models/feedback-models";

export interface IFeedbackTesterWorkflow {
  /**
   * Send an admin response to feedback
   * Optionally notifies the tester
   */
  sendAdminResponse(
    feedbackId: string,
    message: string,
    notifyTester?: boolean
  ): Promise<void>;

  /**
   * Submit tester's confirmation on resolved feedback
   */
  submitTesterConfirmation(
    feedbackId: string,
    status: TesterConfirmationStatus,
    comment?: string
  ): Promise<void>;

  /**
   * Count pending confirmations for a user
   */
  countPendingConfirmations(userId: string): Promise<number>;

  /**
   * Notify tester when feedback is resolved
   */
  notifyTesterResolved(feedbackId: string, message?: string): Promise<void>;
}
