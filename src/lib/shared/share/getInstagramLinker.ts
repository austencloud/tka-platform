import { browser } from '$app/environment';
import { InstagramLinker } from './services/implementations/InstagramLinker';

let instance: InstagramLinker | null = null;

export function getInstagramLinker(): InstagramLinker {
	if (!browser) throw new Error('getInstagramLinker() is browser-only');
	return instance ??= new InstagramLinker();
}
