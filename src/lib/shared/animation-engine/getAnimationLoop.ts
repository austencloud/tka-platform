import { AnimationLoop } from './services/animation-loop';

let instance: AnimationLoop | null = null;
export function getAnimationLoop(): AnimationLoop {
  return instance ??= new AnimationLoop();
}
