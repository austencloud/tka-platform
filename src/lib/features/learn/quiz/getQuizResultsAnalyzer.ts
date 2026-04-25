import { browser } from '$app/environment';
import type { IQuizResultsAnalyzer } from './QuizResultsAnalyzer';
import { QuizResultsAnalyzer } from './QuizResultsAnalyzer';

let instance: IQuizResultsAnalyzer | null = null;

export function getQuizResultsAnalyzer(): IQuizResultsAnalyzer {
	if (!browser) throw new Error('getQuizResultsAnalyzer() is browser-only');
	return instance ??= new QuizResultsAnalyzer();
}
