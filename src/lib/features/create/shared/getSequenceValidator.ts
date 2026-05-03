import { browser } from '$app/environment';
import { SequenceValidator } from './services/implementations/SequenceValidator';

let instance: SequenceValidator | null = null;

export function getSequenceValidator(): SequenceValidator {
	if (!browser) throw new Error('getSequenceValidator() is browser-only');
	return instance ??= new SequenceValidator();
}
