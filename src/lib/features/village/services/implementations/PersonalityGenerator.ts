import type { PersonalityComponent } from "../../domain/village-types";
import type { IPersonalityGenerator } from "../contracts/IPersonalityGenerator";

export class PersonalityGenerator implements IPersonalityGenerator {
	generate(mean: number, stdDev: number): PersonalityComponent {
		return {
			learnSpeed: this.clampedNormal(mean, stdDev),
			sociability: this.clampedNormal(mean, stdDev),
			creativity: this.clampedNormal(mean, stdDev),
			patience: this.clampedNormal(mean, stdDev),
			curiosity: this.clampedNormal(mean, stdDev),
		};
	}

	private clampedNormal(mean: number, stdDev: number): number {
		// Box-Muller transform
		const u1 = Math.random();
		const u2 = Math.random();
		const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
		return Math.max(0, Math.min(1, mean + z * stdDev));
	}
}
