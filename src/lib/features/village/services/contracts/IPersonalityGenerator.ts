import type { PersonalityComponent } from "../../domain/village-types";

export interface IPersonalityGenerator {
	generate(mean: number, stdDev: number): PersonalityComponent;
}
