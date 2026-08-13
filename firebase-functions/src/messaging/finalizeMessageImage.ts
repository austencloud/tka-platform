import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  InvalidMessageImageError,
  normalizeMessageImage,
} from "./messageImageNormalizer";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 2000;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const DECLARED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface FinalizeMessageImageRequest {
  conversationId: string;
  messageId: string;
  attachmentId: string;
  content?: string;
  replyTo?: {
    messageId: string;
  };
}

interface CanonicalReplyPreview {
  messageId: string;
  senderId: string;
  senderName: string;
  content: string;
  attachmentType?: string;
}

interface FinalizeMessageImageResponse {
  messageId: string;
  storagePath: string;
  width: number;
  height: number;
}

function requireSafeId(value: unknown, field: string): string {
  if (typeof value !== "string" || !SAFE_ID.test(value)) {
    throw new HttpsError("invalid-argument", `${field} is invalid.`);
  }
  return value;
}

function optionalReplyMessageId(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== "object") {
    throw new HttpsError("invalid-argument", "Reply preview is invalid.");
  }

  const reply = value as Record<string, unknown>;
  return requireSafeId(reply.messageId, "Reply message ID");
}

export function buildCanonicalReplyPreview(
  messageId: string,
  data: Record<string, unknown> | undefined
): CanonicalReplyPreview {
  if (!data || data.isDeleted === true) {
    throw new HttpsError(
      "failed-precondition",
      "The original message is no longer available."
    );
  }

  const senderId = typeof data.senderId === "string" ? data.senderId : "";
  const senderName =
    typeof data.senderName === "string" ? data.senderName.trim() : "";
  const content = typeof data.content === "string" ? data.content : "";
  if (!senderId || !senderName || content.length > MAX_MESSAGE_LENGTH) {
    throw new HttpsError(
      "failed-precondition",
      "The original message cannot be quoted."
    );
  }

  const preview: CanonicalReplyPreview = {
    messageId,
    senderId,
    senderName: senderName.slice(0, 120),
    content,
  };
  const attachments = Array.isArray(data.attachments) ? data.attachments : [];
  const attachment = attachments[0] as Record<string, unknown> | undefined;
  if (typeof attachment?.type === "string") {
    preview.attachmentType = attachment.type;
  }
  return preview;
}

function isAnonymousToken(token: Record<string, unknown>): boolean {
  const firebase = token.firebase as { sign_in_provider?: string } | undefined;
  return firebase?.sign_in_provider === "anonymous";
}

export const finalizeMessageImage = onCall(
  { timeoutSeconds: 60, memory: "512MiB" },
  async (request): Promise<FinalizeMessageImageResponse> => {
    const auth = request.auth;
    const senderId = auth?.uid;
    if (!senderId) {
      throw new HttpsError("unauthenticated", "Sign in to send images.");
    }
    if (isAnonymousToken(auth.token)) {
      throw new HttpsError(
        "permission-denied",
        "Create an account to send images."
      );
    }

    const data = (request.data ?? {}) as Partial<FinalizeMessageImageRequest>;
    const conversationId = requireSafeId(
      data.conversationId,
      "Conversation ID"
    );
    const messageId = requireSafeId(data.messageId, "Message ID");
    const attachmentId = requireSafeId(data.attachmentId, "Attachment ID");
    const content = typeof data.content === "string" ? data.content.trim() : "";
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new HttpsError("invalid-argument", "Message is too long.");
    }
    const replyMessageId = optionalReplyMessageId(data.replyTo);
    if (replyMessageId === messageId) {
      throw new HttpsError(
        "invalid-argument",
        "A message cannot reply to itself."
      );
    }

    const db = getFirestore();
    const bucket = getStorage().bucket();
    const conversationRef = db.doc(`conversations/${conversationId}`);
    const messageRef = conversationRef.collection("messages").doc(messageId);
    const replyRef = replyMessageId
      ? conversationRef.collection("messages").doc(replyMessageId)
      : null;
    const stagingPath = `message-image-staging/${senderId}/${conversationId}/${messageId}/${attachmentId}`;
    const finalPath = `message-images/${conversationId}/${messageId}/${attachmentId}.webp`;
    const stagingFile = bucket.file(stagingPath);
    const finalFile = bucket.file(finalPath);

    const conversationSnapshot = await conversationRef.get();
    if (!conversationSnapshot.exists) {
      throw new HttpsError("not-found", "Conversation not found.");
    }
    const conversation = conversationSnapshot.data() ?? {};
    const participants = Array.isArray(conversation.participants)
      ? (conversation.participants as string[])
      : [];
    if (!participants.includes(senderId)) {
      throw new HttpsError(
        "permission-denied",
        "You are not part of this conversation."
      );
    }

    const existingMessage = await messageRef.get();
    if (existingMessage.exists) {
      if (existingMessage.data()?.senderId !== senderId) {
        throw new HttpsError("already-exists", "Message ID is already in use.");
      }
      await stagingFile.delete({ ignoreNotFound: true });
      const attachment = existingMessage.data()?.attachments?.[0];
      return {
        messageId,
        storagePath: attachment?.storagePath ?? finalPath,
        width: attachment?.width ?? 0,
        height: attachment?.height ?? 0,
      };
    }

    const [metadata] = await stagingFile.getMetadata().catch(() => {
      throw new HttpsError("not-found", "The staged image was not found.");
    });
    const declaredType = metadata.contentType ?? "";
    const declaredSize = Number(metadata.size ?? 0);
    if (
      !DECLARED_IMAGE_TYPES.has(declaredType) ||
      !Number.isFinite(declaredSize) ||
      declaredSize <= 0 ||
      declaredSize > MAX_UPLOAD_BYTES
    ) {
      await stagingFile.delete({ ignoreNotFound: true });
      throw new HttpsError(
        "invalid-argument",
        "The image type or size is invalid."
      );
    }

    const [input] = await stagingFile.download();
    let normalized;
    try {
      normalized = await normalizeMessageImage(input);
    } catch (error) {
      await stagingFile.delete({ ignoreNotFound: true });
      if (error instanceof InvalidMessageImageError) {
        throw new HttpsError("invalid-argument", error.message);
      }
      throw error;
    }

    await finalFile.save(normalized.buffer, {
      resumable: false,
      metadata: {
        contentType: normalized.contentType,
        cacheControl: "private, max-age=3600",
        contentDisposition: "inline",
        metadata: { conversationId, messageId, attachmentId, senderId },
      },
    });

    const participantInfo =
      typeof conversation.participantInfo === "object" &&
      conversation.participantInfo !== null
        ? (conversation.participantInfo as Record<
            string,
            Record<string, unknown>
          >)
        : {};
    const senderInfo = participantInfo[senderId] ?? {};
    const senderName =
      typeof senderInfo.displayName === "string" &&
      senderInfo.displayName.trim()
        ? senderInfo.displayName.trim().slice(0, 120)
        : "Unknown User";
    const senderAvatar =
      typeof senderInfo.avatar === "string" ? senderInfo.avatar : null;
    const attachment = {
      id: attachmentId,
      type: "image",
      storagePath: finalPath,
      contentType: normalized.contentType,
      byteSize: normalized.buffer.length,
      width: normalized.width,
      height: normalized.height,
      name: "Shared image",
    };

    try {
      await db.runTransaction(async (transaction) => {
        const [freshConversation, freshMessage, freshReply] = await Promise.all(
          [
            transaction.get(conversationRef),
            transaction.get(messageRef),
            replyRef ? transaction.get(replyRef) : Promise.resolve(null),
          ]
        );
        if (!freshConversation.exists) {
          throw new HttpsError("not-found", "Conversation not found.");
        }
        const freshParticipants = freshConversation.data()?.participants;
        if (
          !Array.isArray(freshParticipants) ||
          !freshParticipants.includes(senderId)
        ) {
          throw new HttpsError(
            "permission-denied",
            "You are not part of this conversation."
          );
        }
        if (freshMessage.exists) {
          if (freshMessage.data()?.senderId !== senderId) {
            throw new HttpsError(
              "already-exists",
              "Message ID is already in use."
            );
          }
          return;
        }
        const replyTo = replyMessageId
          ? buildCanonicalReplyPreview(
              replyMessageId,
              freshReply?.exists ? freshReply.data() : undefined
            )
          : undefined;

        transaction.create(messageRef, {
          senderId,
          senderName,
          senderAvatar,
          content,
          createdAt: FieldValue.serverTimestamp(),
          readBy: [senderId],
          attachments: [attachment],
          isDeleted: false,
          replyTo: replyTo ?? null,
          reactions: null,
          editHistory: null,
        });

        const unreadUpdates: Record<string, unknown> = {};
        for (const participantId of freshParticipants) {
          if (participantId !== senderId) {
            unreadUpdates[`unreadCount.${participantId}`] =
              FieldValue.increment(1);
          }
        }
        transaction.update(conversationRef, {
          lastMessage: {
            messageId,
            content: content.slice(0, 100) || "Sent an image",
            senderId,
            senderName,
            createdAt: FieldValue.serverTimestamp(),
            hasAttachment: true,
          },
          updatedAt: FieldValue.serverTimestamp(),
          ...unreadUpdates,
        });
      });
    } catch (error) {
      await finalFile.delete({ ignoreNotFound: true });
      throw error;
    } finally {
      await stagingFile.delete({ ignoreNotFound: true });
    }

    return {
      messageId,
      storagePath: finalPath,
      width: normalized.width,
      height: normalized.height,
    };
  }
);
