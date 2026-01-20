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
  } from "$lib/shared/3d-core/physics/player-controller";
  import { createRapierPhysicsProvider, RapierPhysicsProvider } from "$lib/shared/3d-core/physics/RapierPhysicsProvider";
  import type { PhysicsProvider, AvatarState } from "$lib/shared/3d-core/camera/types";

  // Unified camera system
  import UnifiedCameraController from "$lib/shared/3d-core/camera/UnifiedCameraController.svelte";
  import { CameraMode } from "$lib/shared/3d-core/camera/types";

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
    type Scene,
  } from "three";
  
  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    activeConfig: RealmConfig;
    worldSeed: number;
    worldNoise: SeededNoise;
    autoLoadHannons: boolean;

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

  // Grid plane set - just floor plane for open world
  const floorPlaneSet = new Set([Plane.FLOOR]);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  let isInitialized = $state(false);

  onMount(async () => {
    inputCapabilities.init();

    // Initialize physics
    physicsState = createPhysicsWorldState();
    await initPhysicsWorld(physicsState, { x: 0, y: -activeConfig.physics.gravity, z: 0 });

    // Create terrain physics manager
    terrainPhysics = new TerrainPhysicsManager(physicsState);

    // Create player controller at spawn position
    const spawnPos = activeConfig.spawn.position;
    playerController = createPlayerController(physicsState, {
      position: { x: spawnPos[0], y: spawnPos[1], z: spawnPos[2] },
    });

    // Create physics provider for UnifiedCameraController
    physicsProvider = createRapierPhysicsProvider(physicsState, playerController);

    // Initialize position
    playerPosition = { x: spawnPos[0], y: spawnPos[1], z: spawnPos[2] };

    // Setup lighting
    setupLighting();

    // Initialize vegetation manager with GLTF models
    vegetationManager = new VegetationManager(scene, { useGLTFModels: true });
    await vegetationManager.initWithModels();

    // Initialize atmosphere
    atmosphereManager = new AtmosphereManager(scene);
    atmosphereManager.createSky();
    atmosphereManager.setFog("plains");

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

<!-- Unified Camera Controller with physics provider -->
{#if isInitialized && physicsProvider}
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
{#if isInitialized && showAvatar}
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
{#if isInitialized && showAvatar && showGridPlanes}
  <Grid3D
    centerPosition={playerPosition}
    facingAngle={playerYaw}
    visiblePlanes={floorPlaneSet}
  />
{/if}
