import { browser } from '$app/environment';
import { FeedbackSorter } from './services/implementations/FeedbackSorter';

let instance: FeedbackSorter | null = null;

export function getFeedbackSorter(): FeedbackSorter {
	if (!browser) throw new Error('getFeedbackSorter() is browser-only');
	return instance ??= new FeedbackSorter();
}
