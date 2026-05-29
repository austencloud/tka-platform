import { browser } from '$app/environment';

import { HandTrackingStabilizer } from './services/hand-tracking-stabilizer';

let instance: HandTrackingStabilizer | null = null;

export function getHandTrackingStabilizer(): HandTrackingStabilizer {
	if (!browser) throw new Error('getHandTrackingStabilizer() is browser-only');
	return instance ??= new HandTrackingStabilizer();
}
