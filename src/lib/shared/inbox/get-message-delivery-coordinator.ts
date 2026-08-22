import { getMessageImageSender } from "$lib/shared/messaging/get-message-image-sender";
import { messagingService } from "$lib/shared/messaging/services/messenger";
import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
import type { IMessageDeliveryCoordinator } from "./services/contracts/IMessageDeliveryCoordinator";
import { MessageDeliveryCoordinator } from "./services/implementations/MessageDeliveryCoordinator";

let instance: IMessageDeliveryCoordinator | undefined;

export function getMessageDeliveryCoordinator(): IMessageDeliveryCoordinator {
  instance ??= new MessageDeliveryCoordinator(
    messagingService,
    getMessageImageSender(),
    getShortCodeManager()
  );
  return instance;
}
