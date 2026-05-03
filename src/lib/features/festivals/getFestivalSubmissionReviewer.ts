import { browser } from '$app/environment';
import { FestivalSubmissionReviewer } from './services/implementations/FestivalSubmissionReviewer';
import { getFestivalRepository } from './getFestivalRepository';

let instance: FestivalSubmissionReviewer | null = null;

export function getFestivalSubmissionReviewer(): FestivalSubmissionReviewer {
	if (!browser) throw new Error('getFestivalSubmissionReviewer() is browser-only');
	return instance ??= new FestivalSubmissionReviewer(getFestivalRepository());
}
