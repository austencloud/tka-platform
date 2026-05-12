import { browser } from '$app/environment';
import { AudioAnalyzer } from './services/AudioAnalyzer';

let instance: AudioAnalyzer | null = null;

export function getAudioAnalyzer(): AudioAnalyzer {
	if (!browser) throw new Error('getAudioAnalyzer() is browser-only');
	return instance ??= new AudioAnalyzer();
}
