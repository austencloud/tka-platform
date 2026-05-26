/**
 * Creates Three.js terrain meshes from heightmap data.
 * Extracted from HannonsCampModule for reusability and testability.
 */

import {
	BufferGeometry,
	BufferAttribute,
	Mesh,
	MeshStandardMaterial,
} from "three";
import type { GeoBounds } from "./terrain-types";

/**
 * Heightmap data structure from terrain JSON files
 */
export interface HeightmapData {
	width: number;
	height: number;
	minElevation: number;
	maxElevation: number;
	heights: number[];
}

/**
 * World dimensions in real meters
 */
export interface WorldDimensions {
	width: number;
	depth: number;
}

/**
 * Complete terrain data structure
 */
export interface TerrainData {
	heightmap: HeightmapData;
	geoBounds: GeoBounds;
	worldDimensions: WorldDimensions;
}

/**
 * Result from terrain mesh generation
 */
export interface TerrainMeshResult {
	mesh: Mesh;
	material: MeshStandardMaterial;
	bounds: GeoBounds;
	minElevation: number;
	elevationRange: { min: number; max: number };
	terrainSize: { width: number; depth: number };
}

function generateVertices(
	vertices: Float32Array,
	colors: Float32Array,
	uvs: Float32Array,
	width: number,
	height: number,
	boundsWidth: number,
	boundsDepth: number,
	heights: number[],
	minElevation: number,
	maxElevation: number,
): void {
	for (let z = 0; z < height; z++) {
		for (let x = 0; x < width; x++) {
			const idx = (z * width + x) * 3;
			const uvIdx = (z * width + x) * 2;
			const heightIdx = z * width + x;

			const worldX = (x / (width - 1)) * boundsWidth - boundsWidth / 2;
			const worldZ = (z / (height - 1)) * boundsDepth - boundsDepth / 2;

			const rawHeight = heights[heightIdx] ?? minElevation;
			const realHeight = rawHeight - minElevation;

			vertices[idx] = worldX;
			vertices[idx + 1] = realHeight;
			vertices[idx + 2] = worldZ;

			uvs[uvIdx] = x / (width - 1);
			uvs[uvIdx + 1] = 1 - z / (height - 1);

			const t = (rawHeight - minElevation) / (maxElevation - minElevation);
			colors[idx] = 0.2 + t * 0.3;
			colors[idx + 1] = 0.5 - t * 0.15;
			colors[idx + 2] = 0.15 + t * 0.1;
		}
	}
}

function calculateNormals(
	normals: Float32Array,
	vertices: Float32Array,
	width: number,
	height: number,
	boundsWidth: number,
	boundsDepth: number,
): void {
	for (let z = 0; z < height; z++) {
		for (let x = 0; x < width; x++) {
			const idx = (z * width + x) * 3;

			const h = vertices[idx + 1] ?? 0;
			const hL = x > 0 ? (vertices[(z * width + (x - 1)) * 3 + 1] ?? h) : h;
			const hR = x < width - 1 ? (vertices[(z * width + (x + 1)) * 3 + 1] ?? h) : h;
			const hD = z > 0 ? (vertices[((z - 1) * width + x) * 3 + 1] ?? h) : h;
			const hU = z < height - 1 ? (vertices[((z + 1) * width + x) * 3 + 1] ?? h) : h;

			const stepX = boundsWidth / (width - 1);
			const stepZ = boundsDepth / (height - 1);
			const nx = (hL - hR) / (2 * stepX);
			const nz = (hD - hU) / (2 * stepZ);
			const len = Math.sqrt(nx * nx + 1 + nz * nz);

			normals[idx] = nx / len;
			normals[idx + 1] = 1 / len;
			normals[idx + 2] = nz / len;
		}
	}
}

function generateIndices(width: number, height: number): Uint32Array {
	const quadCount = (width - 1) * (height - 1);
	const indices = new Uint32Array(quadCount * 6);
	let indexIdx = 0;

	for (let z = 0; z < height - 1; z++) {
		for (let x = 0; x < width - 1; x++) {
			const tl = z * width + x;
			const tr = tl + 1;
			const bl = (z + 1) * width + x;
			const br = bl + 1;

			indices[indexIdx++] = tl;
			indices[indexIdx++] = bl;
			indices[indexIdx++] = tr;
			indices[indexIdx++] = tr;
			indices[indexIdx++] = bl;
			indices[indexIdx++] = br;
		}
	}

	return indices;
}

/**
 * Create a terrain mesh from heightmap data.
 *
 * Uses 1:1 meter scale - no elevation scaling.
 * Lowest point is Y=0, real meter differences preserved.
 */
export function createTerrainMesh(terrainData: TerrainData): TerrainMeshResult {
	const { heightmap, geoBounds, worldDimensions } = terrainData;
	const { width, height, minElevation, maxElevation, heights } = heightmap;

	const boundsWidth = worldDimensions.width;
	const boundsDepth = worldDimensions.depth;

	const geometry = new BufferGeometry();
	const vertexCount = width * height;
	const vertices = new Float32Array(vertexCount * 3);
	const normals = new Float32Array(vertexCount * 3);
	const colors = new Float32Array(vertexCount * 3);
	const uvs = new Float32Array(vertexCount * 2);

	generateVertices(vertices, colors, uvs, width, height, boundsWidth, boundsDepth, heights, minElevation, maxElevation);
	calculateNormals(normals, vertices, width, height, boundsWidth, boundsDepth);
	const indices = generateIndices(width, height);

	geometry.setAttribute("position", new BufferAttribute(vertices, 3));
	geometry.setAttribute("normal", new BufferAttribute(normals, 3));
	geometry.setAttribute("color", new BufferAttribute(colors, 3));
	geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
	geometry.setIndex(new BufferAttribute(indices, 1));

	const material = new MeshStandardMaterial({
		vertexColors: true,
		roughness: 0.9,
		metalness: 0.0,
		flatShading: false,
	});

	const mesh = new Mesh(geometry, material);
	mesh.receiveShadow = true;
	mesh.castShadow = true;

	return {
		mesh,
		material,
		bounds: geoBounds,
		minElevation,
		elevationRange: { min: minElevation, max: maxElevation },
		terrainSize: {
			width: Math.round(boundsWidth),
			depth: Math.round(boundsDepth),
		},
	};
}
