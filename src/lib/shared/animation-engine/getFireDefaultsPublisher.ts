import { browser } from '$app/environment';
import type { IFireDefaultsPublisher } from './services/contracts/IFireDefaultsPublisher';
import { FireDefaultsPublisher } from './services/implementations/FireDefaultsPublisher';

let instance: IFireDefaultsPublisher | null = null;

export function getFireDefaultsPublisher(): IFireDefaultsPublisher {
	if (!browser) throw new Error('getFireDefaultsPublisher() is browser-only');
	return instance ??= new FireDefaultsPublisher();
}
