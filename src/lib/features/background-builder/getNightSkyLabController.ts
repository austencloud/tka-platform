import { browser } from '$app/environment';

import { NightSkyLabController } from './services/implementations/NightSkyLabController';

let instance: NightSkyLabController | null = null;

export function getNightSkyLabController(): NightSkyLabController {
	if (!browser) throw new Error('getNightSkyLabController() is browser-only');
	return instance ??= new NightSkyLabController();
}
