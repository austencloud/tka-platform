import { browser } from '$app/environment';
import type { IReflectionComparer } from './services/contracts/IReflectionComparer';
import { ReflectionComparer } from './services/implementations/comparison/ReflectionComparer';

let instance: IReflectionComparer | null = null;

export function getReflectionComparer(): IReflectionComparer {
	if (!browser) throw new Error('getReflectionComparer() is browser-only');
	return instance ??= new ReflectionComparer();
}
