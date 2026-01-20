<script lang="ts">
  /**
   * WorldScene
   *
   * Threlte-based scene for Infinite Worlds that enables full avatar parity
   * with Stage and Gallery. Uses the same GalleryCanvas pattern for WebGPU support.
   *
   * Architecture:
   * - Threlte Canvas with WebGPU (falls back to WebGL)
   * - Existing managers (ChunkManager, VegetationManager, etc.) add meshes via scene reference
   * - Game loop runs via Threlte's useTask() instead of requestAnimationFrame
   * - UnifiedCameraController handles camera/movement with physics
   * - Full Avatar3D, Staff3D, Grid3D support
   */

  import GalleryCanvas from "$lib/features/gallery/components/GalleryCanvas.svelte";
  import WorldSceneContent from "./WorldSceneContent.svelte";
  import DebugPanel from "./DebugPanel.svelte";
  import VirtualJoystick from "$lib/shared/components/touch/VirtualJoystick.svelte";

  import type { PhysicsWorldState, PlayerControllerState } from "$lib/shared/3d-core/physics/types";
  import type { PhysicsProvider } from "$lib/shared/3d-core/camera/types";
  import { TerrainPhysicsManager } from "$lib/shared/3d-core/physics/terrain-collider";
  import { teleportPlayer } from "$lib/shared/3d-core/physics/player-controller";
  import { CameraMode } from "$lib/shared/3d-core/camera/types";

  import { ChunkManager } from "../core/chunk-manager";
  import { generateWorldSeed, encodeSeed, SeededNoise } from "../generation/seed-generator";
  import { VegetationManager } from "../rendering/instanced-vegetation";
  import { AtmosphereManager } from "../rendering/atmosphere";
  import { WaterManager } from "../rendering/water";
  import type { RealmConfig } from "../core/realm-config";
  import { getDefaultRealmConfig } from "../core/realm-definitions";
  import { getInputCapabilities } from "$lib/shared/input/InputCapabilities.svelte";
  import type { Mesh } from "three";

  // ============================================================================
  // PROPS
  // ============================================================================

  interface Props {
    /** Realm configuration (defines terrain, physics, features, spawn) */
    realmConfig?: RealmConfig;
    /** World seed (optional - overrides realmConfig.terrain.seed if provided) */
    seed?: number;
    /** Show debug info overlay */
    showDebug?: boolean;
    /** Auto-load Hannon's Camp terrain on mount (legacy - prefer realmConfig) */
    autoLoadHannons?: boolean;
    /** Enable stage mode - flat performance area with grid planes */
    stageMode?: boolean;
  }

  let {
    realmConfig,
    seed,
    showDebug = false,
    autoLoadHannons = false,
    stageMode = false,
  }: Props = $props();

  // Use provided realm config or default
  const activeConfig = realmConfig ?? getDefaultRealmConfig();

  // ============================================================================
  // STATE (bindable to WorldSceneContent)
  // ============================================================================

  // Physics state
  let physicsState: PhysicsWorldState | null = $state(null);
  let terrainPhysics: TerrainPhysicsManager | null = $state(null);
  let playerController: PlayerControllerState | null = $state(null);
  let physicsProvider: PhysicsProvider | null = $state(null);

  // Managers
  let vegetationManager: VegetationManager | null = $state(null);
  let atmosphereManager: AtmosphereManager | null = $state(null);
  let waterManager: WaterManager | null = $state(null);
  let chunkManager: ChunkManager | null = $state(null);
  let chunkMeshes = $state(new Map<string, Mesh>());

  // World generation
  const worldSeed = seed ?? activeConfig.terrain.seed ?? generateWorldSeed();
  const worldSeedEncoded = encodeSeed(worldSeed);
  const worldNoise = new SeededNoise(worldSeed);

  // Avatar/Camera state
  let cameraMode = $state<CameraMode>(CameraMode.FIRST_PERSON);
  const showAvatar = $derived(cameraMode !== CameraMode.FIRST_PERSON);
  let showGridPlanes = $state(true);

  // Player position (updated from physics)
  let playerPosition = $state({ x: 0, y: 0, z: 0 });
  let playerYaw = $state(0);
  let isMoving = $state(false);

  // Debug stats
  let fps = $state(0);
  let frameCount = $state(0);
  let fpsTime = $state(0);
  let chunkStats = $state({ loaded: 0, pending: 0, loading: 0 });
  let colliderCount = $state(0);
  let vegetationCount = $state({ trees: 0, rocks: 0, bushes: 0, grass: 0 });
  let currentBiome = $state("forest");

  // Terrain zone state
  let hannonsLoaded = $state(false);
  let zoneBounds = $state<{ minX: number; maxX: number; minZ: number; maxZ: number } | null>(null);
  let zoneBoundary = $state<Array<{ x: number; z: number }>>([]);
  let isInsideZone = $state(false);

  // Touch UI
  let showTouchUI = $state(false);
  let joystickInput = $state({ x: 0, z: 0 });
  const inputCapabilities = getInputCapabilities();

  // ============================================================================
  // AVATAR STATE (for UnifiedCameraController)
  // ============================================================================

  const avatarState = {
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
</script>

<div class="infinite-worlds">
  <GalleryCanvas
    renderingBackend="webgpu-auto"
    autoRender={true}
    toneMapping={undefined}
  >
    <WorldSceneContent
      {activeConfig}
      {worldSeed}
      {worldNoise}
      {autoLoadHannons}
      {stageMode}
      bind:physicsState
      bind:terrainPhysics
      bind:playerController
      bind:physicsProvider
      bind:vegetationManager
      bind:atmosphereManager
      bind:waterManager
      bind:chunkManager
      bind:chunkMeshes
      bind:playerPosition
      bind:playerYaw
      bind:cameraMode
      bind:fps
      bind:frameCount
      bind:fpsTime
      bind:chunkStats
      bind:colliderCount
      bind:vegetationCount
      bind:currentBiome
      bind:hannonsLoaded
      bind:zoneBounds
      bind:zoneBoundary
      bind:isInsideZone
      bind:showTouchUI
      bind:joystickInput
      {avatarState}
      {showAvatar}
      {showGridPlanes}
      {inputCapabilities}
      onModeChange={(mode) => (cameraMode = mode)}
    />
  </GalleryCanvas>

  <!-- UI Overlays (outside Threlte Canvas) -->
  {#if showTouchUI}
    <VirtualJoystick
      onInput={(x, y) => joystickInput = { x, z: y }}
      enabled={true}
      left={24}
      bottom={24}
      size={120}
    />
    <div class="touch-look-hint">
      <span>Drag to look around</span>
    </div>
  {/if}

  <DebugPanel
    position={playerPosition}
    biome={currentBiome}
    onTeleport={(x, y, z) => {
      if (playerController) {
        teleportPlayer(playerController, { x, y, z });
      }
    }}
    onToggleWater={(visible) => waterManager?.setVisible(visible)}
    onToggleFog={(enabled) => {
      if (atmosphereManager) {
        if (enabled) {
          atmosphereManager.setFog(currentBiome);
        }
      }
    }}
  />

  {#if hannonsLoaded && zoneBounds}
    <div class="zone-overlay">
      <div class="zone-header">
        <i class="fas fa-campground" aria-hidden="true"></i>
        <span>Hannon's Camp</span>
        <span class="zone-status" class:inside={isInsideZone}>
          {isInsideZone ? "INSIDE ZONE" : "OUTSIDE ZONE"}
        </span>
      </div>
      <div class="zone-info">
        <div class="info-row">
          <span class="label">Position:</span>
          <span class="value">X: {playerPosition.x.toFixed(0)}, Z: {playerPosition.z.toFixed(0)}</span>
        </div>
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
        <span class="label">Position:</span>
        <span class="value">({playerPosition.x.toFixed(1)}, {playerPosition.y.toFixed(1)}, {playerPosition.z.toFixed(1)})</span>
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
          {vegetationCount.trees} trees / {vegetationCount.rocks} rocks
        </span>
      </div>
      <div class="debug-row">
        <span class="label">Seed:</span>
        <span class="value">{worldSeedEncoded}</span>
      </div>
    </div>
  {/if}

  <!-- Controls overlay when in orbit mode (not exploring) -->
  {#if cameraMode === CameraMode.ORBIT}
    <div class="controls-overlay">
      <h2>{activeConfig.name}</h2>
      {#if activeConfig.description}
        <p class="description">{activeConfig.description}</p>
      {/if}
      <p class="seed">Seed: <code>{worldSeedEncoded}</code></p>
      <div class="instructions">
        <p><strong>Click</strong> to start exploring</p>
        <p><strong>WASD</strong> to move</p>
        <p><strong>Mouse</strong> to look around</p>
        <p><strong>Shift</strong> to sprint</p>
        <p><strong>Space</strong> to jump</p>
        <p><strong>V</strong> to change camera mode</p>
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

  .controls-overlay .description {
    margin: 0 0 8px 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    font-style: italic;
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

  .zone-overlay {
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(0, 0, 0, 0.9);
    padding: 16px;
    border-radius: 12px;
    border: 2px solid #f97316;
    color: white;
    font-family: system-ui, sans-serif;
    min-width: 220px;
  }

  .zone-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }

  .zone-header i {
    color: #f97316;
    font-size: 18px;
  }

  .zone-header span:first-of-type {
    font-weight: 600;
    font-size: 16px;
  }

  .zone-status {
    margin-left: auto;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    background: #ef4444;
  }

  .zone-status.inside {
    background: #22c55e;
  }

  .zone-info .info-row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    margin: 4px 0;
  }

  .zone-info .label {
    color: rgba(255, 255, 255, 0.6);
  }

  .zone-info .value {
    color: #60a5fa;
    font-family: monospace;
  }

  .touch-look-hint {
    position: fixed;
    top: 50%;
    right: 20%;
    transform: translateY(-50%);
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    font-weight: 500;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    animation: fadeInOut 4s ease-in-out;
    z-index: 100;
  }

  @keyframes fadeInOut {
    0%, 100% { opacity: 0; }
    15%, 85% { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .touch-look-hint {
      animation: none;
      opacity: 0.6;
    }
  }
</style>
