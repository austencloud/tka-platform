/**
 * Destination Definitions - Registry of all 3D destinations
 *
 * Central registry for Stage, Gallery, Worlds, and future destinations.
 * Used by the Realm module to display destination picker.
 */

import { CameraMode } from "../camera/types";
import type { Destination, DestinationCategory } from "./types";

/**
 * All available 3D destinations
 */
export const DESTINATIONS: Destination[] = [
	{
		id: "stage",
		name: "Stage",
		description:
			"Multi-performer choreography viewer with synchronized playback and timeline editing",
		icon: "fa-theater-masks",
		color: "#8b5cf6", // Purple
		supportsMultiplayer: false, // Future: add multiplayer for live performances
		supportsPhysics: false,
		defaultCameraMode: CameraMode.THIRD_PERSON,
		category: "performance",
		tags: ["choreography", "avatars", "performance", "timeline"],
		component: () => import("../../../features/stage/StageDestination.svelte"),
	},
	{
		id: "gallery",
		name: "Gallery",
		description:
			"Explore sequences in a procedural museum with friends. Multiplayer social experience",
		icon: "fa-building-columns",
		color: "#06b6d4", // Cyan
		supportsMultiplayer: true,
		supportsPhysics: true, // Rapier physics for realistic movement
		defaultCameraMode: CameraMode.FIRST_PERSON,
		category: "social",
		tags: ["museum", "multiplayer", "social", "exhibits"],
		component: () =>
			import("../../../features/gallery/GalleryDestination.svelte"),
	},
	{
		id: "worlds",
		name: "Infinite Worlds",
		description:
			"Procedurally generated terrain with biomes, vegetation, and endless exploration",
		icon: "fa-earth-americas",
		color: "#10b981", // Green
		supportsMultiplayer: false, // Future: add multiplayer exploration
		supportsPhysics: true, // Rapier physics with terrain colliders
		defaultCameraMode: CameraMode.FIRST_PERSON,
		category: "exploration",
		tags: ["procedural", "terrain", "biomes", "exploration"],
		component: () =>
			import("../../../features/infinite-worlds/WorldsDestination.svelte"),
	},
	// Future destinations:
	// {
	//   id: "forest",
	//   name: "Mystic Forest",
	//   description: "Nature environment with vegetation and ambient sounds",
	//   icon: "fa-tree",
	//   color: "#22c55e",
	//   ...
	// },
	// {
	//   id: "arena",
	//   name: "Performance Arena",
	//   description: "Large stage for multi-performer shows with audience view",
	//   icon: "fa-landmark-dome",
	//   color: "#f97316",
	//   ...
	// },
];

/**
 * Destination categories
 */
export const DESTINATION_CATEGORIES: DestinationCategory[] = [
	{
		id: "performance",
		name: "Performance",
		description: "Watch and create choreography",
		icon: "fa-theater-masks",
		color: "#8b5cf6",
	},
	{
		id: "social",
		name: "Social",
		description: "Hang out with friends",
		icon: "fa-users",
		color: "#06b6d4",
	},
	{
		id: "exploration",
		name: "Exploration",
		description: "Discover new worlds",
		icon: "fa-compass",
		color: "#10b981",
	},
	{
		id: "creative",
		name: "Creative",
		description: "Build and customize",
		icon: "fa-palette",
		color: "#f59e0b",
	},
];

/**
 * Get destination by ID
 */
export function getDestination(id: string): Destination | undefined {
	return DESTINATIONS.find((dest) => dest.id === id);
}

/**
 * Get destinations by category
 */
export function getDestinationsByCategory(
	categoryId: string,
): Destination[] {
	return DESTINATIONS.filter((dest) => dest.category === categoryId);
}

/**
 * Get all destination IDs
 */
export function getAllDestinationIds(): string[] {
	return DESTINATIONS.map((dest) => dest.id);
}
