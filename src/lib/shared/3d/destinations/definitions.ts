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
	// Single destination - campground clearing with procedural forest
	{
		id: "realm",
		name: "Realm",
		description:
			"Campground clearing surrounded by procedural forest terrain",
		icon: "fa-earth-americas",
		color: "#10b981", // Green
		supportsMultiplayer: false,
		supportsPhysics: true,
		defaultCameraMode: CameraMode.FIRST_PERSON,
		category: "exploration",
		tags: ["procedural", "terrain", "campground", "exploration"],
		component: () =>
			import("../../../features/realm/RealmDestination.svelte"),
		enabled: true,
	},
	{
		id: "museum",
		name: "Museum",
		description: "Curate your own open-air museum of sequences",
		icon: "fa-building-columns",
		color: "#a78bfa",
		supportsMultiplayer: false,
		supportsPhysics: true,
		defaultCameraMode: CameraMode.FIRST_PERSON,
		category: "social",
		tags: ["museum", "gallery", "curation", "exhibits"],
		component: () => import("../../../features/realm/destinations/museum/MuseumDestination.svelte"),
		enabled: true,
	},
	{
		id: "3d-controls",
		name: "3D Controls",
		description:
			"Adjust grid positions, turns, planes, and motion types on a live 3D scene",
		icon: "fa-cube",
		color: "#06b6d4",
		supportsMultiplayer: false,
		supportsPhysics: false,
		defaultCameraMode: CameraMode.ORBIT,
		category: "creative",
		tags: ["controls", "dev", "tuning", "props"],
		component: () =>
			import("../../../features/realm/tools/3d-controls/ThreeDControlsLab.svelte"),
		enabled: true,
	},
	// Disabled destinations (kept for future re-enabling)
	{
		id: "stage",
		name: "Stage",
		description:
			"Multi-performer choreography viewer with synchronized playback and timeline editing",
		icon: "fa-theater-masks",
		color: "#8b5cf6",
		supportsMultiplayer: false,
		supportsPhysics: false,
		defaultCameraMode: CameraMode.THIRD_PERSON,
		category: "performance",
		tags: ["choreography", "avatars", "performance", "timeline"],
		component: () => import("../../../features/realm/destinations/stage/StageDestination.svelte"),
		enabled: false, // Will be ported to Realm
	},
	{
		id: "gallery",
		name: "Gallery",
		description:
			"Browse sequences in a procedural museum with friends. Multiplayer social experience",
		icon: "fa-building-columns",
		color: "#06b6d4",
		supportsMultiplayer: true,
		supportsPhysics: true,
		defaultCameraMode: CameraMode.FIRST_PERSON,
		category: "social",
		tags: ["museum", "multiplayer", "social", "exhibits"],
		component: () =>
			import("../../../features/realm/destinations/gallery/GalleryDestination.svelte"),
		enabled: false, // Will be completely redone
	},
	{
		id: "hannons-camp",
		name: "Hannon's Camp",
		description:
			"Real terrain from Kinetic Fire festival site in Southwest Ohio",
		icon: "fa-campground",
		color: "#f97316",
		supportsMultiplayer: false,
		supportsPhysics: true,
		defaultCameraMode: CameraMode.FIRST_PERSON,
		category: "exploration",
		tags: ["real-terrain", "festival", "kinetic-fire", "ohio"],
		component: () =>
			import("../../../features/realm/HannonsCampDestination.svelte"),
		enabled: false,
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
		description: "Browse new worlds",
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
