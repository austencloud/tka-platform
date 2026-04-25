import { browser } from '$app/environment';
import type { IPositionAnalyzer } from './services/contracts/IPositionAnalyzer';
import { PositionAnalyzer } from './services/implementations/PositionAnalyzer';
import { gridPositionDeriver } from '$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver';

let instance: IPositionAnalyzer | null = null;

export function getPositionAnalyzer(): IPositionAnalyzer {
	if (!browser) throw new Error('getPositionAnalyzer() is browser-only');
	return instance ??= new PositionAnalyzer(gridPositionDeriver);
}
