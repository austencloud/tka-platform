import { browser } from '$app/environment';
import { MandalaGeometryCalculator } from './services/implementations/MandalaGeometryCalculator';

let instance: MandalaGeometryCalculator | null = null;

export function getMandalaGeometryCalculator(): MandalaGeometryCalculator {
	if (!browser) throw new Error('getMandalaGeometryCalculator() is browser-only');
	return instance ??= new MandalaGeometryCalculator();
}
