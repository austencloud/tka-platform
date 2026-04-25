import { browser } from '$app/environment';
import type { ILoopViabilityService } from './services/contracts/ILoopViabilityService';
import { LoopViabilityService } from './services/implementations/LoopViabilityService';

let instance: ILoopViabilityService | null = null;

export function getLoopViabilityService(): ILoopViabilityService {
	if (!browser) throw new Error('getLoopViabilityService() is browser-only');
	return instance ??= new LoopViabilityService();
}
