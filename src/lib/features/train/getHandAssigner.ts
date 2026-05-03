import { browser } from '$app/environment';

import { HandAssigner } from './services/implementations/HandAssigner';
import { getHandTrackingStabilizer } from './getHandTrackingStabilizer';

let instance: HandAssigner | null = null;

export function getHandAssigner(): HandAssigner {
	if (!browser) throw new Error('getHandAssigner() is browser-only');
	return instance ??= new HandAssigner(getHandTrackingStabilizer());
}
