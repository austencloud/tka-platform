import { browser } from '$app/environment';

import { OrientationContinuityValidator } from './services/implementations/OrientationContinuityValidator';

let instance: OrientationContinuityValidator | null = null;

export function getOrientationContinuityValidator(): OrientationContinuityValidator {
	if (!browser) throw new Error('getOrientationContinuityValidator() is browser-only');
	return instance ??= new OrientationContinuityValidator();
}
