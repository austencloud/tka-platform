import { browser } from '$app/environment';
import type { ISoundPlayer } from './services/contracts/ISoundPlayer';
import { SoundPlayer } from './services/implementations/SoundPlayer';

let instance: ISoundPlayer | null = null;

export function getSoundPlayer(): ISoundPlayer {
	if (!browser) throw new Error('getSoundPlayer() is browser-only');
	return instance ??= new SoundPlayer();
}
