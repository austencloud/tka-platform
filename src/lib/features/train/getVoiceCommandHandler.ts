import { browser } from '$app/environment';
import { VoiceCommandHandler } from './services/implementations/VoiceCommandHandler';

let instance: VoiceCommandHandler | null = null;

export function getVoiceCommandHandler(): VoiceCommandHandler {
	if (!browser) throw new Error('getVoiceCommandHandler() is browser-only');
	return instance ??= new VoiceCommandHandler();
}
