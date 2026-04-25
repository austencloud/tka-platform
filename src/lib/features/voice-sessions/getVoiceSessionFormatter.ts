import type { IVoiceSessionFormatter } from './services/contracts/IVoiceSessionFormatter';
import { VoiceSessionFormatter } from './services/implementations/VoiceSessionFormatter';

let instance: IVoiceSessionFormatter | null = null;
export function getVoiceSessionFormatter(): IVoiceSessionFormatter {
  return instance ??= new VoiceSessionFormatter();
}
