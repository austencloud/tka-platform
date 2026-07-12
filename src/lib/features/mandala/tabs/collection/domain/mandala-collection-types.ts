import { z } from "zod";
import { StepDataSchema } from "$lib/shared/foundation/domain/schemas";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

export interface CollectedMandala {
	id: string;
	name: string;
	steps: StepData[];
	variant: "blue" | "red" | "both";
	bluePropType: string;
	redPropType: string;
	createdAt: number;
	source?: "studio" | "sequence" | "default";
	/** Lineage stamp — the source sequence's simplified word (never a raw
	 *  repeated word; see simplifyRepeatedWord) and, when known at save time,
	 *  its library id. Optional: old entries simply lack them. */
	sourceWord?: string;
	sourceSequenceId?: string;
}

export const CollectedMandalaSchema = z.object({
	id: z.string().min(1),
	name: z.string(),
	steps: z.array(StepDataSchema),
	variant: z.enum(["blue", "red", "both"]),
	bluePropType: z.string(),
	redPropType: z.string(),
	createdAt: z.any(),
	updatedAt: z.any().optional(),
	source: z.enum(["studio", "sequence", "default"]).optional(),
	sourceWord: z.string().optional(),
	sourceSequenceId: z.string().optional(),
});

export const MANDALA_COLLECTION_STORAGE_KEY = "tka:mandala-collection";
export const MANDALA_COLLECTION_SCHEMA_VERSION = 1;
