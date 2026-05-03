import { AnimationStorageManager } from './services/implementations/AnimationStorageManager';

let instance: AnimationStorageManager | null = null;
export function getAnimationStorageManager(): AnimationStorageManager {
  return instance ??= new AnimationStorageManager();
}
