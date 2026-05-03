import { browser } from '$app/environment';
import { RuleBasedTagger } from './services/implementations/RuleBasedTagger';

let instance: RuleBasedTagger | null = null;

export function getRuleBasedTagger(): RuleBasedTagger {
	if (!browser) throw new Error('getRuleBasedTagger() is browser-only');
	return instance ??= new RuleBasedTagger();
}
