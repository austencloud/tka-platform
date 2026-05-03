import { browser } from '$app/environment';
import { RotationComparer } from './services/implementations/comparison/RotationComparer';

let instance: RotationComparer | null = null;

export function getRotationComparer(): RotationComparer {
	if (!browser) throw new Error('getRotationComparer() is browser-only');
	return instance ??= new RotationComparer();
}
