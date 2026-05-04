import { browser } from '$app/environment';
import { QuizRepoManager } from './services/implementations/QuizRepoManager';
import type { CodexLetterMappingRepo } from '$lib/shared/learn/services/CodexLetterMappingRepo';
import { getCodexLetterMappingRepo } from '$lib/features/learn/codex/getCodexLetterMappingRepo';

let instance: QuizRepoManager | null = null;

export function getQuizRepoManager(): QuizRepoManager {
	if (!browser) throw new Error('getQuizRepoManager() is browser-only');
	return instance ??= new QuizRepoManager(
		getCodexLetterMappingRepo() as unknown as CodexLetterMappingRepo,
	);
}
