import { z } from "zod";
import { StepDataSchema } from "$lib/shared/foundation/domain/schemas";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { MandalaPathShape } from "$lib/shared/mandala/domain/mandala-types";

export interface CollectedMandala {
	id: string;
	name: string;
	steps: StepData[];
	variant: "blue" | "red" | "both";
	bluePropType: string;
	redPropType: string;
	pathShape?: MandalaPathShape;
	createdAt: number;
	source?: "studio" | "sequence" | "default";
	/** Lineage stamp — the source sequence's simplified word (never a raw
	 *  repeated word; see simplifyRepeatedWord) and, when known at save time,
	 *  its library id. Optional: old entries simply lack them. */
	sourceWord?: string;
	sourceSequenceId?: string;
	/** Stable work id lives in `id`; these fields identify the exact current
	 * immutable payload. Legacy entries are baselined when they next hydrate. */
	currentRevisionId?: string;
	currentContentDigest?: string;
	currentRevisionCreatedAt?: number;
	revisionDigestAlgorithm?: "SHA-256";
	revisionDigestVersion?: 1;
}

export const CollectedMandalaSchema = z.object({
	id: z.string().min(1),
	name: z.string(),
	steps: z.array(StepDataSchema),
	variant: z.enum(["blue", "red", "both"]),
	bluePropType: z.string(),
	redPropType: z.string(),
	pathShape: z.enum(["arc", "linear", "concave", "hybrid"]).optional(),
	createdAt: z.any(),
	updatedAt: z.any().optional(),
	source: z.enum(["studio", "sequence", "default"]).optional(),
	sourceWord: z.string().optional(),
	sourceSequenceId: z.string().optional(),
	currentRevisionId: z.string().min(1).optional(),
	currentContentDigest: z
		.string()
		.regex(/^[a-f0-9]{64}$/)
		.optional(),
	currentRevisionCreatedAt: z.number().optional(),
	revisionDigestAlgorithm: z.literal("SHA-256").optional(),
	revisionDigestVersion: z.literal(1).optional(),
});

export const MANDALA_COLLECTION_STORAGE_KEY = "tka:mandala-collection";
export const MANDALA_COLLECTION_SCHEMA_VERSION = 1;
