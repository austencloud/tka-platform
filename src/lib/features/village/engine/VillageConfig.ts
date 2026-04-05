export interface VillageConfig {
	targetPopulation: number;
	lifespanTicks: number;
	ticksPerSecond: number;
	traitDistribution: {
		mean: number;
		stdDev: number;
	};
	lossyTransmissionRate: number;
	inventionRate: number;
	arenaRadius: number;
	youthPhaseRatio: number;
	adultPhaseRatio: number;
	elderPhaseRatio: number;
}

export function createDefaultConfig(
	overrides?: Partial<VillageConfig>,
): VillageConfig {
	return {
		targetPopulation: 6,
		lifespanTicks: 600,
		ticksPerSecond: 10,
		traitDistribution: { mean: 0.5, stdDev: 0.15 },
		lossyTransmissionRate: 0.1,
		inventionRate: 0.005,
		arenaRadius: 8,
		youthPhaseRatio: 0.1,
		adultPhaseRatio: 0.7,
		elderPhaseRatio: 0.2,
		...overrides,
	};
}
