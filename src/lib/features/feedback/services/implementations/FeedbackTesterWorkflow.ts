/**
 * FeedbackTesterWorkflowService
 *
 * Handles admin-tester interactions: responses, confirmations, and notifications.
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { authState } from "$lib/shared/auth/state/authState.svelte";

import type { AdminResponse, TesterConfirmation, TesterConfirmationStatus, FeedbackStatus, } from "../../domain/models/feedback-models";
import type { FeedbackNotification } from "../../domain/models/notification-models";
import { notificationTriggerService } from "./NotificationTrigger";
import { feedbackQueryService } from "./FeedbackQuerier";
import type { FeedbackQueryService } from "../implementations/FeedbackQuerier";

const COLLECTION_NAME = "feedback";

export class FeedbackTesterWorkflowService {
  constructor(
    private readonly queryService: FeedbackQueryService = feedbackQueryService
  ) {}

  async sendAdminResponse(
    feedbackId: string,
    message: string,
    notifyTester: boolean = true
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    const user = authState.user;
    if (!user) {
      throw new Error("User must be authenticated");
    }

    const feedback = await this.queryService.getFeedback(feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    const adminResponse: AdminResponse = {
      message,
      respondedAt: new Date(),
      respondedBy: user.uid,
    };

    const docRef = doc(firestore, COLLECTION_NAME, feedbackId);
    await updateDoc(docRef, {
      adminResponse,
      updatedAt: serverTimestamp(),
    });

    if (notifyTester) {
      await this.createNotification(
        feedback.userId,
        feedbackId,
        feedback.title,
        "feedback-response",
        message
      );
    }
  }

  async submitTesterConfirmation(
    feedbackId: string,
    status: TesterConfirmationStatus,
    comment?: string
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    const testerConfirmation: TesterConfirmation = {
      status,
      respondedAt: new Date(),
      ...(comment && { comment }),
    };

    const docRef = doc(firestore, COLLECTION_NAME, feedbackId);

    // Determine new status based on confirmation
    const newStatus: FeedbackStatus =
      status === "confirmed"
        ? "archived"
        : status === "needs-work"
          ? "in-progress"
          : "in-review";

    await updateDoc(docRef, {
      testerConfirmation,
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
  }

  async countPendingConfirmations(userId: string): Promise<number> {
    const firestore = await getFirestoreInstance();

    // Get in-review items for this user
    const inReviewQuery = query(
      collection(firestore, COLLECTION_NAME),
      where("userId", "==", userId),
      where("status", "==", "in-review")
    );

    const snapshot = await getDocs(inReviewQuery);

    // Count items where testerConfirmation is pending or doesn't exist
    let count = 0;
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const confirmation = data["testerConfirmation"] as
        | TesterConfirmation
        | undefined;
      if (!confirmation || confirmation.status === "pending") {
        count++;
      }
    });

    return count;
  }

  async notifyTesterResolved(
    feedbackId: string,
    message?: string
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    const feedback = await this.queryService.getFeedback(feedbackId);
    if (!feedback) return;

    await this.createNotification(
      feedback.userId,
      feedbackId,
      feedback.title,
      "feedback-resolved",
      message ||
        "Your feedback has been addressed! Please confirm if it works for you."
    );

    // Initialize tester confirmation as pending
    const docRef = doc(firestore, COLLECTION_NAME, feedbackId);
    await updateDoc(docRef, {
      "testerConfirmation.status": "pending",
      updatedAt: serverTimestamp(),
    });
  }

  private async createNotification(
    userId: string,
    feedbackId: string,
    feedbackTitle: string,
    type: FeedbackNotification["type"],
    message: string
  ): Promise<void> {
    const admin = authState.user;
    if (!admin) return;

    await notificationTriggerService.createFeedbackNotification(
      userId,
      type,
      feedbackId,
      feedbackTitle,
      message,
      admin.uid,
      admin.displayName || admin.email || "Admin"
    );
  }
}

// Export singleton instance
export const feedbackTesterWorkflowService =
  new FeedbackTesterWorkflowService();
