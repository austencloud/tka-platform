import type {
  MessageDraftRecord,
  MessageOutboxRecord,
} from "../../domain/message-delivery-models";

export interface IMessageDeliveryRepository {
  listDrafts(userId: string): Promise<MessageDraftRecord[]>;
  getDraft(
    userId: string,
    conversationId: string
  ): Promise<MessageDraftRecord | undefined>;
  putDraft(draft: MessageDraftRecord): Promise<void>;
  deleteDraft(userId: string, conversationId: string): Promise<void>;
  listOutbox(userId: string): Promise<MessageOutboxRecord[]>;
  putOutbox(item: MessageOutboxRecord): Promise<void>;
  deleteOutbox(messageId: string): Promise<void>;
  promoteDraftToOutbox(
    draftId: string,
    item: MessageOutboxRecord
  ): Promise<void>;
  purgeUser(userId: string): Promise<void>;
}
