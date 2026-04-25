import type { ITTSProvider } from './services/contracts/ITTSProvider';
import { WebSpeechTTSProvider } from './services/implementations/WebSpeechTTSProvider';

let instance: ITTSProvider | null = null;
export function getTTSProvider(): ITTSProvider {
  return instance ??= new WebSpeechTTSProvider();
}
