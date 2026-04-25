import { browser } from '$app/environment';
import type { IRotationComparer } from './services/contracts/IRotationComparer';
import { RotationComparer } from './services/implementations/comparison/RotationComparer';

let instance: IRotationComparer | null = null;

export function getRotationComparer(): IRotationComparer {
	if (!browser) throw new Error('getRotationComparer() is browser-only');
	return instance ??= new RotationComparer();
}
