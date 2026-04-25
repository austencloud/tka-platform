import { browser } from '$app/environment';
import type { ILOOPEndPositionSelector } from './services/contracts/ILOOPEndPositionSelector';
import { LOOPEndPositionSelector } from './services/implementations/LOOPEndPositionSelector';
import { getRotatedEndPositionSelector } from './getRotatedEndPositionSelector';

let instance: ILOOPEndPositionSelector | null = null;

export function getLOOPEndPositionSelector(): ILOOPEndPositionSelector {
	if (!browser) throw new Error('getLOOPEndPositionSelector() is browser-only');
	return instance ??= new LOOPEndPositionSelector(getRotatedEndPositionSelector());
}
