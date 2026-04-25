import { browser } from '$app/environment';
import type { IVoiceCommandHandler } from './services/contracts/IVoiceCommandHandler';
import { VoiceCommandHandler } from './services/implementations/VoiceCommandHandler';

let instance: IVoiceCommandHandler | null = null;

export function getVoiceCommandHandler(): IVoiceCommandHandler {
	if (!browser) throw new Error('getVoiceCommandHandler() is browser-only');
	return instance ??= new VoiceCommandHandler();
}
