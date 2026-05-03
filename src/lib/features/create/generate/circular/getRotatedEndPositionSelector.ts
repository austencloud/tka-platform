import { browser } from '$app/environment';
import { RotatedEndPositionSelector } from './services/implementations/RotatedEndPositionSelector';

let instance: RotatedEndPositionSelector | null = null;

export function getRotatedEndPositionSelector(): RotatedEndPositionSelector {
	if (!browser) throw new Error('getRotatedEndPositionSelector() is browser-only');
	return instance ??= new RotatedEndPositionSelector();
}
