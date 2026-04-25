import { browser } from '$app/environment';
import type { IRuleBasedTagger } from './services/contracts/IRuleBasedTagger';
import { RuleBasedTagger } from './services/implementations/RuleBasedTagger';

let instance: IRuleBasedTagger | null = null;

export function getRuleBasedTagger(): IRuleBasedTagger {
	if (!browser) throw new Error('getRuleBasedTagger() is browser-only');
	return instance ??= new RuleBasedTagger();
}
