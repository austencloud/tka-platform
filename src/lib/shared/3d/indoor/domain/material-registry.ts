/**
 * Material Registry
 *
 * Maps WallMaterialId to Three.js material properties.
 * Phase 1: solid colors matching Discovery Chamber aesthetic.
 * Phase 2: PBR textures with normal maps.
 */

import type { WallMaterialId } from "./room-types";

export interface MaterialProperties {
	color: number;
	roughness: number;
	metalness: number;
}

const MATERIALS: Record<WallMaterialId, MaterialProperties> = {
	stone: { color: 0x5a4a3a, roughness: 0.92, metalness: 0.02 },
	marble: { color: 0xd4c5a9, roughness: 0.3, metalness: 0.05 },
	wood: { color: 0x8b6914, roughness: 0.85, metalness: 0.0 },
	metal: { color: 0x666666, roughness: 0.4, metalness: 0.7 },
	sandstone: { color: 0xc2a278, roughness: 0.9, metalness: 0.01 },
};

const FLOOR_DARKEN = 0.85;
const CEILING_DARKEN = 0.7;

function darkenColor(color: number, factor: number): number {
	const r = Math.floor(((color >> 16) & 0xff) * factor);
	const g = Math.floor(((color >> 8) & 0xff) * factor);
	const b = Math.floor((color & 0xff) * factor);
	return (r << 16) | (g << 8) | b;
}

export function getWallMaterial(id: WallMaterialId): MaterialProperties {
	return MATERIALS[id];
}

export function getFloorMaterial(id: WallMaterialId): MaterialProperties {
	const wall = MATERIALS[id];
	return { ...wall, color: darkenColor(wall.color, FLOOR_DARKEN) };
}

export function getCeilingMaterial(id: WallMaterialId): MaterialProperties {
	const wall = MATERIALS[id];
	return { ...wall, color: darkenColor(wall.color, CEILING_DARKEN) };
}
