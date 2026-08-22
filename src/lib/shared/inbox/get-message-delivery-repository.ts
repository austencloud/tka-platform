import type { IMessageDeliveryRepository } from "./services/contracts/IMessageDeliveryRepository";
import { MessageDeliveryRepository } from "./services/implementations/MessageDeliveryRepository";

let instance: IMessageDeliveryRepository | undefined;

export function getMessageDeliveryRepository(): IMessageDeliveryRepository {
  instance ??= new MessageDeliveryRepository();
  return instance;
}
