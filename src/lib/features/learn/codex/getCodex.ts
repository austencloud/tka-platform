import { browser } from '$app/environment';

import { Codex } from './services/implementations/Codex';
import type { CodexLetterMappingRepo } from '$lib/shared/learn/services/CodexLetterMappingRepo';
import { getCodexLetterMappingRepo } from './getCodexLetterMappingRepo';
import * as codexPictographUpdater from './services/codex-pictograph-updater';
import { getQuizRepoManager } from '$lib/features/learn/quiz/getQuizRepoManager';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';

let instance: Codex | null = null;

export function getCodex(): Codex {
	if (!browser) throw new Error('getCodex() is browser-only');
	return instance ??= new Codex(
		getCodexLetterMappingRepo() as unknown as CodexLetterMappingRepo,
		getQuizRepoManager(),
		codexPictographUpdater,
		letterQueryHandler,
	);
}
