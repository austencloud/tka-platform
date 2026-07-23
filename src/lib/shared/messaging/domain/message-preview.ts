import type { MessageAttachment } from "./models/message-models";

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
    case "feedback":
      return "Shared feedback";
    case "link":
      return "Shared a link";
    default:
      return "Sent an attachment";
  }
}
