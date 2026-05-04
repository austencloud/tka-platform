import { browser } from '$app/environment';
import * as contributorLoader from '$lib/shared/feedback/services/contributor-loader';

const api = {
	...contributorLoader,
	delete: contributorLoader.deleteContributor,
};

export function getContributorLoader() {
	if (!browser) throw new Error('getContributorLoader() is browser-only');
	return api;
}
