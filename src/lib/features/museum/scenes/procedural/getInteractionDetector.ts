import type { IInteractionDetector } from './services/contracts/IInteractionDetector';
import { InteractionDetector } from './services/implementations/InteractionDetector';

let instance: IInteractionDetector | null = null;
export function getInteractionDetector(): IInteractionDetector {
  return instance ??= new InteractionDetector();
}
