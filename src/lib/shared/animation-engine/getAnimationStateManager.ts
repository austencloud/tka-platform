import { AnimationStateManager } from './services/implementations/AnimationStateManager';

let instance: AnimationStateManager | null = null;
export function getAnimationStateManager(): AnimationStateManager {
  return instance ??= new AnimationStateManager();
}
