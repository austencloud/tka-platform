import { browser } from '$app/environment';
import { loopViabilityService } from './services/loop-viability-service';

export function getLoopViabilityService(): typeof loopViabilityService {
	if (!browser) throw new Error('getLoopViabilityService() is browser-only');
	return loopViabilityService;
}
