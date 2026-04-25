import type { IAnimationStorageManager } from './services/contracts/IAnimationStorageManager';
import { AnimationStorageManager } from './services/implementations/AnimationStorageManager';

let instance: IAnimationStorageManager | null = null;
export function getAnimationStorageManager(): IAnimationStorageManager {
  return instance ??= new AnimationStorageManager();
}
