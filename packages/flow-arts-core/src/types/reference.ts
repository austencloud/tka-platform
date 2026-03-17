/**
 * ExternalReference — links to documents, videos, websites, apps
 */

export type ReferenceType = "document" | "video" | "website" | "app" | "forum-post";

export interface ExternalReference {
	/** URL */
	url: string;
	/** Human-readable title */
	title: string;
	/** Type of resource */
	type: ReferenceType;
	/** Author or creator */
	author?: string;
	/** Year published or created */
	year?: number;
	/** When we last verified this link works */
	accessDate?: string;
}
