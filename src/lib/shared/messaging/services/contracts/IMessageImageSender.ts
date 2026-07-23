import type { ReplyPreview } from "../../domain/models/message-models";

export type MessageImageSendPhase = "uploading" | "finalizing";

export interface MessageImageSendProgress {
  phase: MessageImageSendPhase;
  fraction: number;
}

export interface MessageImageSendRequest {
  conversationId: string;
  messageId: string;
  attachmentId: string;
  file: File;
  content: string;
  replyTo?: ReplyPreview;
  onProgress?: (progress: MessageImageSendProgress) => void;
}

export interface MessageImageSendResult {
  messageId: string;
  storagePath: string;
  width: number;
  height: number;
}

export interface MessageImageSendHandle {
  promise: Promise<MessageImageSendResult>;
  cancel(): void;
}

export interface IMessageImageSender {
  send(request: MessageImageSendRequest): MessageImageSendHandle;
}
