import { browser } from '$app/environment';
import type { IVoiceRecorder } from './services/contracts/IVoiceRecorder';
import { VoiceRecorder } from './services/implementations/VoiceRecorder';

let instance: IVoiceRecorder | null = null;

export function getVoiceRecorder(): IVoiceRecorder {
	if (!browser) throw new Error('getVoiceRecorder() is browser-only');
	return instance ??= new VoiceRecorder();
}
