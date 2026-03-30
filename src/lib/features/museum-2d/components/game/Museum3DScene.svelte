<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    MathUtils,
    Vector3,
    Quaternion,
    Euler,
    Object3D,
    BoxGeometry,
    CylinderGeometry,
    SphereGeometry,
    MeshStandardMaterial,
    InstancedMesh,
  } from "three";
  import type { PerspectiveCamera } from "three";
  import type { MuseumGrid, TileType, FloorMaterial } from "../../domain/museum-grid-types";
  import { parseTileKey } from "../../domain/museum-grid-types";
  import type { AvatarState, PhysicsProvider } from "$lib/shared/3d/camera/types";
  import { CameraMode } from "$lib/shared/3d/camera/types";
  import UnifiedCameraController from "$lib/shared/3d/camera/UnifiedCameraController.svelte";
  import { createMuseumPhysicsProvider } from "../../services/implementations/MuseumPhysicsProvider";

  interface Props {
    grid: MuseumGrid;
    flipRequested: number;
  }

  let { grid, flipRequested }: Props = $props();

  // ── Tile scale: each tile = 0.5m in world space ──
  const TILE_SIZE = 0.5;

  // ── Material color map ──
  const FLOOR_COLORS: Record<FloorMaterial, string> = {
    stone: "#2a2520",
    marble: "#2e2b28",
    wood: "#302418",
    dirt: "#28201a",
    sandstone: "#302a1e",
  };

  const TILE_TYPE_COLORS: Partial<Record<TileType, string>> = {
    wall: "#1a1510",
    door: "#3a3020",
    "exhibit-panel": "#12123a",
    "performer-station": "#0e2e0e",
    pedestal: "#3a3028",
    sign: "#1a2030",
  };

  // ── Camera ──
  let camera: PerspectiveCamera | undefined = $state();

  // Center the camera on the grid center
  const gridCenterX = (grid.width * TILE_SIZE) / 2;
  const gridCenterZ = (grid.height * TILE_SIZE) / 2;

  // Top-down camera needs to be high enough to see the whole museum
  const maxExtent = Math.max(grid.width, grid.height) * TILE_SIZE;

  // FOV must be wide enough to see the full museum from this height
  const topDownHeight = maxExtent * 0.8;
  const topDownFov = 2 * Math.atan((maxExtent * 0.6) / topDownHeight) * (180 / Math.PI);

  const TOP_DOWN = {
    position: new Vector3(gridCenterX, topDownHeight, gridCenterZ),
    quaternion: new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0)),
    fov: Math.max(30, Math.min(60, topDownFov)),
  };

  // FPS camera target — updated to match UCC's exact first-frame camera position
  // before each flip so there's zero discontinuity on handoff.
  const spawnWorldX = grid.spawn.x * TILE_SIZE;
  const spawnWorldZ = grid.spawn.y * TILE_SIZE;

  // These must match UCC's SETTINGS.firstPerson exactly
  const UCC_FP_HEIGHT = 0.75;
  const UCC_FP_FORWARD_OFFSET = 0.05;
  const UCC_FPS_FOV = 65;
  const UCC_FAR_PLANE = 10000; // UCC forces this in its game loop

  const FPS = {
    position: new Vector3(spawnWorldX, 0.85 + UCC_FP_HEIGHT, spawnWorldZ + UCC_FP_FORWARD_OFFSET),
    quaternion: new Quaternion(), // computed by syncFpsToPlayer
    fov: UCC_FPS_FOV,
  };

  /**
   * Sync FPS endpoint to match exactly what UCC will compute on its first frame.
   * This eliminates the visual "swap" on handoff.
   */
  function syncFpsToPlayer(): void {
    const pos = physicsProvider.getPlayerPosition();

    // Match UCC first-person: camPos = target + forwardOffset in yaw direction
    const camX = pos.x + Math.sin(playerYaw) * UCC_FP_FORWARD_OFFSET;
    const camY = pos.y + UCC_FP_HEIGHT;
    const camZ = pos.z + Math.cos(playerYaw) * UCC_FP_FORWARD_OFFSET;
    FPS.position.set(camX, camY, camZ);

    // Match UCC's lookAt orientation: look 100 units ahead at same height
    const lookX = camX + Math.sin(playerYaw) * 100;
    const lookZ = camZ + Math.cos(playerYaw) * 100;

    // Build a lookAt matrix to get the exact quaternion UCC would produce
    const tempCam = new Object3D();
    tempCam.position.set(camX, camY, camZ);
    tempCam.lookAt(lookX, camY, lookZ);
    FPS.quaternion.copy(tempCam.quaternion);
  }

  // ── Flip animation state ──
  const DURATION = 1.5;
  let progress = 0;
  let animating = false;
  let goingDown = true;
  let lastFlipCount = 0;
  let initialized = false;

  const tempPos = new Vector3();
  const tempQuat = new Quaternion();

  function easeInOutCubic(x: number): number {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  // ── FPS mode: active when flip animation has completed (progress=1) ──
  // UnifiedCameraController takes over camera when this is true.
  let fpsActive = $state(false);

  // Avatar state for UnifiedCameraController (follows the established pattern)
  // Yaw and pitch persist across flip cycles so the player's view direction is restored.
  let playerYaw = $state(0);
  let playerPitch = $state(0);
  let isMoving = $state(false);
  let playerPosition = $state({ x: spawnWorldX, y: 0, z: spawnWorldZ });

  const avatarState: AvatarState = {
    get position() { return playerPosition; },
    get facingAngle() { return playerYaw; },
    get isMoving() { return isMoving; },
    setMoveInput(input: { x: number; z: number }) {
      isMoving = input.x !== 0 || input.z !== 0;
    },
    updateMovement(_delta: number, _cameraAngle: number) {
      // Handled by physics provider
    },
    setFacingAngle(angle: number) { playerYaw = angle; },
  };

  // Physics provider for grid-based wall collision
  const physicsProvider: PhysicsProvider = createMuseumPhysicsProvider(
    grid,
    TILE_SIZE,
    { x: spawnWorldX, y: 0, z: spawnWorldZ }
  );

  // Initialize FPS target at spawn (must be after physicsProvider is created)
  syncFpsToPlayer();

  // ── Flip animation loop ──
  // When fpsActive, UnifiedCameraController owns the camera — we don't touch it.
  useTask((delta) => {
    if (!camera) return;

    // First frame: set camera to top-down
    if (!initialized) {
      initialized = true;
      camera.position.copy(TOP_DOWN.position);
      camera.quaternion.copy(TOP_DOWN.quaternion);
      camera.fov = TOP_DOWN.fov;
      camera.near = 0.1;
      camera.far = maxExtent * 3;
      camera.updateProjectionMatrix();
      return;
    }

    // If FPS mode is active, UCC owns the camera — skip flip animation
    if (fpsActive) return;

    // Detect new flip request
    if (flipRequested !== lastFlipCount) {
      lastFlipCount = flipRequested;
      if (!animating) {
        // Sync FPS target to player's current position so the flip-down
        // animation lands where the player actually is, not at spawn
        syncFpsToPlayer();
        animating = true;
        goingDown = progress < 0.5;
      }
    }

    if (!animating) return;

    const step = delta / DURATION;
    if (goingDown) {
      progress = Math.min(progress + step, 1);
      if (progress >= 1) {
        animating = false;
        // Flip completed → hand off to UnifiedCameraController
        fpsActive = true;
      }
    } else {
      progress = Math.max(progress - step, 0);
      if (progress <= 0) animating = false;
    }

    const t = easeInOutCubic(progress);

    tempPos.lerpVectors(TOP_DOWN.position, FPS.position, t);
    camera.position.copy(tempPos);

    tempQuat.slerpQuaternions(TOP_DOWN.quaternion, FPS.quaternion, t);
    camera.quaternion.copy(tempQuat);

    camera.fov = MathUtils.lerp(TOP_DOWN.fov, FPS.fov, t);
    camera.near = MathUtils.lerp(0.1, 0.1, t);
    camera.far = MathUtils.lerp(maxExtent * 3, UCC_FAR_PLANE, t);
    camera.updateProjectionMatrix();
  });

  // When Q is pressed again while in FPS mode, exit back to top-down
  $effect(() => {
    if (fpsActive && flipRequested !== lastFlipCount) {
      lastFlipCount = flipRequested;
      syncFpsToPlayer(); // So the flip-back animation starts from where the player is
      fpsActive = false;
      animating = true;
      goingDown = false;
    }
  });

  // ── Bucket tiles by render category ──
  interface TileBucket {
    positions: { x: number; z: number }[];
    color: string;
  }

  const floorBuckets = new Map<string, TileBucket>();
  const wallPositions: { x: number; z: number }[] = [];
  const exhibitPositions: { x: number; z: number }[] = [];
  const performerPositions: { x: number; z: number }[] = [];
  const pedestalPositions: { x: number; z: number }[] = [];
  const signPositions: { x: number; z: number }[] = [];
  const torchPositions: { x: number; z: number }[] = [];

  function addToFloorBucket(color: string, x: number, z: number): void {
    let bucket = floorBuckets.get(color);
    if (!bucket) {
      bucket = { positions: [], color };
      floorBuckets.set(color, bucket);
    }
    bucket.positions.push({ x, z });
  }

  // Process all tiles
  for (const [key, tile] of grid.tiles) {
    const { x: tileX, y: tileY } = parseTileKey(key);
    const worldX = tileX * TILE_SIZE;
    const worldZ = tileY * TILE_SIZE;

    switch (tile.type) {
      case "floor":
      case "corridor": {
        const material = tile.material ?? "stone";
        const color = FLOOR_COLORS[material];
        addToFloorBucket(color, worldX, worldZ);
        break;
      }
      case "door": {
        addToFloorBucket(TILE_TYPE_COLORS.door!, worldX, worldZ);
        break;
      }
      case "wall": {
        wallPositions.push({ x: worldX, z: worldZ });
        break;
      }
      case "exhibit-panel": {
        addToFloorBucket(FLOOR_COLORS.stone, worldX, worldZ);
        exhibitPositions.push({ x: worldX, z: worldZ });
        break;
      }
      case "performer-station": {
        addToFloorBucket(FLOOR_COLORS.stone, worldX, worldZ);
        performerPositions.push({ x: worldX, z: worldZ });
        break;
      }
      case "pedestal": {
        addToFloorBucket(FLOOR_COLORS.stone, worldX, worldZ);
        pedestalPositions.push({ x: worldX, z: worldZ });
        break;
      }
      case "sign": {
        addToFloorBucket(FLOOR_COLORS.stone, worldX, worldZ);
        signPositions.push({ x: worldX, z: worldZ });
        break;
      }
      case "torch": {
        addToFloorBucket(FLOOR_COLORS.stone, worldX, worldZ);
        torchPositions.push({ x: worldX, z: worldZ });
        break;
      }
      case "trigger":
        break;
      case "rope":
      case "scaffolding":
        addToFloorBucket(FLOOR_COLORS.stone, worldX, worldZ);
        break;
    }
  }

  // ── Build InstancedMesh data ──
  const dummy = new Object3D();

  const floorGeo = new BoxGeometry(TILE_SIZE - 0.02, 0.05, TILE_SIZE - 0.02);
  const wallGeo = new BoxGeometry(TILE_SIZE, 1.5, TILE_SIZE);
  const exhibitGeo = new BoxGeometry(TILE_SIZE * 0.8, 1.0, 0.08);
  const performerGeo = new CylinderGeometry(TILE_SIZE * 0.2, TILE_SIZE * 0.2, 0.5, 8);
  const pedestalGeo = new BoxGeometry(TILE_SIZE * 0.7, 0.5, TILE_SIZE * 0.7);
  const signGeo = new BoxGeometry(TILE_SIZE * 0.6, 0.4, 0.06);
  const torchSphereGeo = new SphereGeometry(0.06, 6, 6);

  interface InstancedMeshData {
    mesh: InstancedMesh;
  }

  const floorMeshes: InstancedMeshData[] = [];

  for (const [, bucket] of floorBuckets) {
    const material = new MeshStandardMaterial({ color: bucket.color });
    const mesh = new InstancedMesh(floorGeo, material, bucket.positions.length);

    for (let i = 0; i < bucket.positions.length; i++) {
      dummy.position.set(bucket.positions[i]!.x, 0, bucket.positions[i]!.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    floorMeshes.push({ mesh });
  }

  let wallMesh: InstancedMesh | null = null;
  if (wallPositions.length > 0) {
    const wallMat = new MeshStandardMaterial({ color: TILE_TYPE_COLORS.wall! });
    wallMesh = new InstancedMesh(wallGeo, wallMat, wallPositions.length);
    for (let i = 0; i < wallPositions.length; i++) {
      dummy.position.set(wallPositions[i]!.x, 0.75, wallPositions[i]!.z);
      dummy.updateMatrix();
      wallMesh.setMatrixAt(i, dummy.matrix);
    }
    wallMesh.instanceMatrix.needsUpdate = true;
  }

  let exhibitMesh: InstancedMesh | null = null;
  if (exhibitPositions.length > 0) {
    const exhibitMat = new MeshStandardMaterial({ color: TILE_TYPE_COLORS["exhibit-panel"]! });
    exhibitMesh = new InstancedMesh(exhibitGeo, exhibitMat, exhibitPositions.length);
    for (let i = 0; i < exhibitPositions.length; i++) {
      dummy.position.set(exhibitPositions[i]!.x, 0.5, exhibitPositions[i]!.z);
      dummy.updateMatrix();
      exhibitMesh.setMatrixAt(i, dummy.matrix);
    }
    exhibitMesh.instanceMatrix.needsUpdate = true;
  }

  let performerMesh: InstancedMesh | null = null;
  if (performerPositions.length > 0) {
    const performerMat = new MeshStandardMaterial({ color: TILE_TYPE_COLORS["performer-station"]! });
    performerMesh = new InstancedMesh(performerGeo, performerMat, performerPositions.length);
    for (let i = 0; i < performerPositions.length; i++) {
      dummy.position.set(performerPositions[i]!.x, 0.25, performerPositions[i]!.z);
      dummy.updateMatrix();
      performerMesh.setMatrixAt(i, dummy.matrix);
    }
    performerMesh.instanceMatrix.needsUpdate = true;
  }

  let pedestalMesh: InstancedMesh | null = null;
  if (pedestalPositions.length > 0) {
    const pedestalMat = new MeshStandardMaterial({ color: TILE_TYPE_COLORS.pedestal! });
    pedestalMesh = new InstancedMesh(pedestalGeo, pedestalMat, pedestalPositions.length);
    for (let i = 0; i < pedestalPositions.length; i++) {
      dummy.position.set(pedestalPositions[i]!.x, 0.25, pedestalPositions[i]!.z);
      dummy.updateMatrix();
      pedestalMesh.setMatrixAt(i, dummy.matrix);
    }
    pedestalMesh.instanceMatrix.needsUpdate = true;
  }

  let signMesh: InstancedMesh | null = null;
  if (signPositions.length > 0) {
    const signMat = new MeshStandardMaterial({ color: TILE_TYPE_COLORS.sign! });
    signMesh = new InstancedMesh(signGeo, signMat, signPositions.length);
    for (let i = 0; i < signPositions.length; i++) {
      dummy.position.set(signPositions[i]!.x, 0.5, signPositions[i]!.z);
      dummy.updateMatrix();
      signMesh.setMatrixAt(i, dummy.matrix);
    }
    signMesh.instanceMatrix.needsUpdate = true;
  }

  let torchSphereMesh: InstancedMesh | null = null;
  if (torchPositions.length > 0) {
    const torchMat = new MeshStandardMaterial({
      color: "#ff9020",
      emissive: "#ff9020",
      emissiveIntensity: 2.0,
    });
    torchSphereMesh = new InstancedMesh(torchSphereGeo, torchMat, torchPositions.length);
    for (let i = 0; i < torchPositions.length; i++) {
      dummy.position.set(torchPositions[i]!.x, 1.25, torchPositions[i]!.z);
      dummy.updateMatrix();
      torchSphereMesh.setMatrixAt(i, dummy.matrix);
    }
    torchSphereMesh.instanceMatrix.needsUpdate = true;
  }

  const MAX_POINT_LIGHTS = 32;
  let torchLightPositions: { x: number; z: number }[];
  if (torchPositions.length <= MAX_POINT_LIGHTS) {
    torchLightPositions = torchPositions;
  } else {
    torchLightPositions = [];
    const step = torchPositions.length / MAX_POINT_LIGHTS;
    for (let i = 0; i < MAX_POINT_LIGHTS; i++) {
      torchLightPositions.push(torchPositions[Math.floor(i * step)]!);
    }
  }
</script>

<!-- Camera (owned by flip animation when not in FPS, by UCC when in FPS) -->
<T.PerspectiveCamera
  makeDefault
  bind:ref={camera}
  fov={TOP_DOWN.fov}
  near={0.1}
  far={maxExtent * 3}
/>

<!-- UnifiedCameraController: only active when FPS mode is engaged -->
{#if fpsActive}
  <UnifiedCameraController
    destinationId="museum"
    {avatarState}
    {physicsProvider}
    enabled={true}
    moveSpeed={3}
    initialYaw={playerYaw}
    initialPitch={playerPitch}
    onModeChange={(mode) => {
      // ESC in UCC returns to orbit mode — in the museum, that means flip back to top-down
      if (mode === CameraMode.ORBIT) {
        syncFpsToPlayer();
        fpsActive = false;
        animating = true;
        goingDown = false;
      }
    }}
    onRotationChange={(newYaw, newPitch) => {
      playerYaw = newYaw;
      playerPitch = newPitch;
    }}
  />
{/if}

<!-- Lighting -->
<T.AmbientLight intensity={0.3} color="#c8b890" />
<T.DirectionalLight
  intensity={0.6}
  position={[gridCenterX, maxExtent * 0.5, gridCenterZ]}
  color="#fff0d0"
/>

<!-- Floor instanced meshes (one per color bucket) -->
{#each floorMeshes as { mesh }}
  <T is={mesh} />
{/each}

<!-- Wall instanced mesh -->
{#if wallMesh}
  <T is={wallMesh} />
{/if}

<!-- Exhibit panel instanced mesh -->
{#if exhibitMesh}
  <T is={exhibitMesh} />
{/if}

<!-- Performer station instanced mesh -->
{#if performerMesh}
  <T is={performerMesh} />
{/if}

<!-- Pedestal instanced mesh -->
{#if pedestalMesh}
  <T is={pedestalMesh} />
{/if}

<!-- Sign instanced mesh -->
{#if signMesh}
  <T is={signMesh} />
{/if}

<!-- Torch emissive spheres -->
{#if torchSphereMesh}
  <T is={torchSphereMesh} />
{/if}

<!-- Torch point lights (capped to avoid GPU overload) -->
{#each torchLightPositions as torch}
  <T.PointLight
    position={[torch.x, 1.25, torch.z]}
    intensity={4}
    color="#ff9020"
    distance={8}
  />
{/each}
