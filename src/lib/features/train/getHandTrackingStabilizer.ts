import { browser } from '$app/environment';
import type { IHandTrackingStabilizer } from './services/contracts/IHandTrackingStabilizer';
import { HandTrackingStabilizer } from './services/implementations/HandTrackingStabilizer';

let instance: IHandTrackingStabilizer | null = null;

export function getHandTrackingStabilizer(): IHandTrackingStabilizer {
	if (!browser) throw new Error('getHandTrackingStabilizer() is browser-only');
	return instance ??= new HandTrackingStabilizer();
}
