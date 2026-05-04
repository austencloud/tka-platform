import * as voiceSessionRepository from './services/voice-session-repository';

export function getVoiceSessionRepository(): typeof voiceSessionRepository {
  return voiceSessionRepository;
}
