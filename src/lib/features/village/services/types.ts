/**
 * Co-exported types from retired interface contracts.
 */


export type MutationType =
	| "mirror"
	| "flip"
	| "rotate"
	| "swap"
	| "invert"
	| "rewind";
export type MutationResult =
	| {
			success: true;
			mutationType: MutationType;
			inventedId: string;
	  }
	| {
			success: false;
			reason: "invalid-source";
	  };
