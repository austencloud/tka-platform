<script lang="ts">
  /**
   * IndoorSceneContent
   *
   * Inner component that runs inside the Threlte Canvas context (via GalleryCanvas).
   * Handles Rapier physics initialization, creates colliders from room geometry,
   * and renders walls/floor/ceiling meshes.
   *
   * Uses UnifiedCameraController (the same one Museum/Realm use) for all
   * camera, input, movement, jumping, and pointer lock handling.
   */

  import { onMount, onDestroy, type Snippet } from "svelte";
  import { T, useTask } from "@threlte/core";
  import { DoubleSide } from "three";

  // Physics
  import {
    createPhysicsWorldState,
    initPhysicsWorld,
    disposePhysicsWorld,
    stepPhysics,
  } from "$lib/shared/3d/physics/rapier-world";
  import { createRigidBody } from "$lib/shared/3d/physics/rapier-world";
  import type { PhysicsWorldState, PlayerControllerState } from "$lib/shared/3d/physics/types";
  import {
    createPlayerController,
    disposePlayerController,
  } from "$lib/shared/3d/physics/player-controller";
  import { createRapierPhysicsProvider } from "$lib/shared/3d/physics/RapierPhysicsProvider";

  // Camera — use the SAME controller as Museum/Realm
  import UnifiedCameraController from "$lib/shared/3d/camera/UnifiedCameraController.svelte";
  import { CameraMode } from "$lib/shared/3d/camera/types";
  import type { AvatarState, PhysicsProvider } from "$lib/shared/3d/camera/types";
  import { getInputCapabilities } from "$lib/shared/input/InputCapabilities.svelte";

  // Room types and materials
  import type { SolvedRoom } from "./domain/room-types";
  import {
    getWallMaterial,
    getFloorMaterial,
    getCeilingMaterial,
  } from "./domain/material-registry";

  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    room: SolvedRoom;
    eyeHeight?: number;
    moveSpeed?: number;
    gravity?: number;
    onPositionChange?: (pos: { x: number; y: number; z: number }) => void;
    children: Snippet;
  }

  let {
    room,
    eyeHeight = 1.7,
    moveSpeed = 2.5,
    gravity = -9.81,
    onPositionChange,
    children,
  }: Props = $props();

  // ============================================================================
  // STATE
  // ============================================================================

  let physicsState: PhysicsWorldState | null = null;
  let playerState: PlayerControllerState | null = null;
  let physicsProvider = $state<PhysicsProvider | null>(null);
  let isDisposed = false;
  let isInitialized = $state(false);

  // Player state (reactive, read by UCC)
  const offset = room.worldOffset;
  const spawnX = room.spawnPoint.x + offset.x;
  const spawnY = room.spawnPoint.y + offset.y;
  const spawnZ = room.spawnPoint.z + offset.z;

  let playerPosition = $state({ x: spawnX, y: spawnY, z: spawnZ });
  let playerYaw = $state(room.spawnFacing);
  let isMoving = $state(false);
  let cameraMode = $state(CameraMode.FIRST_PERSON);

  const inputCapabilities = getInputCapabilities();

  // AvatarState adapter — same pattern as WorldScene.svelte
  const avatarState: AvatarState = {
    get position() {
      return playerPosition;
    },
    get facingAngle() {
      return playerYaw;
    },
    get isMoving() {
      return isMoving;
    },
    setMoveInput(input: { x: number; z: number }) {
      isMoving = input.x !== 0 || input.z !== 0;
    },
    updateMovement(_delta: number, _cameraAngle: number) {
      // Handled by physics provider
    },
    setFacingAngle(angle: number) {
      playerYaw = angle;
    },
  };

  // ============================================================================
  // PHYSICS INITIALIZATION
  // ============================================================================

  onMount(async () => {
    // 1. Initialize physics world
    physicsState = createPhysicsWorldState();
    await initPhysicsWorld(physicsState, { x: 0, y: gravity, z: 0 });

    if (isDisposed) return;

    // 2. Create static colliders for room geometry
    for (const collider of room.colliders) {
      createRigidBody(
        physicsState,
        {
          type: "static",
          position: {
            x: collider.position[0] + offset.x,
            y: collider.position[1] + offset.y,
            z: collider.position[2] + offset.z,
          },
        },
        {
          type: "box",
          size: {
            x: collider.size[0],
            y: collider.size[1],
            z: collider.size[2],
          },
        },
      );
    }

    // 3. Create player controller at spawn point
    playerState = createPlayerController(physicsState, {
      position: { x: spawnX, y: spawnY, z: spawnZ },
    });

    // 4. Create physics provider for UnifiedCameraController
    physicsProvider = createRapierPhysicsProvider(physicsState, playerState);

    isInitialized = true;
  });

  // ============================================================================
  // FRAME LOOP (physics only — UCC handles its own camera/input loop)
  // ============================================================================

  useTask((delta) => {
    if (!isInitialized || !physicsState?.world || isDisposed) return;

    // Step physics
    stepPhysics(physicsState, Math.min(delta, 1 / 30));

    // Report position to parent
    onPositionChange?.(playerPosition);
  });

  // ============================================================================
  // CLEANUP
  // ============================================================================

  onDestroy(() => {
    isDisposed = true;

    if (playerState && physicsState) {
      disposePlayerController(physicsState, playerState);
    }

    if (physicsState) {
      disposePhysicsWorld(physicsState);
    }
  });

  // ============================================================================
  // MATERIAL HELPERS
  // ============================================================================

  const wallMats = $derived(
    room.walls.map((w) => getWallMaterial(w.materialId)),
  );
  const floorMat = $derived(getFloorMaterial(room.floor.materialId));
  const ceilingMat = $derived(getCeilingMaterial(room.ceiling.materialId));

  const ox = room.worldOffset.x;
  const oy = room.worldOffset.y;
  const oz = room.worldOffset.z;
</script>

<!-- UnifiedCameraController — handles ALL input, camera, movement, jumping, pointer lock -->
{#if isInitialized && physicsProvider}
  <UnifiedCameraController
    destinationId="archive"
    {avatarState}
    {physicsProvider}
    enabled={true}
    initialYaw={room.spawnFacing}
    onModeChange={(mode) => {
      cameraMode = mode;
    }}
    onRotationChange={(newYaw, _pitch) => {
      playerYaw = newYaw;
    }}
  />
{/if}

<!-- Walls -->
{#each room.walls as wall, i}
  <T.Mesh
    position.x={wall.position[0] + ox}
    position.y={wall.position[1] + oy}
    position.z={wall.position[2] + oz}
    rotation.y={wall.rotationY}
  >
    <T.BoxGeometry args={wall.size} />
    <T.MeshStandardMaterial
      color={wallMats[i]?.color}
      roughness={wallMats[i]?.roughness}
      metalness={wallMats[i]?.metalness}
      side={DoubleSide}
    />
  </T.Mesh>
{/each}

<!-- Floor -->
<T.Mesh
  position.x={room.floor.position[0] + ox}
  position.y={room.floor.position[1] + oy}
  position.z={room.floor.position[2] + oz}
>
  <T.BoxGeometry args={room.floor.size} />
  <T.MeshStandardMaterial
    color={floorMat.color}
    roughness={floorMat.roughness}
    metalness={floorMat.metalness}
    side={DoubleSide}
  />
</T.Mesh>

<!-- Ceiling -->
<T.Mesh
  position.x={room.ceiling.position[0] + ox}
  position.y={room.ceiling.position[1] + oy}
  position.z={room.ceiling.position[2] + oz}
>
  <T.BoxGeometry args={room.ceiling.size} />
  <T.MeshStandardMaterial
    color={ceilingMat.color}
    roughness={ceilingMat.roughness}
    metalness={ceilingMat.metalness}
    side={DoubleSide}
  />
</T.Mesh>

<!-- Entrance wall segments (flanking the opening) -->
{#each room.entrance.segments as seg}
  {@const mat = getWallMaterial(seg.materialId)}
  <T.Mesh
    position.x={seg.position[0] + ox}
    position.y={seg.position[1] + oy}
    position.z={seg.position[2] + oz}
    rotation.y={seg.rotationY}
  >
    <T.BoxGeometry args={seg.size} />
    <T.MeshStandardMaterial
      color={mat.color}
      roughness={mat.roughness}
      metalness={mat.metalness}
      side={DoubleSide}
    />
  </T.Mesh>
{/each}

<!-- Corridor (if present) -->
{#if room.entrance.corridor}
  <!-- Corridor walls -->
  {#each room.entrance.corridor.walls as cWall}
    {@const mat = getWallMaterial(cWall.materialId)}
    <T.Mesh
      position.x={cWall.position[0] + ox}
      position.y={cWall.position[1] + oy}
      position.z={cWall.position[2] + oz}
      rotation.y={cWall.rotationY}
    >
      <T.BoxGeometry args={cWall.size} />
      <T.MeshStandardMaterial
        color={mat.color}
        roughness={mat.roughness}
        metalness={mat.metalness}
        side={DoubleSide}
      />
    </T.Mesh>
  {/each}

  <!-- Corridor floor -->
  {@const corridorFloorMat = getFloorMaterial(room.entrance.corridor.floor.materialId)}
  <T.Mesh
    position.x={room.entrance.corridor.floor.position[0] + ox}
    position.y={room.entrance.corridor.floor.position[1] + oy}
    position.z={room.entrance.corridor.floor.position[2] + oz}
  >
    <T.BoxGeometry args={room.entrance.corridor.floor.size} />
    <T.MeshStandardMaterial
      color={corridorFloorMat.color}
      roughness={corridorFloorMat.roughness}
      metalness={corridorFloorMat.metalness}
      side={DoubleSide}
    />
  </T.Mesh>

  <!-- Corridor ceiling -->
  {@const corridorCeilMat = getCeilingMaterial(room.entrance.corridor.ceiling.materialId)}
  <T.Mesh
    position.x={room.entrance.corridor.ceiling.position[0] + ox}
    position.y={room.entrance.corridor.ceiling.position[1] + oy}
    position.z={room.entrance.corridor.ceiling.position[2] + oz}
  >
    <T.BoxGeometry args={room.entrance.corridor.ceiling.size} />
    <T.MeshStandardMaterial
      color={corridorCeilMat.color}
      roughness={corridorCeilMat.roughness}
      metalness={corridorCeilMat.metalness}
      side={DoubleSide}
    />
  </T.Mesh>
{/if}

<!-- Wing-specific content (pedestals, displays, lights, etc.) -->
{@render children()}
