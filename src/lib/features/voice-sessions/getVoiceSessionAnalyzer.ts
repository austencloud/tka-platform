import * as voiceSessionAnalyzer from './services/voice-session-analyzer';

export function getVoiceSessionAnalyzer(): typeof voiceSessionAnalyzer {
  return voiceSessionAnalyzer;
}
