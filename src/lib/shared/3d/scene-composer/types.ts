// src/lib/shared/3d/scene-composer/types.ts

import type { Vector3, Quaternion, Mesh } from "three";
import type { ObjectDefinition } from "../procedural-engine/objects/object-catalog";

export interface SceneComposerPlugin {
	sceneId: string;
	displayName: string;
	catalog: ComposerCatalog;
	surfaceRules: SurfaceRules;
	getDefaults(): ComposerPlacement[];
	constraints?: PlacementConstraints;
}

export interface ComposerCatalog {
	categories: CatalogCategory[];
	getDefinition(key: string): ObjectDefinition | undefined;
	allItems(): ObjectDefinition[];
}

export interface CatalogCategory {
	id: string;
	label: string;
	icon: string;
	items: ObjectDefinition[];
}

export interface SurfaceRules {
	isSurface(mesh: Mesh): boolean;
	orientationMode: "upright" | "surface-normal" | "custom";
	orientFromNormal?(normal: Vector3): Quaternion;
	gridSize: number | null;
	surfaceOffset: number;
}

export interface PlacementConstraints {
	maxObjects?: number;
	maxPerType?: Record<string, number>;
	minSpacing?: number;
	exclusionZones?: ExclusionZone[];
	validate?(placement: ComposerPlacement, existing: ComposerPlacement[]): string | null;
}

export interface ExclusionZone {
	center: [number, number, number];
	radius: number;
	reason: string;
}

export interface ComposerPlacement {
	id: string;
	objectKey: string;
	position: [number, number, number];
	rotation: [number, number, number, number];
	scale: [number, number, number];
	locked?: boolean;
	visible?: boolean;
}
