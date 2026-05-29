import { browser } from '$app/environment';
import { LetterTransitionGraph } from './services/letter-transition-graph';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';

let instance: LetterTransitionGraph | null = null;

export function getLetterTransitionGraph(): LetterTransitionGraph {
	if (!browser) throw new Error('getLetterTransitionGraph() is browser-only');
	if (!instance) {
		instance = new LetterTransitionGraph();
		instance.setLetterQueryHandler(letterQueryHandler);
	}
	return instance;
}
