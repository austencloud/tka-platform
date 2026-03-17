/**
 * MovementPattern — generic pattern type used across notation systems
 */

import type { SourcedClaim } from "./sourced-claim.js";

export interface MovementPattern {
	/** Pattern name */
	name: string;
	/** Which framework defines this pattern */
	framework: string;
	/** Plain-language description */
	description: string;
	/** Where this pattern definition comes from */
	source: SourcedClaim;
}
