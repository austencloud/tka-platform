import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { HandPathData } from "$lib/shared/foundation/domain/models/HandPathData";
import type { SoloPropData } from "$lib/shared/foundation/domain/models/SoloPropData";

export interface FuseOptions {
	readonly alignmentOffset?: number;
	readonly maxBeats?: number;
}

export interface ISequenceFuser {
	fuse(
		blue: HandPathData | SoloPropData,
		red: HandPathData | SoloPropData,
		options?: FuseOptions
	): SequenceData;
}
