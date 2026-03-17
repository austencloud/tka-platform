/**
 * Insignia's 8 Driving Styles
 *
 * Classification system for how the spinner's body drives poi movement.
 * Developed by Insignia as an extension to the VTG framework.
 */

import type { SourcedClaim } from "@flow-arts/core";

export interface DrivingStyle {
	/** Unique identifier */
	id: string;
	/** Style name */
	name: string;
	/** Plain-language description of how the body drives the poi */
	description: string;
	/** Body parts primarily involved */
	bodyParts?: string[];
	/** Where this driving style definition comes from */
	source: SourcedClaim;
	/** Example patterns that use this style */
	examplePatterns?: string[];
}

// TODO: Populate from Insignia's driving style documentation
export const VTG_DRIVING_STYLES: DrivingStyle[] = [];
