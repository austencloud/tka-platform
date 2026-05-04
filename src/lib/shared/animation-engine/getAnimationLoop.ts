import { AnimationLoop } from './services/implementations/AnimationLoop';

let instance: AnimationLoop | null = null;
export function getAnimationLoop(): AnimationLoop {
  return instance ??= new AnimationLoop();
}
