import { AnimationPlaybackControllerFactory } from './services/implementations/AnimationPlaybackControllerFactory';

let instance: AnimationPlaybackControllerFactory | null = null;
export function getAnimationPlaybackControllerFactory(): AnimationPlaybackControllerFactory {
  return instance ??= new AnimationPlaybackControllerFactory();
}
