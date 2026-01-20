/**
 * Terrain Collider Generator
 *
 * Creates Rapier trimesh colliders from chunk geometry.
 * Each chunk gets its own static collider for efficient collision detection.
 *
 * Used by: Infinite Worlds and any future terrain-based destinations
 */

import type {
	PhysicsWorldState,
	TerrainMeshData,
	TerrainCollider,
} from "./types";

// ============================================================================
// TERRAIN PHYSICS MANAGER
// ============================================================================

/**
 * Terrain physics manager - handles all chunk colliders
 */
export class TerrainPhysicsManager {
	private colliders: Map<string, TerrainCollider> = new Map();
	private physicsState: PhysicsWorldState;

	constructor(physicsState: PhysicsWorldState) {
		this.physicsState = physicsState;
	}

	/**
	 * Create a trimesh collider from chunk mesh data
	 */
	addChunkCollider(
		chunkX: number,
		chunkZ: number,
		chunkSize: number,
		meshData: TerrainMeshData,
	): TerrainCollider | null {
		if (!this.physicsState.rapier || !this.physicsState.world) {
			console.warn("[TerrainPhysics] Physics not initialized");
			return null;
		}

		const RAPIER = this.physicsState.rapier;
		const key = `${chunkX},${chunkZ}`;

		// Remove existing collider if any
		this.removeChunkCollider(chunkX, chunkZ);

		// Create trimesh collider description
		// Rapier expects vertices as flat Float32Array and indices as Uint32Array
		const vertices = meshData.vertices;
		const indices = meshData.indices;

		// Create the trimesh collider
		const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);

		if (!colliderDesc) {
			console.error("[TerrainPhysics] Failed to create trimesh collider desc");
			return null;
		}

		// Set collider properties
		colliderDesc.setFriction(0.8);
		colliderDesc.setRestitution(0.0);

		// Position the collider at the chunk's world position
		colliderDesc.setTranslation(chunkX * chunkSize, 0, chunkZ * chunkSize);

		// Create the collider (static - no rigid body needed)
		const collider = this.physicsState.world.createCollider(colliderDesc);

		const terrainCollider: TerrainCollider = {
			collider,
			chunkX,
			chunkZ,
		};

		this.colliders.set(key, terrainCollider);

		return terrainCollider;
	}

	/**
	 * Remove a chunk's collider
	 */
	removeChunkCollider(chunkX: number, chunkZ: number): void {
		const key = `${chunkX},${chunkZ}`;
		const existing = this.colliders.get(key);

		if (existing && this.physicsState.world) {
			this.physicsState.world.removeCollider(existing.collider, true);
			this.colliders.delete(key);
		}
	}

	/**
	 * Check if a chunk has a collider
	 */
	hasCollider(chunkX: number, chunkZ: number): boolean {
		return this.colliders.has(`${chunkX},${chunkZ}`);
	}

	/**
	 * Get collider count
	 */
	getColliderCount(): number {
		return this.colliders.size;
	}

	/**
	 * Dispose all colliders
	 */
	dispose(): void {
		if (this.physicsState.world) {
			for (const terrain of this.colliders.values()) {
				this.physicsState.world.removeCollider(terrain.collider, true);
			}
		}
		this.colliders.clear();
	}
}
