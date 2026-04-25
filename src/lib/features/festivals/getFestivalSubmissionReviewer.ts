import { browser } from '$app/environment';
import type { IFestivalSubmissionReviewer } from './services/contracts/IFestivalSubmissionReviewer';
import { FestivalSubmissionReviewer } from './services/implementations/FestivalSubmissionReviewer';
import { getFestivalRepository } from './getFestivalRepository';

let instance: IFestivalSubmissionReviewer | null = null;

export function getFestivalSubmissionReviewer(): IFestivalSubmissionReviewer {
	if (!browser) throw new Error('getFestivalSubmissionReviewer() is browser-only');
	return instance ??= new FestivalSubmissionReviewer(getFestivalRepository());
}
