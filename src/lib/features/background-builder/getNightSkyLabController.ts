import { browser } from '$app/environment';
import type { INightSkyLabController } from './services/contracts/INightSkyLabController';
import { NightSkyLabController } from './services/implementations/NightSkyLabController';

let instance: INightSkyLabController | null = null;

export function getNightSkyLabController(): INightSkyLabController {
	if (!browser) throw new Error('getNightSkyLabController() is browser-only');
	return instance ??= new NightSkyLabController();
}
