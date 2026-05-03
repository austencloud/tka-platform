
import { DelightOrchestrator } from './services/implementations/DelightOrchestrator';
import { getHapticFeedback } from '$lib/shared/application/getHapticFeedback';

let instance: DelightOrchestrator | null = null;
export function getDelightOrchestrator(): DelightOrchestrator {
  return instance ??= new DelightOrchestrator(getHapticFeedback());
}
