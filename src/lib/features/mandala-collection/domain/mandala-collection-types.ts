import type { StepData } from "$lib/shared/foundation/domain/models/StepData";

export interface CollectedMandala {
	id: string;
	name: string;
	steps: StepData[];
	variant: "blue" | "red" | "both";
	bluePropType: string;
	redPropType: string;
	createdAt: number;
}

export const MANDALA_COLLECTION_STORAGE_KEY = "tka:mandala-collection";
export const MANDALA_COLLECTION_SCHEMA_VERSION = 1;
