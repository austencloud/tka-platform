import { browser } from '$app/environment';
import { FireDefaultsPublisher } from './services/implementations/FireDefaultsPublisher';

let instance: FireDefaultsPublisher | null = null;

export function getFireDefaultsPublisher(): FireDefaultsPublisher {
	if (!browser) throw new Error('getFireDefaultsPublisher() is browser-only');
	return instance ??= new FireDefaultsPublisher();
}
