import { browser } from '$app/environment';

import { ConstructCoordinator } from './services/implementations/ConstructCoordinator';

let instance: ConstructCoordinator | null = null;

export function getConstructCoordinator(): ConstructCoordinator {
	if (!browser) throw new Error('getConstructCoordinator() is browser-only');
	return instance ??= new ConstructCoordinator();
}
