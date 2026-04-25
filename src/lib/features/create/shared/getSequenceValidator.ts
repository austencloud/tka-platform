import { browser } from '$app/environment';
import type { ISequenceValidator } from './services/contracts/ISequenceValidator';
import { SequenceValidator } from './services/implementations/SequenceValidator';

let instance: ISequenceValidator | null = null;

export function getSequenceValidator(): ISequenceValidator {
	if (!browser) throw new Error('getSequenceValidator() is browser-only');
	return instance ??= new SequenceValidator();
}
