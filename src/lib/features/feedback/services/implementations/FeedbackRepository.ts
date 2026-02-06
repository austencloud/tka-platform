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
import type { IFeedbackService } from "../contracts/IFeedbackService";
import type {
  FeedbackItem,
  FeedbackFormData,
  FeedbackFilterOptions,
  FeedbackStatus,
  TesterConfirmationStatus,
} from "../../domain/models/feedback-models";

// Import focused services
import {
  feedbackSubmissionService,
  type FeedbackSubmissionService,
} from "./FeedbackSubmitter";
import {
  feedbackQueryService,
  type FeedbackQueryService,
} from "./FeedbackQuerier";
import {
  feedbackStatusService,
  type FeedbackStatusService,
} from "./FeedbackStatusManager";
import {
  feedbackTesterWorkflowService,
  type FeedbackTesterWorkflowService,
} from "./FeedbackTesterWorkflow";
import {
  feedbackSubscriptionService,
  type FeedbackSubscriptionService,
} from "./FeedbackSubscriber";

export class FeedbackService implements IFeedbackService {
  constructor(
    private readonly submissionService: FeedbackSubmissionService = feedbackSubmissionService,
    private readonly queryService: FeedbackQueryService = feedbackQueryService,
    private readonly statusService: FeedbackStatusService = feedbackStatusService,
    private readonly testerWorkflowService: FeedbackTesterWorkflowService = feedbackTesterWorkflowService,
    private readonly subscriptionService: FeedbackSubscriptionService = feedbackSubscriptionService
  ) {}

  // ============================================================
  // SUBMISSION
  // ============================================================

  async submitFeedback(
    formData: FeedbackFormData,
    capturedModule: string,
    capturedTab: string,
    images?: File[]
  ): Promise<string> {
    return this.submissionService.submitFeedback(
      formData,
      capturedModule,
      capturedTab,
      images
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
    return this.queryService.loadFeedback(filters, pageSize, lastDocId);
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
    return this.queryService.loadUserFeedback(userId, pageSize, lastDocId);
  }

  async getFeedback(feedbackId: string): Promise<FeedbackItem | null> {
    return this.queryService.getFeedback(feedbackId);
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
      Pick<FeedbackItem, "type" | "title" | "description" | "priority">
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
    return this.testerWorkflowService.sendAdminResponse(
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
    return this.testerWorkflowService.submitTesterConfirmation(
      feedbackId,
      status,
      comment
    );
  }

  async countPendingConfirmations(userId: string): Promise<number> {
    return this.testerWorkflowService.countPendingConfirmations(userId);
  }

  async notifyTesterResolved(
    feedbackId: string,
    message?: string
  ): Promise<void> {
    return this.testerWorkflowService.notifyTesterResolved(feedbackId, message);
  }

  // ============================================================
  // SUBSCRIPTIONS
  // ============================================================

  subscribeToFeedback(
    onUpdate: (items: FeedbackItem[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    return this.subscriptionService.subscribeToFeedback(onUpdate, onError);
  }

  subscribeToUserFeedback(
    userId: string,
    onUpdate: (items: FeedbackItem[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    return this.subscriptionService.subscribeToUserFeedback(
      userId,
      onUpdate,
      onError
    );
  }
}

// Export singleton instance (maintains backwards compatibility)
export const feedbackService = new FeedbackService();
