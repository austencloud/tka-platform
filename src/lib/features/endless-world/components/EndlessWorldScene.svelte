<script lang="ts">
  /**
   * EndlessWorldScene
   *
   * The 3D scene for the endless world / terrain exploration.
   * Renders heightmap-based terrain with dual camera modes:
   * - Orbit mode: Bird's eye view for editing/overview
   * - First-person mode: Ground-level exploration
   *
   * Supports both mouse/keyboard and touch input.
   * Press V to toggle between camera modes.
   */

  import { T, Canvas } from "@threlte/core";
  import { OrbitControls, Sky } from "@threlte/extras";
  import { onMount, onDestroy } from "svelte";
  import { Vector3 } from "three";
  import type { PerspectiveCamera } from "three";
  import HeightmapTerrain from "./HeightmapTerrain.svelte";
  import BoundaryEditor from "./BoundaryEditor.svelte";
  import BoundaryClickPlane from "./BoundaryClickPlane.svelte";
  import { generateCampgroundTerrain } from "../terrain/procedural-heightmap";
  import type { TerrainConfig, HeightmapData } from "../terrain/terrain-types";
  import type { OrbitControls as OrbitControlsType } from "three/examples/jsm/controls/OrbitControls.js";

  // Shared input primitives
  import { getInputCapabilities } from "$lib/shared/input/InputCapabilities.svelte";
  import VirtualJoystick from "$lib/shared/components/touch/VirtualJoystick.svelte";

  const inputCaps = getInputCapabilities();

  interface BoundaryPoint {
    world: { x: number; y: number; z: number };
    uv: { u: number; v: number };
  }

  interface Props {
    /** Optional heightmap data (falls back to procedural) */
    heightmap?: HeightmapData | null;
    /** Terrain size in world units */
    terrainSize?: number;
    /** Vertical exaggeration (1 = realistic) */
    verticalExaggeration?: number;
    /** Show wireframe overlay */
    wireframe?: boolean;
    /** Optional satellite texture for realistic rendering */
    satelliteTexture?: HTMLCanvasElement | null;
    /** Callback when camera azimuth changes (in degrees, 0 = North) */
    onazimuthchange?: (azimuth: number) => void;
    /** Whether boundary editing mode is active */
    boundaryEditMode?: boolean;
    /** Boundary points to render */
    boundaryPoints?: BoundaryPoint[];
    /** Callback when terrain is clicked (for boundary placement) */
    onterrainclick?: (point: { x: number; y: number; z: number }) => void;
  }

  let {
    heightmap = null,
    terrainSize = 800,
    verticalExaggeration = 1,
    wireframe = false,
    satelliteTexture = null,
    onazimuthchange,
    boundaryEditMode = false,
    boundaryPoints = [],
    onterrainclick,
  }: Props = $props();

  // ============================================================================
  // CAMERA MODE STATE
  // ============================================================================

  type CameraMode = "orbit" | "first-person";
  let cameraMode = $state<CameraMode>("orbit");
  let camera: PerspectiveCamera | undefined = $state();

  // Track orbit controls
  let orbitControls: OrbitControlsType | undefined = $state();

  // First-person state
  const PLAYER_HEIGHT = 2;
  const WALK_SPEED = 50;
  const MOUSE_SENSITIVITY = 0.002;
  const TOUCH_SENSITIVITY = 0.004;

  let fpPosition = $state({ x: 0, y: PLAYER_HEIGHT, z: 0 });
  let fpYaw = $state(0);
  let fpPitch = $state(0);

  // Movement state
  let moveForward = false;
  let moveBackward = false;
  let moveLeft = false;
  let moveRight = false;

  // Touch look state
  let touchLookId: number | null = null;
  let touchLook = { active: false, currentX: 0, currentY: 0 };

  // Joystick constants (match VirtualJoystick defaults)
  const JOYSTICK_SIZE = 120;
  const JOYSTICK_MARGIN = 24;

  // ============================================================================
  // DERIVED VALUES
  // ============================================================================

  // Generate procedural terrain if none provided
  const terrainData = $derived.by(() => {
    if (heightmap) return heightmap;
    return generateCampgroundTerrain(256, 256);
  });

  // Terrain configuration
  const terrainConfig: TerrainConfig = $derived({
    width: terrainSize,
    depth: terrainSize,
    maxHeight: 40,
    widthSegments: 511,
    depthSegments: 511,
  });

  // Terrain offset
  const terrainOffset: [number, number, number] = $derived([
    -terrainSize * 0.35,
    0,
    -terrainSize * 0.35,
  ]);

  // Orbit camera position
  const orbitCameraPosition: [number, number, number] = $derived([
    terrainOffset[0],
    terrainSize * 0.2,
    terrainOffset[2] + terrainSize * 0.4,
  ]);
  const orbitCameraTarget: [number, number, number] = $derived([
    terrainOffset[0],
    30,
    terrainOffset[2],
  ]);

  // Helper functions
  function shouldShowTouchUI(): boolean {
    return inputCaps.shouldShowTouchUI();
  }

  function isInJoystickZone(x: number, y: number): boolean {
    const zoneWidth = JOYSTICK_SIZE + JOYSTICK_MARGIN * 2;
    const zoneHeight = JOYSTICK_SIZE + JOYSTICK_MARGIN * 2;
    return x < zoneWidth && y > window.innerHeight - zoneHeight;
  }

  // ============================================================================
  // CAMERA MODE TOGGLE
  // ============================================================================

  function toggleCameraMode() {
    if (cameraMode === "orbit") {
      enterFirstPerson();
    } else {
      enterOrbitMode();
    }
  }

  function enterFirstPerson() {
    if (!camera) return;

    console.log("[EndlessWorld] Entering first-person mode");
    cameraMode = "first-person";

    // Disable orbit controls
    if (orbitControls) {
      orbitControls.enabled = false;
    }

    // Position player at terrain center
    fpPosition = {
      x: terrainOffset[0],
      y: PLAYER_HEIGHT + 20, // Start above terrain
      z: terrainOffset[2],
    };
    fpYaw = 0;
    fpPitch = 0;

    // Request pointer lock for mouse users
    if (inputCaps.canUsePointerLock()) {
      document.body.requestPointerLock?.();
    }
  }

  function enterOrbitMode() {
    console.log("[EndlessWorld] Entering orbit mode");
    cameraMode = "orbit";

    // Re-enable orbit controls
    if (orbitControls) {
      orbitControls.enabled = true;
    }

    // Exit pointer lock
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }

    // Reset movement
    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;
  }

  // ============================================================================
  // INPUT HANDLERS
  // ============================================================================

  function handleKeyDown(e: KeyboardEvent) {
    // V to toggle camera mode
    if (e.code === "KeyV") {
      toggleCameraMode();
      e.preventDefault();
      return;
    }

    // First-person controls
    if (cameraMode !== "first-person") return;

    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        moveForward = true;
        e.preventDefault();
        break;
      case "KeyS":
      case "ArrowDown":
        moveBackward = true;
        e.preventDefault();
        break;
      case "KeyA":
      case "ArrowLeft":
        moveLeft = true;
        e.preventDefault();
        break;
      case "KeyD":
      case "ArrowRight":
        moveRight = true;
        e.preventDefault();
        break;
      case "Escape":
        enterOrbitMode();
        e.preventDefault();
        break;
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (cameraMode !== "first-person") return;

    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        moveForward = false;
        break;
      case "KeyS":
      case "ArrowDown":
        moveBackward = false;
        break;
      case "KeyA":
      case "ArrowLeft":
        moveLeft = false;
        break;
      case "KeyD":
      case "ArrowRight":
        moveRight = false;
        break;
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (cameraMode !== "first-person") return;
    if (!document.pointerLockElement) return;

    fpYaw -= e.movementX * MOUSE_SENSITIVITY;
    fpPitch -= e.movementY * MOUSE_SENSITIVITY;
    fpPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, fpPitch));
  }

  function handlePointerDown(e: PointerEvent) {
    inputCaps.handlePointerEvent(e);

    // Request pointer lock on click in first-person mode (mouse only)
    if (cameraMode === "first-person" && e.pointerType === "mouse" && inputCaps.canUsePointerLock()) {
      if (!document.pointerLockElement) {
        document.body.requestPointerLock?.();
      }
    }
  }

  function handlePointerMove(e: PointerEvent) {
    // Track pointer type for proper input detection (works with DevTools touch simulation)
    inputCaps.handlePointerEvent(e);
  }

  // Touch look handlers
  function handleTouchStart(e: TouchEvent) {
    if (cameraMode !== "first-person") return;

    for (const touch of Array.from(e.changedTouches)) {
      // Skip joystick zone
      if (isInJoystickZone(touch.clientX, touch.clientY)) continue;

      if (touchLookId === null) {
        touchLookId = touch.identifier;
        touchLook.active = true;
        touchLook.currentX = touch.clientX;
        touchLook.currentY = touch.clientY;
        e.preventDefault();
      }
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (cameraMode !== "first-person") return;

    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === touchLookId && touchLook.active) {
        const deltaX = touch.clientX - touchLook.currentX;
        const deltaY = touch.clientY - touchLook.currentY;

        fpYaw -= deltaX * TOUCH_SENSITIVITY;
        fpPitch -= deltaY * TOUCH_SENSITIVITY;
        fpPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, fpPitch));

        touchLook.currentX = touch.clientX;
        touchLook.currentY = touch.clientY;
        e.preventDefault();
      }
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === touchLookId) {
        touchLookId = null;
        touchLook.active = false;
      }
    }
  }

  // Joystick input handler
  function handleJoystickInput(x: number, y: number) {
    const deadzone = 0.2;
    moveForward = y > deadzone;
    moveBackward = y < -deadzone;
    moveLeft = x < -deadzone;
    moveRight = x > deadzone;
  }

  // ============================================================================
  // ORBIT CONTROLS HANDLER
  // ============================================================================

  function handleControlsChange() {
    if (orbitControls && onazimuthchange && cameraMode === "orbit") {
      const azimuth = orbitControls.getAzimuthalAngle();
      const degrees = (azimuth * 180 / Math.PI + 180) % 360;
      onazimuthchange(degrees);
    }
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  let animationFrameId: number | null = null;
  let lastTime = 0;

  function movementLoop(time: number) {
    const delta = Math.min((time - lastTime) / 1000, 0.1); // Cap delta to prevent large jumps
    lastTime = time;

    if (cameraMode === "first-person" && camera) {
      const speed = WALK_SPEED * delta;

      // Calculate movement direction based on yaw
      const forward = new Vector3(0, 0, -1).applyAxisAngle(new Vector3(0, 1, 0), fpYaw);
      const right = new Vector3(1, 0, 0).applyAxisAngle(new Vector3(0, 1, 0), fpYaw);

      if (moveForward) {
        fpPosition.x += forward.x * speed;
        fpPosition.z += forward.z * speed;
      }
      if (moveBackward) {
        fpPosition.x -= forward.x * speed;
        fpPosition.z -= forward.z * speed;
      }
      if (moveLeft) {
        fpPosition.x -= right.x * speed;
        fpPosition.z -= right.z * speed;
      }
      if (moveRight) {
        fpPosition.x += right.x * speed;
        fpPosition.z += right.z * speed;
      }

      // Update camera directly
      camera.position.set(fpPosition.x, fpPosition.y, fpPosition.z);
      camera.rotation.set(fpPitch, fpYaw, 0, "YXZ");
    }

    animationFrameId = requestAnimationFrame(movementLoop);
  }

  onMount(() => {
    inputCaps.init();

    // Start movement loop
    lastTime = performance.now();
    animationFrameId = requestAnimationFrame(movementLoop);

    // Keyboard
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    // Mouse and pointer events
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointermove", handlePointerMove);

    // Touch
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);
  });

  onDestroy(() => {
    // Stop movement loop
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }

    inputCaps.destroy();

    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("pointerdown", handlePointerDown);
    document.removeEventListener("pointermove", handlePointerMove);

    window.removeEventListener("touchstart", handleTouchStart);
    window.removeEventListener("touchmove", handleTouchMove);
    window.removeEventListener("touchend", handleTouchEnd);
    window.removeEventListener("touchcancel", handleTouchEnd);

    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  });
</script>

<div class="endless-world-container">
  <Canvas>
    <!-- Sky -->
    <Sky
      elevation={30}
      azimuth={180}
      turbidity={8}
      rayleigh={0.5}
    />

    <!-- Ambient light -->
    <T.AmbientLight intensity={0.4} />

    <!-- Sun -->
    <T.DirectionalLight
      position={[100, 100, 50]}
      intensity={1.2}
      castShadow
      shadow.mapSize.width={2048}
      shadow.mapSize.height={2048}
      shadow.camera.near={0.5}
      shadow.camera.far={500}
      shadow.camera.left={-200}
      shadow.camera.right={200}
      shadow.camera.top={200}
      shadow.camera.bottom={-200}
    />

    <!-- Fill light -->
    <T.DirectionalLight
      position={[-50, 30, -50]}
      intensity={0.3}
    />

    <!-- Terrain -->
    <HeightmapTerrain
      heightmap={terrainData}
      config={terrainConfig}
      {verticalExaggeration}
      {wireframe}
      {satelliteTexture}
      color="#4a7c4e"
      position={terrainOffset}
    />

    <!-- Ground plane (water level / base) -->
    <T.Mesh
      rotation.x={-Math.PI / 2}
      position.x={terrainOffset[0]}
      position.y={-1}
      position.z={terrainOffset[2]}
      receiveShadow
    >
      <T.PlaneGeometry args={[terrainSize * 2, terrainSize * 2]} />
      <T.MeshStandardMaterial color="#2d5a3d" roughness={0.95} />
    </T.Mesh>

    <!-- Click detection for boundary placement -->
    {#if boundaryEditMode && onterrainclick}
      <BoundaryClickPlane
        onclick={onterrainclick}
        enabled={boundaryEditMode}
      />
    {/if}

    <!-- Boundary markers (fence posts) -->
    {#if boundaryPoints.length > 0}
      <BoundaryEditor points={boundaryPoints} />
    {/if}

    <!-- Camera -->
    {#if cameraMode === "orbit"}
      <!-- Orbit mode camera -->
      <T.PerspectiveCamera
        makeDefault
        bind:ref={camera}
        position={orbitCameraPosition}
        fov={60}
        near={0.1}
        far={5000}
      >
        <OrbitControls
          bind:ref={orbitControls}
          target={orbitCameraTarget}
          enableDamping
          dampingFactor={0.1}
          minDistance={10}
          maxDistance={1000}
          maxPolarAngle={Math.PI / 2 - 0.1}
          onchange={handleControlsChange}
        />
      </T.PerspectiveCamera>
    {:else}
      <!-- First-person mode camera -->
      <T.PerspectiveCamera
        makeDefault
        bind:ref={camera}
        position.x={fpPosition.x}
        position.y={fpPosition.y}
        position.z={fpPosition.z}
        rotation.order="YXZ"
        rotation.y={fpYaw}
        rotation.x={fpPitch}
        fov={75}
        near={0.1}
        far={5000}
      />
    {/if}
  </Canvas>

  <!-- UI Overlays -->
  {#if cameraMode === "first-person"}
    <!-- Touch controls -->
    {#if shouldShowTouchUI()}
      <VirtualJoystick
        onInput={handleJoystickInput}
        enabled={true}
        left={JOYSTICK_MARGIN}
        bottom={JOYSTICK_MARGIN}
        size={JOYSTICK_SIZE}
      />

      <button class="exit-fp-btn" onclick={enterOrbitMode}>
        <i class="fas fa-expand" aria-hidden="true"></i>
        <span>Orbit View</span>
      </button>

      <div class="look-hint">
        <span>Drag to look</span>
      </div>
    {:else}
      <!-- Desktop controls hint -->
      <div class="fp-controls">
        <p><strong>WASD</strong> move • <strong>Mouse</strong> look • <strong>V</strong> orbit view • <strong>ESC</strong> exit</p>
      </div>

      {#if !document.pointerLockElement}
        <div class="click-hint">
          <p>Click to enable mouse look</p>
        </div>
      {/if}
    {/if}
  {:else}
    <!-- Orbit mode hint -->
    <div class="orbit-hint">
      <p>Press <strong>V</strong> for first-person view</p>
    </div>
  {/if}
</div>

<style>
  .endless-world-container {
    position: absolute;
    inset: 0;
    background: #1a1a2e;
  }

  .endless-world-container :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* First-person controls hint */
  .fp-controls {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.6);
    padding: 12px 24px;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    pointer-events: none;
  }

  .fp-controls p {
    margin: 0;
  }

  /* Click to enable mouse look */
  .click-hint {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.7);
    padding: 20px 40px;
    border-radius: 12px;
    color: white;
    font-size: 16px;
    pointer-events: none;
  }

  .click-hint p {
    margin: 0;
  }

  /* Orbit mode hint */
  .orbit-hint {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.5);
    padding: 10px 20px;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 13px;
    pointer-events: none;
  }

  .orbit-hint p {
    margin: 0;
  }

  /* Touch exit button */
  .exit-fp-btn {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 14px;
    cursor: pointer;
    z-index: 100;
  }

  .exit-fp-btn:hover {
    background: rgba(0, 0, 0, 0.8);
  }

  /* Touch look hint */
  .look-hint {
    position: absolute;
    top: 50%;
    right: 40px;
    transform: translateY(-50%);
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
    pointer-events: none;
  }
</style>
