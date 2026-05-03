import { browser } from '$app/environment';
import { QuizHistoryRecorder } from './services/implementations/QuizHistoryRecorder';

let instance: QuizHistoryRecorder | null = null;

export function getQuizHistoryRecorder(): QuizHistoryRecorder {
	if (!browser) throw new Error('getQuizHistoryRecorder() is browser-only');
	return instance ??= new QuizHistoryRecorder();
}
