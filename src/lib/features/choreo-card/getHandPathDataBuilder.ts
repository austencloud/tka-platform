import { browser } from '$app/environment';
import type { IHandPathDataBuilder } from './services/contracts/IHandPathDataBuilder';
import { HandPathDataBuilder } from './services/implementations/HandPathDataBuilder';

let instance: IHandPathDataBuilder | null = null;

export function getHandPathDataBuilder(): IHandPathDataBuilder {
	if (!browser) throw new Error('getHandPathDataBuilder() is browser-only');
	return instance ??= new HandPathDataBuilder();
}
