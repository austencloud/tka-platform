export interface FishEventUniforms {
	uDartCount: { value: number };
	uDartIndices: { value: Int32Array };
	uDartStrength: { value: number };
	uExcursionCount: { value: number };
	uExcursionIndices: { value: Int32Array };
	uExcursionBias: { value: Float32Array };
}

export class FishEventSystem {
	private readonly fishCount: number;
	private readonly traitsData: Float32Array;
	private readonly dartTimers: Float32Array;
	private readonly excursionTimers: Float32Array;

	constructor(fishCount: number, traitsData: Float32Array) {
		this.fishCount = fishCount;
		this.traitsData = traitsData;
		this.dartTimers = new Float32Array(fishCount);
		this.excursionTimers = new Float32Array(fishCount);

		for (let i = 0; i < fishCount; i++) {
			this.dartTimers[i] = Math.random() * 8.0;
			this.excursionTimers[i] = 15.0 + Math.random() * 20.0;
		}
	}

	tick(dt: number, uniforms: FishEventUniforms): void {
		let dartCount = 0;
		let excursionCount = 0;
		const dartIndices = uniforms.uDartIndices.value;
		const excursionIndices = uniforms.uExcursionIndices.value;
		const excursionBias = uniforms.uExcursionBias.value;

		dartIndices.fill(-1);
		excursionIndices.fill(-1);
		excursionBias.fill(0);

		for (let i = 0; i < this.fishCount; i++) {
			const boldness = this.traitsData[i * 4 + 2]!;
			const dartSeed = this.traitsData[i * 4 + 3]!;

			// Dart timer
			this.dartTimers[i]! -= dt;
			if (this.dartTimers[i]! <= 0 && dartCount < 8) {
				dartIndices[dartCount] = i;
				dartCount++;
				this.dartTimers[i] = 8.0 * (1.5 - boldness) + dartSeed * 2.0;
			}

			// Vertical excursion timer
			this.excursionTimers[i]! -= dt;
			if (this.excursionTimers[i]! <= 0 && excursionCount < 4) {
				excursionIndices[excursionCount] = i;
				excursionBias[excursionCount] = (dartSeed > 0.5 ? 1.0 : -1.0) * 0.5;
				excursionCount++;
				this.excursionTimers[i] = 15.0 + dartSeed * 20.0;
			}
		}

		uniforms.uDartCount.value = dartCount;
		uniforms.uExcursionCount.value = excursionCount;
	}
}
