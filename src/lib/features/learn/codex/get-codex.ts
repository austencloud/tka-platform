import { browser } from '$app/environment';

import { Codex } from './services/codex';
import type { CodexLetterMappingRepo } from '$lib/shared/learn/services/CodexLetterMappingRepo';
import { getCodexLetterMappingRepo } from './get-codex-letter-mapping-repo';
import * as codexPictographUpdater from './services/codex-pictograph-updater';
import { getQuizRepoManager } from '$lib/features/learn/quiz/get-quiz-repo-manager';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/letter-query-handler';

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
