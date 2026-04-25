import { browser } from '$app/environment';
import type { ICandidateFormatter } from './services/contracts/ICandidateFormatter';
import { CandidateFormatter } from './services/implementations/CandidateFormatter';

let instance: ICandidateFormatter | null = null;

export function getCandidateFormatter(): ICandidateFormatter {
	if (!browser) throw new Error('getCandidateFormatter() is browser-only');
	return instance ??= new CandidateFormatter();
}
