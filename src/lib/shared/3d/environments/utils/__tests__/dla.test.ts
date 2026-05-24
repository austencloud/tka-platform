import { describe, it, expect } from 'vitest';
import { generateDLAMask } from '../dla';

describe('generateDLAMask', () => {
	it('produces a grid with reef cells around seeds', () => {
		const mask = generateDLAMask({
			gridSize: 32,
			walkerCount: 200,
			seeds: [{ angle: Math.PI, distanceNorm: 0.4 }],
			outsideLeakFactor: 0.1,
			innerRadius: 7,
			outerRadius: 24,
			seed: 42
		});
		expect(mask.gridSize).toBe(32);
		expect(mask.grid.length).toBe(32 * 32);
		const reefCount = mask.grid.filter(Boolean).length;
		expect(reefCount).toBeGreaterThan(10);
		expect(reefCount).toBeLessThan(32 * 32 * 0.8);
	});

	it('lookup returns true inside reef boundary', () => {
		const mask = generateDLAMask({
			gridSize: 32,
			walkerCount: 300,
			seeds: [{ angle: Math.PI, distanceNorm: 0.4 }],
			outsideLeakFactor: 0.1,
			innerRadius: 7,
			outerRadius: 24,
			seed: 42
		});
		const seedX = Math.cos(Math.PI) * (7 + 0.4 * 17);
		const seedZ = Math.sin(Math.PI) * (7 + 0.4 * 17);
		expect(mask.lookup(seedX, seedZ)).toBe(true);
	});

	it('is deterministic given same seed', () => {
		const args = {
			gridSize: 32,
			walkerCount: 200,
			seeds: [{ angle: Math.PI, distanceNorm: 0.4 }],
			outsideLeakFactor: 0.1,
			innerRadius: 7,
			outerRadius: 24,
			seed: 42
		};
		const a = generateDLAMask(args);
		const b = generateDLAMask(args);
		expect(a.grid).toEqual(b.grid);
	});
});
