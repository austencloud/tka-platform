import { VoiceSessionRecorder } from './services/voice-session-recorder';

let instance: VoiceSessionRecorder | null = null;
export function getVoiceSessionRecorder(): VoiceSessionRecorder {
  return instance ??= new VoiceSessionRecorder();
}
