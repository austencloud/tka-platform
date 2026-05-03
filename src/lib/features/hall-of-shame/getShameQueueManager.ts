import { ShameQueueManager } from './services/implementations/ShameQueueManager';

let instance: ShameQueueManager | null = null;
export function getShameQueueManager(): ShameQueueManager {
  return instance ??= new ShameQueueManager();
}
