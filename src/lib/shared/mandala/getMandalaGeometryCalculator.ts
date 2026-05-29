import { browser } from '$app/environment';
import { MandalaGeometryCalculator } from './services/mandala-geometry-calculator';

let instance: MandalaGeometryCalculator | null = null;

export function getMandalaGeometryCalculator(): MandalaGeometryCalculator {
	if (!browser) throw new Error('getMandalaGeometryCalculator() is browser-only');
	return instance ??= new MandalaGeometryCalculator();
}
