<script lang="ts">
  /**
   * InfiniteWorldsModule
   *
   * Main entry point for the infinite procedural worlds system.
   * Integrates WebGPU rendering, ECS, physics, and chunk streaming.
   *
   * Architecture:
   * - WebGPU renderer (WebGL fallback)
   * - Miniplex ECS for entities
   * - Rapier WASM for physics
   * - Worker-based chunk generation
   * - Octree spatial indexing
   */

  import { onMount, onDestroy } from "svelte";
  import {
    createRenderer,
    createCamera,
    resizeRenderer,
    render as renderScene,
    disposeRenderer,
    getRendererInfo,
    type RendererState,
  } from "../rendering/webgpu-renderer";
  import {
    createPhysicsWorldState,
    initPhysicsWorld,
    disposePhysicsWorld,
    type PhysicsWorldState,
  } from "../physics/rapier-world";
  import { TerrainPhysicsManager } from "../physics/terrain-collider";
  import {
    createPlayerController,
    disposePlayerController,
    type PlayerControllerState,
  } from "../physics/player-controller";
  import {
    world,
    createPlayerEntity,
    clearWorld,
    getEntityStats,
  } from "../core/ecs-world";
  import { ChunkManager, type ChunkState } from "../core/chunk-manager";
  import {
    initInputSystem,
    runSystems,
    getPointerLocked,
    type SystemContext,
  } from "../core/systems";
  import { generateWorldSeed, encodeSeed, SeededNoise, getBiome } from "../generation/seed-generator";
  import { VegetationManager } from "../rendering/instanced-vegetation";
  import { AtmosphereManager } from "../rendering/atmosphere";
  import { WaterManager } from "../rendering/water";
  import {
    BufferGeometry,
    BufferAttribute,
    Mesh,
    MeshStandardMaterial,
    DirectionalLight,
    AmbientLight,
    HemisphereLight,
    Vector3,
    type PerspectiveCamera,
  } from "three";
  import { teleportPlayer } from "../physics/player-controller";
  import DebugPanel from "./DebugPanel.svelte";

  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    /** World seed (optional - generates random if not provided) */
    seed?: number;
    /** View distance in world units */
    viewDistance?: number;
    /** Show debug info overlay */
    showDebug?: boolean;
  }

  let {
    seed,
    viewDistance = 256,
    showDebug = false,
  }: Props = $props();

  // ============================================================================
  // STATE
  // ============================================================================

  let canvas: HTMLCanvasElement;
  let container: HTMLDivElement;
  let rendererState: RendererState | null = $state(null);
  let camera: PerspectiveCamera | null = $state(null);
  let physicsState: PhysicsWorldState | null = $state(null);
  let terrainPhysics: TerrainPhysicsManager | null = $state(null);
  let playerController: PlayerControllerState | null = $state(null);
  let vegetationManager: VegetationManager | null = $state(null);
  let atmosphereManager: AtmosphereManager | null = $state(null);
  let waterManager: WaterManager | null = $state(null);
  let chunkManager: ChunkManager | null = $state(null);
  let cleanupInput: (() => void) | null = null;

  // Animation
  let animationId: number | null = null;
  let lastTime = 0;

  // Debug stats
  let fps = $state(0);
  let frameCount = 0;
  let fpsTime = 0;
  let entityCount = $state(0);
  let chunkStats = $state({ loaded: 0, pending: 0, loading: 0 });
  let colliderCount = $state(0);
  let vegetationCount = $state({ trees: 0, rocks: 0, bushes: 0, grass: 0 });
  let playerPos = $state({ x: 0, y: 0, z: 0 });
  let rendererType = $state("Unknown");
  let isLocked = $state(false);
  let currentBiome = $state("forest");

  // World
  const worldSeed = seed ?? generateWorldSeed();
  const worldSeedEncoded = encodeSeed(worldSeed);
  const worldNoise = new SeededNoise(worldSeed);

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  onMount(async () => {
    if (!canvas || !container) return;

    // Initialize renderer
    rendererState = await createRenderer({
      canvas,
      width: container.clientWidth,
      height: container.clientHeight,
      antialias: true,
      powerPreference: "high-performance",
    });

    rendererType = rendererState.isWebGPU ? "WebGPU" : "WebGL";

    // Create camera
    camera = createCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );

    // Add lighting to scene
    setupLighting();

    // Initialize physics
    physicsState = createPhysicsWorldState();
    await initPhysicsWorld(physicsState, { x: 0, y: -20, z: 0 });

    // Create terrain physics manager
    terrainPhysics = new TerrainPhysicsManager(physicsState);

    // Create player controller (starts high, will fall to terrain)
    playerController = createPlayerController(physicsState, {
      position: { x: 0, y: 50, z: 0 },
    });

    // Create local player entity
    createPlayerEntity("local-player", true, 0, 50, 0);

    // Initialize vegetation manager (GPU instanced rendering with GLTF models)
    vegetationManager = new VegetationManager(rendererState.scene, { useGLTFModels: true });
    await vegetationManager.initWithModels();

    // Initialize atmosphere (sky + fog)
    atmosphereManager = new AtmosphereManager(rendererState.scene);
    atmosphereManager.createSky();
    atmosphereManager.setFog("plains"); // Default fog

    // Initialize water (at sea level - visible in low areas and ocean biomes)
    waterManager = new WaterManager(rendererState.scene, {
      waterLevel: 5,
      color: "#2a8faa",
      opacity: 0.75,
    });
    waterManager.create();

    // Initialize chunk manager
    chunkManager = new ChunkManager(worldSeed, {
      chunkSize: 32,
      viewDistance,
      lodDistances: [32, 64, 128, 256],
      maxConcurrentLoads: 4,
      resolution: 33,
    });

    // Handle chunk loaded - create mesh, physics collider, and vegetation
    chunkManager.onChunkLoaded = (key, state) => {
      if (state.meshData && rendererState) {
        createChunkMesh(state);

        // Create terrain collider for physics
        const chunk = state.entity.chunk;
        if (chunk && terrainPhysics) {
          terrainPhysics.addChunkCollider(
            chunk.chunkX,
            chunk.chunkZ,
            32, // chunkSize
            state.meshData
          );
        }

        // Add vegetation (trees, rocks, grass)
        if (chunk && vegetationManager && state.meshData.vegetation.length > 0) {
          const chunkWorldX = chunk.chunkX * 32;
          const chunkWorldZ = chunk.chunkZ * 32;
          vegetationManager.addChunkVegetation(
            key,
            chunkWorldX,
            chunkWorldZ,
            state.meshData.vegetation
          );
        }
      }
    };

    // Handle chunk unloaded - remove mesh, physics collider, and vegetation
    chunkManager.onChunkUnloaded = (key) => {
      // Parse chunk coordinates from key
      const parts = key.split(",").map(Number);
      const chunkX = parts[0] ?? 0;
      const chunkZ = parts[2] ?? 0;

      // Remove terrain collider
      terrainPhysics?.removeChunkCollider(chunkX, chunkZ);

      // Remove vegetation
      vegetationManager?.removeChunkVegetation(key);
    };

    // Initialize input
    cleanupInput = initInputSystem(canvas);

    // Handle resize
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Start animation loop
    lastTime = performance.now();
    animate(lastTime);
  });

  onDestroy(() => {
    // Stop animation
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
    }

    // Cleanup input
    cleanupInput?.();

    // Dispose chunk manager
    chunkManager?.dispose();

    // Dispose vegetation manager
    vegetationManager?.dispose();

    // Dispose atmosphere
    atmosphereManager?.dispose();

    // Dispose water
    waterManager?.dispose();

    // Dispose terrain physics
    terrainPhysics?.dispose();

    // Dispose player controller
    if (physicsState && playerController) {
      disposePlayerController(physicsState, playerController);
    }

    // Dispose physics world
    if (physicsState) {
      disposePhysicsWorld(physicsState);
    }

    // Clear ECS world
    clearWorld();

    // Dispose renderer
    if (rendererState) {
      disposeRenderer(rendererState);
    }
  });

  // ============================================================================
  // RENDERING
  // ============================================================================

  function setupLighting(): void {
    if (!rendererState) return;

    // Ambient light
    const ambient = new AmbientLight(0x404060, 0.4);
    rendererState.scene.add(ambient);

    // Hemisphere light (sky + ground)
    const hemisphere = new HemisphereLight(0x87ceeb, 0x3d5c3d, 0.6);
    rendererState.scene.add(hemisphere);

    // Sun
    const sun = new DirectionalLight(0xffffff, 1.0);
    sun.position.set(50, 100, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 500;
    rendererState.scene.add(sun);
  }

  function createChunkMesh(state: ChunkState): void {
    if (!state.meshData || !rendererState) return;

    const { vertices, normals, colors, indices } = state.meshData;

    // Create geometry
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(vertices, 3));
    geometry.setAttribute("normal", new BufferAttribute(normals, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.setIndex(new BufferAttribute(indices, 1));

    // Create material
    const material = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.1,
    });

    // Create mesh
    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    // Position mesh
    const chunk = state.entity.chunk;
    if (chunk) {
      mesh.position.set(
        chunk.chunkX * 32,
        0,
        chunk.chunkZ * 32
      );
    }

    // Add to scene
    rendererState.scene.add(mesh);

    // Store mesh reference in entity
    state.entity.mesh = {
      object3D: mesh,
      visible: true,
      castShadow: true,
      receiveShadow: true,
    };
  }

  function handleResize(): void {
    if (!container || !rendererState || !camera) return;

    resizeRenderer(
      rendererState,
      camera,
      container.clientWidth,
      container.clientHeight
    );
  }

  // ============================================================================
  // DEBUG PANEL HANDLERS
  // ============================================================================

  function handleTeleport(x: number, y: number, z: number): void {
    if (playerController) {
      teleportPlayer(playerController, { x, y, z });
      // Also update camera position for immediate visual feedback
      if (camera) {
        camera.position.set(x, y + 1.6, z); // Eye height offset
      }
    }
  }

  function handleToggleWater(visible: boolean): void {
    waterManager?.setVisible(visible);
  }

  function handleToggleFog(enabled: boolean): void {
    if (!rendererState) return;

    if (enabled) {
      atmosphereManager?.setFog(currentBiome);
    } else {
      rendererState.scene.fog = null;
    }
  }

  // ============================================================================
  // GAME LOOP
  // ============================================================================

  function animate(time: number): void {
    animationId = requestAnimationFrame(animate);

    const deltaTime = Math.min((time - lastTime) / 1000, 0.1); // Cap at 100ms
    lastTime = time;

    // Update FPS counter
    frameCount++;
    fpsTime += deltaTime;
    if (fpsTime >= 1) {
      fps = Math.round(frameCount / fpsTime);
      frameCount = 0;
      fpsTime = 0;

      // Update stats
      entityCount = getEntityStats().total ?? 0;
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
      if (camera) {
        playerPos = {
          x: Math.round(camera.position.x * 10) / 10,
          y: Math.round(camera.position.y * 10) / 10,
          z: Math.round(camera.position.z * 10) / 10,
        };
        // Update current biome based on player position
        currentBiome = getBiome(worldNoise, camera.position.x, camera.position.z);
      }
    }

    // Check pointer lock
    isLocked = getPointerLocked();

    // Run ECS systems
    if (rendererState && camera && physicsState) {
      const ctx: SystemContext = {
        deltaTime,
        time: time / 1000,
        physics: physicsState,
        camera,
        scene: rendererState.scene,
        playerController,
      };

      runSystems(ctx);

      // Update chunks based on camera position
      chunkManager?.update(
        camera.position.x,
        camera.position.y,
        camera.position.z
      );

      // Rebuild vegetation batches if needed (handles removals)
      vegetationManager?.rebuildDirtyBatches();

      // Update atmosphere (keep sky centered on camera)
      atmosphereManager?.update(camera);

      // Update water animation
      waterManager?.update(time / 1000, camera.position.x, camera.position.z);

      // Render
      renderScene(rendererState, camera);
    }
  }
</script>

<div class="infinite-worlds" bind:this={container}>
  <canvas bind:this={canvas}></canvas>

  {#if !isLocked}
    <div class="controls-overlay">
      <h2>Infinite Worlds</h2>
      <p class="seed">Seed: <code>{worldSeedEncoded}</code></p>
      <div class="instructions">
        <p><strong>Click</strong> to start exploring</p>
        <p><strong>WASD</strong> to move</p>
        <p><strong>Mouse</strong> to look around</p>
        <p><strong>Shift</strong> to sprint</p>
        <p><strong>Space</strong> to jump</p>
        <p><strong>ESC</strong> to release cursor</p>
      </div>
    </div>
  {/if}

  <DebugPanel
    position={playerPos}
    biome={currentBiome}
    onTeleport={handleTeleport}
    onToggleWater={handleToggleWater}
    onToggleFog={handleToggleFog}
  />

  {#if showDebug}
    <div class="debug-overlay">
      <div class="debug-row">
        <span class="label">FPS:</span>
        <span class="value">{fps}</span>
      </div>
      <div class="debug-row">
        <span class="label">Renderer:</span>
        <span class="value">{rendererType}</span>
      </div>
      <div class="debug-row">
        <span class="label">Position:</span>
        <span class="value">({playerPos.x}, {playerPos.y}, {playerPos.z})</span>
      </div>
      <div class="debug-row">
        <span class="label">Entities:</span>
        <span class="value">{entityCount}</span>
      </div>
      <div class="debug-row">
        <span class="label">Chunks:</span>
        <span class="value">
          {chunkStats.loaded} loaded / {chunkStats.loading} loading / {chunkStats.pending} pending
        </span>
      </div>
      <div class="debug-row">
        <span class="label">Colliders:</span>
        <span class="value">{colliderCount}</span>
      </div>
      <div class="debug-row">
        <span class="label">Vegetation:</span>
        <span class="value">
          {vegetationCount.trees} trees / {vegetationCount.rocks} rocks / {vegetationCount.bushes} bushes
        </span>
      </div>
      <div class="debug-row">
        <span class="label">Seed:</span>
        <span class="value">{worldSeedEncoded}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .infinite-worlds {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #0a0a1a;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .controls-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: white;
    background: rgba(0, 0, 0, 0.8);
    padding: 32px 48px;
    border-radius: 16px;
    backdrop-filter: blur(10px);
    pointer-events: none;
  }

  .controls-overlay h2 {
    margin: 0 0 16px 0;
    font-size: 28px;
    font-weight: 600;
    color: #60a5fa;
  }

  .controls-overlay .seed {
    margin: 0 0 24px 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
  }

  .controls-overlay code {
    font-family: monospace;
    background: rgba(255, 255, 255, 0.1);
    padding: 4px 8px;
    border-radius: 4px;
    color: #f59e0b;
  }

  .instructions p {
    margin: 8px 0;
    font-size: 16px;
  }

  .instructions strong {
    color: #f59e0b;
    font-weight: 600;
  }

  .debug-overlay {
    position: absolute;
    top: 16px;
    left: 16px;
    background: rgba(0, 0, 0, 0.8);
    padding: 12px 16px;
    border-radius: 8px;
    font-family: monospace;
    font-size: 12px;
    color: white;
    pointer-events: none;
  }

  .debug-row {
    display: flex;
    gap: 8px;
    margin: 4px 0;
  }

  .debug-row .label {
    color: rgba(255, 255, 255, 0.6);
  }

  .debug-row .value {
    color: #60a5fa;
  }
</style>
