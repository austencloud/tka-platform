/**
 * PlacedObject Domain Model
 *
 * Represents a user-placed object in a camp scene (tent, marker, prop, zone).
 * Uses quaternion for rotation to avoid gimbal lock and match Three.js Object3D.
 */

export interface PlacedObject {
	id: string; // UUID
	sceneId: string; // e.g., "hannons-camp"

	// Object identity
	objectType: PlacedObjectType;
	modelKey: string; // e.g., "bell-tent", "dome-tent", "fire-pit"

	// Transform (matches Three.js Object3D)
	position: [number, number, number];
	rotation: [number, number, number, number]; // Quaternion [x, y, z, w]
	scale: [number, number, number];

	// Metadata
	label?: string;
	color?: string; // Hex color override
	locked?: boolean; // Prevent accidental edits
	visible?: boolean;

	// Audit
	createdAt: Date;
	lastModified: Date;
	userId: string;
}

export type CampObjectType =
	| "tent"
	| "marker"
	| "prop"
	| "zone"
	| "path";

export type PlacedObjectType = CampObjectType | (string & {});

/**
 * Create a new PlacedObject with default values
 */
export function createPlacedObject(
	sceneId: string,
	objectType: PlacedObjectType,
	modelKey: string,
	position: [number, number, number],
	userId: string,
): PlacedObject {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		sceneId,
		objectType,
		modelKey,
		position,
		rotation: [0, 0, 0, 1], // Identity quaternion
		scale: [1, 1, 1],
		locked: false,
		visible: true,
		createdAt: now,
		lastModified: now,
		userId,
	};
}

/**
 * Serialize PlacedObject for storage (converts Dates to ISO strings)
 */
export function serializePlacedObject(obj: PlacedObject): Record<string, unknown> {
	return {
		...obj,
		createdAt: obj.createdAt.toISOString(),
		lastModified: obj.lastModified.toISOString(),
	};
}

/**
 * Deserialize PlacedObject from storage (converts ISO strings to Dates)
 */
export function deserializePlacedObject(data: Record<string, unknown>): PlacedObject {
	return {
		...(data as unknown as PlacedObject),
		createdAt: new Date(data.createdAt as string),
		lastModified: new Date(data.lastModified as string),
	};
}
