import type { IMessageImageSender } from "./services/contracts/IMessageImageSender";
import { MessageImageSender } from "./services/implementations/MessageImageSender";

let instance: IMessageImageSender | undefined;

export function getMessageImageSender(): IMessageImageSender {
  instance ??= new MessageImageSender();
  return instance;
}
