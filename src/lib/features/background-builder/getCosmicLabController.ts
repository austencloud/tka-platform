import { browser } from '$app/environment';

import { CosmicLabController } from './services/CosmicLabController';

let instance: CosmicLabController | null = null;

export function getCosmicLabController(): CosmicLabController {
	if (!browser) throw new Error('getCosmicLabController() is browser-only');
	return instance ??= new CosmicLabController();
}
