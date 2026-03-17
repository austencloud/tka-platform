/**
 * Contributor — people who created or extended notation systems
 */

import type { ExternalReference } from "./reference.js";

export interface Contributor {
	/** Full name */
	name: string;
	/** Known aliases, handles, nicknames */
	aliases?: string[];
	/** Primary role description */
	role: string;
	/** Specific contributions */
	contributions: string[];
	/** Years active in the community */
	activeYears?: string;
	/** External links (websites, social media) */
	links?: ExternalReference[];
}
