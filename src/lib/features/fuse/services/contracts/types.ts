import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { HandPathData } from "$lib/shared/foundation/domain/models/HandPathData";
import type { SoloPropData } from "$lib/shared/foundation/domain/models/SoloPropData";

// --- From ISequenceFuser ---

export interface FuseOptions {
	readonly alignmentOffset?: number;
	readonly maxSteps?: number;
}

// === From ISequenceFuser ===

export interface FuseOptions {
	readonly alignmentOffset?: number;
	readonly maxSteps?: number;
}
