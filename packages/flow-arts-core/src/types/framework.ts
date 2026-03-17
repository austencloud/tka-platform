/**
 * NotationFramework — metadata about a flow arts notation system
 */

export type FrameworkStatus = "active" | "historical" | "active-development";

export interface NotationFramework {
	/** Short identifier: "vtg", "tka", "caps", "9square", "qft" */
	id: string;
	/** Full name */
	name: string;
	/** People who created it */
	creators: string[];
	/** Year first published/shared */
	yearCreated: number;
	/** Current state */
	status: FrameworkStatus;
	/** What it does in one sentence */
	description: string;
	/** What kind of output it produces */
	outputFormat: string;
	/** Primary prop it was designed for */
	primaryProp: string;
}
