import { browser } from '$app/environment';
import { CandidateFormatter } from './services/implementations/CandidateFormatter';

let instance: CandidateFormatter | null = null;

export function getCandidateFormatter(): CandidateFormatter {
	if (!browser) throw new Error('getCandidateFormatter() is browser-only');
	return instance ??= new CandidateFormatter();
}
