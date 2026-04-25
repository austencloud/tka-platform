import { browser } from '$app/environment';
import type { ILetterTransitionGraph } from './services/contracts/ILetterTransitionGraph';
import { LetterTransitionGraph } from './services/implementations/LetterTransitionGraph';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';

let instance: ILetterTransitionGraph | null = null;

export function getLetterTransitionGraph(): ILetterTransitionGraph {
	if (!browser) throw new Error('getLetterTransitionGraph() is browser-only');
	if (!instance) {
		instance = new LetterTransitionGraph();
		instance.setLetterQueryHandler(letterQueryHandler);
	}
	return instance;
}
