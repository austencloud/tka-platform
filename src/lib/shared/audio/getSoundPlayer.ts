import { browser } from '$app/environment';

import { SoundPlayer } from './services/implementations/SoundPlayer';

let instance: SoundPlayer | null = null;

export function getSoundPlayer(): SoundPlayer {
	if (!browser) throw new Error('getSoundPlayer() is browser-only');
	return instance ??= new SoundPlayer();
}
