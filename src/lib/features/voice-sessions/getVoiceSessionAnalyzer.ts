import { VoiceSessionAnalyzer } from './services/implementations/VoiceSessionAnalyzer';

let instance: VoiceSessionAnalyzer | null = null;
export function getVoiceSessionAnalyzer(): VoiceSessionAnalyzer {
  return instance ??= new VoiceSessionAnalyzer();
}
