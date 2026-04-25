import { browser } from '$app/environment';
import type { ICodexLetterMappingRepo } from './services/contracts/ICodexLetterMappingRepo';
import { CodexLetterMappingRepo } from './services/implementations/CodexLetterMappingRepo';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';

let instance: ICodexLetterMappingRepo | null = null;

export function getCodexLetterMappingRepo(): ICodexLetterMappingRepo {
	if (!browser) throw new Error('getCodexLetterMappingRepo() is browser-only');
	if (!instance) {
		instance = new CodexLetterMappingRepo();
		// Inject the repo into the letter query handler if the method exists
		// This enables Codex-specific methods like getAllCodexPictographs
		if (letterQueryHandler.setLetterMappingRepo) {
			letterQueryHandler.setLetterMappingRepo(instance);
		}
	}
	return instance;
}
