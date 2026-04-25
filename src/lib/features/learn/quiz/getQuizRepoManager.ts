import { browser } from '$app/environment';
import type { IQuizRepoManager } from './services/contracts/IQuizRepository';
import { QuizRepoManager } from './services/implementations/QuizRepoManager';
import type { CodexLetterMappingRepo } from '$lib/features/learn/codex/services/implementations/CodexLetterMappingRepo';
import { getCodexLetterMappingRepo } from '$lib/features/learn/codex/getCodexLetterMappingRepo';

let instance: IQuizRepoManager | null = null;

export function getQuizRepoManager(): IQuizRepoManager {
	if (!browser) throw new Error('getQuizRepoManager() is browser-only');
	return instance ??= new QuizRepoManager(
		getCodexLetterMappingRepo() as unknown as CodexLetterMappingRepo,
	);
}
