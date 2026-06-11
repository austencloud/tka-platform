import { browser } from '$app/environment';
import { QuizRepoManager } from './services/quiz-repo-manager';
import { getCodexLetterMappingRepo } from '$lib/features/learn/codex/get-codex-letter-mapping-repo';

let instance: QuizRepoManager | null = null;

export function getQuizRepoManager(): QuizRepoManager {
	if (!browser) throw new Error('getQuizRepoManager() is browser-only');
	return instance ??= new QuizRepoManager(getCodexLetterMappingRepo());
}
