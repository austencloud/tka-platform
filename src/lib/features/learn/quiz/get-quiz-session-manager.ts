import { browser } from '$app/environment';
import { QuizSessionManager } from './services/quiz-session-manager';

let instance: QuizSessionManager | null = null;

export function getQuizSessionManager(): QuizSessionManager {
	if (!browser) throw new Error('getQuizSessionManager() is browser-only');
	return instance ??= new QuizSessionManager();
}
