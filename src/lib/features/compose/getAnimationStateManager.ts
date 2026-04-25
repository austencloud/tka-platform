import type { IAnimationStateManager } from './services/contracts/IAnimationStateManager';
import { AnimationStateManager } from './services/implementations/AnimationStateManager';

let instance: IAnimationStateManager | null = null;
export function getAnimationStateManager(): IAnimationStateManager {
  return instance ??= new AnimationStateManager();
}
