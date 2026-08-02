import type { Firestore, Timestamp } from "firebase/firestore";
import { doc, updateDoc } from "firebase/firestore";
import type {
  Conversation,
  ConversationPreview,
  ConversationType,
  ParticipantInfo,
} from "../domain/models/conversation-models";

function getConversationType(data: Record<string, unknown>): ConversationType {
  return (data["type"] as ConversationType) || "direct";
}

export function mapDocToConversation(
  id: string,
  data: Record<string, unknown>
): Conversation {
  const rawLastMessage = data["lastMessage"] as
    | Record<string, unknown>
    | undefined;
  const lastMessage = rawLastMessage
    ? {
        messageId: rawLastMessage["messageId"] as string | undefined,
        content: rawLastMessage["content"] as string,
        senderId: rawLastMessage["senderId"] as string,
        senderName: rawLastMessage["senderName"] as string,
        createdAt:
          (rawLastMessage["createdAt"] as Timestamp)?.toDate() || new Date(),
        hasAttachment: rawLastMessage["hasAttachment"] as boolean | undefined,
      }
    : undefined;

  const rawGroupMetadata = data["groupMetadata"] as
    | Record<string, unknown>
    | undefined;
  const groupMetadata = rawGroupMetadata
    ? {
        name: rawGroupMetadata["name"] as string,
        description: rawGroupMetadata["description"] as string | undefined,
        avatarUrl: rawGroupMetadata["avatarUrl"] as string | undefined,
        adminIds: rawGroupMetadata["adminIds"] as string[],
        createdBy: rawGroupMetadata["createdBy"] as string,
      }
    : undefined;

  return {
    id,
    type: getConversationType(data),
    participants: data["participants"] as string[],
    participantInfo: data["participantInfo"] as Record<string, ParticipantInfo>,
    lastMessage,
    unreadCount: (data["unreadCount"] as Record<string, number>) || {},
    createdAt: (data["createdAt"] as Timestamp)?.toDate() || new Date(),
    updatedAt: (data["updatedAt"] as Timestamp)?.toDate() || new Date(),
    groupMetadata,
  };
}

export function mapDocToPreview(
  id: string,
  data: Record<string, unknown>,
  currentUserId: string
): ConversationPreview | null {
  const type = getConversationType(data);
  const participants = data["participants"] as string[];
  const participantInfo = data["participantInfo"] as Record<
    string,
    ParticipantInfo
  >;
  const unreadCount = (data["unreadCount"] as Record<string, number>) || {};

  const rawLastMessage = data["lastMessage"] as
    | Record<string, unknown>
    | undefined;
  const lastMessage = rawLastMessage
    ? {
        messageId: rawLastMessage["messageId"] as string | undefined,
        content: rawLastMessage["content"] as string,
        senderId: rawLastMessage["senderId"] as string,
        senderName: rawLastMessage["senderName"] as string,
        createdAt:
          (rawLastMessage["createdAt"] as Timestamp)?.toDate() || new Date(),
        hasAttachment: rawLastMessage["hasAttachment"] as boolean | undefined,
      }
    : undefined;

  if (type === "group") {
    const rawGroupMetadata = data["groupMetadata"] as
      | Record<string, unknown>
      | undefined;

    const otherParticipantIds = participants.filter((p) => p !== currentUserId);
    const participantPreviews = otherParticipantIds
      .slice(0, 4)
      .map((pid) => participantInfo[pid])
      .filter((p): p is ParticipantInfo => p !== undefined);

    return {
      id,
      type: "group",
      groupName: rawGroupMetadata?.["name"] as string,
      groupAvatar: rawGroupMetadata?.["avatarUrl"] as string | undefined,
      participantCount: participants.length,
      participantPreviews,
      lastMessage,
      unreadCount: unreadCount[currentUserId] || 0,
      updatedAt: (data["updatedAt"] as Timestamp)?.toDate() || new Date(),
    };
  }

  const otherUserId = participants.find((p) => p !== currentUserId) || "";

  if (!otherUserId || otherUserId === currentUserId) {
    return null;
  }

  const otherParticipant = participantInfo[otherUserId] || {
    userId: otherUserId,
    displayName: "Unknown User",
    joinedAt: new Date(),
  };

  return {
    id,
    type: "direct",
    otherParticipant,
    lastMessage,
    unreadCount: unreadCount[currentUserId] || 0,
    updatedAt: (data["updatedAt"] as Timestamp)?.toDate() || new Date(),
  };
}

export function previewNeedsRefresh(
  preview: ConversationPreview | null
): string | undefined {
  if (
    preview?.type === "direct" &&
    preview.otherParticipant?.displayName === "Loading..."
  ) {
    return preview.otherParticipant.userId;
  }
  return undefined;
}

export async function refreshParticipantInfo(
  firestore: Firestore,
  conversationId: string,
  userId: string,
  fetchUserInfo: (
    uid: string
  ) => Promise<{ displayName: string; photoURL?: string }>
): Promise<void> {
  try {
    const userInfo = await fetchUserInfo(userId);
    const conversationRef = doc(firestore, "conversations", conversationId);
    await updateDoc(conversationRef, {
      [`participantInfo.${userId}.displayName`]: userInfo.displayName,
      ...(userInfo.photoURL && {
        [`participantInfo.${userId}.avatar`]: userInfo.photoURL,
      }),
    });
  } catch (error) {
    console.error(
      "[conversation-mappers] Failed to refresh participant info:",
      error
    );
  }
}
