import { browser } from '$app/environment';
import { ContributorLoader } from './services/implementations/ContributorLoader';

let instance: ContributorLoader | null = null;

export function getContributorLoader(): ContributorLoader {
	if (!browser) throw new Error('getContributorLoader() is browser-only');
	return instance ??= new ContributorLoader();
}
