import { browser } from '$app/environment';
import type { IOnboardingPersister } from './services/contracts/IOnboardingPersister';
import { OnboardingPersister } from './services/implementations/OnboardingPersister';

let instance: IOnboardingPersister | null = null;

export function getOnboardingPersister(): IOnboardingPersister {
	if (!browser) throw new Error('getOnboardingPersister() is browser-only');
	return instance ??= new OnboardingPersister();
}
