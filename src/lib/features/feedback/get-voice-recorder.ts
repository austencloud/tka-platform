import { browser } from '$app/environment';

import { VoiceRecorder } from './services/voice-recorder';

let instance: VoiceRecorder | null = null;

export function getVoiceRecorder(): VoiceRecorder {
	if (!browser) throw new Error('getVoiceRecorder() is browser-only');
	return instance ??= new VoiceRecorder();
}
