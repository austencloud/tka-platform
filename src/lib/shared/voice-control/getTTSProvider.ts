import { WebSpeechTTSProvider } from './services/implementations/WebSpeechTTSProvider';

let instance: WebSpeechTTSProvider | null = null;
export function getTTSProvider(): WebSpeechTTSProvider {
  return instance ??= new WebSpeechTTSProvider();
}
