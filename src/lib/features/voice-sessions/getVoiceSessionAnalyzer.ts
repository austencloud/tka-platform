import type { IVoiceSessionAnalyzer } from './services/contracts/IVoiceSessionAnalyzer';
import { VoiceSessionAnalyzer } from './services/implementations/VoiceSessionAnalyzer';

let instance: IVoiceSessionAnalyzer | null = null;
export function getVoiceSessionAnalyzer(): IVoiceSessionAnalyzer {
  return instance ??= new VoiceSessionAnalyzer();
}
