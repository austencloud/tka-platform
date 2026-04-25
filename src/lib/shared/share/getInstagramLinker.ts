import { browser } from '$app/environment';
import type { IInstagramLinker } from './services/contracts/IInstagramLinker';
import { InstagramLinker } from './services/implementations/InstagramLinker';

let instance: IInstagramLinker | null = null;

export function getInstagramLinker(): IInstagramLinker {
	if (!browser) throw new Error('getInstagramLinker() is browser-only');
	return instance ??= new InstagramLinker();
}
