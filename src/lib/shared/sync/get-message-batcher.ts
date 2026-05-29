import { MessageBatcher } from './services/message-batcher';

let instance: MessageBatcher | null = null;
export function getMessageBatcher(): MessageBatcher {
  return instance ??= new MessageBatcher();
}
