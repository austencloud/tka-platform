import { browser } from '$app/environment';
import { MusicPlayer } from './services/music-player';

let instance: MusicPlayer | null = null;

export function getMusicPlayer(): MusicPlayer {
	if (!browser) throw new Error('getMusicPlayer() is browser-only');
	return instance ??= new MusicPlayer();
}
