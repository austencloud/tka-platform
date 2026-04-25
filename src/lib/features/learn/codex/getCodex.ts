import { browser } from '$app/environment';
import type { ICodex } from './services/contracts/ICodex';
import { Codex } from './services/implementations/Codex';
import type { CodexLetterMappingRepo } from './services/implementations/CodexLetterMappingRepo';
import { getCodexLetterMappingRepo } from './getCodexLetterMappingRepo';
import { getCodexPictographUpdater } from './getCodexPictographUpdater';
import { getQuizRepoManager } from '$lib/features/learn/quiz/getQuizRepoManager';
import { letterQueryHandler } from '$lib/shared/pictograph/tka-glyph/services/implementations/LetterQueryHandler';

let instance: ICodex | null = null;

export function getCodex(): ICodex {
	if (!browser) throw new Error('getCodex() is browser-only');
	return instance ??= new Codex(
		getCodexLetterMappingRepo() as unknown as CodexLetterMappingRepo,
		getQuizRepoManager(),
		getCodexPictographUpdater(),
		letterQueryHandler,
	);
}
