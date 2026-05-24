import type { CoralSpeciesConfig } from '../domain/models/scene-configs';

export function speciesWeight(species: CoralSpeciesConfig, distanceNorm: number): number {
	const [lo, hi] = species.depthPreference;
	if (distanceNorm >= lo && distanceNorm <= hi) return 1.0;
	const dist = distanceNorm < lo ? lo - distanceNorm : distanceNorm - hi;
	return Math.exp(-(dist * dist) / (2 * 0.15 * 0.15));
}

export function selectSpecies(
	species: CoralSpeciesConfig[],
	distanceNorm: number,
	rng: () => number,
): number {
	const weights = species.map((s) => speciesWeight(s, distanceNorm));
	const total = weights.reduce((a, b) => a + b, 0);
	if (total === 0) return species[0]!.speciesIndex;
	let r = rng() * total;
	for (let i = 0; i < weights.length; i++) {
		r -= weights[i]!;
		if (r <= 0) return species[i]!.speciesIndex;
	}
	return species[species.length - 1]!.speciesIndex;
}

export function vonMisesSample(mean: number, kappa: number, rng: () => number): number {
	const tau = 1.0 + Math.sqrt(1.0 + 4.0 * kappa * kappa);
	const rho = (tau - Math.sqrt(2.0 * tau)) / (2.0 * kappa);
	const r_ = (1.0 + rho * rho) / (2.0 * rho);

	for (let attempt = 0; attempt < 100; attempt++) {
		const u1 = rng();
		const z = Math.cos(Math.PI * u1);
		const f = (1.0 + r_ * z) / (r_ + z);
		const c = kappa * (r_ - f);
		const u2 = rng();
		if (c * (2.0 - c) > u2 || Math.log(c / u2) + 1.0 >= c) {
			const u3 = rng();
			const theta = u3 > 0.5 ? Math.acos(f) : -Math.acos(f);
			return ((theta + mean) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
		}
	}
	return mean;
}

export function densityCurve(distanceNorm: number): number {
	if (distanceNorm < 0.2) return 0.3;
	if (distanceNorm < 0.5) return 0.3 + ((distanceNorm - 0.2) / 0.3) * 0.7;
	if (distanceNorm < 0.7) return 1.0 - ((distanceNorm - 0.5) / 0.2) * 0.2;
	if (distanceNorm < 0.85) return 0.8 - ((distanceNorm - 0.7) / 0.15) * 0.3;
	return 0.5 - ((distanceNorm - 0.85) / 0.15) * 0.3;
}
