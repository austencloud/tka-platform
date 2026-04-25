import { browser } from '$app/environment';
import type { IRotatedEndPositionSelector } from './services/contracts/IRotatedEndPositionSelector';
import { RotatedEndPositionSelector } from './services/implementations/RotatedEndPositionSelector';

let instance: IRotatedEndPositionSelector | null = null;

export function getRotatedEndPositionSelector(): IRotatedEndPositionSelector {
	if (!browser) throw new Error('getRotatedEndPositionSelector() is browser-only');
	return instance ??= new RotatedEndPositionSelector();
}
