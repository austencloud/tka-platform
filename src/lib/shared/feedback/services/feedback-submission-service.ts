/**
 * FeedbackSubmissionService
 *
 * Handles feedback submission, image uploads, and messaging integration.
 */

import {
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  getFirestoreInstance,
  getStorageInstance,
} from "$lib/shared/auth/firebase";
import { trackXP } from "$lib/shared/gamification/init/gamification-initializer";
import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { userPreviewState } from "$lib/shared/debug/state/user-preview-state.svelte";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";

import type {
  FeedbackFormData,
  FeedbackProgressCallback,
  FeedbackStatus,
} from "$lib/shared/feedback/domain/models/feedback-models";
import type { MessageAttachment } from "$lib/shared/messaging/domain/models/message-models";
import { conversationService } from "$lib/shared/messaging/services/conversation-manager";
import { messagingService } from "$lib/shared/messaging/services/messenger";
import { captureDeviceContext } from "$lib/shared/feedback/utils/device-context-capturer";

const ADMIN_USER_ID = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
const COLLECTION_NAME = "feedback";

export function generateTitleFromDescription(description: string): string {
  const trimmed = description.trim();

  // Try to get first sentence (up to . ! or ?)
  const sentenceMatch = trimmed.match(/^[^.!?]+[.!?]?/);
  if (
    sentenceMatch &&
    sentenceMatch[0].length >= 10 &&
    sentenceMatch[0].length <= 80
  ) {
    return sentenceMatch[0].trim();
  }

  // Otherwise take first ~60 chars at word boundary
  if (trimmed.length <= 60) {
    return trimmed;
  }

  const truncated = trimmed.substring(0, 60);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > 30) {
    return truncated.substring(0, lastSpace) + "...";
  }
  return truncated + "...";
}

export async function submitFeedback(
  formData: FeedbackFormData,
  capturedModule: string,
  capturedTab: string,
  images?: File[],
  onProgress?: FeedbackProgressCallback,
  preUploadedImageUrls?: string[]
): Promise<string> {
  const firestore = await getFirestoreInstance();
  const user = authState.user;
  if (!user) {
    throw new Error("User must be authenticated to submit feedback");
  }

  // Use effective user (respects preview mode for proper attribution)
  const effectiveUser = getEffectiveUser(user);

  // Generate title from description if not provided
  const title =
    formData.title?.trim() ||
    generateTitleFromDescription(formData.description);

  // Capture device context
  const deviceContext = captureDeviceContext(capturedModule, capturedTab);

  const feedbackData = {
    userId: effectiveUser.uid,
    userEmail: effectiveUser.email,
    userDisplayName: effectiveUser.displayName,
    userPhotoURL: effectiveUser.photoURL,
    type: formData.type,
    title,
    description: formData.description,
    // Preserve originals (write-once) for long-term analysis of user language
    originalTitle: title,
    originalDescription: formData.description,
    priority: null,
    capturedModule,
    capturedTab,
    deviceContext,
    source: "app" as const,
    status: "new" as FeedbackStatus,
    createdAt: serverTimestamp(),
    updatedAt: null,
  };

  // Report saving phase
  onProgress?.({ phase: "saving", fraction: 0 });

  let docRef;
  try {
    // Create document first to get ID
    docRef = await addDoc(
      collection(firestore, COLLECTION_NAME),
      feedbackData
    );
  } catch (error) {
    console.error("[FeedbackSubmitter] Failed to submit feedback:", error);
    toast.error("Failed to submit feedback. Please try again.");
    throw error;
  }

  // Attach images - use pre-uploaded URLs if available (instant), otherwise upload now
  if (preUploadedImageUrls && preUploadedImageUrls.length > 0) {
    try {
      await updateDoc(docRef, { imageUrls: preUploadedImageUrls });
    } catch (error) {
      console.error("[FeedbackSubmitter] Failed to attach pre-uploaded image URLs:", error);
      toast.warning("Feedback submitted but images may not be attached.");
    }
  } else if (images && images.length > 0) {
    // Fallback: upload during submit (used when pre-upload didn't complete)
    onProgress?.({ phase: "uploading", fraction: 0 });

    try {
      const imageUrls = await uploadImagesWithProgress(
        images,
        docRef.id,
        effectiveUser.uid,
        onProgress
      );
      await updateDoc(docRef, { imageUrls });
    } catch (error) {
      console.error("[FeedbackSubmitter] Failed to upload images:", error);
      toast.warning("Feedback submitted but some images failed to upload.");
    }
  }

  // Award XP for submitting feedback (non-blocking)
  trackXP("feedback_submitted", {
    feedbackId: docRef.id,
    feedbackType: formData.type,
  }).catch((err) => console.warn("Failed to track feedback XP:", err));

  // Send message to admin (non-blocking, skip if user is admin)
  const effectiveUserId = effectiveUser.uid;
  if (effectiveUserId !== ADMIN_USER_ID) {
    sendFeedbackMessage(
      docRef.id,
      title,
      formData.type,
      formData.description
    ).catch((err) =>
      console.error("[FeedbackSubmitter] Failed to send message:", err)
    );
  }

  return docRef.id;
}

function getEffectiveUser(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}) {
  if (userPreviewState.isActive && userPreviewState.data.profile) {
    return {
      uid: userPreviewState.data.profile.uid,
      email: userPreviewState.data.profile.email || "",
      displayName:
        userPreviewState.data.profile.displayName || "Unknown User",
      photoURL: userPreviewState.data.profile.photoURL || null,
    };
  }
  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || user.email || "Anonymous",
    photoURL: user.photoURL || null,
  };
}

/**
 * Upload all images concurrently using resumable uploads.
 * Aggregates bytesTransferred across all images into a single 0–1 fraction
 * so the UI can render a smooth progress bar.
 */
async function uploadImagesWithProgress(
  files: File[],
  feedbackId: string,
  userId: string,
  onProgress?: FeedbackProgressCallback
): Promise<string[]> {
  const { ref, uploadBytesResumable, getDownloadURL } =
    await import("firebase/storage");
  const storage = await getStorageInstance();

  // Per-image byte tracking for aggregate progress
  const transferred = new Array<number>(files.length).fill(0);
  const totals = files.map((f) => f.size);
  const grandTotal = totals.reduce((a, b) => a + b, 0);

  function reportAggregate() {
    if (!onProgress || grandTotal === 0) return;
    const sumTransferred = transferred.reduce((a, b) => a + b, 0);
    onProgress({ phase: "uploading", fraction: sumTransferred / grandTotal });
  }

  const uploadPromises = files.map((file, index) => {
    return new Promise<string>((resolve, reject) => {
      const timestamp = Date.now();
      const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `feedback/${userId}/${feedbackId}/${timestamp}_${sanitizedFilename}`;
      const storageRef = ref(storage, storagePath);

      const task = uploadBytesResumable(storageRef, file);

      task.on(
        "state_changed",
        (snapshot) => {
          transferred[index] = snapshot.bytesTransferred;
          reportAggregate();
        },
        (error) => {
          console.error(`[FeedbackSubmitter] Failed to upload image: ${file.name}`, error);
          reject(new Error(`Failed to upload image: ${file.name}`));
        },
        async () => {
          try {
            transferred[index] = totals[index]!;
            reportAggregate();
            const url = await getDownloadURL(storageRef);
            resolve(url);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  });

  return Promise.all(uploadPromises);
}

async function sendFeedbackMessage(
  feedbackId: string,
  title: string,
  type: FeedbackFormData["type"],
  description: string
): Promise<void> {
  // Use silent mode to avoid showing error toasts for this background operation
  // The feedback itself was already saved - failing to notify admin shouldn't alarm users
  const { conversation } =
    await conversationService.getOrCreateConversation(ADMIN_USER_ID, { silent: true });

  const feedbackAttachment: MessageAttachment = {
    type: "feedback",
    url: `/feedback/${feedbackId}`,
    metadata: {
      feedbackId,
      feedbackTitle: title,
      feedbackType: type,
      feedbackStatus: "new",
      feedbackDescription: description.slice(0, 200),
    },
  };

  await messagingService.sendMessage({
    conversationId: conversation.id,
    content: "[Feedback submitted]",
    attachments: [feedbackAttachment],
  });
}
