import { seededRandom } from './poisson-disc';

export interface DLAMaskConfig {
	gridSize: number;
	walkerCount: number;
	seeds: Array<{ angle: number; distanceNorm: number }>;
	outsideLeakFactor: number;
	innerRadius: number;
	outerRadius: number;
	seed: number;
}

export interface DLAMask {
	gridSize: number;
	grid: boolean[];
	lookup: (worldX: number, worldZ: number) => boolean;
}

export function generateDLAMask(config: DLAMaskConfig): DLAMask {
	const { gridSize, walkerCount, seeds, innerRadius, outerRadius, seed } = config;
	const rng = seededRandom(seed);
	const grid = new Array<boolean>(gridSize * gridSize).fill(false);
	const extent = outerRadius * 2.2;
	const cellSize = extent / gridSize;

	function worldToGrid(wx: number, wz: number): [number, number] {
		const gx = Math.floor((wx + extent / 2) / cellSize);
		const gz = Math.floor((wz + extent / 2) / cellSize);
		return [
			Math.max(0, Math.min(gridSize - 1, gx)),
			Math.max(0, Math.min(gridSize - 1, gz))
		];
	}

	function idx(gx: number, gz: number): number {
		return gz * gridSize + gx;
	}

	// Seed reef nucleation points
	for (const s of seeds) {
		const r = innerRadius + s.distanceNorm * (outerRadius - innerRadius);
		const wx = Math.cos(s.angle) * r;
		const wz = Math.sin(s.angle) * r;
		const [gx, gz] = worldToGrid(wx, wz);
		grid[idx(gx, gz)] = true;
		for (let dx = -1; dx <= 1; dx++) {
			for (let dz = -1; dz <= 1; dz++) {
				const nx = gx + dx,
					nz = gz + dz;
				if (nx >= 0 && nx < gridSize && nz >= 0 && nz < gridSize) {
					grid[idx(nx, nz)] = true;
				}
			}
		}
	}

	// Random walkers
	const dirs = [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1]
	] as const;
	for (let w = 0; w < walkerCount; w++) {
		const angle = rng() * Math.PI * 2;
		const edge = rng() > 0.5 ? outerRadius : innerRadius;
		const [startGx, startGz] = worldToGrid(
			Math.cos(angle) * edge,
			Math.sin(angle) * edge
		);
		let gx = startGx,
			gz = startGz;
		let steps = 0;
		const maxSteps = gridSize * gridSize;

		while (steps < maxSteps) {
			steps++;
			let adjacent = false;
			for (const [dx, dz] of dirs) {
				const nx = gx + dx,
					nz = gz + dz;
				if (nx >= 0 && nx < gridSize && nz >= 0 && nz < gridSize && grid[idx(nx, nz)]) {
					adjacent = true;
					break;
				}
			}
			if (adjacent) {
				grid[idx(gx, gz)] = true;
				break;
			}
			const dir = dirs[Math.floor(rng() * 4)]!;
			const nx = gx + dir[0],
				nz = gz + dir[1];
			if (nx >= 0 && nx < gridSize && nz >= 0 && nz < gridSize) {
				gx = nx;
				gz = nz;
			}
		}
	}

	// Majority-filter smoothing
	const smoothed = [...grid];
	for (let gz = 1; gz < gridSize - 1; gz++) {
		for (let gx = 1; gx < gridSize - 1; gx++) {
			let neighbors = 0;
			for (let dx = -1; dx <= 1; dx++) {
				for (let dz = -1; dz <= 1; dz++) {
					if (dx === 0 && dz === 0) continue;
					if (grid[idx(gx + dx, gz + dz)]) neighbors++;
				}
			}
			smoothed[idx(gx, gz)] = neighbors >= 4;
		}
	}

	function lookup(worldX: number, worldZ: number): boolean {
		const [gx, gz] = worldToGrid(worldX, worldZ);
		return smoothed[idx(gx, gz)] ?? false;
	}

	return { gridSize, grid: smoothed, lookup };
}
