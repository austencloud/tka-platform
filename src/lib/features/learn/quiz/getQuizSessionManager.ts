import { browser } from '$app/environment';
import { QuizSessionManager } from './services/implementations/QuizSessionManager';

let instance: QuizSessionManager | null = null;

export function getQuizSessionManager(): QuizSessionManager {
	if (!browser) throw new Error('getQuizSessionManager() is browser-only');
	return instance ??= new QuizSessionManager();
}
