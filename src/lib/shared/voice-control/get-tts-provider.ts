import { WebSpeechTTSProvider } from './services/web-speech-tts-provider';

let instance: WebSpeechTTSProvider | null = null;
export function getTTSProvider(): WebSpeechTTSProvider {
  return instance ??= new WebSpeechTTSProvider();
}
