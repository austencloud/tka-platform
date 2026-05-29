/**
 * MuseumPhysicsProvider
 *
 * Grid-based collision detection for the museum's 3D mode.
 * Instead of Rapier physics, this checks the museum's tile grid
 * to determine if movement is allowed. Solid tiles (walls, ropes,
 * exhibit furniture, signs) block movement; floor, corridor, door,
 * and content tiles are walkable.
 *
 * Supports jumping: UCC handles jump impulse and gravity, we accept
 * the Y component of desiredMovement and report grounded state
 * based on whether the player is at standing height.
 */

import type { PhysicsProvider, Vector3 } from "$lib/shared/3d/camera/types";
import type { MuseumGrid } from "../domain/museum-grid-types";

export const SOLID_TYPES = new Set([
	"wall",
	"rope",
	"scaffolding",
	"exhibit-panel",
	"pedestal",
	"performer-station",
	"sign",
]);

// Collision radius in world units - prevents clipping through wall corners.
// TILE_SIZE is 0.5, so 0.15 keeps the player ~30% of a tile away from walls.
const COLLISION_RADIUS = 0.15;

// UCC first-person eye height = position.y + 0.75 (from SETTINGS.firstPerson.height).
// For a 1.6m eye level on a ground-plane museum, we keep position.y at 0.85
// so that 0.85 + 0.75 = 1.6m. This matches the Rapier capsule center convention.
const STANDING_Y = 0.85;

export class MuseumPhysicsProvider implements PhysicsProvider {
	private position: Vector3;
	private velocity: Vector3 = { x: 0, y: 0, z: 0 };

	/** When true, movePlayer ignores XZ - animation drives XZ via applyRootMotion instead. */
	rootMotionEnabled = false;

	constructor(
		private grid: MuseumGrid,
		private tileSize: number,
		spawnPosition: Vector3
	) {
		this.position = { x: spawnPosition.x, y: STANDING_Y, z: spawnPosition.z };
	}

	/**
	 * Check if a world-space position is walkable (not a solid object, not void).
	 * Tests a small collision disc around the position to prevent corner clipping.
	 */
	private isWalkableAt(worldX: number, worldZ: number): boolean {
		const offsets = [
			{ x: COLLISION_RADIUS, z: 0 },
			{ x: -COLLISION_RADIUS, z: 0 },
			{ x: 0, z: COLLISION_RADIUS },
			{ x: 0, z: -COLLISION_RADIUS },
		];

		for (const offset of offsets) {
			const tileX = Math.round((worldX + offset.x) / this.tileSize);
			const tileY = Math.round((worldZ + offset.z) / this.tileSize);
			const key = `${tileX},${tileY}`;
			const tile = this.grid.tiles.get(key);

			if (!tile || SOLID_TYPES.has(tile.type)) {
				return false;
			}
		}

		return true;
	}

	movePlayer(desiredMovement: Vector3, deltaTime: number): void {
		const dt = deltaTime > 0 ? deltaTime : 1 / 60;

		if (this.rootMotionEnabled) {
			// Root motion mode: ignore XZ from code - animation drives XZ
			// via applyRootMotion(). Zero XZ velocity here; applyRootMotion
			// will set accurate XZ velocity when it runs.
			this.velocity = { x: 0, y: desiredMovement.y / dt, z: 0 };
		} else {
			// Code-driven mode: apply XZ from UCC/top-down input
			const newX = this.position.x + desiredMovement.x;
			const newZ = this.position.z + desiredMovement.z;

			// XZ collision: try full, then wall-slide per axis
			if (this.isWalkableAt(newX, newZ)) {
				this.position.x = newX;
				this.position.z = newZ;
				this.velocity = { x: desiredMovement.x / dt, y: desiredMovement.y / dt, z: desiredMovement.z / dt };
			} else if (this.isWalkableAt(newX, this.position.z)) {
				this.position.x = newX;
				this.velocity = { x: desiredMovement.x / dt, y: desiredMovement.y / dt, z: 0 };
			} else if (this.isWalkableAt(this.position.x, newZ)) {
				this.position.z = newZ;
				this.velocity = { x: 0, y: desiredMovement.y / dt, z: desiredMovement.z / dt };
			} else {
				this.velocity = { x: 0, y: desiredMovement.y / dt, z: 0 };
			}
		}

		// Y movement: accept UCC's jump/gravity calculations, clamp at ground
		this.position.y += desiredMovement.y;
		if (this.position.y < STANDING_Y) {
			this.position.y = STANDING_Y;
		}
	}

	/**
	 * Apply animation-driven XZ movement (root motion). Same collision
	 * logic as movePlayer, but only handles XZ - Y stays physics-driven.
	 * The delta is already in world space (caller rotates by facing angle).
	 */
	applyRootMotion(worldDelta: { x: number; z: number }): void {
		const prevX = this.position.x;
		const prevZ = this.position.z;
		const newX = prevX + worldDelta.x;
		const newZ = prevZ + worldDelta.z;

		// Wall-slide collision (same as movePlayer)
		if (this.isWalkableAt(newX, newZ)) {
			this.position.x = newX;
			this.position.z = newZ;
		} else if (this.isWalkableAt(newX, this.position.z)) {
			this.position.x = newX;
		} else if (this.isWalkableAt(this.position.x, newZ)) {
			this.position.z = newZ;
		}

		// Compute velocity from actual displacement (for speed reporting)
		const dt = 1 / 60; // approximate frame time
		this.velocity.x = (this.position.x - prevX) / dt;
		this.velocity.z = (this.position.z - prevZ) / dt;
	}

	getPlayerPosition(): Vector3 {
		return { ...this.position };
	}

	isGrounded(): boolean {
		// Grounded when at (or very near) standing height
		return this.position.y <= STANDING_Y + 0.01;
	}

	getVelocity(): Vector3 {
		return { ...this.velocity };
	}

	teleport(position: Vector3): void {
		this.position = { x: position.x, y: STANDING_Y, z: position.z };
	}
}

export function createMuseumPhysicsProvider(
	grid: MuseumGrid,
	tileSize: number,
	spawnPosition: Vector3
): PhysicsProvider {
	return new MuseumPhysicsProvider(grid, tileSize, spawnPosition);
}
