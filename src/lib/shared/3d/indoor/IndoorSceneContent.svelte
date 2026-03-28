<script lang="ts">
  /**
   * IndoorSceneContent
   *
   * Inner component that runs inside the Threlte Canvas context (via GalleryCanvas).
   * Handles Rapier physics initialization, player controller, camera, input,
   * and renders room geometry (walls, floor, ceiling, entrance, corridor).
   *
   * Must be a child of GalleryCanvas so useThrelte() has access to the scene.
   */

  import { onMount, onDestroy, type Snippet } from "svelte";
  import { T, useTask, useThrelte } from "@threlte/core";
  import { DoubleSide, type PerspectiveCamera } from "three";

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
    teleportPlayer,
  } from "$lib/shared/3d/physics/player-controller";
  import { createRapierPhysicsProvider } from "$lib/shared/3d/physics/RapierPhysicsProvider";

  // Camera
  import { CameraMovementController } from "$lib/shared/3d/camera/services/implementations/CameraMovementController";
  import { CameraMode } from "$lib/shared/3d/camera/types";
  import type { MovementInput, LookInput } from "$lib/shared/3d/camera/services/contracts/ICameraMovementController";

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

  // Get Threlte context (only available inside Canvas)
  const { renderer } = useThrelte();

  // ============================================================================
  // STATE
  // ============================================================================

  let physicsState: PhysicsWorldState | null = null;
  let playerState: PlayerControllerState | null = null;
  let isDisposed = false;
  let isInitialized = $state(false);

  // Camera controller
  const cameraController = new CameraMovementController({
    destinationId: "indoor-scene",
    moveSpeed,
    gravity: Math.abs(gravity),
    firstPersonHeight: eyeHeight,
  });

  // Input state
  let keys = $state<Record<string, boolean>>({});
  let mouseDeltaX = 0;
  let mouseDeltaY = 0;

  // ============================================================================
  // INPUT HANDLING
  // ============================================================================

  function onKeyDown(event: KeyboardEvent) {
    keys[event.code] = true;

    // V to cycle camera mode
    if (event.code === "KeyV") {
      cameraController.cycleMode();
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    keys[event.code] = false;
  }

  function onMouseMove(event: MouseEvent) {
    if (!cameraController.isPointerLocked()) return;
    mouseDeltaX += event.movementX;
    mouseDeltaY += event.movementY;
  }

  function onClick(event: MouseEvent) {
    // Request pointer lock on click
    const canvas = renderer.current?.domElement;
    if (canvas && !cameraController.isPointerLocked()) {
      canvas.requestPointerLock();
    }
  }

  function onPointerLockChange() {
    const canvas = renderer.current?.domElement;
    const locked = document.pointerLockElement === canvas;
    cameraController.setPointerLocked(locked);

    // Return to orbit on ESC (pointer lock release)
    if (!locked) {
      cameraController.returnToOrbit();
    }
  }

  // ============================================================================
  // PHYSICS INITIALIZATION
  // ============================================================================

  onMount(async () => {
    // 1. Initialize physics world
    physicsState = createPhysicsWorldState();
    await initPhysicsWorld(physicsState, { x: 0, y: gravity, z: 0 });

    if (isDisposed) return;

    const offset = room.worldOffset;

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
    const spawnX = room.spawnPoint.x + offset.x;
    const spawnY = room.spawnPoint.y + offset.y;
    const spawnZ = room.spawnPoint.z + offset.z;

    playerState = createPlayerController(physicsState, {
      position: { x: spawnX, y: spawnY, z: spawnZ },
    });

    // 4. Create physics provider and wire to camera controller
    const physicsProvider = createRapierPhysicsProvider(physicsState, playerState);
    cameraController.setPhysicsProvider(physicsProvider);

    // 5. Set initial facing direction and mode
    cameraController.setYaw(room.spawnFacing);
    cameraController.setMode(CameraMode.FIRST_PERSON);
    cameraController.teleport({ x: spawnX, y: spawnY, z: spawnZ });

    // 6. Listen for pointer lock changes
    document.addEventListener("pointerlockchange", onPointerLockChange);

    isInitialized = true;
  });

  // ============================================================================
  // FRAME LOOP
  // ============================================================================

  useTask((delta) => {
    if (!isInitialized || !physicsState?.world || isDisposed) return;

    // Step physics
    stepPhysics(physicsState, Math.min(delta, 1 / 30));

    // Build movement input from keyboard state
    const movementInput: MovementInput = {
      forward: !!keys["KeyW"] || !!keys["ArrowUp"],
      backward: !!keys["KeyS"] || !!keys["ArrowDown"],
      left: !!keys["KeyA"] || !!keys["ArrowLeft"],
      right: !!keys["KeyD"] || !!keys["ArrowRight"],
      sprint: !!keys["ShiftLeft"] || !!keys["ShiftRight"],
      crouch: !!keys["ControlLeft"] || !!keys["ControlRight"],
      jump: !!keys["Space"],
    };

    // Build look input from accumulated mouse deltas
    const lookInput: LookInput = {
      deltaYaw: mouseDeltaX,
      deltaPitch: mouseDeltaY,
    };

    // Reset mouse deltas after consuming
    mouseDeltaX = 0;
    mouseDeltaY = 0;

    // Update camera and movement
    cameraController.update(delta, movementInput, lookInput);

    // Report position to parent
    const pos = cameraController.getPlayerPosition();
    onPositionChange?.(pos);
  });

  // ============================================================================
  // CAMERA INIT CALLBACK
  // ============================================================================

  function onCameraCreate(ref: PerspectiveCamera) {
    cameraController.init(ref);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  onDestroy(() => {
    isDisposed = true;

    document.removeEventListener("pointerlockchange", onPointerLockChange);

    cameraController.dispose();

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

<!-- Keyboard and mouse input -->
<svelte:window onkeydown={onKeyDown} onkeyup={onKeyUp} />
<svelte:document onmousemove={onMouseMove} onclick={onClick} />

<!-- Camera -->
<T.PerspectiveCamera
  makeDefault
  fov={70}
  near={0.1}
  far={100}
  oncreate={onCameraCreate}
/>

<!-- Ambient light for base visibility -->
<T.AmbientLight intensity={0.3} color={0xffffff} />
<T.HemisphereLight
  args={[0xb1e1ff, 0x886644, 0.4]}
/>

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
