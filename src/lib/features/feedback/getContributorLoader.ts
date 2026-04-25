import { browser } from '$app/environment';
import type { IContributorLoader } from './services/contracts/IContributorLoader';
import { ContributorLoader } from './services/implementations/ContributorLoader';

let instance: IContributorLoader | null = null;

export function getContributorLoader(): IContributorLoader {
	if (!browser) throw new Error('getContributorLoader() is browser-only');
	return instance ??= new ContributorLoader();
}
