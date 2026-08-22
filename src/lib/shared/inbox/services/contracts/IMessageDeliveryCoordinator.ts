import type { MessageAttachment } from "$lib/shared/messaging/domain/models/message-models";
import type {
  MessageDeliveryProgress,
  MessageOutboxRecord,
} from "../../domain/message-delivery-models";

export interface MessageDeliveryHooks {
  onProgress?(progress: MessageDeliveryProgress): void;
  onPrepared?(attachments: MessageAttachment[]): Promise<void>;
}

export interface IMessageDeliveryCoordinator {
  deliver(
    item: MessageOutboxRecord,
    hooks?: MessageDeliveryHooks
  ): Promise<void>;
}
