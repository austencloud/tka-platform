import { browser } from '$app/environment';
import type { IUFOStatusPoller } from './services/contracts/IUFOStatusPoller';
import { UFOStatusPoller } from './services/implementations/UFOStatusPoller';

let instance: IUFOStatusPoller | null = null;

export function getUFOStatusPoller(): IUFOStatusPoller {
	if (!browser) throw new Error('getUFOStatusPoller() is browser-only');
	return instance ??= new UFOStatusPoller();
}
