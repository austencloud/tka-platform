import { browser } from '$app/environment';
import type { IConstructCoordinator } from './services/contracts/IConstructCoordinator';
import { ConstructCoordinator } from './services/implementations/ConstructCoordinator';

let instance: IConstructCoordinator | null = null;

export function getConstructCoordinator(): IConstructCoordinator {
	if (!browser) throw new Error('getConstructCoordinator() is browser-only');
	return instance ??= new ConstructCoordinator();
}
