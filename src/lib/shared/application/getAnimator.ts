import type { IAnimator } from './services/contracts/IAnimator';
import { Animator } from './services/implementations/Animator';

let instance: IAnimator | null = null;
export function getAnimator(): IAnimator {
  return instance ??= new Animator();
}
