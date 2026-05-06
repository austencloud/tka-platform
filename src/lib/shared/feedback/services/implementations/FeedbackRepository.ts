/**
 * FeedbackService
 *
 * Facade for feedback operations. Delegates to focused services:
 * - FeedbackSubmissionService: submit, upload, messaging
 * - FeedbackQueryService: load, get, user queries
 * - FeedbackStatusService: status updates, defer, delete
 * - FeedbackTesterWorkflowService: admin/tester interactions
 * - FeedbackSubscriptionService: real-time subscriptions
 *
 * This facade maintains backwards compatibility with the original API.
 */

import type { Unsubscribe } from "firebase/firestore";

import type {
  FeedbackItem,
  FeedbackFormData,
  FeedbackFilterOptions,
  FeedbackProgressCallback,
  FeedbackStatus,
  TesterConfirmationStatus,
} from "$lib/shared/feedback/domain/models/feedback-models";

// Import focused services
import * as feedbackSubmissionModule from "$lib/shared/feedback/services/feedback-submission-service";
import * as feedbackQuerierModule from "$lib/shared/feedback/services/feedback-querier";
import {
  feedbackStatusService,
  type FeedbackStatusService,
} from "$lib/shared/feedback/services/implementations/FeedbackStatusManager";
import {
  getFeedbackTesterWorkflow,
  type IFeedbackTesterWorkflow,
} from "$lib/shared/feedback/services/IFeedbackTesterWorkflow";
import * as feedbackSubscriberModule from "$lib/shared/feedback/services/feedback-subscriber";

export class FeedbackService {
  constructor(
    private readonly statusService: FeedbackStatusService = feedbackStatusService,
  ) {}

  private get testerWorkflow(): IFeedbackTesterWorkflow {
    const wf = getFeedbackTesterWorkflow();
    if (!wf) {
      throw new Error(
        "FeedbackTesterWorkflow not yet registered. " +
          "This method requires deferred registrations to have completed."
      );
    }
    return wf;
  }

  // ============================================================
  // SUBMISSION
  // ============================================================

  async submitFeedback(
    formData: FeedbackFormData,
    capturedModule: string,
    capturedTab: string,
    images?: File[],
    onProgress?: FeedbackProgressCallback,
    preUploadedImageUrls?: string[]
  ): Promise<string> {
    return feedbackSubmissionModule.submitFeedback(
      formData,
      capturedModule,
      capturedTab,
      images,
      onProgress,
      preUploadedImageUrls
    );
  }

  // ============================================================
  // QUERY
  // ============================================================

  async loadFeedback(
    filters: FeedbackFilterOptions,
    pageSize: number,
    lastDocId?: string
  ): Promise<{
    items: FeedbackItem[];
    lastDocId: string | null;
    hasMore: boolean;
  }> {
    return feedbackQuerierModule.loadFeedback(filters, pageSize, lastDocId);
  }

  async loadUserFeedback(
    userId: string,
    pageSize: number,
    lastDocId?: string
  ): Promise<{
    items: FeedbackItem[];
    lastDocId: string | null;
    hasMore: boolean;
  }> {
    return feedbackQuerierModule.loadUserFeedback(userId, pageSize, lastDocId);
  }

  async getFeedback(feedbackId: string): Promise<FeedbackItem | null> {
    return feedbackQuerierModule.getFeedback(feedbackId);
  }

  // ============================================================
  // STATUS & UPDATES
  // ============================================================

  async updateStatus(
    feedbackId: string,
    status: FeedbackStatus
  ): Promise<void> {
    return this.statusService.updateStatus(feedbackId, status);
  }

  async deferFeedback(
    feedbackId: string,
    deferredUntil: Date,
    notes: string
  ): Promise<void> {
    return this.statusService.deferFeedback(feedbackId, deferredUntil, notes);
  }

  async deleteFeedback(feedbackId: string): Promise<void> {
    return this.statusService.deleteFeedback(feedbackId);
  }

  async updateFeedback(
    feedbackId: string,
    updates: Partial<
      Pick<FeedbackItem, "type" | "title" | "description" | "priority" | "assignedTo" | "assignedToName">
    >
  ): Promise<void> {
    return this.statusService.updateFeedback(feedbackId, updates);
  }

  async updateUserFeedback(
    feedbackId: string,
    updates: Partial<Pick<FeedbackItem, "type" | "description">>,
    appendMode: boolean = false
  ): Promise<FeedbackItem> {
    return this.statusService.updateUserFeedback(
      feedbackId,
      updates,
      appendMode
    );
  }

  async deleteUserFeedback(feedbackId: string): Promise<void> {
    return this.statusService.deleteUserFeedback(feedbackId);
  }

  // ============================================================
  // TESTER WORKFLOW
  // ============================================================

  async sendAdminResponse(
    feedbackId: string,
    message: string,
    notifyTester: boolean = true
  ): Promise<void> {
    return this.testerWorkflow.sendAdminResponse(
      feedbackId,
      message,
      notifyTester
    );
  }

  async submitTesterConfirmation(
    feedbackId: string,
    status: TesterConfirmationStatus,
    comment?: string
  ): Promise<void> {
    return this.testerWorkflow.submitTesterConfirmation(
      feedbackId,
      status,
      comment
    );
  }

  async countPendingConfirmations(userId: string): Promise<number> {
    return this.testerWorkflow.countPendingConfirmations(userId);
  }

  async notifyTesterResolved(
    feedbackId: string,
    message?: string
  ): Promise<void> {
    return this.testerWorkflow.notifyTesterResolved(feedbackId, message);
  }

  // ============================================================
  // SUBSCRIPTIONS
  // ============================================================

  subscribeToFeedback(
    onUpdate: (items: FeedbackItem[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    return feedbackSubscriberModule.subscribeToFeedback(onUpdate, onError);
  }

  subscribeToUserFeedback(
    userId: string,
    onUpdate: (items: FeedbackItem[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    return feedbackSubscriberModule.subscribeToUserFeedback(userId, onUpdate, onError);
  }
}

// Export singleton instance (maintains backwards compatibility)
export const feedbackService = new FeedbackService();
