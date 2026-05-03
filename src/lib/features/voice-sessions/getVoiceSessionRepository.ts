import { VoiceSessionRepository } from './services/implementations/VoiceSessionRepository';

let instance: VoiceSessionRepository | null = null;
export function getVoiceSessionRepository(): VoiceSessionRepository {
  return instance ??= new VoiceSessionRepository();
}
