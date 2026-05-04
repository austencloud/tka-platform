import * as voiceSessionFormatter from './services/voice-session-formatter';

export function getVoiceSessionFormatter(): typeof voiceSessionFormatter {
  return voiceSessionFormatter;
}
