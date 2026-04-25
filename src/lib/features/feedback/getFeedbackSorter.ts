import { browser } from '$app/environment';
import type { IFeedbackSorter } from './services/contracts/IFeedbackSorter';
import { FeedbackSorter } from './services/implementations/FeedbackSorter';

let instance: IFeedbackSorter | null = null;

export function getFeedbackSorter(): IFeedbackSorter {
	if (!browser) throw new Error('getFeedbackSorter() is browser-only');
	return instance ??= new FeedbackSorter();
}
