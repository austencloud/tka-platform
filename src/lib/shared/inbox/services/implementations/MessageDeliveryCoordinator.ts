import type { IMessageImageSender } from "$lib/shared/messaging/services/contracts/IMessageImageSender";
import type { MessageAttachment } from "$lib/shared/messaging/domain/models/message-models";
import type { Messenger } from "$lib/shared/messaging/services/messenger";
import type { ShortCodeManager } from "$lib/shared/qr/services/short-code-manager";
import { buildSequenceMessageAttachment } from "../../domain/message-attachment-builders";
import { restoreMessageAttachment } from "../../domain/message-delivery-models";
import type { MessageOutboxRecord } from "../../domain/message-delivery-models";
import type {
  IMessageDeliveryCoordinator,
  MessageDeliveryHooks,
} from "../contracts/IMessageDeliveryCoordinator";

export class MessageDeliveryCoordinator implements IMessageDeliveryCoordinator {
  constructor(
    private readonly messenger: Messenger,
    private readonly imageSender: IMessageImageSender,
    private readonly shortCodeManager: ShortCodeManager
  ) {}

  async deliver(
    item: MessageOutboxRecord,
    hooks: MessageDeliveryHooks = {}
  ): Promise<void> {
    const attachment = item.attachment
      ? restoreMessageAttachment(item.attachment)
      : undefined;

    if (attachment?.type === "image") {
      const handle = this.imageSender.send({
        conversationId: item.conversationId,
        messageId: item.id,
        attachmentId: attachment.attachmentId,
        file: attachment.file,
        content: item.content,
        replyTo: item.replyTo,
        onProgress: (progress) => {
          hooks.onProgress?.({
            label:
              progress.phase === "finalizing"
                ? "Preparing image"
                : `Uploading ${Math.round(progress.fraction * 100)}%`,
            fraction: progress.fraction,
          });
        },
      });
      await handle.promise;
      return;
    }

    let preparedAttachments = item.preparedAttachments;
    if (attachment?.type === "sequence" && !preparedAttachments?.length) {
      hooks.onProgress?.({ label: "Preparing sequence" });
      const { code } = await this.shortCodeManager.createShortCode(
        attachment.payload.sequence,
        { embedSequenceData: true }
      );
      preparedAttachments = [
        buildSequenceMessageAttachment(attachment.payload.sequence, code),
      ];
      await hooks.onPrepared?.(preparedAttachments);
    }

    if (attachment?.type === "collection" && !preparedAttachments?.length) {
      const payload = attachment.payload;
      const metadata: NonNullable<MessageAttachment["metadata"]> = {
        collectionId: payload.collectionId,
        collectionOwnerId: payload.ownerId,
        collectionName: payload.name,
        collectionSequenceCount: payload.sequenceCount,
      };
      if (payload.icon) metadata.collectionIcon = payload.icon;
      if (payload.color) metadata.collectionColor = payload.color;

      const collectionAttachment: MessageAttachment = {
        type: "collection",
        name: payload.name,
        metadata,
      };
      if (payload.coverImageUrl) {
        collectionAttachment.thumbnailUrl = payload.coverImageUrl;
      }
      preparedAttachments = [collectionAttachment];
      await hooks.onPrepared?.(preparedAttachments);
    }

    hooks.onProgress?.({ label: "Sending" });
    await this.messenger.sendMessage({
      messageId: item.id,
      conversationId: item.conversationId,
      content: item.content,
      attachments: preparedAttachments,
      replyTo: item.replyTo,
    });
  }
}
