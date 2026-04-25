import type { IVoiceSessionRepository } from './services/contracts/IVoiceSessionRepository';
import { VoiceSessionRepository } from './services/implementations/VoiceSessionRepository';

let instance: IVoiceSessionRepository | null = null;
export function getVoiceSessionRepository(): IVoiceSessionRepository {
  return instance ??= new VoiceSessionRepository();
}
