/**
 * MuseumPlayerController
 *
 * Handles player movement logic in both top-down and FPS modes:
 * - Top-down WASD movement with physics-based collision
 * - FPS position sync from physics provider
 * - Portal teleportation
 * - Void recovery (teleport to spawn when player falls off the map)
 * - Spawn reset
 * - Facing direction computation
 *
 * All Svelte reactive state ($state) stays in the component. This class
 * computes movement and returns results for the component to apply.
 */

import type { MuseumGrid } from "../domain/museum-grid-types";
import type { MuseumPhysicsProvider } from "./museum-physics-provider";
import type { PortalProximityChecker } from "./museum-portals";

// ── Constants ──

const TOP_DOWN_MOVE_SPEED = 3;
const TOP_DOWN_SPRINT_MULTIPLIER = 2.5;

export interface PlayerMoveResult {
  /** Updated player position */
  position: { x: number; y: number; z: number };
  /** Updated player yaw (facing direction) */
  playerYaw: number;
  /** Current movement speed */
  speed: number;
  /** True if a portal teleport occurred */
  teleported: boolean;
  /** True if void recovery teleported the player to spawn */
  voidRecovered: boolean;
}

export class MuseumPlayerController {
  private readonly grid: MuseumGrid;
  private readonly TILE_SIZE: number;
  private readonly physicsProvider: MuseumPhysicsProvider;
  private readonly portalChecker: PortalProximityChecker;

  constructor(
    grid: MuseumGrid,
    tileSize: number,
    physicsProvider: MuseumPhysicsProvider,
    portalChecker: PortalProximityChecker,
  ) {
    this.grid = grid;
    this.TILE_SIZE = tileSize;
    this.physicsProvider = physicsProvider;
    this.portalChecker = portalChecker;
  }

  // ── Facing direction ──

  /**
   * Convert a yaw angle (radians) to a compass facing string.
   * Quantizes to 8 directions.
   */
  yawToFacing(yaw: number): string {
    const a = ((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const idx = Math.round(a / (Math.PI / 4)) % 8;
    return [
      "south", "southwest", "west", "northwest",
      "north", "northeast", "east", "southeast",
    ][idx]!;
  }

  // ── Top-down movement ──

  /**
   * Process WASD input in top-down mode. Moves the player via the physics
   * provider and returns the resulting state.
   */
  updateTopDownMovement(
    heldKeys: Set<string>,
    delta: number,
    currentYaw: number,
  ): PlayerMoveResult {
    const forward = (heldKeys.has("KeyW") || heldKeys.has("ArrowUp") ? 1 : 0) -
                    (heldKeys.has("KeyS") || heldKeys.has("ArrowDown") ? 1 : 0);
    const strafe = (heldKeys.has("KeyD") || heldKeys.has("ArrowRight") ? 1 : 0) -
                   (heldKeys.has("KeyA") || heldKeys.has("ArrowLeft") ? 1 : 0);

    let speed = 0;
    let playerYaw = currentYaw;

    if (forward !== 0 || strafe !== 0) {
      const isSprinting = heldKeys.has("ShiftLeft") || heldKeys.has("ShiftRight");
      const moveSpeed = isSprinting
        ? TOP_DOWN_MOVE_SPEED * TOP_DOWN_SPRINT_MULTIPLIER
        : TOP_DOWN_MOVE_SPEED;

      let moveX = strafe * moveSpeed * delta;
      let moveZ = -forward * moveSpeed * delta;

      // Normalize diagonal
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      const maxMove = moveSpeed * delta;
      if (len > maxMove) {
        moveX *= maxMove / len;
        moveZ *= maxMove / len;
      }

      this.physicsProvider.movePlayer({ x: moveX, y: 0, z: moveZ }, delta);
      const topVel = this.physicsProvider.getVelocity();
      speed = Math.sqrt(topVel.x * topVel.x + topVel.z * topVel.z);

      if (Math.abs(moveX) > 0.001 || Math.abs(moveZ) > 0.001) {
        playerYaw = Math.atan2(moveX, moveZ);
      }
    }

    // Read back position from physics
    const pos = { ...this.physicsProvider.getPlayerPosition() };

    // Void recovery
    let voidRecovered = false;
    const tileKey = `${Math.round(pos.x / this.TILE_SIZE)},${Math.round(pos.z / this.TILE_SIZE)}`;
    if (!this.grid.tiles.has(tileKey)) {
      voidRecovered = true;
      const spawnX = this.grid.spawn.x * this.TILE_SIZE;
      const spawnZ = this.grid.spawn.y * this.TILE_SIZE;
      this.physicsProvider.teleport!({ x: spawnX, y: 0, z: spawnZ });
      const corrected = this.physicsProvider.getPlayerPosition();
      pos.x = corrected.x;
      pos.y = corrected.y;
      pos.z = corrected.z;
    }

    // Portal detection only - caller handles the actual teleport
    // because it needs to update reactive state (yaw, fpsActive, etc.)
    const portalHit = this.portalChecker.check(pos.x, pos.z);

    return { position: pos, playerYaw, speed, teleported: !!portalHit, voidRecovered };
  }

  // ── FPS position sync ──

  /**
   * Read back position from the physics provider in FPS mode.
   * Performs void recovery. Portal detection is returned but NOT acted on -
   * the Svelte component's handlePortalTeleport does the actual teleport
   * because it needs to update reactive state (yaw, fpsActive, etc.).
   */
  syncFpsPosition(): PlayerMoveResult & {
    velocity: { x: number; y: number; z: number };
    grounded: boolean;
    portalHit: ReturnType<PortalProximityChecker["check"]>;
  } {
    const fpsPos = { ...this.physicsProvider.getPlayerPosition() };

    // Void recovery
    let voidRecovered = false;
    const tileKey = `${Math.round(fpsPos.x / this.TILE_SIZE)},${Math.round(fpsPos.z / this.TILE_SIZE)}`;
    if (!this.grid.tiles.has(tileKey)) {
      voidRecovered = true;
      const spawnX = this.grid.spawn.x * this.TILE_SIZE;
      const spawnZ = this.grid.spawn.y * this.TILE_SIZE;
      this.physicsProvider.teleport!({ x: spawnX, y: 0, z: spawnZ });
      const corrected = this.physicsProvider.getPlayerPosition();
      fpsPos.x = corrected.x;
      fpsPos.y = corrected.y;
      fpsPos.z = corrected.z;
    }

    // Portal detection only - caller handles the actual teleport
    const portalHit = this.portalChecker.check(fpsPos.x, fpsPos.z);

    const vel = this.physicsProvider.getVelocity();
    const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    const grounded = this.physicsProvider.isGrounded();

    return {
      position: fpsPos,
      playerYaw: 0, // caller uses their own yaw in FPS
      speed,
      teleported: !!portalHit,
      voidRecovered,
      velocity: vel,
      grounded,
      portalHit,
    };
  }

  // ── Spawn reset ──

  /**
   * Teleport the player back to the spawn point.
   */
  resetToSpawn(): { x: number; y: number; z: number } {
    const spawnX = this.grid.spawn.x * this.TILE_SIZE;
    const spawnZ = this.grid.spawn.y * this.TILE_SIZE;
    this.physicsProvider.teleport!({ x: spawnX, y: 0, z: spawnZ });
    return this.physicsProvider.getPlayerPosition();
  }

  /**
   * Sync playerPosition from physics provider (after teleport).
   */
  syncPositionFromPhysics(): { x: number; y: number; z: number } {
    return { ...this.physicsProvider.getPlayerPosition() };
  }

  /**
   * Get the physics provider's current player position.
   */
  getPlayerPosition(): { x: number; y: number; z: number } {
    return this.physicsProvider.getPlayerPosition();
  }
}
