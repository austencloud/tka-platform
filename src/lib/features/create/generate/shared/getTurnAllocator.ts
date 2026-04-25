import { browser } from '$app/environment';
import type { ITurnAllocator } from './services/contracts/ITurnAllocator';
import { TurnAllocator } from './services/implementations/TurnAllocator';
import { getLOOPParameterProvider } from './getLOOPParameterProvider';

let instance: ITurnAllocator | null = null;

export function getTurnAllocator(): ITurnAllocator {
	if (!browser) throw new Error('getTurnAllocator() is browser-only');
	return instance ??= new TurnAllocator(getLOOPParameterProvider());
}
