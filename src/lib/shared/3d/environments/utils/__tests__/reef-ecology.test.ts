import { describe, it, expect } from 'vitest';
import { speciesWeight, selectSpecies, vonMisesSample, densityCurve } from '../reef-ecology';
import type { CoralSpeciesConfig } from '../../domain/models/scene-configs';

describe('speciesWeight', () => {
	it('returns 1.0 inside preferred range', () => {
		const sp = { speciesIndex: 0, depthPreference: [0.2, 0.6] } as CoralSpeciesConfig;
		expect(speciesWeight(sp, 0.4)).toBe(1.0);
	});

	it('falls off outside preferred range', () => {
		const sp = { speciesIndex: 0, depthPreference: [0.2, 0.6] } as CoralSpeciesConfig;
		const w = speciesWeight(sp, 0.9);
		expect(w).toBeGreaterThan(0);
		expect(w).toBeLessThan(0.5);
	});
});

describe('selectSpecies', () => {
	it('biases toward shallow species at low distanceNorm', () => {
		const species = [
			{ speciesIndex: 0, depthPreference: [0.0, 0.3] },
			{ speciesIndex: 1, depthPreference: [0.7, 1.0] },
		] as CoralSpeciesConfig[];
		let shallow = 0;
		let i = 0;
		const rng = () => {
			i++;
			return (i * 0.1) % 1;
		};
		for (let j = 0; j < 100; j++) {
			if (selectSpecies(species, 0.1, rng) === 0) shallow++;
		}
		expect(shallow).toBeGreaterThan(70);
	});
});

describe('vonMisesSample', () => {
	it('concentrates around the mean angle', () => {
		let i = 0;
		const rng = () => {
			i++;
			return (i * 0.0731) % 1;
		};
		const samples = Array.from({ length: 200 }, () => vonMisesSample(Math.PI, 2.0, rng));
		const nearMean = samples.filter(
			(a) => Math.abs(a - Math.PI) < 0.8 || Math.abs(a - Math.PI + Math.PI * 2) < 0.8,
		);
		expect(nearMean.length).toBeGreaterThan(100);
	});
});

describe('densityCurve', () => {
	it('peaks in mid-range', () => {
		expect(densityCurve(0.5)).toBeGreaterThan(densityCurve(0.0));
		expect(densityCurve(0.5)).toBeGreaterThan(densityCurve(1.0));
	});

	it('returns values between 0 and 1', () => {
		for (let d = 0; d <= 1; d += 0.1) {
			const v = densityCurve(d);
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThanOrEqual(1);
		}
	});
});
