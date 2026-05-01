import { browser } from '$app/environment';
import { LoopViabilityService } from './services/implementations/LoopViabilityService';

let instance: LoopViabilityService | null = null;

export function getLoopViabilityService(): LoopViabilityService {
	if (!browser) throw new Error('getLoopViabilityService() is browser-only');
	return instance ??= new LoopViabilityService();
}
