import { AnimationStateManager } from './services/animation-state-manager';

let instance: AnimationStateManager | null = null;
export function getAnimationStateManager(): AnimationStateManager {
  return instance ??= new AnimationStateManager();
}
