import { browser } from '$app/environment';
import type { IAudioAnalyzer } from './services/contracts/IAudioAnalyzer';
import { AudioAnalyzer } from './services/implementations/AudioAnalyzer';

let instance: IAudioAnalyzer | null = null;

export function getAudioAnalyzer(): IAudioAnalyzer {
	if (!browser) throw new Error('getAudioAnalyzer() is browser-only');
	return instance ??= new AudioAnalyzer();
}
