import { browser } from '$app/environment';
import type { ILOOPParameterProvider } from './services/contracts/ILOOPParameterProvider';
import { LOOPParameterProvider } from './services/implementations/LOOPParameterProvider';
import { getPictographFilter } from './getPictographFilter';

let instance: ILOOPParameterProvider | null = null;

export function getLOOPParameterProvider(): ILOOPParameterProvider {
	if (!browser) throw new Error('getLOOPParameterProvider() is browser-only');
	return instance ??= new LOOPParameterProvider(getPictographFilter());
}
