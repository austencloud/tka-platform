import { VoiceSessionRecorder } from './services/implementations/VoiceSessionRecorder';

let instance: VoiceSessionRecorder | null = null;
export function getVoiceSessionRecorder(): VoiceSessionRecorder {
  return instance ??= new VoiceSessionRecorder();
}
