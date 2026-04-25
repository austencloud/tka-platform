import { browser } from '$app/environment';
import type { IQuizHistoryRecorder } from './services/contracts/IQuizHistoryRecorder';
import { QuizHistoryRecorder } from './services/implementations/QuizHistoryRecorder';

let instance: IQuizHistoryRecorder | null = null;

export function getQuizHistoryRecorder(): IQuizHistoryRecorder {
	if (!browser) throw new Error('getQuizHistoryRecorder() is browser-only');
	return instance ??= new QuizHistoryRecorder();
}
