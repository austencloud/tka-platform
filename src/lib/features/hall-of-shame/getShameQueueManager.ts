import type { IShameQueueManager } from './services/contracts/IShameQueueManager';
import { ShameQueueManager } from './services/implementations/ShameQueueManager';

let instance: IShameQueueManager | null = null;
export function getShameQueueManager(): IShameQueueManager {
  return instance ??= new ShameQueueManager();
}
