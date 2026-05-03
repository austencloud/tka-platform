import { browser } from '$app/environment';
import { AudioAnalyzer } from './services/implementations/AudioAnalyzer';

let instance: AudioAnalyzer | null = null;

export function getAudioAnalyzer(): AudioAnalyzer {
	if (!browser) throw new Error('getAudioAnalyzer() is browser-only');
	return instance ??= new AudioAnalyzer();
}
