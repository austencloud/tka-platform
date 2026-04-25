import type { IMessageBatcher } from './services/contracts/IMessageBatcher';
import { MessageBatcher } from './services/implementations/MessageBatcher';

let instance: IMessageBatcher | null = null;
export function getMessageBatcher(): IMessageBatcher {
  return instance ??= new MessageBatcher();
}
