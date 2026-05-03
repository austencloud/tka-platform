
import { InteractionDetector } from './services/implementations/InteractionDetector';

let instance: InteractionDetector | null = null;
export function getInteractionDetector(): InteractionDetector {
  return instance ??= new InteractionDetector();
}
