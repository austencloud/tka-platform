<script lang="ts">
  /**
   * MuseumNavigatorModule
   *
   * Main entry point for the walkable museum experience.
   * Displays user's TKA sequences as exhibits in a procedural gallery.
   *
   * Phase 2: Exhibits - pictographs on walls and pedestals for 3D animations
   */

  import { onMount, onDestroy } from "svelte";
  import {
    createRenderer,
    createCamera,
    resizeRenderer,
    render as renderScene,
    disposeRenderer,
    type RendererState,
  } from "../../infinite-worlds/rendering/webgpu-renderer";
  import {
    createPhysicsWorldState,
    initPhysicsWorld,
    disposePhysicsWorld,
    type PhysicsWorldState,
  } from "../../infinite-worlds/physics/rapier-world";
  import {
    createPlayerController,
    disposePlayerController,
    type PlayerControllerState,
  } from "../../infinite-worlds/physics/player-controller";
  import {
    world,
    createPlayerEntity,
    clearWorld,
  } from "../../infinite-worlds/core/ecs-world";
  import {
    initInputSystem,
    runSystems,
    getPointerLocked,
    type SystemContext,
  } from "../../infinite-worlds/core/systems";
  import { createRoom, type RoomMesh } from "../rendering/room-renderer";
  import { RoomColliderManager } from "../physics/room-collider";
  import { ExhibitManager } from "../exhibits/exhibit-manager";
  import { tryResolve } from "$lib/shared/inversify/di";
  import { MUSEUM_TYPES } from "$lib/shared/inversify/types/museum.types";
  import { TYPES } from "$lib/shared/inversify/types";
  import type { ISequenceCurator } from "../services/contracts/ISequenceCurator";
  import type { IImageComposer } from "$lib/shared/render/services/contracts/IImageComposer";
  import {
    DirectionalLight,
    AmbientLight,
    HemisphereLight,
    type PerspectiveCamera,
  } from "three";

  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    /** Show debug info overlay */
    showDebug?: boolean;
  }

  let { showDebug = false }: Props = $props();

  // ============================================================================
  // STATE
  // ============================================================================

  let canvas: HTMLCanvasElement;
  let container: HTMLDivElement;
  let rendererState: RendererState | null = $state(null);
  let camera: PerspectiveCamera | null = $state(null);
  let physicsState: PhysicsWorldState | null = $state(null);
  let roomColliders: RoomColliderManager | null = $state(null);
  let playerController: PlayerControllerState | null = $state(null);
  let currentRoom: RoomMesh | null = $state(null);
  let cleanupInput: (() => void) | null = null;
  let exhibitManager: ExhibitManager | null = $state(null);

  // Animation
  let animationId: number | null = null;
  let lastTime = 0;

  // Debug stats
  let fps = $state(0);
  let frameCount = 0;
  let fpsTime = 0;
  let playerPos = $state({ x: 0, y: 0, z: 0 });
  let rendererType = $state("Unknown");
  let isLocked = $state(false);
  let exhibitCount = $state(0);

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

    // Create camera (start in center of room, eye height)
    camera = createCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.7, 0); // Eye height

    // Add lighting
    setupLighting();

    // Initialize physics (lower gravity for indoor feel)
    physicsState = createPhysicsWorldState();
    await initPhysicsWorld(physicsState, { x: 0, y: -15, z: 0 });

    // Create room collider manager
    roomColliders = new RoomColliderManager(physicsState);

    // Create player controller (start at center of room)
    playerController = createPlayerController(physicsState, {
      position: { x: 0, y: 2, z: 0 },
    });

    // Create local player entity
    createPlayerEntity("local-player", true, 0, 2, 0);

    // Create the initial room (hub)
    currentRoom = createRoom(rendererState.scene, {
      type: "hub",
      width: 12,
      depth: 12,
      height: 4,
    });

    // Add room colliders
    roomColliders.addRoomCollider("hub", currentRoom);

    // Create exhibit manager
    const imageComposer = tryResolve<IImageComposer>(TYPES.IImageComposer);
    exhibitManager = new ExhibitManager(rendererState.scene, imageComposer);

    // Load exhibits
    await loadExhibits();

    // Initialize input
    cleanupInput = initInputSystem(canvas);

    // Handle resize
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Start animation loop
    lastTime = performance.now();
    animate(lastTime);
  });

  /**
   * Load exhibits from user's library
   */
  async function loadExhibits(): Promise<void> {
    if (!exhibitManager) return;

    const curator = tryResolve<ISequenceCurator>(MUSEUM_TYPES.ISequenceCurator);
    if (!curator) {
      console.warn("[MuseumNavigator] Sequence curator not available");
      return;
    }

    await loadExhibitsWithCurator(curator);
  }

  async function loadExhibitsWithCurator(curator: ISequenceCurator): Promise<void> {
    if (!exhibitManager) return;

    try {
      // Load sequences
      await curator.loadSequences();

      // Get exhibits for hub room (max 8)
      const roomExhibits = await curator.getExhibitsForRoom("hub", 8);

      // Create exhibits
      await exhibitManager.createExhibitsForRoom(roomExhibits);

      exhibitCount = exhibitManager.getExhibitCount();
    } catch (error) {
      console.error("[MuseumNavigator] Failed to load exhibits:", error);
    }
  }

  onDestroy(() => {
    // Stop animation
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
    }

    // Cleanup input
    cleanupInput?.();

    // Dispose exhibits
    exhibitManager?.dispose();

    // Dispose room
    currentRoom?.dispose();

    // Dispose room colliders
    roomColliders?.dispose();

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
  // LIGHTING
  // ============================================================================

  function setupLighting(): void {
    if (!rendererState) return;

    // Bright ambient for gallery feel
    const ambient = new AmbientLight(0xffffff, 0.6);
    rendererState.scene.add(ambient);

    // Hemisphere (ceiling white, floor gray)
    const hemisphere = new HemisphereLight(0xffffff, 0x888888, 0.4);
    rendererState.scene.add(hemisphere);

    // Main directional light (simulates ceiling lights)
    const mainLight = new DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(0, 10, 0);
    mainLight.castShadow = true;
    rendererState.scene.add(mainLight);
  }

  // ============================================================================
  // RESIZE
  // ============================================================================

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
  // GAME LOOP
  // ============================================================================

  function animate(time: number): void {
    animationId = requestAnimationFrame(animate);

    const deltaTime = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    // Update FPS counter
    frameCount++;
    fpsTime += deltaTime;
    if (fpsTime >= 1) {
      fps = Math.round(frameCount / fpsTime);
      frameCount = 0;
      fpsTime = 0;

      if (camera) {
        playerPos = {
          x: Math.round(camera.position.x * 10) / 10,
          y: Math.round(camera.position.y * 10) / 10,
          z: Math.round(camera.position.z * 10) / 10,
        };
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

      // Render
      renderScene(rendererState, camera);
    }
  }
</script>

<div class="museum-navigator" bind:this={container}>
  <canvas bind:this={canvas}></canvas>

  {#if !isLocked}
    <div class="controls-overlay">
      <h2>Museum Gallery</h2>
      <p class="subtitle">Explore your sequences in 3D</p>
      <div class="instructions">
        <p><strong>Click</strong> to start exploring</p>
        <p><strong>WASD</strong> to move</p>
        <p><strong>Mouse</strong> to look around</p>
        <p><strong>ESC</strong> to release cursor</p>
      </div>
    </div>
  {/if}

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
        <span class="label">Exhibits:</span>
        <span class="value">{exhibitCount}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .museum-navigator {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #1a1a1a;
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
    background: rgba(0, 0, 0, 0.85);
    padding: 32px 48px;
    border-radius: 16px;
    backdrop-filter: blur(10px);
    pointer-events: none;
  }

  .controls-overlay h2 {
    margin: 0 0 8px 0;
    font-size: 28px;
    font-weight: 600;
    color: #ffffff;
  }

  .controls-overlay .subtitle {
    margin: 0 0 24px 0;
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
  }

  .instructions p {
    margin: 8px 0;
    font-size: 16px;
  }

  .instructions strong {
    color: #60a5fa;
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
