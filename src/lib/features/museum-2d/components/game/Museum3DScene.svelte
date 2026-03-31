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
    TextureLoader,
    RepeatWrapping,
  } from "three";
  import type { Texture } from "three";
  import type { PerspectiveCamera } from "three";
  import type { MuseumGrid, TileType, FloorMaterial } from "../../domain/museum-grid-types";
  import { parseTileKey } from "../../domain/museum-grid-types";
  import type { AvatarState, PhysicsProvider } from "$lib/shared/3d/camera/types";
  import { CameraMode } from "$lib/shared/3d/camera/types";
  import UnifiedCameraController from "$lib/shared/3d/camera/UnifiedCameraController.svelte";
  import { createMuseumPhysicsProvider } from "../../services/implementations/MuseumPhysicsProvider";
  import { cameraPreferences } from "$lib/shared/3d/camera/camera-preferences.svelte";
  import MuseumFurniture from "./MuseumFurniture.svelte";
  import MuseumPerformerStation3D from "./MuseumPerformerStation3D.svelte";
  import Avatar3D from "$lib/shared/3d/components/Avatar3D.svelte";
  import MuseumMirror from "./MuseumMirror.svelte";

  // Facing direction string → yaw angle for performer stations
  const FACING_TO_YAW: Record<string, number> = {
    north: Math.PI, south: 0, east: Math.PI / 2, west: -Math.PI / 2,
  };

  interface Props {
    grid: MuseumGrid;
    flipRequested: number;
    /** Keys currently held by the player (from parent's keyboard handler) */
    heldKeys?: Set<string>;
    /** Top-down camera height above the player (controlled by parent for zoom) */
    topDownHeight?: number;
    /** Callback: fires every frame with the player's current world position + facing */
    onPlayerUpdate?: (worldX: number, worldZ: number, tileX: number, tileY: number, facing: string, inFPS: boolean, yaw: number) => void;
    /** If true on mount, skip top-down init and go straight to FPS (used for HMR restore) */
    initialFpsActive?: boolean;
    /** Override spawn position (used for HMR restore) */
    initialPlayerPos?: { x: number; z: number };
    /** Override initial yaw (used for HMR restore) */
    initialPlayerYaw?: number;
    /** Increment to teleport player back to spawn */
    resetRequested?: number;
  }

  let {
    grid, flipRequested, heldKeys = new Set(), topDownHeight = 12, onPlayerUpdate,
    initialFpsActive = false, initialPlayerPos, initialPlayerYaw, resetRequested = 0,
  }: Props = $props();

  // ── Tile scale: each tile = 0.5m in world space ──
  const TILE_SIZE = 0.5;

  // ── Material colors — more contrast, brighter floors, distinct materials ──
  const FLOOR_COLORS: Record<FloorMaterial, string> = {
    stone: "#3a3530",    // warm grey stone
    marble: "#484440",   // lighter, reflective feel
    wood: "#4a3820",     // warm brown planks
    dirt: "#352a1e",     // earthy dark
    sandstone: "#4a3e2a", // warm tan
  };

  const TILE_TYPE_COLORS: Partial<Record<TileType, string>> = {
    wall: "#2a2420",      // dark but readable walls
    door: "#4a3e28",      // visible doorways
    "exhibit-panel": "#1a1a18", // warm dark museum plaque
    "performer-station": "#1a3a1a", // green stage
    pedestal: "#4a3e30",  // warm pedestal
    sign: "#2a3040",      // blue-grey sign
  };

  // ── Wing-themed wall tints — each theme gets a distinct wall color ──
  import type { WingTheme } from "../../domain/museum-grid-types";

  const WING_WALL_COLORS: Record<WingTheme, string> = {
    cave: "#2a1e14",         // dark stone, torchlight warmth
    classical: "#3a3020",    // sandstone, oil lamp warmth
    renaissance: "#2e2818",  // dark wood paneling
    industrial: "#282828",   // grey iron/steel
    digital: "#141428",      // dark with blue tinge
    institutional: "#1e1e24", // sterile grey-blue
    gallery: "#201820",      // deep purple-black (dramatic)
    modern: "#1a1a1a",       // pure dark
    futuristic: "#141420",   // dark with slight blue
    outdoor: "#2a3020",      // natural green tinge
    construction: "#2e2a1e", // dusty beige
    retail: "#2a2220",       // warm commercial
  };

  // ── PBR Texture Loading ──
  const textureLoader = new TextureLoader();

  /** Texture pack name -> FloorMaterial / WingTheme mapping */
  const FLOOR_TEXTURE_MAP: Partial<Record<FloorMaterial, string>> = {
    stone: "Rock035",
    marble: "Marble006",
    wood: "WoodFloor007",
    sandstone: "Rock003",
  };

  const WALL_TEXTURE_MAP: Partial<Record<WingTheme, string>> = {
    cave: "Rock035",
    classical: "Rock003",
    renaissance: "Rock003",
    gallery: "Plaster001",
    institutional: "Plaster001",
    modern: "Plaster001",
  };

  /** Cache loaded materials so the same texture pack isn't loaded twice */
  const pbrMaterialCache = new Map<string, MeshStandardMaterial>();

  function loadPBR(packName: string, tileRepeat: number = 8, tintColor?: string): MeshStandardMaterial {
    const cacheKey = `${packName}_${tileRepeat}_${tintColor ?? "none"}`;
    const cached = pbrMaterialCache.get(cacheKey);
    if (cached) return cached;

    const basePath = `/assets/museum/textures/${packName.toLowerCase()}`;
    const prefix = `${packName}_1K-JPG`;

    const colorTex = textureLoader.load(`${basePath}/${prefix}_Color.jpg`);
    const normalTex = textureLoader.load(`${basePath}/${prefix}_NormalGL.jpg`);
    const roughnessTex = textureLoader.load(`${basePath}/${prefix}_Roughness.jpg`);

    const textures: Texture[] = [colorTex, normalTex, roughnessTex];
    for (const t of textures) {
      t.wrapS = RepeatWrapping;
      t.wrapT = RepeatWrapping;
      t.repeat.set(tileRepeat, tileRepeat);
    }

    const mat = new MeshStandardMaterial({
      map: colorTex,
      normalMap: normalTex,
      roughnessMap: roughnessTex,
      color: tintColor ?? "#ffffff",
    });

    pbrMaterialCache.set(cacheKey, mat);
    return mat;
  }

  // Wall height — 4.5m mimics a real museum gallery ceiling (typical range 3.6–5m).
  // At eye height ~1.6m the ceiling sits ~2.9m above the player — spacious but not cavernous.
  const WALL_HEIGHT = 4.5;
  const WALL_Y_CENTER = WALL_HEIGHT / 2;

  // ── Helpers ──
  function yawToFacing(yaw: number): string {
    // Normalize to 0..2π then quantize to 8 directions
    const a = ((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const idx = Math.round(a / (Math.PI / 4)) % 8;
    return ["south", "southwest", "west", "northwest", "north", "northeast", "east", "southeast"][idx]!;
  }

  // ── Camera ──
  let camera: PerspectiveCamera | undefined = $state();

  // Grid metrics
  const gridCenterX = (grid.width * TILE_SIZE) / 2;
  const gridCenterZ = (grid.height * TILE_SIZE) / 2;
  const maxExtent = Math.max(grid.width, grid.height) * TILE_SIZE;
  const spawnWorldX = initialPlayerPos?.x ?? grid.spawn.x * TILE_SIZE;
  const spawnWorldZ = initialPlayerPos?.z ?? grid.spawn.y * TILE_SIZE;

  // ── Top-down camera: zoomed-in follow camera above the player ──
  // Height lerps toward the parent-controlled topDownHeight prop for smooth zoom.
  let currentTopDownHeight = topDownHeight;
  const TOP_DOWN_FOV = 50;
  const CAMERA_SMOOTHING = 0.08; // Exponential lerp factor for camera follow
  const ZOOM_SMOOTHING = 0.12; // Lerp factor for zoom height changes
  const TOP_DOWN_MOVE_SPEED = 3; // units/sec — matches FPS
  const TOP_DOWN_SPRINT_MULTIPLIER = 2.5; // Shift key multiplier

  // Mutable — position tracks the player, not the grid center
  const TOP_DOWN = {
    position: new Vector3(spawnWorldX, currentTopDownHeight, spawnWorldZ),
    quaternion: new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0)),
    fov: TOP_DOWN_FOV,
  };

  // These must match UCC's SETTINGS.firstPerson exactly
  const UCC_FP_HEIGHT = 0.75;
  const UCC_FP_FORWARD_OFFSET = 0.05;
  const UCC_FPS_FOV = 65;
  const UCC_FAR_PLANE = 10000; // UCC forces this in its game loop

  const FPS = {
    position: new Vector3(spawnWorldX, 0.85 + UCC_FP_HEIGHT, spawnWorldZ + UCC_FP_FORWARD_OFFSET),
    quaternion: new Quaternion(), // computed by syncFpsFromPlayer/syncFpsFromCamera
    fov: UCC_FPS_FOV,
  };

  /**
   * Compute FPS target from the player's current position + yaw.
   * Used when ENTERING FPS from top-down — the animation needs to land
   * where UCC will place the camera on its first frame.
   */
  function syncFpsFromPlayer(): void {
    const pos = physicsProvider.getPlayerPosition();
    const camX = pos.x + Math.sin(playerYaw) * UCC_FP_FORWARD_OFFSET;
    const camY = pos.y + UCC_FP_HEIGHT;
    const camZ = pos.z + Math.cos(playerYaw) * UCC_FP_FORWARD_OFFSET;
    FPS.position.set(camX, camY, camZ);
    FPS.fov = UCC_FPS_FOV;

    // Match UCC's camera orientation exactly.
    // UCC uses camera.lookAt(target) where target is computed from yaw/pitch.
    // Rather than reverse-engineering that with Object3D.lookAt (which can differ),
    // use a temporary PerspectiveCamera to get the exact same quaternion.
    if (camera) {
      // Temporarily position OUR camera where FPS will be, lookAt the same target UCC would
      const savedPos = camera.position.clone();
      const savedQuat = camera.quaternion.clone();
      const savedFov = camera.fov;

      camera.position.set(camX, camY, camZ);
      camera.up.set(0, 1, 0);
      const lookDist = 100;
      camera.lookAt(
        camX + Math.sin(playerYaw) * lookDist * Math.cos(playerPitch),
        camY - Math.sin(playerPitch) * lookDist,
        camZ + Math.cos(playerYaw) * lookDist * Math.cos(playerPitch)
      );
      FPS.quaternion.copy(camera.quaternion);

      // Restore camera to its previous state (the animation will use FPS as the target)
      camera.position.copy(savedPos);
      camera.quaternion.copy(savedQuat);
      camera.fov = savedFov;
    } else {
      // Fallback: simple forward-facing quaternion
      FPS.quaternion.setFromEuler(new Euler(0, playerYaw, 0));
    }
  }

  /**
   * Capture the camera's ACTUAL state into FPS.
   * Used when EXITING FPS — so the flip-back animation starts from
   * exactly where UCC had the camera. No reverse-engineering needed.
   */
  function syncFpsFromCamera(): void {
    if (camera) {
      FPS.position.copy(camera.position);
      FPS.quaternion.copy(camera.quaternion);
      FPS.fov = camera.fov;
    }
  }

  // ── Flip animation state ──
  const DURATION = 1.5;
  let progress = initialFpsActive ? 1 : 0;
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
  let fpsActive = $state(initialFpsActive);

  // Avatar state for UnifiedCameraController (follows the established pattern)
  // Yaw and pitch persist across flip cycles so the player's view direction is restored.
  let playerYaw = $state(initialPlayerYaw ?? 0);
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
  syncFpsFromPlayer();

  // ── Flip animation loop ──
  // When fpsActive, UnifiedCameraController owns the camera — we don't touch it.
  useTask((delta) => {
    if (!camera) return;

    // First frame: initialize camera
    if (!initialized) {
      initialized = true;
      if (initialFpsActive) {
        // HMR restore: go straight to FPS — skip top-down and flip animation
        cameraPreferences.setModeForDestination("museum", CameraMode.FIRST_PERSON);
        syncFpsFromPlayer();
        camera.position.copy(FPS.position);
        camera.quaternion.copy(FPS.quaternion);
        camera.fov = FPS.fov;
      } else {
        camera.position.copy(TOP_DOWN.position);
        camera.quaternion.copy(TOP_DOWN.quaternion);
        camera.fov = TOP_DOWN.fov;
      }
      camera.near = 0.1;
      camera.far = UCC_FAR_PLANE;
      camera.updateProjectionMatrix();
      return;
    }

    // If FPS mode is active, UCC owns the camera — skip everything
    if (fpsActive) {
      // Still report player position to parent for interaction detection
      const fpsPos = physicsProvider.getPlayerPosition();
      const fpsTileX = Math.round(fpsPos.x / TILE_SIZE);
      const fpsTileZ = Math.round(fpsPos.z / TILE_SIZE);
      onPlayerUpdate?.(fpsPos.x, fpsPos.z, fpsTileX, fpsTileZ, yawToFacing(playerYaw), true, playerYaw);
      return;
    }

    // Detect new flip request (must check before movement/animation branches)
    if (flipRequested !== lastFlipCount) {
      lastFlipCount = flipRequested;
      if (!animating) {
        // Entering FPS: compute target from player position (NOT from top-down camera)
        syncFpsFromPlayer();
        animating = true;
        goingDown = progress < 0.5;
      }
    }

    // ── Top-down WASD movement (when not animating) ──
    if (!animating) {
      const forward = (heldKeys.has("KeyW") || heldKeys.has("ArrowUp") ? 1 : 0) -
                      (heldKeys.has("KeyS") || heldKeys.has("ArrowDown") ? 1 : 0);
      const strafe = (heldKeys.has("KeyD") || heldKeys.has("ArrowRight") ? 1 : 0) -
                     (heldKeys.has("KeyA") || heldKeys.has("ArrowLeft") ? 1 : 0);

      if (forward !== 0 || strafe !== 0) {
        // Sprint when Shift is held
        const isSprinting = heldKeys.has("ShiftLeft") || heldKeys.has("ShiftRight");
        const speed = isSprinting ? TOP_DOWN_MOVE_SPEED * TOP_DOWN_SPRINT_MULTIPLIER : TOP_DOWN_MOVE_SPEED;

        // In top-down, "forward" = -Z (north on screen), "right" = +X (east)
        let moveX = strafe * speed * delta;
        let moveZ = -forward * speed * delta;

        // Normalize diagonal
        const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
        const maxMove = speed * delta;
        if (len > maxMove) {
          moveX *= maxMove / len;
          moveZ *= maxMove / len;
        }

        physicsProvider.movePlayer({ x: moveX, y: 0, z: moveZ }, delta);

        // Update facing direction from movement
        if (Math.abs(moveX) > 0.001 || Math.abs(moveZ) > 0.001) {
          playerYaw = Math.atan2(moveX, moveZ);
        }
      }

      // Read back position from physics provider
      const pos = physicsProvider.getPlayerPosition();
      playerPosition.x = pos.x;
      playerPosition.y = pos.y;
      playerPosition.z = pos.z;

      // Smooth camera follow — lerp TOP_DOWN position toward player
      TOP_DOWN.position.x += (pos.x - TOP_DOWN.position.x) * CAMERA_SMOOTHING;
      TOP_DOWN.position.z += (pos.z - TOP_DOWN.position.z) * CAMERA_SMOOTHING;

      // Smooth zoom — lerp height toward the parent-controlled target
      currentTopDownHeight += (topDownHeight - currentTopDownHeight) * ZOOM_SMOOTHING;
      TOP_DOWN.position.y = currentTopDownHeight;

      // Apply top-down camera position
      camera.position.copy(TOP_DOWN.position);
      camera.quaternion.copy(TOP_DOWN.quaternion);
      camera.fov = TOP_DOWN.fov;
      camera.near = 0.1;
      camera.far = UCC_FAR_PLANE;
      camera.updateProjectionMatrix();

      // Report to parent
      const tileX = Math.round(pos.x / TILE_SIZE);
      const tileZ = Math.round(pos.z / TILE_SIZE);
      onPlayerUpdate?.(pos.x, pos.z, tileX, tileZ, yawToFacing(playerYaw), false, playerYaw);
      return;
    }

    // ── Flip animation ──
    const step = delta / DURATION;
    if (goingDown) {
      progress = Math.min(progress + step, 1);
      if (progress >= 1) {
        animating = false;
        // Force first-person mode before UCC mounts (prevents orbit-loop from stale preference)
        cameraPreferences.setModeForDestination("museum", CameraMode.FIRST_PERSON);
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
    camera.far = MathUtils.lerp(UCC_FAR_PLANE, UCC_FAR_PLANE, t);
    camera.updateProjectionMatrix();
  });

  /** Sync playerPosition and TOP_DOWN camera to where the physics provider says the player is */
  function syncPositionFromPhysics(): void {
    const pos = physicsProvider.getPlayerPosition();
    playerPosition.x = pos.x;
    playerPosition.y = pos.y;
    playerPosition.z = pos.z;
    // Snap top-down camera to player's current position (no lag on re-entry)
    TOP_DOWN.position.x = pos.x;
    TOP_DOWN.position.z = pos.z;
  }

  // When Q is pressed again while in FPS mode, exit back to top-down
  $effect(() => {
    if (fpsActive && flipRequested !== lastFlipCount) {
      lastFlipCount = flipRequested;
      syncFpsFromCamera();
      syncPositionFromPhysics();
      // Clear held keys to prevent stale movement (mutate parent's Set)
      heldKeys.clear();
      fpsActive = false;
      animating = true;
      goingDown = false;
    }
  });

  // Reset to spawn when requested (R key or Home)
  let lastResetCount = 0;
  $effect(() => {
    if (resetRequested !== lastResetCount) {
      lastResetCount = resetRequested;
      const spawnX = grid.spawn.x * TILE_SIZE;
      const spawnZ = grid.spawn.y * TILE_SIZE;
      physicsProvider.teleport!({ x: spawnX, y: 0, z: spawnZ });
      playerYaw = 0;
      syncPositionFromPhysics();
    }
  });

  // ── Bucket tiles by render category ──
  interface TileBucket {
    positions: { x: number; z: number }[];
    color: string;
    /** Floor material type — used to select PBR textures */
    floorMaterial?: FloorMaterial;
    /** Wing theme — used to select wall PBR textures */
    wingTheme?: WingTheme;
  }

  const floorBuckets = new Map<string, TileBucket>();
  const wallBuckets = new Map<string, TileBucket>(); // keyed by wing wall color
  const exhibitPositions: { x: number; z: number }[] = [];
  const performerPositions: { x: number; z: number }[] = [];
  const pedestalPositions: { x: number; z: number }[] = [];
  const signPositions: { x: number; z: number }[] = [];
  const torchPositions: { x: number; z: number }[] = [];

  function getWingThemeAt(tileX: number, tileY: number): WingTheme | null {
    for (const wing of grid.wings) {
      const b = wing.bounds;
      if (tileX >= b.x && tileX < b.x + b.width && tileY >= b.y && tileY < b.y + b.height) {
        return wing.theme;
      }
    }
    return null;
  }

  function addToWallBucket(color: string, x: number, z: number, theme?: WingTheme): void {
    let bucket = wallBuckets.get(color);
    if (!bucket) {
      bucket = { positions: [], color, wingTheme: theme };
      wallBuckets.set(color, bucket);
    }
    bucket.positions.push({ x, z });
  }

  function addToFloorBucket(color: string, x: number, z: number, material?: FloorMaterial): void {
    let bucket = floorBuckets.get(color);
    if (!bucket) {
      bucket = { positions: [], color, floorMaterial: material };
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
        addToFloorBucket(color, worldX, worldZ, material);
        break;
      }
      case "door": {
        addToFloorBucket(TILE_TYPE_COLORS.door!, worldX, worldZ);
        break;
      }
      case "wall": {
        const wingTheme = getWingThemeAt(tileX, tileY);
        const wallColor = wingTheme ? WING_WALL_COLORS[wingTheme] : TILE_TYPE_COLORS.wall!;
        addToWallBucket(wallColor, worldX, worldZ, wingTheme ?? undefined);
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
  const wallGeo = new BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE);
  const exhibitGeo = new BoxGeometry(TILE_SIZE * 0.8, 1.5, 0.08);
  const frameGeo = new BoxGeometry(TILE_SIZE * 0.9, 1.6, 0.04);
  const performerGeo = new CylinderGeometry(TILE_SIZE * 0.2, TILE_SIZE * 0.2, 0.5, 8);
  const pedestalGeo = new BoxGeometry(TILE_SIZE * 0.7, 0.5, TILE_SIZE * 0.7);
  const signGeo = new BoxGeometry(TILE_SIZE * 0.6, 0.4, 0.06);
  const torchSphereGeo = new SphereGeometry(0.06, 6, 6);

  interface InstancedMeshData {
    mesh: InstancedMesh;
  }

  const floorMeshes: InstancedMeshData[] = [];

  for (const [, bucket] of floorBuckets) {
    // Use PBR texture if we have one for this floor material, otherwise fall back to solid color
    const texturePack = bucket.floorMaterial ? FLOOR_TEXTURE_MAP[bucket.floorMaterial] : undefined;
    const material = texturePack
      ? loadPBR(texturePack, 8)
      : new MeshStandardMaterial({ color: bucket.color });
    const mesh = new InstancedMesh(floorGeo, material, bucket.positions.length);

    for (let i = 0; i < bucket.positions.length; i++) {
      dummy.position.set(bucket.positions[i]!.x, 0, bucket.positions[i]!.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    floorMeshes.push({ mesh });
  }

  // Wall meshes — one per wing theme color, with PBR textures where available
  const wallMeshes: InstancedMeshData[] = [];
  for (const [, bucket] of wallBuckets) {
    const texturePack = bucket.wingTheme ? WALL_TEXTURE_MAP[bucket.wingTheme] : undefined;
    // For walls, tint the texture with the wing's wall color so themed wings stay distinct
    const wallMat = texturePack
      ? loadPBR(texturePack, 4, bucket.color)
      : new MeshStandardMaterial({ color: bucket.color });
    const mesh = new InstancedMesh(wallGeo, wallMat, bucket.positions.length);
    for (let i = 0; i < bucket.positions.length; i++) {
      dummy.position.set(bucket.positions[i]!.x, WALL_Y_CENTER, bucket.positions[i]!.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    wallMeshes.push({ mesh });
  }

  // Ceiling mesh — flat plane at wall height, covers all walkable tiles.
  // Visible only in FPS mode so the top-down view isn't obscured.
  const allFloorPositions: { x: number; z: number }[] = [];
  for (const [, bucket] of floorBuckets) {
    for (const pos of bucket.positions) {
      allFloorPositions.push(pos);
    }
  }

  let ceilingMesh: InstancedMesh | null = null;
  if (allFloorPositions.length > 0) {
    const ceilingMat = new MeshStandardMaterial({
      color: "#3a3530",          // lighter than walls so it reads as a ceiling catching ambient light
      emissive: "#0a0a08",       // faint self-illumination prevents pitch-black voids between lights
      emissiveIntensity: 0.3,
      roughness: 0.85,           // slight roughness variation — plaster/stone feel
    });
    ceilingMesh = new InstancedMesh(floorGeo, ceilingMat, allFloorPositions.length);
    for (let i = 0; i < allFloorPositions.length; i++) {
      dummy.position.set(allFloorPositions[i]!.x, WALL_HEIGHT, allFloorPositions[i]!.z);
      dummy.updateMatrix();
      ceilingMesh.setMatrixAt(i, dummy.matrix);
    }
    ceilingMesh.instanceMatrix.needsUpdate = true;
  }

  let exhibitMesh: InstancedMesh | null = null;
  let frameMesh: InstancedMesh | null = null;
  const exhibitLightPositions: { x: number; z: number }[] = [];
  const useSpotLights = exhibitPositions.length > 0 && exhibitPositions.length < 20;

  if (exhibitPositions.length > 0) {
    // Warm dark museum plaque material
    const exhibitMat = new MeshStandardMaterial({
      color: "#1a1a18",
      emissive: "#1a1510",
      emissiveIntensity: 0.3,
      roughness: 0.9,
      metalness: 0.0,
    });
    exhibitMesh = new InstancedMesh(exhibitGeo, exhibitMat, exhibitPositions.length);

    // Aged brass/gold frame behind each plaque
    const frameMat = new MeshStandardMaterial({
      color: "#8a7040",
      metalness: 0.6,
      roughness: 0.4,
    });
    frameMesh = new InstancedMesh(frameGeo, frameMat, exhibitPositions.length);

    for (let i = 0; i < exhibitPositions.length; i++) {
      const ex = exhibitPositions[i]!;

      // Plaque face
      dummy.position.set(ex.x, 1.2, ex.z);
      dummy.updateMatrix();
      exhibitMesh.setMatrixAt(i, dummy.matrix);

      // Frame sits 0.02 behind the plaque (toward wall)
      dummy.position.set(ex.x, 1.2, ex.z - 0.02);
      dummy.updateMatrix();
      frameMesh.setMatrixAt(i, dummy.matrix);

      exhibitLightPositions.push({ x: ex.x, z: ex.z });
    }
    exhibitMesh.instanceMatrix.needsUpdate = true;
    frameMesh.instanceMatrix.needsUpdate = true;
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

<!-- Player representation -->
{#if !fpsActive}
  <!-- Top-down marker -->
  <T.Group position.x={playerPosition.x} position.y={0.15} position.z={playerPosition.z}>
    <T.Mesh rotation.x={-Math.PI / 2}>
      <T.RingGeometry args={[0.18, 0.28, 16]} />
      <T.MeshBasicMaterial color="#c8b890" opacity={0.4} transparent={true} />
    </T.Mesh>
    <T.Mesh rotation.x={-Math.PI / 2}>
      <T.CircleGeometry args={[0.12, 16]} />
      <T.MeshBasicMaterial color="#c8b890" opacity={0.8} transparent={true} />
    </T.Mesh>
    <T.Group rotation.y={playerYaw}>
      <T.Mesh position.z={0.35} rotation.x={Math.PI / 2}>
        <T.ConeGeometry args={[0.06, 0.12, 3]} />
        <T.MeshBasicMaterial color="#c8b890" opacity={0.6} transparent={true} />
      </T.Mesh>
    </T.Group>
    <T.PointLight intensity={2} color="#c8b890" distance={4} position.y={1} />
  </T.Group>
{:else}
  <!-- Player avatar (visible in mirrors, third-person, and when looking down) -->
  <!-- position.y must be non-zero to trigger Avatar3D's terrain mode (y=0 triggers
       stage mode which uses groundY, placing the avatar underground).
       isActive=false keeps the avatar on LAYER_WORLD (layer 0) so the default camera
       can see it — the museum doesn't manage camera layers like the 3D viewer does. -->
  <Avatar3D
    id="museum-player"
    bluePropState={null}
    redPropState={null}
    position={{ x: playerPosition.x, y: 0.001, z: playerPosition.z }}
    facingAngle={playerYaw}
    isActive={false}
    isMoving={isMoving}
  />
{/if}

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
    allowedModes={[CameraMode.FIRST_PERSON, CameraMode.THIRD_PERSON]}
    onModeChange={() => {
      // No action needed — UCC handles mode internally.
      // allowedModes ensures ORBIT is never reached via V-key cycling.
    }}
    onRotationChange={(newYaw, newPitch) => {
      playerYaw = newYaw;
      playerPitch = newPitch;
    }}
  />
{/if}

<!-- Lighting — well-lit museum, warm and inviting -->
<T.AmbientLight intensity={0.5} color="#c8b890" />
<T.DirectionalLight
  intensity={0.8}
  position={[gridCenterX, 30, gridCenterZ]}
  color="#fff0d0"
/>
<!-- Secondary fill light from below to soften shadows -->
<T.HemisphereLight
  intensity={0.3}
  color="#fff8e0"
  groundColor="#1a1510"
/>

<!-- Floor instanced meshes (one per color bucket) -->
{#each floorMeshes as { mesh }}
  <T is={mesh} />
{/each}

<!-- Wall instanced meshes (one per wing theme color) -->
{#each wallMeshes as { mesh }}
  <T is={mesh} />
{/each}

<!-- Ceiling — visible only in FPS so top-down view shows the floor plan -->
{#if fpsActive && ceilingMesh}
  <T is={ceilingMesh} />
{/if}

<!-- Exhibit panel: gold frame behind warm dark plaque, lit from above -->
{#if frameMesh}
  <T is={frameMesh} />
{/if}
{#if exhibitMesh}
  <T is={exhibitMesh} />
{/if}
{#each exhibitLightPositions as pos}
  {#if useSpotLights}
    <T.SpotLight
      position={[pos.x, 2.5, pos.z]}
      target-position={[pos.x, 1.2, pos.z]}
      intensity={3}
      color="#fff8e0"
      distance={4}
      angle={0.4}
      penumbra={0.5}
    />
  {:else}
    <T.PointLight
      position={[pos.x, 2.4, pos.z]}
      intensity={2}
      color="#fff8e0"
      distance={3}
    />
  {/if}
{/each}

<!-- Performer station instanced mesh -->
<!-- Performer stations: 3D mannequins with spinning staves -->
{#each grid.performers as performer (performer.id)}
  <MuseumPerformerStation3D
    stationId={performer.id}
    worldX={performer.tileX * TILE_SIZE}
    worldZ={performer.tileY * TILE_SIZE}
    facingAngle={FACING_TO_YAW[performer.facing] ?? 0}
    sequenceId={performer.sequenceId}
    autoPlay={performer.autoPlay}
  />
{/each}

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

<!-- GLTF furniture models (Kenney CC0 kit) -->
<MuseumFurniture {grid} tileSize={TILE_SIZE} />

<!-- Mirrors — placed in rooms that historically feature them -->
{#each grid.wings as wing}
  {#if wing.theme === "renaissance"}
    <!-- Renaissance wing: ornate gilded mirror on the east wall -->
    <MuseumMirror
      width={1.8}
      height={2.8}
      position={[
        (wing.bounds.x + wing.bounds.width - 1) * TILE_SIZE,
        1.6,
        (wing.bounds.y + wing.bounds.height / 2) * TILE_SIZE,
      ]}
      rotation={[0, -Math.PI / 2, 0]}
      frameColor="#9a8040"
      textureWidth={512}
      textureHeight={768}
    />
  {/if}
  {#if wing.theme === "gallery"}
    <!-- Gallery: dramatic full-height mirror -->
    <MuseumMirror
      width={2.5}
      height={3.5}
      position={[
        (wing.bounds.x + wing.bounds.width - 1) * TILE_SIZE,
        2.0,
        (wing.bounds.y + wing.bounds.height / 2) * TILE_SIZE,
      ]}
      rotation={[0, -Math.PI / 2, 0]}
      frameColor="#6a5a30"
      textureWidth={512}
      textureHeight={768}
    />
  {/if}
{/each}
