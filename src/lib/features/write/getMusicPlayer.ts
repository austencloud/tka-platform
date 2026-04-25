import { browser } from '$app/environment';
import type { IMusicPlayer } from './services/contracts/IMusicPlayer';
import { MusicPlayer } from './services/implementations/MusicPlayer';

let instance: IMusicPlayer | null = null;

export function getMusicPlayer(): IMusicPlayer {
	if (!browser) throw new Error('getMusicPlayer() is browser-only');
	return instance ??= new MusicPlayer();
}
