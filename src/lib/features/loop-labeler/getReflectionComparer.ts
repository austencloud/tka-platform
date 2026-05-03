import { browser } from '$app/environment';
import { ReflectionComparer } from './services/implementations/comparison/ReflectionComparer';

let instance: ReflectionComparer | null = null;

export function getReflectionComparer(): ReflectionComparer {
	if (!browser) throw new Error('getReflectionComparer() is browser-only');
	return instance ??= new ReflectionComparer();
}
