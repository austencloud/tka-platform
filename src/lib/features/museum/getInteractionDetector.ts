import { InteractionDetector } from '$lib/features/museum/scenes/procedural/services/implementations/InteractionDetector';

let instance: InteractionDetector | null = null;

export function getInteractionDetector(): InteractionDetector {
  return instance ??= new InteractionDetector();
}
