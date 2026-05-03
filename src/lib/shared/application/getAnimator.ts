import { Animator } from './services/implementations/Animator';

let instance: Animator | null = null;
export function getAnimator(): Animator {
  return instance ??= new Animator();
}
