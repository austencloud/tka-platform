<script lang="ts">
  /**
   * WorldSceneContent
   *
   * Inner component that runs inside the Threlte Canvas context.
   * Handles physics initialization, chunk streaming, vegetation, atmosphere,
   * and integrates with UnifiedCameraController for full avatar parity.
   */

  import { onMount, onDestroy } from "svelte";
  import { T, useTask, useThrelte } from "@threlte/core";

  // Physics
  import {
    createPhysicsWorldState,
    initPhysicsWorld,
    disposePhysicsWorld,
  } from "$lib/shared/3d-core/physics/rapier-world";
  import type { PhysicsWorldState, PlayerControllerState } from "$lib/shared/3d-core/physics/types";
  import { TerrainPhysicsManager } from "$lib/shared/3d-core/physics/terrain-collider";
  import {
    createPlayerController,
    disposePlayerController,
    teleportPlayer,
    getPlayerPosition,
    snapToGround,
  } from "$lib/shared/3d-core/physics/player-controller";
  import { createRapierPhysicsProvider, RapierPhysicsProvider } from "$lib/shared/3d-core/physics/RapierPhysicsProvider";
  import type { PhysicsProvider, AvatarState } from "$lib/shared/3d-core/camera/types";

  // Unified camera system
  import UnifiedCameraController from "$lib/shared/3d-core/camera/UnifiedCameraController.svelte";
  import { CameraMode } from "$lib/shared/3d-core/camera/types";
  import { cameraPreferences } from "$lib/shared/3d-core/camera/camera-preferences.svelte";

  // Avatar components
  import Avatar3D from "$lib/shared/3d-animation/components/Avatar3D.svelte";
  import Staff3D from "$lib/shared/3d-animation/components/Staff3D.svelte";
  import Grid3D from "$lib/shared/3d-animation/components/Grid3D.svelte";
  import { Plane } from "$lib/shared/3d-animation/domain/enums/Plane";

  // World systems
  import { ChunkManager, type ChunkState } from "../core/chunk-manager";
  import { SeededNoise, getBiome } from "../generation/seed-generator";
  import { type ImportedTerrainData, isPointInPolygon } from "../generation/real-terrain-zone";
  import { VegetationManager } from "../rendering/instanced-vegetation";
  import { AtmosphereManager } from "../rendering/atmosphere";
  import { WaterManager } from "../rendering/water";
  import type { RealmConfig } from "../core/realm-config";

  import hannonsTerrainData from "../data/hannons-camp-terrain.json";

  import {
    BufferGeometry,
    BufferAttribute,
    Mesh,
    MeshStandardMaterial,
    DirectionalLight,
    AmbientLight,
    HemisphereLight,
    Group,
    Object3D,
    type Scene,
  } from "three";
  import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
  
  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    activeConfig: RealmConfig;
    worldSeed: number;
    worldNoise: SeededNoise;
    autoLoadHannons: boolean;

    /** Enable stage mode - flat performance area with grid planes */
    stageMode?: boolean;

    // Bindable state (passed up to parent)
    physicsState: PhysicsWorldState | null;
    terrainPhysics: TerrainPhysicsManager | null;
    playerController: PlayerControllerState | null;
    physicsProvider: PhysicsProvider | null;
    vegetationManager: VegetationManager | null;
    atmosphereManager: AtmosphereManager | null;
    waterManager: WaterManager | null;
    chunkManager: ChunkManager | null;
    chunkMeshes: Map<string, Mesh>;
    playerPosition: { x: number; y: number; z: number };
    playerYaw: number;
    cameraMode: CameraMode;
    fps: number;
    frameCount: number;
    fpsTime: number;
    chunkStats: { loaded: number; pending: number; loading: number };
    colliderCount: number;
    vegetationCount: { trees: number; rocks: number; bushes: number; grass: number };
    currentBiome: string;
    hannonsLoaded: boolean;
    zoneBounds: { minX: number; maxX: number; minZ: number; maxZ: number } | null;
    zoneBoundary: Array<{ x: number; z: number }>;
    isInsideZone: boolean;
    showTouchUI: boolean;
    joystickInput: { x: number; z: number };

    avatarState: AvatarState;
    showAvatar: boolean;
    showGridPlanes: boolean;
    inputCapabilities: ReturnType<typeof import("$lib/shared/input/InputCapabilities.svelte").getInputCapabilities>;
    onModeChange: (mode: CameraMode) => void;
  }

  let {
    activeConfig,
    worldSeed,
    worldNoise,
    autoLoadHannons,
    stageMode = false,

    physicsState = $bindable(),
    terrainPhysics = $bindable(),
    playerController = $bindable(),
    physicsProvider = $bindable(),
    vegetationManager = $bindable(),
    atmosphereManager = $bindable(),
    waterManager = $bindable(),
    chunkManager = $bindable(),
    chunkMeshes = $bindable(),
    playerPosition = $bindable(),
    playerYaw = $bindable(),
    cameraMode = $bindable(),
    fps = $bindable(),
    frameCount = $bindable(),
    fpsTime = $bindable(),
    chunkStats = $bindable(),
    colliderCount = $bindable(),
    vegetationCount = $bindable(),
    currentBiome = $bindable(),
    hannonsLoaded = $bindable(),
    zoneBounds = $bindable(),
    zoneBoundary = $bindable(),
    isInsideZone = $bindable(),
    showTouchUI = $bindable(),
    joystickInput = $bindable(),

    avatarState,
    showAvatar,
    showGridPlanes,
    inputCapabilities,
    onModeChange,
  }: Props = $props();

  // Get Threlte context
  const { scene, camera, renderer } = useThrelte();

  // Grid plane sets
  // Stage mode: all three planes (wall, wheel, floor)
  // Open world: just floor plane
  const stagePlaneSet = new Set([Plane.WALL, Plane.WHEEL, Plane.FLOOR]);
  const floorPlaneSet = new Set([Plane.FLOOR]);
  const activePlaneSet = $derived(stageMode ? stagePlaneSet : floorPlaneSet);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  let isInitialized = $state(false);
  let isReadyToRender = $state(false); // True after ground snap - prevents showing underground
  let needsGroundSnap = true; // Snap to ground once terrain loads
  let groundSnapAttempts = 0; // Track attempts to avoid infinite loops
  const MAX_GROUND_SNAP_ATTEMPTS = 300; // ~5 seconds at 60fps

  // Campground objects placed in spawn clearing
  let campgroundObjects: Object3D[] = [];
  const gltfLoader = new GLTFLoader();

  onMount(async () => {
    inputCapabilities.init();

    // Initialize physics
    physicsState = createPhysicsWorldState();
    await initPhysicsWorld(physicsState, { x: 0, y: -activeConfig.physics.gravity, z: 0 });

    // Create terrain physics manager
    terrainPhysics = new TerrainPhysicsManager(physicsState);

    // Add immediate ground collider for spawn clearing or stage zone
    // This prevents falling through before terrain chunks load
    const waterLevel = activeConfig.terrain.waterLevel ?? 5;
    if (activeConfig.spawnClearing?.enabled) {
      // Spawn clearing: ground is above water level
      const clearingHeight = waterLevel + 3;
      terrainPhysics.addStageGroundCollider(
        activeConfig.spawnClearing.center.x,
        activeConfig.spawnClearing.center.z,
        activeConfig.spawnClearing.radius + activeConfig.spawnClearing.blendWidth,
        clearingHeight
      );
    } else if (stageMode && activeConfig.stageZone?.enabled) {
      // Legacy stage zone: ground at Y=0
      terrainPhysics.addStageGroundCollider(
        0, 0,  // Center at origin
        activeConfig.stageZone.radius + activeConfig.stageZone.blendWidth
      );
    }

    // Create player controller - start high, ground snap happens in game loop once terrain loads
    const spawnPos = activeConfig.spawn.position;
    playerController = createPlayerController(physicsState, {
      position: { x: spawnPos[0], y: 500, z: spawnPos[2] }, // Start very high
    });

    // Create physics provider for UnifiedCameraController
    physicsProvider = createRapierPhysicsProvider(physicsState, playerController);

    // Initialize position (will be updated when ground snap happens)
    playerPosition = { x: spawnPos[0], y: 500, z: spawnPos[2] };

    // Setup lighting
    setupLighting();

    // Initialize vegetation manager with GLTF models
    vegetationManager = new VegetationManager(scene, { useGLTFModels: true });
    await vegetationManager.initWithModels();

    // Initialize atmosphere
    atmosphereManager = new AtmosphereManager(scene);
    atmosphereManager.createSky();
    // Use forest fog for stage mode, otherwise use plains
    atmosphereManager.setFog(stageMode ? "forest" : "plains");

    // Initialize water
    waterManager = new WaterManager(scene, {
      waterLevel: 5,
      color: "#2a8faa",
      opacity: 0.75,
    });
    waterManager.create();

    // Initialize chunk manager
    chunkManager = new ChunkManager(worldSeed, {
      chunkSize: activeConfig.chunks.size,
      viewDistance: activeConfig.chunks.viewDistance,
      lodDistances: activeConfig.chunks.lodDistances,
      maxConcurrentLoads: 4,
      resolution: 33,
    });

    // CRITICAL: Set spawn clearing BEFORE any chunks are generated
    // This must happen immediately after chunk manager is created
    if (activeConfig.spawnClearing?.enabled) {
      const clearing = activeConfig.spawnClearing;
      const waterLvl = activeConfig.terrain.waterLevel ?? 5;
      chunkManager.setSpawnClearing(
        clearing.center,
        clearing.radius,
        clearing.blendWidth,
        waterLvl,
        clearing.campground
      );
      console.log(`[WorldSceneContent] Set spawn clearing BEFORE chunk generation: radius=${clearing.radius}m, waterLevel=${waterLvl}`);
    }

    // Handle chunk loaded
    chunkManager.onChunkLoaded = (key, state) => {
      if (state.meshData) {
        createChunkMesh(state, key);

        // Create terrain collider
        const chunk = state.entity.chunk;
        const chunkSize = activeConfig.chunks.size;
        if (chunk && terrainPhysics) {
          terrainPhysics.addChunkCollider(
            chunk.chunkX,
            chunk.chunkZ,
            chunkSize,
            state.meshData
          );
        }

        // Add vegetation
        if (chunk && vegetationManager && state.meshData.vegetation.length > 0) {
          const chunkWorldX = chunk.chunkX * chunkSize;
          const chunkWorldZ = chunk.chunkZ * chunkSize;
          vegetationManager.addChunkVegetation(
            key,
            chunkWorldX,
            chunkWorldZ,
            state.meshData.vegetation
          );
        }
      }
    };

    // Handle chunk unloaded
    chunkManager.onChunkUnloaded = (key) => {
      // Remove mesh from scene
      const mesh = chunkMeshes.get(key);
      if (mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        if (mesh.material instanceof MeshStandardMaterial) {
          mesh.material.dispose();
        }
        chunkMeshes.delete(key);
      }

      // Remove terrain collider
      const parts = key.split(",").map(Number);
      const chunkX = parts[0] ?? 0;
      const chunkZ = parts[2] ?? 0;
      terrainPhysics?.removeChunkCollider(chunkX, chunkZ);

      // Remove vegetation
      vegetationManager?.removeChunkVegetation(key);
    };

    isInitialized = true;

    // Force FIRST_PERSON mode for infinite-worlds (ORBIT mode doesn't work without OrbitControls)
    // This ensures the camera starts correctly regardless of saved preferences
    cameraPreferences.setModeForDestination("infinite-worlds", CameraMode.FIRST_PERSON);

    // Place campground objects (spawn clearing was already set above)
    if (activeConfig.spawnClearing?.enabled && activeConfig.spawnClearing.campground.enabled) {
      const waterLvl = activeConfig.terrain.waterLevel ?? 5;
      await placeCampgroundObjects(activeConfig.spawnClearing, waterLvl);
    }
    // Legacy: Initialize stage zone if configured and no spawn clearing
    else if (stageMode && activeConfig.stageZone?.enabled && chunkManager) {
      chunkManager.setStageZone(
        { x: 0, z: 0 },  // Stage at origin
        activeConfig.stageZone.radius,
        activeConfig.stageZone.blendWidth
      );
      console.log(`[WorldSceneContent] Initialized stage zone: radius=${activeConfig.stageZone.radius}m, blend=${activeConfig.stageZone.blendWidth}m`);
    }

    // Auto-load terrain if configured
    if (activeConfig.terrain.type === "real-terrain" || autoLoadHannons) {
      setTimeout(() => loadHannonsCamp(), 100);
    }
  });

  onDestroy(() => {
    // Dispose chunk meshes
    for (const [key, mesh] of chunkMeshes) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material instanceof MeshStandardMaterial) {
        mesh.material.dispose();
      }
    }
    chunkMeshes.clear();

    // Dispose campground objects
    for (const obj of campgroundObjects) {
      scene.remove(obj);
    }
    campgroundObjects = [];

    // Dispose managers
    chunkManager?.dispose();
    vegetationManager?.dispose();
    atmosphereManager?.dispose();
    waterManager?.dispose();
    terrainPhysics?.dispose();

    // Dispose player controller
    if (physicsState && playerController) {
      disposePlayerController(physicsState, playerController);
    }

    // Dispose physics world
    if (physicsState) {
      disposePhysicsWorld(physicsState);
    }

    inputCapabilities.destroy();
  });

  // ============================================================================
  // LIGHTING
  // ============================================================================

  function setupLighting(): void {
    // Ambient light
    const ambient = new AmbientLight(0x404060, 0.4);
    scene.add(ambient);

    // Hemisphere light (sky + ground)
    const hemisphere = new HemisphereLight(0x87ceeb, 0x3d5c3d, 0.6);
    scene.add(hemisphere);

    // Sun
    const sun = new DirectionalLight(0xffffff, 1.0);
    sun.position.set(50, 100, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 500;
    scene.add(sun);
  }

  // ============================================================================
  // CAMPGROUND OBJECTS
  // ============================================================================

  /**
   * Load a GLTF model and add it to the scene
   */
  async function loadAndPlaceModel(
    path: string,
    x: number,
    y: number,
    z: number,
    rotationY: number = 0,
    scale: number = 1
  ): Promise<Object3D | null> {
    try {
      const gltf = await gltfLoader.loadAsync(path);
      const model = gltf.scene;
      model.position.set(x, y, z);
      model.rotation.y = rotationY;
      model.scale.setScalar(scale);
      model.castShadow = true;
      model.receiveShadow = true;
      // Enable shadows on all children
      model.traverse((child) => {
        if (child instanceof Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      scene.add(model);
      campgroundObjects.push(model);
      return model;
    } catch (error) {
      console.warn(`[WorldSceneContent] Failed to load model ${path}:`, error);
      return null;
    }
  }

  /**
   * Place campground objects in the spawn clearing
   */
  async function placeCampgroundObjects(
    clearing: NonNullable<typeof activeConfig.spawnClearing>,
    waterLevel: number
  ): Promise<void> {
    const { center, campground } = clearing;
    const groundY = waterLevel + 3; // Clearing is 3m above water

    console.log(`[WorldSceneContent] Placing campground objects at Y=${groundY}`);

    // Model paths
    const MODELS = {
      firePit: "/models/camping/campfire-pit.glb",
      tent: "/models/camping/tent-canvas.glb",
      log: "/models/camping/tree-log.glb",
      logSmall: "/models/camping/tree-log-small.glb",
    };

    // Fire pit at center
    if (campground.firePit) {
      await loadAndPlaceModel(
        MODELS.firePit,
        center.x,
        groundY,
        center.z,
        0,
        1.5
      );
      console.log(`[WorldSceneContent] Placed fire pit`);
    }

    // Tent offset from center
    if (campground.tent) {
      await loadAndPlaceModel(
        MODELS.tent,
        center.x - 8,
        groundY,
        center.z - 5,
        Math.PI * 0.25, // Face toward fire
        1.2
      );
      console.log(`[WorldSceneContent] Placed tent`);
    }

    // Log seats around fire
    if (campground.seatingLogs > 0) {
      const logPositions = [
        { x: center.x + 3, z: center.z + 2, rot: -Math.PI * 0.3 },
        { x: center.x - 2, z: center.z + 4, rot: -Math.PI * 0.6 },
        { x: center.x + 1, z: center.z - 3, rot: Math.PI * 0.4 },
        { x: center.x + 4, z: center.z - 1, rot: Math.PI * 0.1 },
      ];

      const logsToPlace = Math.min(campground.seatingLogs, logPositions.length);
      for (let i = 0; i < logsToPlace; i++) {
        const pos = logPositions[i];
        if (pos) {
          await loadAndPlaceModel(
            i % 2 === 0 ? MODELS.log : MODELS.logSmall,
            pos.x,
            groundY,
            pos.z,
            pos.rot,
            0.8
          );
        }
      }
      console.log(`[WorldSceneContent] Placed ${logsToPlace} log seats`);
    }

    // Torches at perimeter (not implemented yet - would need torch model)
    if (campground.torches > 0) {
      // TODO: Add torch models when available
      // For now, torches are placeholders
      console.log(`[WorldSceneContent] Torches configured but no torch model available yet`);
    }

    console.log(`[WorldSceneContent] Campground objects placed`);
  }

  // ============================================================================
  // CHUNK MESH CREATION
  // ============================================================================

  function createChunkMesh(state: ChunkState, key: string): void {
    if (!state.meshData) return;

    const { vertices, normals, colors, indices } = state.meshData;

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(vertices, 3));
    geometry.setAttribute("normal", new BufferAttribute(normals, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.setIndex(new BufferAttribute(indices, 1));

    const material = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.1,
    });

    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    const chunk = state.entity.chunk;
    if (chunk) {
      mesh.position.set(
        chunk.chunkX * activeConfig.chunks.size,
        0,
        chunk.chunkZ * activeConfig.chunks.size
      );
    }

    scene.add(mesh);
    chunkMeshes.set(key, mesh);

    // Store mesh reference in entity
    state.entity.mesh = {
      object3D: mesh,
      visible: true,
      castShadow: true,
      receiveShadow: true,
    };
  }

  // ============================================================================
  // TERRAIN LOADING
  // ============================================================================

  function loadHannonsCamp(): void {
    if (!chunkManager) return;

    const boundary = (hannonsTerrainData as ImportedTerrainData).boundary;
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const p of boundary) {
      minX = Math.min(minX, p.worldX);
      maxX = Math.max(maxX, p.worldX);
      minZ = Math.min(minZ, p.worldZ);
      maxZ = Math.max(maxZ, p.worldZ);
    }

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    zoneBounds = { minX, maxX, minZ, maxZ };
    zoneBoundary = boundary.map(p => ({ x: p.worldX, z: p.worldZ }));

    chunkManager.loadRealTerrainZone(hannonsTerrainData as ImportedTerrainData);
    hannonsLoaded = true;

    // Teleport player to center
    if (playerController) {
      teleportPlayer(playerController, { x: centerX, y: 100, z: centerZ });
      playerPosition = { x: centerX, y: 100, z: centerZ };
    }

    console.log(`[WorldScene] Loaded Hannon's Camp, teleporting to center: (${centerX.toFixed(0)}, ${centerZ.toFixed(0)})`);
  }

  // ============================================================================
  // GAME LOOP (via Threlte useTask)
  // ============================================================================

  useTask((delta) => {
    if (!isInitialized || !physicsState || !playerController) return;

    // Update FPS counter
    frameCount++;
    fpsTime += delta;
    if (fpsTime >= 1) {
      fps = Math.round(frameCount / fpsTime);
      frameCount = 0;
      fpsTime = 0;

      // Update stats
      if (chunkManager) {
        const stats = chunkManager.getStats();
        chunkStats = {
          loaded: stats.loadedChunks,
          pending: stats.pendingChunks,
          loading: stats.loadingChunks,
        };
      }
      if (terrainPhysics) {
        colliderCount = terrainPhysics.getColliderCount();
      }
      if (vegetationManager) {
        vegetationCount = vegetationManager.getStats();
      }
    }

    // Check touch UI
    showTouchUI = inputCapabilities.shouldShowTouchUI();

    // Step physics
    if (physicsState.isInitialized && physicsState.world) {
      physicsState.world.timestep = Math.min(delta, 0.1);
      physicsState.world.step();
    }

    // Deferred ground snap: wait for terrain colliders to exist before snapping
    if (needsGroundSnap && terrainPhysics && groundSnapAttempts < MAX_GROUND_SNAP_ATTEMPTS) {
      groundSnapAttempts++;
      const colliderCount = terrainPhysics.getColliderCount();

      // Only snap once we have terrain colliders (not just the player collider)
      if (colliderCount > 0) {
        const snapped = snapToGround(physicsState, playerController, 1000);
        const pos = getPlayerPosition(playerController);
        console.log(`[WorldScene] Ground snap: snapped=${snapped}, Y=${pos?.y.toFixed(1)}, colliders=${colliderCount}`);

        if (snapped && pos && pos.y < 500) {
          // Successfully snapped to terrain
          needsGroundSnap = false;
          isReadyToRender = true; // Now safe to show camera/avatar
        }
      }
    }

    // Update player position from physics (after camera controller moves player)
    const pos = getPlayerPosition(playerController);
    if (pos) {
      playerPosition = { x: pos.x, y: pos.y, z: pos.z };

      // Update biome based on position
      currentBiome = getBiome(worldNoise, pos.x, pos.z);

      // Check if inside zone
      if (zoneBoundary.length > 0) {
        isInsideZone = isPointInPolygon(pos.x, pos.z, zoneBoundary);
      }
    }

    // Update chunks based on player position
    if (camera.current) {
      chunkManager?.update(
        camera.current.position.x,
        camera.current.position.y,
        camera.current.position.z
      );
    }

    // Rebuild vegetation batches
    vegetationManager?.rebuildDirtyBatches();

    // Update atmosphere
    if (camera.current) {
      atmosphereManager?.update(camera.current);
    }

    // Update water
    const time = performance.now() / 1000;
    if (camera.current) {
      waterManager?.update(time, camera.current.position.x, camera.current.position.z);
    }
  });
</script>

<!-- Default camera during loading (orbit view of campground from above) -->
<!-- Shows nice overhead view while physics/terrain initializes -->
{#if !isReadyToRender}
  <T.PerspectiveCamera
    makeDefault
    position={[0, 25, 30]}
    fov={60}
    near={0.1}
    far={10000}
    on:create={({ ref }) => {
      ref.lookAt(0, 8, 0);
    }}
  />
{/if}

<!-- Unified Camera Controller with physics provider -->
<!-- Takes over once ground snap is complete and player is at correct position -->
{#if isInitialized && isReadyToRender && physicsProvider}
  <UnifiedCameraController
    destinationId="infinite-worlds"
    {avatarState}
    {physicsProvider}
    enabled={true}
    onModeChange={(mode) => {
      cameraMode = mode;
      onModeChange(mode);
    }}
  />
{/if}

<!-- Player Avatar (hidden in first-person mode) -->
<!-- Wait for isReadyToRender to prevent showing avatar at wrong position -->
{#if isInitialized && isReadyToRender && showAvatar}
  <Avatar3D
    id="infinite-worlds-player"
    bluePropState={null}
    redPropState={null}
    visible={true}
    position={playerPosition}
    facingAngle={playerYaw}
    isMoving={avatarState.isMoving}
  />
{/if}

<!-- Grid Planes (optional) -->
{#if isInitialized && isReadyToRender && showAvatar && showGridPlanes}
  <Grid3D
    centerPosition={playerPosition}
    facingAngle={playerYaw}
    visiblePlanes={activePlaneSet}
  />
{/if}
