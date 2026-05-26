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
	 * Create a flat ground plane collider for the stage zone
	 * This provides immediate collision before terrain chunks load
	 */
	addStageGroundCollider(
		centerX: number,
		centerZ: number,
		radius: number,
		height: number = 0, // Default to ground level (Y=0)
	): void {
		if (!this.physicsState.rapier || !this.physicsState.world) {
			console.warn("[TerrainPhysics] Physics not initialized");
			return;
		}

		const RAPIER = this.physicsState.rapier;
		const key = "stage-ground";

		// Remove existing stage ground if any
		const existing = this.colliders.get(key);
		if (existing) {
			this.physicsState.world.removeCollider(existing.collider, true);
			this.colliders.delete(key);
		}

		// Create a large flat cuboid at the specified height
		// Use a thin box (half-extents: radius, 0.1, radius)
		const colliderDesc = RAPIER.ColliderDesc.cuboid(radius * 2, 0.1, radius * 2);

		if (!colliderDesc) {
			console.error("[TerrainPhysics] Failed to create stage ground collider");
			return;
		}

		colliderDesc.setFriction(0.8);
		colliderDesc.setRestitution(0.0);
		// Position so top surface is at the specified height
		colliderDesc.setTranslation(centerX, height - 0.1, centerZ);

		const collider = this.physicsState.world.createCollider(colliderDesc);

		this.colliders.set(key, {
			collider,
			chunkX: 0,
			chunkZ: 0,
		});

	}

	/**
	 * Remove the stage ground collider
	 */
	removeStageGroundCollider(): void {
		const key = "stage-ground";
		const existing = this.colliders.get(key);

		if (existing && this.physicsState.world) {
			this.physicsState.world.removeCollider(existing.collider, true);
			this.colliders.delete(key);
		}
	}

	/**
	 * Dispose all colliders
	 *
	 * Uses try-catch to handle HMR scenarios where Rapier's WASM objects
	 * may already be freed before this cleanup runs.
	 */
	dispose(): void {
		try {
			if (this.physicsState.world) {
				for (const terrain of this.colliders.values()) {
					this.physicsState.world.removeCollider(terrain.collider, true);
				}
			}
		} catch (e) {
			// Rapier WASM objects may already be freed during HMR - this is expected
			if (import.meta.hot) {
				console.debug('[TerrainCollider] Rapier cleanup during HMR:', e);
			}
		}
		this.colliders.clear();
	}
}
