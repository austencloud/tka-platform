/**
 * Destination Types - Types for 3D destination system
 */

import type { CameraMode } from "../camera/types";
import type { Component } from "svelte";

/**
 * Destination definition
 */
export interface Destination {
	id: string;
	name: string;
	description: string;
	icon: string; // FontAwesome class
	color: string; // Brand color (hex)
	thumbnail?: string; // Preview image path

	// Capabilities
	supportsMultiplayer: boolean;
	supportsPhysics: boolean;
	defaultCameraMode: CameraMode;

	// Metadata
	category?: "performance" | "social" | "exploration" | "creative";
	tags?: string[];

	// Module loader (lazy-loaded)
	component: () => Promise<{ default: Component }>;

	// Whether this destination is currently enabled (default: true)
	// Set to false to hide from destination picker while preserving the code
	enabled?: boolean;
}

/**
 * Destination category metadata
 */
export interface DestinationCategory {
	id: string;
	name: string;
	description: string;
	icon: string;
	color: string;
}
