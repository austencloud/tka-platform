import type {
  Message,
  MessageAttachment,
  MessageAttachmentType,
  ReplyPreview,
} from "./models/message-models";

const MAX_PREVIEW_LENGTH = 100;

export function getMessagePreviewText(
  content: string,
  attachments?: readonly MessageAttachment[]
): string {
  const text = content.trim();
  if (text) return text.slice(0, MAX_PREVIEW_LENGTH);

  switch (attachments?.[0]?.type) {
    case "image":
      return "Sent an image";
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

const REPLY_ATTACHMENT_LABELS: Record<MessageAttachmentType, string> = {
  image: "Image",
  sequence: "Sequence",
  collection: "Collection",
  link: "Link",
  feedback: "Feedback",
};

/**
 * Replies keep a snapshot rather than borrowing the conversation-list preview.
 * The full text is retained so future presentations are not limited by today's
 * two-line quote, while attachment-only messages still carry useful context.
 */
export function buildReplyPreview(
  message: Pick<
    Message,
    "id" | "senderId" | "senderName" | "content" | "attachments"
  >
): ReplyPreview {
  const preview: ReplyPreview = {
    messageId: message.id,
    senderId: message.senderId,
    senderName: message.senderName,
    content: message.content,
  };
  const attachmentType = message.attachments?.[0]?.type;
  if (attachmentType) preview.attachmentType = attachmentType;
  return preview;
}

export function getReplyPreviewText(reply: ReplyPreview): string {
  const text = reply.content.trim();
  if (text) return text;
  if (reply.attachmentType)
    return REPLY_ATTACHMENT_LABELS[reply.attachmentType];
  return "Message";
}
