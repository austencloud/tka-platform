import { browser } from '$app/environment';
import type { IHandAssigner } from './services/contracts/IHandAssigner';
import { HandAssigner } from './services/implementations/HandAssigner';
import { getHandTrackingStabilizer } from './getHandTrackingStabilizer';

let instance: IHandAssigner | null = null;

export function getHandAssigner(): IHandAssigner {
	if (!browser) throw new Error('getHandAssigner() is browser-only');
	return instance ??= new HandAssigner(getHandTrackingStabilizer());
}
