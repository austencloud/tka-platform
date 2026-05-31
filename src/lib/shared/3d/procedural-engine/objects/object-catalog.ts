/**
 * Object Catalog
 *
 * Defines all placeable object types with their properties.
 * Each object has a fallback primitive geometry for immediate rendering,
 * with optional GLTF model path for higher-quality versions.
 */

import type { PlacedObjectType } from "./placed-object";

export interface ObjectDefinition {
	key: string;
	name: string;
	type: PlacedObjectType;
	icon: string; // Font Awesome class
	modelPath?: string; // GLTF path (optional, for future)
	fallbackGeometry: "cone" | "box" | "cylinder" | "sphere" | "flag";
	defaultScale: number;
	defaultHeight: number; // Height above ground
	snapToGround: boolean;
	canRotate: boolean;
	canScale: boolean;
	color: number; // Default hex color
}

export const OBJECT_CATALOG: ObjectDefinition[] = [
	// ─────────────────────────────────────────────────────────────
	// TENTS - Camping structures
	// ─────────────────────────────────────────────────────────────
	{
		key: "bell-tent",
		name: "Bell Tent",
		type: "tent",
		icon: "fa-campground",
		fallbackGeometry: "cone",
		defaultScale: 3,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0xd4a574, // Warm canvas tan
	},
	{
		key: "dome-tent",
		name: "Dome Tent",
		type: "tent",
		icon: "fa-igloo",
		fallbackGeometry: "sphere",
		defaultScale: 2,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0x4a90a4, // Blue-gray
	},
	{
		key: "shade-structure",
		name: "Shade Structure",
		type: "tent",
		icon: "fa-umbrella-beach",
		fallbackGeometry: "box",
		defaultScale: 5,
		defaultHeight: 2,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0xf5f5dc, // Beige
	},
	{
		key: "geodesic-dome",
		name: "Geodesic Dome",
		type: "tent",
		icon: "fa-gem",
		fallbackGeometry: "sphere",
		defaultScale: 4,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: false,
		canScale: true,
		color: 0xe8e8e8, // Light gray
	},

	// ─────────────────────────────────────────────────────────────
	// MARKERS - Points of interest
	// ─────────────────────────────────────────────────────────────
	{
		key: "pin-marker",
		name: "Pin Marker",
		type: "marker",
		icon: "fa-map-pin",
		fallbackGeometry: "cone",
		defaultScale: 0.5,
		defaultHeight: 2,
		snapToGround: true,
		canRotate: false,
		canScale: false,
		color: 0xff6b6b, // Coral red
	},
	{
		key: "flag",
		name: "Flag",
		type: "marker",
		icon: "fa-flag",
		fallbackGeometry: "flag",
		defaultScale: 1,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0xffd93d, // Yellow
	},
	{
		key: "waypoint",
		name: "Waypoint",
		type: "marker",
		icon: "fa-location-dot",
		fallbackGeometry: "cylinder",
		defaultScale: 0.3,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: false,
		canScale: false,
		color: 0x4ecdc4, // Teal
	},

	// ─────────────────────────────────────────────────────────────
	// PROPS - Decorative items
	// ─────────────────────────────────────────────────────────────
	{
		key: "fire-pit",
		name: "Fire Pit",
		type: "prop",
		icon: "fa-fire",
		fallbackGeometry: "cylinder",
		defaultScale: 1.5,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: false,
		canScale: true,
		color: 0x8b4513, // Saddle brown
	},
	{
		key: "picnic-table",
		name: "Picnic Table",
		type: "prop",
		icon: "fa-chair",
		fallbackGeometry: "box",
		defaultScale: 2,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0x8b7355, // Wood brown
	},
	{
		key: "cooler",
		name: "Cooler",
		type: "prop",
		icon: "fa-box",
		fallbackGeometry: "box",
		defaultScale: 0.8,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0x1e90ff, // Dodger blue
	},
	{
		key: "speaker-tower",
		name: "Speaker Tower",
		type: "prop",
		icon: "fa-volume-high",
		fallbackGeometry: "box",
		defaultScale: 1,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0x333333, // Dark gray
	},
	{
		key: "generator",
		name: "Generator",
		type: "prop",
		icon: "fa-bolt",
		fallbackGeometry: "box",
		defaultScale: 1,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0xffcc00, // Yellow
	},

	// ─────────────────────────────────────────────────────────────
	// ZONES - Area markers
	// ─────────────────────────────────────────────────────────────
	{
		key: "sound-camp",
		name: "Sound Camp Zone",
		type: "zone",
		icon: "fa-music",
		fallbackGeometry: "cylinder",
		defaultScale: 15,
		defaultHeight: 0.1,
		snapToGround: true,
		canRotate: false,
		canScale: true,
		color: 0x9b59b6, // Purple (semi-transparent)
	},
	{
		key: "art-installation",
		name: "Art Installation",
		type: "zone",
		icon: "fa-palette",
		fallbackGeometry: "cylinder",
		defaultScale: 8,
		defaultHeight: 0.1,
		snapToGround: true,
		canRotate: false,
		canScale: true,
		color: 0xe74c3c, // Red (semi-transparent)
	},
	{
		key: "gathering-area",
		name: "Gathering Area",
		type: "zone",
		icon: "fa-users",
		fallbackGeometry: "cylinder",
		defaultScale: 12,
		defaultHeight: 0.1,
		snapToGround: true,
		canRotate: false,
		canScale: true,
		color: 0x3498db, // Blue (semi-transparent)
	},
	{
		key: "parking",
		name: "Parking Area",
		type: "zone",
		icon: "fa-car",
		fallbackGeometry: "box",
		defaultScale: 20,
		defaultHeight: 0.05,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0x7f8c8d, // Gray (semi-transparent)
	},
];

/**
 * Get object definition by key
 */
export function getObjectDefinition(key: string): ObjectDefinition | undefined {
	return OBJECT_CATALOG.find((def) => def.key === key);
}

/**
 * Get all objects of a specific type
 */
export function getObjectsByType(type: PlacedObjectType): ObjectDefinition[] {
	return OBJECT_CATALOG.filter((def) => def.type === type);
}

/**
 * Object categories for UI grouping
 */
export const OBJECT_CATEGORIES = [
	{ key: "tent", label: "Tents", icon: "fa-campground" },
	{ key: "marker", label: "Markers", icon: "fa-map-pin" },
	{ key: "prop", label: "Props", icon: "fa-couch" },
	{ key: "zone", label: "Zones", icon: "fa-draw-polygon" },
] as const;
