import { browser } from '$app/environment';
import type { IMandalaGeometryCalculator } from './services/contracts/IMandalaGeometryCalculator';
import { MandalaGeometryCalculator } from './services/implementations/MandalaGeometryCalculator';

let instance: IMandalaGeometryCalculator | null = null;

export function getMandalaGeometryCalculator(): IMandalaGeometryCalculator {
	if (!browser) throw new Error('getMandalaGeometryCalculator() is browser-only');
	return instance ??= new MandalaGeometryCalculator();
}
