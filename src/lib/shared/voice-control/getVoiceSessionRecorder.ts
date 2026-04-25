import type { IVoiceSessionRecorder } from './services/contracts/IVoiceSessionRecorder';
import { VoiceSessionRecorder } from './services/implementations/VoiceSessionRecorder';

let instance: IVoiceSessionRecorder | null = null;
export function getVoiceSessionRecorder(): IVoiceSessionRecorder {
  return instance ??= new VoiceSessionRecorder();
}
