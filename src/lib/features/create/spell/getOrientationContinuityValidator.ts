import { browser } from '$app/environment';
import type { IOrientationContinuityValidator } from './services/contracts/IOrientationContinuityValidator';
import { OrientationContinuityValidator } from './services/implementations/OrientationContinuityValidator';

let instance: IOrientationContinuityValidator | null = null;

export function getOrientationContinuityValidator(): IOrientationContinuityValidator {
	if (!browser) throw new Error('getOrientationContinuityValidator() is browser-only');
	return instance ??= new OrientationContinuityValidator();
}
