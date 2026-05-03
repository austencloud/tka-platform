import { browser } from '$app/environment';

import { TurnAllocator } from './services/implementations/TurnAllocator';
import { getLOOPParameterProvider } from './getLOOPParameterProvider';

let instance: TurnAllocator | null = null;

export function getTurnAllocator(): TurnAllocator {
	if (!browser) throw new Error('getTurnAllocator() is browser-only');
	return instance ??= new TurnAllocator(getLOOPParameterProvider());
}
