import { VoiceSessionFormatter } from './services/implementations/VoiceSessionFormatter';

let instance: VoiceSessionFormatter | null = null;
export function getVoiceSessionFormatter(): VoiceSessionFormatter {
  return instance ??= new VoiceSessionFormatter();
}
