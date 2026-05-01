import { browser } from '$app/environment';
import { LOOPParameterProvider } from './services/implementations/LOOPParameterProvider';
import { getPictographFilter } from './getPictographFilter';

let instance: LOOPParameterProvider | null = null;

export function getLOOPParameterProvider(): LOOPParameterProvider {
	if (!browser) throw new Error('getLOOPParameterProvider() is browser-only');
	return instance ??= new LOOPParameterProvider(getPictographFilter());
}
