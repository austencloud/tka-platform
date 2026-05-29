import { browser } from '$app/environment';

import { PositionDeriver } from './services/position-deriver';

let instance: PositionDeriver | null = null;

export function getPositionDeriver(): PositionDeriver {
	if (!browser) throw new Error('getPositionDeriver() is browser-only');
	return instance ??= new PositionDeriver();
}
