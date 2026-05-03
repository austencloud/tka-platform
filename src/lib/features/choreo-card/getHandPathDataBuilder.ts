import { browser } from '$app/environment';

import { HandPathDataBuilder } from './services/implementations/HandPathDataBuilder';

let instance: HandPathDataBuilder | null = null;

export function getHandPathDataBuilder(): HandPathDataBuilder {
	if (!browser) throw new Error('getHandPathDataBuilder() is browser-only');
	return instance ??= new HandPathDataBuilder();
}
