import {
  FieldValue,
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  buildCanonicalReplyPreview,
  isAnonymousToken,
  MAX_MESSAGE_LENGTH,
  optionalReplyMessageId,
  requireSafeId,
  sanitizeClientAttachments,
} from "./messageDeliveryValidation";

interface DeliverMessageRequest {
  conversationId: string;
  messageId: string;
  content?: string;
  attachments?: unknown;
  replyTo?: { messageId?: string };
}

interface DeliverMessageResponse {
  messageId: string;
  alreadyDelivered: boolean;
}

function getMessagePreviewText(
  content: string,
  attachments: Record<string, unknown>[] | undefined
): string {
  if (content) return content.slice(0, 100);

  switch (attachments?.[0]?.type) {
    case "sequence":
      return "Shared a sequence";
    case "collection":
      return "Shared a collection";
    case "feedback":
      return "Shared feedback";
    case "link":
      return "Shared a link";
    default:
      return "Sent an attachment";
  }
}

export async function deliverMessageRequest(
  senderId: string,
  rawData: Partial<DeliverMessageRequest>,
  db: Firestore = getFirestore()
): Promise<DeliverMessageResponse> {
  const conversationId = requireSafeId(
    rawData.conversationId,
    "Conversation ID"
  );
  const messageId = requireSafeId(rawData.messageId, "Message ID");
  const content =
    typeof rawData.content === "string" ? rawData.content.trim() : "";
  if (content.length > MAX_MESSAGE_LENGTH) {
    throw new HttpsError("invalid-argument", "Message is too long.");
  }
  const attachments = sanitizeClientAttachments(rawData.attachments);
  if (!content && !attachments?.length) {
    throw new HttpsError("invalid-argument", "Message cannot be empty.");
  }
  const replyMessageId = optionalReplyMessageId(rawData.replyTo);
  if (replyMessageId === messageId) {
    throw new HttpsError(
      "invalid-argument",
      "A message cannot reply to itself."
    );
  }

  const conversationRef = db.doc(`conversations/${conversationId}`);
  const messageRef = conversationRef.collection("messages").doc(messageId);
  const replyRef = replyMessageId
    ? conversationRef.collection("messages").doc(replyMessageId)
    : null;

  let alreadyDelivered = false;
  await db.runTransaction(async (transaction) => {
    const [conversationSnapshot, messageSnapshot, replySnapshot] =
      await Promise.all([
        transaction.get(conversationRef),
        transaction.get(messageRef),
        replyRef ? transaction.get(replyRef) : Promise.resolve(null),
      ]);

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

    if (messageSnapshot.exists) {
      if (messageSnapshot.data()?.senderId !== senderId) {
        throw new HttpsError("already-exists", "Message ID is already in use.");
      }
      alreadyDelivered = true;
      return;
    }

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
    const replyTo = replyMessageId
      ? buildCanonicalReplyPreview(
          replyMessageId,
          replySnapshot?.exists ? replySnapshot.data() : undefined
        )
      : null;

    transaction.create(messageRef, {
      senderId,
      senderName,
      senderAvatar,
      content,
      createdAt: FieldValue.serverTimestamp(),
      readBy: [senderId],
      attachments: attachments ?? null,
      isDeleted: false,
      replyTo,
      reactions: null,
      editHistory: null,
    });

    const unreadUpdates: Record<string, unknown> = {};
    for (const participantId of participants) {
      if (participantId !== senderId) {
        unreadUpdates[`unreadCount.${participantId}`] = FieldValue.increment(1);
      }
    }
    transaction.update(conversationRef, {
      lastMessage: {
        messageId,
        content: getMessagePreviewText(content, attachments),
        senderId,
        senderName,
        createdAt: FieldValue.serverTimestamp(),
        hasAttachment: Boolean(attachments?.length),
      },
      updatedAt: FieldValue.serverTimestamp(),
      ...unreadUpdates,
    });
  });

  return { messageId, alreadyDelivered };
}

export const deliverMessage = onCall(async (request) => {
  const auth = request.auth;
  const senderId = auth?.uid;
  if (!senderId) {
    throw new HttpsError("unauthenticated", "Sign in to send messages.");
  }
  if (isAnonymousToken(auth.token)) {
    throw new HttpsError(
      "permission-denied",
      "Create an account to send messages."
    );
  }

  return deliverMessageRequest(
    senderId,
    (request.data ?? {}) as Partial<DeliverMessageRequest>
  );
});
