import { browser } from '$app/environment';
import type { IQuizSessionManager } from './services/contracts/IQuizSessionManager';
import { QuizSessionManager } from './services/implementations/QuizSessionManager';

let instance: IQuizSessionManager | null = null;

export function getQuizSessionManager(): IQuizSessionManager {
	if (!browser) throw new Error('getQuizSessionManager() is browser-only');
	return instance ??= new QuizSessionManager();
}
