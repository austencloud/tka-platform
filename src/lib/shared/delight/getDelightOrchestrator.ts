import type { IDelightOrchestrator } from './services/contracts/IDelightOrchestrator';
import { DelightOrchestrator } from './services/implementations/DelightOrchestrator';
import { getHapticFeedback } from '$lib/shared/application/getHapticFeedback';

let instance: IDelightOrchestrator | null = null;
export function getDelightOrchestrator(): IDelightOrchestrator {
  return instance ??= new DelightOrchestrator(getHapticFeedback());
}
