/**
 * FeedbackStatusService
 *
 * Handles feedback status updates, deferrals, and deletions.
 */

import {
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { firestoreDelete } from "$lib/shared/firestore";
import { authState } from "$lib/shared/auth/state/authState.svelte";

import type { FeedbackItem, FeedbackStatus, StatusHistoryEntry, } from "../../domain/models/feedback-models";
import { generateTitleFromDescription } from "../feedback-submission-service";
import { feedbackQueryService } from "./FeedbackQuerier";
import type { FeedbackQueryService } from "../implementations/FeedbackQuerier";

const COLLECTION_NAME = "feedback";

export class FeedbackStatusService {
  constructor(
    private readonly queryService: FeedbackQueryService = feedbackQueryService
  ) {}

  async updateStatus(
    feedbackId: string,
    status: FeedbackStatus
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    const docRef = doc(firestore, COLLECTION_NAME, feedbackId);

    const feedback = await this.queryService.getFeedback(feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };

    // Set archivedAt when moving to archived status
    if (status === "archived") {
      updateData["archivedAt"] = serverTimestamp();
    }

    // Track status change in history (with 60s debounce)
    const shouldRecord = this.shouldRecordStatusChange(
      feedback.statusHistory || [],
      feedback.status,
      status
    );

    if (shouldRecord) {
      const newEntry: StatusHistoryEntry = {
        status,
        timestamp: new Date(),
        fromStatus: feedback.status,
      };
      const updatedHistory = [...(feedback.statusHistory || []), newEntry];
      updateData["statusHistory"] = updatedHistory;
    }

    await updateDoc(docRef, updateData);
  }

  private shouldRecordStatusChange(
    history: StatusHistoryEntry[] = [],
    fromStatus: FeedbackStatus,
    toStatus: FeedbackStatus
  ): boolean {
    if (history.length === 0) return true;

    const lastEntry = history[history.length - 1];
    if (!lastEntry) return true;

    const isSameTransition =
      lastEntry.fromStatus === fromStatus && lastEntry.status === toStatus;
    if (!isSameTransition) return true;

    const now = new Date();
    const timeSinceLastEntry = now.getTime() - lastEntry.timestamp.getTime();
    const DEBOUNCE_MS = 60 * 1000;

    return timeSinceLastEntry >= DEBOUNCE_MS;
  }

  async deferFeedback(
    feedbackId: string,
    deferredUntil: Date,
    notes: string
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    const docRef = doc(firestore, COLLECTION_NAME, feedbackId);
    await updateDoc(docRef, {
      status: "archived",
      deferredUntil: Timestamp.fromDate(deferredUntil),
      adminNotes: notes,
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async deleteFeedback(feedbackId: string): Promise<void> {
    await firestoreDelete(COLLECTION_NAME, feedbackId);
  }

  async updateFeedback(
    feedbackId: string,
    updates: Partial<
      Pick<FeedbackItem, "type" | "title" | "description" | "priority" | "assignedTo" | "assignedToName">
    >
  ): Promise<void> {
    const firestore = await getFirestoreInstance();
    const docRef = doc(firestore, COLLECTION_NAME, feedbackId);

    const updateData: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    if (updates.type !== undefined) updateData["type"] = updates.type;
    if (updates.title !== undefined) updateData["title"] = updates.title;
    if (updates.description !== undefined)
      updateData["description"] = updates.description;
    if (updates.priority !== undefined)
      updateData["priority"] = updates.priority || null;
    if (updates.assignedTo !== undefined)
      updateData["assignedTo"] = updates.assignedTo || null;
    if (updates.assignedToName !== undefined)
      updateData["assignedToName"] = updates.assignedToName || null;

    await updateDoc(docRef, updateData);
  }

  async updateUserFeedback(
    feedbackId: string,
    updates: Partial<Pick<FeedbackItem, "type" | "description">>,
    appendMode: boolean = false
  ): Promise<FeedbackItem> {
    const firestore = await getFirestoreInstance();
    const user = authState.user;
    if (!user) {
      throw new Error("User must be authenticated to update feedback");
    }

    const feedback = await this.queryService.getFeedback(feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    if (feedback.userId !== user.uid) {
      throw new Error("You can only edit your own feedback");
    }

    const editableStatuses = ["new", "in-progress", "in-review"];
    if (!editableStatuses.includes(feedback.status)) {
      throw new Error(
        "Cannot edit feedback that has been completed or archived"
      );
    }

    if (feedback.status !== "new" && !appendMode) {
      throw new Error(
        "Can only add notes to feedback that is already being processed"
      );
    }

    const docRef = doc(firestore, COLLECTION_NAME, feedbackId);
    const updateData: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    if (feedback.status === "new") {
      if (updates.type !== undefined) {
        updateData["type"] = updates.type;
      }
      if (updates.description !== undefined) {
        updateData["description"] = updates.description;
        updateData["title"] =
          generateTitleFromDescription(
            updates.description
          );
      }
    } else {
      if (updates.description?.trim()) {
        const timestamp = new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        const appendedNote = `\n\n---\n**User update (${timestamp}):**\n${updates.description.trim()}`;
        updateData["description"] = feedback.description + appendedNote;
      }
    }

    await updateDoc(docRef, updateData);

    const updatedDoc = await getDoc(docRef);
    const { mapDocToFeedbackItem } = await import("../feedback-document-mapper");
    return mapDocToFeedbackItem(
      updatedDoc.id,
      updatedDoc.data()!
    );
  }

  async deleteUserFeedback(feedbackId: string): Promise<void> {
    const user = authState.user;
    if (!user) {
      throw new Error("User must be authenticated to delete feedback");
    }

    const feedback = await this.queryService.getFeedback(feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    if (feedback.userId !== user.uid) {
      throw new Error("You can only delete your own feedback");
    }

    if (feedback.status !== "new") {
      throw new Error("Cannot delete feedback that is already being processed");
    }

    await firestoreDelete(COLLECTION_NAME, feedbackId);
  }
}

// Export singleton instance
export const feedbackStatusService = new FeedbackStatusService();
