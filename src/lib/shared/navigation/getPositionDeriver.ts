import { browser } from '$app/environment';
import type { IPositionDeriver } from './services/contracts/IPositionDeriver';
import { PositionDeriver } from './services/implementations/PositionDeriver';
import { gridPositionDeriver } from '$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver';

let instance: IPositionDeriver | null = null;

export function getPositionDeriver(): IPositionDeriver {
	if (!browser) throw new Error('getPositionDeriver() is browser-only');
	return instance ??= new PositionDeriver(gridPositionDeriver);
}
