import { MessageBatcher } from './services/implementations/MessageBatcher';

let instance: MessageBatcher | null = null;
export function getMessageBatcher(): MessageBatcher {
  return instance ??= new MessageBatcher();
}
