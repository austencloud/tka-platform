<script lang="ts">
  /**
   * Hannon's Camp Module
   *
   * Dedicated 3D viewer for the real terrain of Hannon's Camp America
   * (Kinetic Fire festival site in Southwest Ohio).
   *
   * This is NOT procedural generation - it renders actual elevation data
   * from Mapbox as a single, fixed terrain mesh.
   *
   * Features:
   * - Load existing terrain data OR capture new terrain
   * - Satellite imagery overlay for orientation
   * - First-person walking mode
   *
   * Controls:
   * - Click to enter first-person mode
   * - WASD to move, mouse to look
   * - ESC to exit first-person mode (returns to orbit view)
   */

  import { onMount, onDestroy } from "svelte";
  import {
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
    BufferGeometry,
    BufferAttribute,
    Mesh,
    MeshStandardMaterial,
    MeshBasicMaterial,
    DirectionalLight,
    AmbientLight,
    HemisphereLight,
    Color,
    Fog,
    Vector3,
    Vector2,
    Raycaster,
    CanvasTexture,
    SRGBColorSpace,
    SphereGeometry,
    LineBasicMaterial,
    Line,
    Group,
    Shape,
    Path,
    ShapeGeometry,
    DoubleSide,
    type Texture,
  } from "three";
  import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
  import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";

  // Import terrain data and satellite loader
  import terrainData from "../data/hannons-camp-terrain.json";
  import { MapboxSatelliteLoader } from "../../endless-world/terrain/services/implementations/MapboxSatelliteLoader";
  import type { GeoBounds } from "../../endless-world/terrain/terrain-types";

  // ============================================================================
  // STATE
  // ============================================================================

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let renderer: WebGLRenderer | null = null;
  let scene: Scene | null = null;
  let camera: PerspectiveCamera | null = null;
  let orbitControls: OrbitControls | null = null;
  let pointerLockControls: PointerLockControls | null = null;
  let terrainMesh: Mesh | null = null;
  let animationId: number | null = null;

  // View mode: "first-person" for walking, "overhead" for bird's-eye editing
  type ViewMode = "first-person" | "overhead";
  let viewMode = $state<ViewMode>("first-person");
  let isFirstPerson = $state(false);
  let moveForward = false;
  let moveBackward = false;
  let moveLeft = false;
  let moveRight = false;
  let canJump = false;
  let velocity = new Vector3();
  let direction = new Vector3();
  const raycaster = new Raycaster();
  const PLAYER_HEIGHT = 1.7; // meters (realistic human eye level)
  const WALK_SPEED = 1.5; // meters/second (realistic walking pace)
  const RUN_SPEED = 5; // meters/second (jogging pace)
  const FLY_SPEED = 50; // meters/second (fast traversal for dev)
  const GRAVITY = 9.8; // realistic gravity

  // Movement mode
  let isFlyMode = $state(false);
  let isRunning = $state(false);

  // Terrain info
  let terrainLoaded = $state(false);
  let elevationRange = $state({ min: 0, max: 0 });
  let terrainSize = $state({ width: 0, depth: 0 });

  // Spawn configuration - entrance location (Hannon's Camp entrance)
  const SPAWN_POINT = { x: 231, z: -96 };
  const SPAWN_YAW = 88 * Math.PI / 180; // 88 degrees, facing the parking lot

  // Position display for finding spawn points
  let currentPosition = $state({ x: 0, y: 0, z: 0 });
  let displayYaw = $state(0); // Separate reactive state for yaw display
  let copyFeedback = $state("");

  // Copy current position/yaw to clipboard for easy sharing
  async function copyCoordinates(): Promise<void> {
    const text = `X: ${currentPosition.x} Z: ${currentPosition.z} Yaw: ${displayYaw}°`;
    try {
      await navigator.clipboard.writeText(text);
      copyFeedback = "Copied!";
      setTimeout(() => copyFeedback = "", 2000);
    } catch {
      copyFeedback = "Failed";
      setTimeout(() => copyFeedback = "", 2000);
    }
  }

  // Satellite texture for terrain
  let satelliteTexture: Texture | null = null;
  let terrainMaterial: MeshStandardMaterial | null = null;
  let satelliteLoader: MapboxSatelliteLoader | null = null;
  let isLoadingTexture = $state(false);
  let textureError = $state<string | null>(null);

  // Store terrain bounds for texture loading
  let terrainBounds: GeoBounds | null = null;
  let terrainMinElevation = 0;

  // Mobile/touch support
  let isMobile = $state(false);
  let touchLookId: number | null = null; // Track touch ID for look
  let touchMoveId: number | null = null; // Track touch ID for movement
  let touchLook = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 };
  let touchMove = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 };
  let joystickBase: HTMLDivElement | null = null;
  let joystickKnob: HTMLDivElement | null = null;
  let cameraYaw = $state(0);
  let cameraPitch = $state(0);
  const TOUCH_SENSITIVITY = 0.004;

  // Boundary editing
  interface BoundaryPoint {
    x: number;
    z: number;
  }
  let boundaryPoints = $state<BoundaryPoint[]>([]);
  let isPolygonClosed = $state(false);
  let boundaryGroup: Group | null = null;
  let boundaryMarkers: Mesh[] = [];
  let boundaryLine: Line | null = null;
  let boundaryMask: Mesh | null = null;

  // ============================================================================
  // TERRAIN GENERATION
  // ============================================================================

  function createTerrainMesh(): Mesh {
    const { heightmap, geoBounds, worldDimensions } = terrainData;
    const { width, height, minElevation, maxElevation, heights } = heightmap;

    // Use world dimensions from the terrain data (in real meters)
    const boundsWidth = worldDimensions.width;  // ~467m
    const boundsDepth = worldDimensions.depth;  // ~444m

    // Store bounds for satellite texture loading
    terrainBounds = geoBounds as GeoBounds;
    terrainMinElevation = minElevation;

    // Store for UI
    elevationRange = { min: minElevation, max: maxElevation };
    terrainSize = { width: Math.round(boundsWidth), depth: Math.round(boundsDepth) };

    console.log(`[HannonsCamp] Creating terrain mesh (1:1 METER SCALE)`);
    console.log(`[HannonsCamp] Heightmap: ${width}x${height}`);
    console.log(`[HannonsCamp] Elevation: ${minElevation.toFixed(1)}m to ${maxElevation.toFixed(1)}m (${(maxElevation - minElevation).toFixed(1)}m range)`);
    console.log(`[HannonsCamp] Size: ${boundsWidth.toFixed(0)}m x ${boundsDepth.toFixed(0)}m`);

    // Create geometry - use heightmap resolution
    const geometry = new BufferGeometry();
    const vertexCount = width * height;
    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);

    // 1:1 METER SCALE - No elevation scaling!
    // Subtract minElevation so lowest point is Y=0, but keep real meter differences
    // Elevation range is ~23.6m, so Y will range from 0 to ~23.6

    // Generate vertices from heightmap
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const idx = (z * width + x) * 3;
        const uvIdx = (z * width + x) * 2;
        const heightIdx = z * width + x;

        // Map heightmap coordinates to world coordinates (real meters)
        // Center the terrain at origin
        const worldX = (x / (width - 1)) * boundsWidth - boundsWidth / 2;
        const worldZ = (z / (height - 1)) * boundsDepth - boundsDepth / 2;

        // Get height - use REAL METERS (offset to ground level)
        const rawHeight = heights[heightIdx] ?? minElevation;
        const realHeight = rawHeight - minElevation; // 0 to ~23.6m

        vertices[idx] = worldX;
        vertices[idx + 1] = realHeight;
        vertices[idx + 2] = worldZ;

        // UV coordinates (0-1 range)
        uvs[uvIdx] = x / (width - 1);
        uvs[uvIdx + 1] = 1 - (z / (height - 1)); // Flip V for correct orientation

        // Color based on elevation - grass green to tan/brown (used until texture loads)
        const t = (rawHeight - minElevation) / (maxElevation - minElevation);
        colors[idx] = 0.2 + t * 0.3;     // R: 0.2 -> 0.5
        colors[idx + 1] = 0.5 - t * 0.15; // G: 0.5 -> 0.35
        colors[idx + 2] = 0.15 + t * 0.1; // B: 0.15 -> 0.25
      }
    }

    // Calculate normals
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const idx = (z * width + x) * 3;

        // Get neighboring heights
        const h = vertices[idx + 1] ?? 0;
        const hL = x > 0 ? (vertices[(z * width + (x - 1)) * 3 + 1] ?? h) : h;
        const hR = x < width - 1 ? (vertices[(z * width + (x + 1)) * 3 + 1] ?? h) : h;
        const hD = z > 0 ? (vertices[((z - 1) * width + x) * 3 + 1] ?? h) : h;
        const hU = z < height - 1 ? (vertices[((z + 1) * width + x) * 3 + 1] ?? h) : h;

        // Calculate normal
        const stepX = boundsWidth / (width - 1);
        const stepZ = boundsDepth / (height - 1);
        const nx = (hL - hR) / (2 * stepX);
        const nz = (hD - hU) / (2 * stepZ);
        const len = Math.sqrt(nx * nx + 1 + nz * nz);

        normals[idx] = nx / len;
        normals[idx + 1] = 1 / len;
        normals[idx + 2] = nz / len;
      }
    }

    // Generate indices
    const quadCount = (width - 1) * (height - 1);
    const indices = new Uint32Array(quadCount * 6);
    let indexIdx = 0;

    for (let z = 0; z < height - 1; z++) {
      for (let x = 0; x < width - 1; x++) {
        const tl = z * width + x;
        const tr = tl + 1;
        const bl = (z + 1) * width + x;
        const br = bl + 1;

        indices[indexIdx++] = tl;
        indices[indexIdx++] = bl;
        indices[indexIdx++] = tr;
        indices[indexIdx++] = tr;
        indices[indexIdx++] = bl;
        indices[indexIdx++] = br;
      }
    }

    geometry.setAttribute("position", new BufferAttribute(vertices, 3));
    geometry.setAttribute("normal", new BufferAttribute(normals, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setIndex(new BufferAttribute(indices, 1));

    // Material - starts with vertex colors, can switch to texture
    terrainMaterial = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: false,
    });

    const mesh = new Mesh(geometry, terrainMaterial);
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    return mesh;
  }

  // ============================================================================
  // SATELLITE TEXTURE LOADING
  // ============================================================================

  async function loadSatelliteTexture(): Promise<void> {
    if (!terrainBounds || !terrainMaterial) {
      console.warn("[HannonsCamp] Cannot load texture - terrain not ready");
      return;
    }

    // Initialize satellite loader
    satelliteLoader = new MapboxSatelliteLoader();
    if (!satelliteLoader.isReady()) {
      textureError = "Mapbox token required for satellite imagery";
      console.warn("[HannonsCamp] No Mapbox token - using vertex colors");
      return;
    }

    isLoadingTexture = true;
    textureError = null;

    try {
      console.log("[HannonsCamp] Loading high-resolution satellite imagery (zoom 18, 4096x4096)...");

      // Fetch satellite imagery at maximum resolution
      // Zoom 18 is the highest detail available from Mapbox
      // 4096x4096 output for crisp textures when walking on the terrain
      const satCanvas = await satelliteLoader.loadSatelliteTexture(
        terrainBounds,
        { width: 4096, height: 4096 },
        18  // Maximum zoom level for highest detail
      );

      // Create Three.js texture
      if (satelliteTexture) {
        satelliteTexture.dispose();
      }
      satelliteTexture = new CanvasTexture(satCanvas);
      satelliteTexture.colorSpace = SRGBColorSpace;
      satelliteTexture.needsUpdate = true;

      // Apply to terrain material
      terrainMaterial.map = satelliteTexture;
      terrainMaterial.vertexColors = false;
      terrainMaterial.needsUpdate = true;

      console.log("[HannonsCamp] Satellite texture applied successfully");
    } catch (error) {
      console.error("[HannonsCamp] Failed to load satellite texture:", error);
      textureError = error instanceof Error ? error.message : "Failed to load satellite imagery";
    } finally {
      isLoadingTexture = false;
    }
  }

  // ============================================================================
  // SCENE SETUP
  // ============================================================================

  function setupScene(): void {
    if (!canvas || !container) return;

    // Renderer
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    // Scene
    scene = new Scene();
    scene.background = new Color(0x87ceeb); // Sky blue
    scene.fog = new Fog(0x87ceeb, 100, 800);

    // Camera - positioned to see the whole terrain
    camera = new PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    camera.position.set(0, 150, 300);
    camera.lookAt(0, 0, 0);

    // Orbit Controls (for overview mode)
    orbitControls = new OrbitControls(camera, canvas);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.maxPolarAngle = Math.PI / 2.1;
    orbitControls.minDistance = 20;
    orbitControls.maxDistance = 800;
    orbitControls.target.set(0, 0, 0);

    // Pointer Lock Controls (for first-person mode)
    pointerLockControls = new PointerLockControls(camera, canvas);

    // Listen for pointer lock changes at document level
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    // Lighting
    const ambient = new AmbientLight(0x404060, 0.4);
    scene.add(ambient);

    const hemisphere = new HemisphereLight(0x87ceeb, 0x3d5c3d, 0.6);
    scene.add(hemisphere);

    const sun = new DirectionalLight(0xffffff, 1.2);
    sun.position.set(100, 200, 100);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 500;
    sun.shadow.camera.left = -300;
    sun.shadow.camera.right = 300;
    sun.shadow.camera.top = 300;
    sun.shadow.camera.bottom = -300;
    scene.add(sun);

    // Create and add terrain
    terrainMesh = createTerrainMesh();
    scene.add(terrainMesh);
    terrainLoaded = true;

    console.log("[HannonsCamp] Scene setup complete");
  }

  function handlePointerLockChange(): void {
    if (document.pointerLockElement === canvas) {
      console.log("[HannonsCamp] Pointer locked");
      isFirstPerson = true;
      if (orbitControls) orbitControls.enabled = false;
    } else {
      console.log("[HannonsCamp] Pointer unlocked");
      isFirstPerson = false;
      if (orbitControls) orbitControls.enabled = true;
      // Reset movement
      moveForward = false;
      moveBackward = false;
      moveLeft = false;
      moveRight = false;
    }
  }

  function enterFirstPerson(): void {
    if (!pointerLockControls || !camera || !terrainMesh || !canvas) {
      console.error("[HannonsCamp] Cannot enter first person - missing dependencies");
      return;
    }

    console.log("[HannonsCamp] Requesting pointer lock...");

    // Position camera on the terrain at center
    const groundY = getTerrainHeightAt(0, 0);
    camera.position.set(0, groundY + PLAYER_HEIGHT, 0);
    velocity.set(0, 0, 0);

    // Request pointer lock - state changes happen in handlePointerLockChange
    canvas.requestPointerLock();
  }

  function getTerrainHeightAt(x: number, z: number): number {
    if (!terrainMesh) return 0;

    // Cast ray downward from high above
    raycaster.set(new Vector3(x, 500, z), new Vector3(0, -1, 0));
    const intersects = raycaster.intersectObject(terrainMesh);

    if (intersects.length > 0) {
      return intersects[0]!.point.y;
    }
    return 0;
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!isFirstPerson) return;

    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        moveForward = true;
        break;
      case "KeyS":
      case "ArrowDown":
        moveBackward = true;
        break;
      case "KeyA":
      case "ArrowLeft":
        moveLeft = true;
        break;
      case "KeyD":
      case "ArrowRight":
        moveRight = true;
        break;
      case "Space":
        if (canJump && !isFlyMode) {
          velocity.y = 5; // Realistic jump velocity
          canJump = false;
        }
        break;
      case "ShiftLeft":
      case "ShiftRight":
        isRunning = true;
        break;
      case "KeyG":
        // Toggle fly mode (G for "Glide")
        isFlyMode = !isFlyMode;
        if (isFlyMode) {
          velocity.y = 0; // Stop vertical velocity when entering fly mode
        }
        console.log(`[HannonsCamp] Fly mode: ${isFlyMode ? 'ON' : 'OFF'}`);
        break;
    }
  }

  function onKeyUp(event: KeyboardEvent): void {
    switch (event.code) {
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
      case "ShiftLeft":
      case "ShiftRight":
        isRunning = false;
        break;
    }
  }

  // ============================================================================
  // TOUCH CONTROLS (Mobile)
  // ============================================================================

  function detectMobile(): boolean {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  }

  function handleTouchStart(event: TouchEvent): void {
    if (!isFirstPerson) return;

    for (const touch of event.changedTouches) {
      const x = touch.clientX;
      const screenHalf = window.innerWidth / 2;

      if (x < screenHalf && touchMoveId === null) {
        // Left side - movement joystick (only if not already tracking a move touch)
        touchMoveId = touch.identifier;
        touchMove.active = true;
        touchMove.startX = x;
        touchMove.startY = touch.clientY;
        touchMove.currentX = x;
        touchMove.currentY = touch.clientY;
        updateJoystickVisual(0, 0);
      } else if (x >= screenHalf && touchLookId === null) {
        // Right side - look control (only if not already tracking a look touch)
        touchLookId = touch.identifier;
        touchLook.active = true;
        touchLook.startX = x;
        touchLook.startY = touch.clientY;
        touchLook.currentX = x;
        touchLook.currentY = touch.clientY;
      }
    }

    event.preventDefault();
  }

  function handleTouchMove(event: TouchEvent): void {
    if (!isFirstPerson) return;

    for (const touch of event.changedTouches) {
      // Track by touch ID, not by current position
      if (touch.identifier === touchMoveId && touchMove.active) {
        // Movement touch - update regardless of current position
        touchMove.currentX = touch.clientX;
        touchMove.currentY = touch.clientY;

        const dx = touchMove.currentX - touchMove.startX;
        const dy = touchMove.currentY - touchMove.startY;
        updateJoystickVisual(dx, dy);
      } else if (touch.identifier === touchLookId && touchLook.active) {
        // Look touch - update regardless of current position
        const deltaX = touch.clientX - touchLook.currentX;
        const deltaY = touch.clientY - touchLook.currentY;

        cameraYaw -= deltaX * TOUCH_SENSITIVITY;
        cameraPitch -= deltaY * TOUCH_SENSITIVITY;
        cameraPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraPitch));

        touchLook.currentX = touch.clientX;
        touchLook.currentY = touch.clientY;
      }
    }

    event.preventDefault();
  }

  function handleTouchEnd(event: TouchEvent): void {
    if (!isFirstPerson) return;

    for (const touch of event.changedTouches) {
      // Check by touch ID, not position
      if (touch.identifier === touchMoveId) {
        touchMoveId = null;
        touchMove.active = false;
        moveForward = false;
        moveBackward = false;
        moveLeft = false;
        moveRight = false;
        updateJoystickVisual(0, 0);
      } else if (touch.identifier === touchLookId) {
        touchLookId = null;
        touchLook.active = false;
      }
    }
  }

  function updateJoystickVisual(dx: number, dy: number): void {
    if (!joystickKnob) return;

    const maxOffset = 40;
    const clampedX = Math.max(-maxOffset, Math.min(maxOffset, dx));
    const clampedY = Math.max(-maxOffset, Math.min(maxOffset, dy));

    joystickKnob.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
  }

  function updateMovementFromTouch(): void {
    if (!touchMove.active) return;

    const dx = touchMove.currentX - touchMove.startX;
    const dy = touchMove.currentY - touchMove.startY;
    const deadzone = 15;

    moveForward = dy < -deadzone;
    moveBackward = dy > deadzone;
    moveLeft = dx < -deadzone;
    moveRight = dx > deadzone;
  }

  function enterFirstPersonMobile(): void {
    if (!camera || !terrainMesh) {
      console.error("[HannonsCamp] Cannot enter first person - missing dependencies");
      return;
    }

    console.log("[HannonsCamp] Entering mobile first-person mode");

    // Position camera on the terrain at center
    const groundY = getTerrainHeightAt(0, 0);
    camera.position.set(0, groundY + PLAYER_HEIGHT, 0);
    velocity.set(0, 0, 0);

    // Initialize camera angles
    cameraYaw = 0;
    cameraPitch = 0;

    // Enter first-person mode (no pointer lock on mobile)
    isFirstPerson = true;
    if (orbitControls) orbitControls.enabled = false;
  }

  function exitFirstPersonMobile(): void {
    console.log("[HannonsCamp] Exiting mobile first-person mode");
    isFirstPerson = false;
    if (orbitControls) orbitControls.enabled = true;
    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;
    touchMove.active = false;
    touchLook.active = false;
    touchMoveId = null;
    touchLookId = null;
  }

  function autoEnterFirstPerson(): void {
    if (!camera || !terrainMesh) {
      console.error("[HannonsCamp] Cannot auto-enter first person - terrain not ready");
      return;
    }

    console.log(`[HannonsCamp] Auto-entering first-person at spawn (${SPAWN_POINT.x}, ${SPAWN_POINT.z}) facing ${Math.round(SPAWN_YAW * 180 / Math.PI)}°`);

    // Get ground height at spawn point
    const groundY = getTerrainHeightAt(SPAWN_POINT.x, SPAWN_POINT.z);
    camera.position.set(SPAWN_POINT.x, groundY + PLAYER_HEIGHT, SPAWN_POINT.z);
    velocity.set(0, 0, 0);

    // Initialize camera angles to spawn direction
    cameraYaw = SPAWN_YAW;
    cameraPitch = 0;

    // Apply initial rotation to camera
    camera.rotation.order = "YXZ";
    camera.rotation.y = cameraYaw;
    camera.rotation.x = cameraPitch;

    // Enter first-person mode
    isFirstPerson = true;
    if (orbitControls) orbitControls.enabled = false;

    // On desktop, we need pointer lock - but don't request it automatically
    // (browsers block auto pointer lock requests). User can click to lock.
    // On mobile, we're already good to go with touch controls.
    if (!isMobile && canvas) {
      console.log("[HannonsCamp] Desktop: Click anywhere to enable mouse look");
      // Add click handler for pointer lock on desktop
      canvas.addEventListener("click", handleCanvasClick);
    }
  }

  function handleCanvasClick(): void {
    if (!isMobile && isFirstPerson && viewMode === "first-person" && canvas && !document.pointerLockElement) {
      canvas.requestPointerLock();
    }
  }

  // ============================================================================
  // VIEW MODE SWITCHING
  // ============================================================================

  function enterOverheadMode(): void {
    if (!camera || !orbitControls) return;

    console.log("[HannonsCamp] Entering overhead mode");
    viewMode = "overhead";
    isFirstPerson = false;

    // Exit pointer lock if active
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    // Reset movement
    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;

    // Position camera directly above the terrain center, looking down
    const centerY = getTerrainHeightAt(0, 0);
    camera.position.set(0, centerY + 300, 0); // 300m above center
    camera.lookAt(0, centerY, 0);
    camera.up.set(0, 0, -1); // North is "up" in overhead view

    // Configure orbit controls for overhead viewing
    orbitControls.enabled = true;
    orbitControls.target.set(0, centerY, 0);
    orbitControls.minPolarAngle = 0; // Allow looking straight down
    orbitControls.maxPolarAngle = Math.PI / 4; // Limit to ~45° from vertical
    orbitControls.minDistance = 50;
    orbitControls.maxDistance = 1000; // Allow zooming out further to see full terrain
    orbitControls.update();
  }

  function exitOverheadMode(): void {
    if (!camera || !orbitControls) return;

    console.log("[HannonsCamp] Exiting overhead mode, returning to first-person");
    viewMode = "first-person";

    // Reset orbit controls constraints
    orbitControls.maxPolarAngle = Math.PI / 2.1;
    orbitControls.minDistance = 20;
    orbitControls.maxDistance = 800;

    // Reset camera up vector
    camera.up.set(0, 1, 0);

    // Re-enter first-person at current position (or spawn if too high)
    const groundY = getTerrainHeightAt(camera.position.x, camera.position.z);
    camera.position.set(camera.position.x, groundY + PLAYER_HEIGHT, camera.position.z);
    velocity.set(0, 0, 0);

    // Initialize camera angles
    cameraYaw = 0;
    cameraPitch = 0;
    camera.rotation.order = "YXZ";
    camera.rotation.y = cameraYaw;
    camera.rotation.x = cameraPitch;

    isFirstPerson = true;
    orbitControls.enabled = false;

    // On desktop, add click handler for pointer lock
    if (!isMobile && canvas) {
      canvas.addEventListener("click", handleCanvasClick);
    }
  }

  // ============================================================================
  // BOUNDARY EDITING
  // ============================================================================

  function initBoundaryGroup(): void {
    if (!scene) return;

    // Create group to hold all boundary visuals
    boundaryGroup = new Group();
    boundaryGroup.name = "BoundaryGroup";
    scene.add(boundaryGroup);
  }

  function handleOverheadClick(event: MouseEvent): void {
    if (viewMode !== "overhead" || !camera || !terrainMesh || !canvas) return;

    // Get normalized device coordinates
    const rect = canvas.getBoundingClientRect();
    const mouse = new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    // Raycast to terrain
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(terrainMesh);

    if (intersects.length > 0) {
      const point = intersects[0]!.point;
      addBoundaryPoint(point.x, point.z);
    }
  }

  function addBoundaryPoint(x: number, z: number): void {
    if (isPolygonClosed) return;

    // Check if clicking near the first point to close polygon
    if (boundaryPoints.length >= 3) {
      const first = boundaryPoints[0]!;
      const dist = Math.sqrt((x - first.x) ** 2 + (z - first.z) ** 2);
      if (dist < 10) {
        // Close polygon
        closeBoundaryPolygon();
        return;
      }
    }

    // Add new point
    boundaryPoints = [...boundaryPoints, { x, z }];
    renderBoundary();
    saveBoundaryToStorage();

    console.log(`[HannonsCamp] Added boundary point ${boundaryPoints.length}: (${x.toFixed(1)}, ${z.toFixed(1)})`);
  }

  function closeBoundaryPolygon(): void {
    if (boundaryPoints.length < 3) return;

    isPolygonClosed = true;
    renderBoundary();
    saveBoundaryToStorage();
    console.log(`[HannonsCamp] Boundary polygon closed with ${boundaryPoints.length} points`);
  }

  function clearBoundary(): void {
    boundaryPoints = [];
    isPolygonClosed = false;
    renderBoundary();
    saveBoundaryToStorage();
    console.log("[HannonsCamp] Boundary cleared");
  }

  // ============================================================================
  // BOUNDARY PERSISTENCE (localStorage)
  // ============================================================================

  const BOUNDARY_STORAGE_KEY = "hannons-camp-boundary";

  function saveBoundaryToStorage(): void {
    if (typeof localStorage === "undefined") return;

    try {
      const data = {
        points: boundaryPoints,
        isClosed: isPolygonClosed,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(BOUNDARY_STORAGE_KEY, JSON.stringify(data));
      console.log(`[HannonsCamp] Boundary saved (${boundaryPoints.length} points)`);
    } catch (error) {
      console.warn("[HannonsCamp] Failed to save boundary:", error);
    }
  }

  function loadBoundaryFromStorage(): void {
    if (typeof localStorage === "undefined") return;

    try {
      const stored = localStorage.getItem(BOUNDARY_STORAGE_KEY);
      if (!stored) return;

      const data = JSON.parse(stored);
      if (data.points && Array.isArray(data.points)) {
        boundaryPoints = data.points;
        isPolygonClosed = data.isClosed ?? false;
        console.log(`[HannonsCamp] Boundary loaded (${boundaryPoints.length} points, closed: ${isPolygonClosed})`);
      }
    } catch (error) {
      console.warn("[HannonsCamp] Failed to load boundary:", error);
    }
  }

  function renderBoundary(): void {
    if (!boundaryGroup || !scene) return;

    // Clear existing visuals
    while (boundaryGroup.children.length > 0) {
      const child = boundaryGroup.children[0];
      if (child) boundaryGroup.remove(child);
    }
    boundaryMarkers = [];

    if (boundaryPoints.length === 0) return;

    // Create markers for each point
    const markerGeometry = new SphereGeometry(3, 16, 16);
    const markerMaterial = new MeshBasicMaterial({ color: 0xf97316 }); // Orange

    for (let i = 0; i < boundaryPoints.length; i++) {
      const point = boundaryPoints[i]!;
      const marker = new Mesh(markerGeometry, markerMaterial);
      const y = getTerrainHeightAt(point.x, point.z) + 2; // Slightly above terrain
      marker.position.set(point.x, y, point.z);
      boundaryGroup.add(marker);
      boundaryMarkers.push(marker);
    }

    // Create line connecting points
    if (boundaryPoints.length >= 2) {
      const linePoints: Vector3[] = [];

      for (const point of boundaryPoints) {
        const y = getTerrainHeightAt(point.x, point.z) + 1;
        linePoints.push(new Vector3(point.x, y, point.z));
      }

      // Close the loop if polygon is closed
      if (isPolygonClosed && boundaryPoints.length > 0) {
        const firstPoint = boundaryPoints[0]!;
        const y = getTerrainHeightAt(firstPoint.x, firstPoint.z) + 1;
        linePoints.push(new Vector3(firstPoint.x, y, firstPoint.z));
      }

      const lineGeometry = new BufferGeometry().setFromPoints(linePoints);
      const lineMaterial = new LineBasicMaterial({
        color: isPolygonClosed ? 0x4ade80 : 0xf97316, // Green when closed, orange when open
        linewidth: 2,
      });

      boundaryLine = new Line(lineGeometry, lineMaterial);
      boundaryGroup.add(boundaryLine);
    }

    // Update terrain mask
    updateBoundaryMask();
  }

  function updateBoundaryMask(): void {
    if (!scene) return;

    // Remove existing mask
    if (boundaryMask) {
      scene.remove(boundaryMask);
      boundaryMask.geometry.dispose();
      if (boundaryMask.material instanceof MeshBasicMaterial) {
        boundaryMask.material.dispose();
      }
      boundaryMask = null;
    }

    // Only create mask if polygon is closed
    if (!isPolygonClosed || boundaryPoints.length < 3) return;

    // Create outer rectangle covering entire terrain
    const { worldDimensions } = terrainData;
    const margin = 50; // Extra margin
    const halfW = worldDimensions.width / 2 + margin;
    const halfD = worldDimensions.depth / 2 + margin;

    // Create shape with outer rectangle
    const outerShape = new Shape();
    outerShape.moveTo(-halfW, -halfD);
    outerShape.lineTo(halfW, -halfD);
    outerShape.lineTo(halfW, halfD);
    outerShape.lineTo(-halfW, halfD);
    outerShape.lineTo(-halfW, -halfD);

    // Create hole from boundary points (note: Shape uses X,Y but we're placing it in XZ plane)
    const holePath = new Path();
    const first = boundaryPoints[0]!;
    holePath.moveTo(first.x, first.z);
    for (let i = 1; i < boundaryPoints.length; i++) {
      const p = boundaryPoints[i]!;
      holePath.lineTo(p.x, p.z);
    }
    holePath.lineTo(first.x, first.z); // Close

    outerShape.holes.push(holePath);

    // Create geometry
    const geometry = new ShapeGeometry(outerShape);

    // Position at average terrain height
    const avgY = boundaryPoints.reduce((sum, p) => sum + getTerrainHeightAt(p.x, p.z), 0) / boundaryPoints.length;

    // Create mesh with semi-transparent dark material
    const material = new MeshBasicMaterial({
      color: 0x000000,
      opacity: 0.6,
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
    });

    boundaryMask = new Mesh(geometry, material);
    boundaryMask.rotation.x = -Math.PI / 2; // Rotate to XZ plane
    boundaryMask.position.y = avgY + 0.5; // Slightly above terrain
    boundaryMask.renderOrder = 1; // Render after terrain

    scene.add(boundaryMask);
    console.log("[HannonsCamp] Boundary mask updated");
  }

  function handleResize(): void {
    if (!renderer || !camera || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  let lastTime = performance.now();

  function animate(): void {
    animationId = requestAnimationFrame(animate);

    const time = performance.now();
    const delta = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (isFirstPerson && camera) {
      // Determine current speed based on mode
      const currentSpeed = isFlyMode ? FLY_SPEED : (isRunning ? RUN_SPEED : WALK_SPEED);

      // Apply gravity (only if not flying)
      if (!isFlyMode) {
        velocity.y -= GRAVITY * delta;
      }

      // Update movement from touch if on mobile
      if (isMobile) {
        updateMovementFromTouch();

        // Apply camera rotation from touch input
        camera.rotation.order = "YXZ";
        camera.rotation.y = cameraYaw;
        camera.rotation.x = cameraPitch;
      }

      // Calculate movement direction
      direction.z = Number(moveForward) - Number(moveBackward);
      direction.x = Number(moveRight) - Number(moveLeft);
      direction.normalize();

      // Move camera - use manual movement on mobile, PointerLockControls on desktop
      if (isMobile) {
        // Manual movement based on camera yaw
        const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        if (!isFlyMode) forward.y = 0; // Lock to ground unless flying
        forward.normalize();

        const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        right.y = 0;
        right.normalize();

        if (moveForward || moveBackward) {
          camera.position.addScaledVector(forward, direction.z * currentSpeed * delta);
        }
        if (moveLeft || moveRight) {
          camera.position.addScaledVector(right, direction.x * currentSpeed * delta);
        }
      } else if (pointerLockControls) {
        // Desktop - use PointerLockControls
        if (moveForward || moveBackward) {
          pointerLockControls.moveForward(direction.z * currentSpeed * delta);
        }
        if (moveLeft || moveRight) {
          pointerLockControls.moveRight(direction.x * currentSpeed * delta);
        }
      }

      // Apply vertical velocity (only if not flying)
      if (!isFlyMode) {
        camera.position.y += velocity.y * delta;

        // Ground collision
        const groundY = getTerrainHeightAt(camera.position.x, camera.position.z);
        if (camera.position.y < groundY + PLAYER_HEIGHT) {
          camera.position.y = groundY + PLAYER_HEIGHT;
          velocity.y = 0;
          canJump = true;
        }
      }

      // Update position display
      currentPosition = {
        x: Math.round(camera.position.x),
        y: Math.round(camera.position.y * 10) / 10,
        z: Math.round(camera.position.z)
      };

      // Calculate yaw from camera's forward direction for display (works for both mobile and desktop)
      const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const calculatedYaw = Math.atan2(-forward.x, -forward.z);
      displayYaw = Math.round(calculatedYaw * 180 / Math.PI); // Convert to degrees for display

      if (!isMobile) {
        cameraYaw = calculatedYaw;
      }
    } else if (orbitControls) {
      orbitControls.update();
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  onMount(() => {
    // Detect mobile/touch device
    isMobile = detectMobile();
    console.log(`[HannonsCamp] Mobile detected: ${isMobile}`);

    setupScene();
    initBoundaryGroup(); // Initialize boundary visuals group
    loadBoundaryFromStorage(); // Load saved boundary
    renderBoundary(); // Render it if exists
    animate();

    window.addEventListener("resize", handleResize);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    // Add touch listeners for mobile
    if (isMobile && canvas) {
      canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
      canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
      canvas.addEventListener("touchend", handleTouchEnd);
      canvas.addEventListener("touchcancel", handleTouchEnd);
    }

    // Add click handler for overhead boundary editing
    if (canvas) {
      canvas.addEventListener("click", handleOverheadClick);
    }

    // Load satellite texture (async - will apply when ready)
    loadSatelliteTexture();

    // Auto-enter first-person mode at spawn point
    // Small delay to ensure terrain mesh is ready for height sampling
    setTimeout(() => {
      autoEnterFirstPerson();
    }, 100);
  });

  onDestroy(() => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
    }

    window.removeEventListener("resize", handleResize);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    document.removeEventListener("pointerlockchange", handlePointerLockChange);

    // Clean up touch listeners and click handler
    if (canvas) {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchcancel", handleTouchEnd);
      canvas.removeEventListener("click", handleCanvasClick);
    }

    // Exit pointer lock if active
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    orbitControls?.dispose();
    pointerLockControls?.dispose();
    renderer?.dispose();

    if (satelliteTexture) {
      satelliteTexture.dispose();
    }

    if (terrainMesh) {
      terrainMesh.geometry.dispose();
      if (Array.isArray(terrainMesh.material)) {
        terrainMesh.material.forEach(m => m.dispose());
      } else {
        terrainMesh.material.dispose();
      }
    }
  });
</script>

<div class="hannons-camp" bind:this={container}>
  <canvas bind:this={canvas}></canvas>

  <!-- Location badge -->
  <div class="location-badge">
    <i class="fas fa-campground" aria-hidden="true"></i>
    <span>Hannon's Camp America</span>
    {#if isLoadingTexture}
      <span class="loading-indicator">
        <i class="fas fa-satellite fa-pulse" aria-hidden="true"></i>
        Loading imagery...
      </span>
    {/if}
  </div>

  {#if textureError}
    <div class="texture-error">
      <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      <span>{textureError}</span>
    </div>
  {/if}

  <!-- View mode toggle (top-right) -->
  <div class="view-mode-toggle">
    <button
      class="mode-btn"
      class:active={viewMode === "first-person"}
      onclick={() => viewMode === "overhead" ? exitOverheadMode() : null}
      title="First-person view"
    >
      <i class="fas fa-walking" aria-hidden="true"></i>
    </button>
    <button
      class="mode-btn"
      class:active={viewMode === "overhead"}
      onclick={() => viewMode === "first-person" ? enterOverheadMode() : null}
      title="Overhead view"
    >
      <i class="fas fa-map" aria-hidden="true"></i>
    </button>
  </div>

  <!-- Overhead mode panel -->
  {#if viewMode === "overhead"}
    <div class="overhead-panel">
      <div class="overhead-header">
        <i class="fas fa-draw-polygon" aria-hidden="true"></i>
        <span>Boundary Editor</span>
      </div>

      <!-- Boundary status -->
      <div class="boundary-status">
        {#if isPolygonClosed}
          <span class="status-badge closed">
            <i class="fas fa-check-circle" aria-hidden="true"></i>
            Boundary Set ({boundaryPoints.length} points)
          </span>
        {:else if boundaryPoints.length > 0}
          <span class="status-badge open">
            <i class="fas fa-pencil-alt" aria-hidden="true"></i>
            Drawing... ({boundaryPoints.length} points)
          </span>
        {:else}
          <span class="status-badge empty">
            <i class="fas fa-mouse-pointer" aria-hidden="true"></i>
            Click to add points
          </span>
        {/if}
      </div>

      <p class="overhead-hint">
        {#if !isPolygonClosed}
          Click the terrain to add boundary points.
          {#if boundaryPoints.length >= 3}
            <br /><strong>Click near first point to close.</strong>
          {/if}
        {:else}
          Boundary is set. Clear to redraw.
        {/if}
      </p>

      <!-- Boundary actions -->
      <div class="boundary-actions">
        {#if boundaryPoints.length >= 3 && !isPolygonClosed}
          <button class="boundary-btn close" onclick={closeBoundaryPolygon}>
            <i class="fas fa-check" aria-hidden="true"></i>
            Close Polygon
          </button>
        {/if}
        {#if boundaryPoints.length > 0}
          <button class="boundary-btn clear" onclick={clearBoundary}>
            <i class="fas fa-trash-alt" aria-hidden="true"></i>
            Clear
          </button>
        {/if}
      </div>

      <hr class="divider" />

      <button class="overhead-action" onclick={exitOverheadMode}>
        <i class="fas fa-walking" aria-hidden="true"></i>
        Return to Ground
      </button>
    </div>
  {/if}

  <!-- Dev panel (position + mode) -->
  {#if isFirstPerson}
    <div class="dev-panel">
      <div class="dev-panel-header">
        <span class="dev-label">Position</span>
        <button
          class="copy-btn"
          class:copied={copyFeedback === "Copied!"}
          onclick={copyCoordinates}
          title="Copy coordinates"
        >
          {#if copyFeedback === "Copied!"}
            <i class="fas fa-check" aria-hidden="true"></i>
          {:else}
            <i class="fas fa-copy" aria-hidden="true"></i>
          {/if}
        </button>
      </div>
      <div class="position-grid">
        <div class="coord">
          <span class="coord-label">X</span>
          <span class="coord-value">{currentPosition.x}</span>
        </div>
        <div class="coord">
          <span class="coord-label">Z</span>
          <span class="coord-value">{currentPosition.z}</span>
        </div>
        <div class="coord">
          <span class="coord-label">Yaw</span>
          <span class="coord-value">{displayYaw}°</span>
        </div>
      </div>
      <div class="mode-row">
        <span class="mode-badge" class:fly={isFlyMode} class:run={isRunning && !isFlyMode}>
          {isFlyMode ? "FLY" : isRunning ? "RUN" : "WALK"}
        </span>
        <span class="mode-keys">G fly · Shift run</span>
      </div>
    </div>
  {/if}

  <!-- First-person controls -->
  {#if isFirstPerson}
    {#if isMobile}
      <!-- Mobile: Exit button -->
      <button class="exit-fp-btn" onclick={exitFirstPersonMobile}>
        <i class="fas fa-expand" aria-hidden="true"></i>
        <span>Orbit View</span>
      </button>

      <!-- Mobile: Virtual joystick and controls -->
      <div class="mobile-controls">
        <!-- Joystick (left side) -->
        <div class="joystick-area">
          <div class="joystick-base" bind:this={joystickBase}>
            <div class="joystick-knob" bind:this={joystickKnob}></div>
          </div>
          <span class="joystick-label">Move</span>
        </div>

        <!-- Look hint (right side) -->
        <div class="look-hint">
          <i class="fas fa-hand-pointer" aria-hidden="true"></i>
          <span>Drag to look</span>
        </div>
      </div>
    {:else}
      <!-- Desktop: Show hint if pointer not locked -->
      {#if !document.pointerLockElement}
        <div class="click-to-look">
          <p>Click to enable mouse look</p>
        </div>
      {/if}
      <!-- Desktop: Keyboard hints (bottom) -->
      <div class="fp-overlay">
        <div class="fp-controls">
          <p><strong>WASD</strong> move • <strong>Space</strong> jump • <strong>ESC</strong> release mouse</p>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .hannons-camp {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #1a1a2e;
    /* Create stacking context above parent's return-hint */
    z-index: 1;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Location badge (top-left) */
  .location-badge {
    position: absolute;
    top: 16px;
    left: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 8px;
    border: 1px solid rgba(249, 115, 22, 0.5);
    color: white;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    font-weight: 600;
    pointer-events: none;
    z-index: 200;
  }

  .location-badge i {
    color: #f97316;
    font-size: 16px;
  }

  .loading-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: 12px;
    padding-left: 12px;
    border-left: 1px solid rgba(255, 255, 255, 0.2);
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 400;
  }

  .loading-indicator i {
    color: #60a5fa;
    font-size: 12px;
  }

  .texture-error {
    position: absolute;
    top: 70px;
    left: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 6px;
    color: #fca5a5;
    font-size: 12px;
    z-index: 200;
  }

  .texture-error i {
    color: #f97316;
  }

  /* View mode toggle (top-right) */
  .view-mode-toggle {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    gap: 4px;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 4px;
    z-index: 200;
  }

  .mode-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .mode-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
  }

  .mode-btn.active {
    background: rgba(249, 115, 22, 0.2);
    color: #f97316;
  }

  /* Overhead mode panel */
  .overhead-panel {
    position: absolute;
    top: 70px;
    right: 16px;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 14px;
    font-family: system-ui, sans-serif;
    z-index: 200;
    max-width: 220px;
  }

  .overhead-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    color: white;
    font-weight: 600;
    font-size: 14px;
  }

  .overhead-header i {
    color: #60a5fa;
  }

  .overhead-hint {
    margin: 0 0 12px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.5;
  }

  .overhead-hint strong {
    color: rgba(255, 255, 255, 0.8);
  }

  /* Boundary status */
  .boundary-status {
    margin-bottom: 10px;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .status-badge.empty {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.6);
  }

  .status-badge.open {
    background: rgba(249, 115, 22, 0.15);
    color: #f97316;
  }

  .status-badge.closed {
    background: rgba(74, 222, 128, 0.15);
    color: #4ade80;
  }

  /* Boundary actions */
  .boundary-actions {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .boundary-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .boundary-btn.close {
    background: rgba(74, 222, 128, 0.15);
    border: 1px solid rgba(74, 222, 128, 0.3);
    color: #4ade80;
  }

  .boundary-btn.close:hover {
    background: rgba(74, 222, 128, 0.25);
    border-color: rgba(74, 222, 128, 0.5);
  }

  .boundary-btn.clear {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  .boundary-btn.clear:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .divider {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    margin: 12px 0;
  }

  .overhead-action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px;
    background: rgba(249, 115, 22, 0.15);
    border: 1px solid rgba(249, 115, 22, 0.3);
    border-radius: 6px;
    color: #f97316;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .overhead-action:hover {
    background: rgba(249, 115, 22, 0.25);
    border-color: rgba(249, 115, 22, 0.5);
  }

  /* Dev panel (position + mode) */
  .dev-panel {
    position: absolute;
    top: 60px;
    left: 16px;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 12px;
    font-family: system-ui, sans-serif;
    z-index: 200;
    min-width: 140px;
  }

  .dev-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .dev-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.5);
  }

  .copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .copy-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.8);
  }

  .copy-btn.copied {
    background: rgba(74, 222, 128, 0.15);
    border-color: rgba(74, 222, 128, 0.4);
    color: #4ade80;
  }

  .position-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 10px;
  }

  .coord {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .coord-label {
    font-size: 10px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.35);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .coord-value {
    font-size: 13px;
    font-weight: 600;
    font-family: "SF Mono", Monaco, monospace;
    color: rgba(255, 255, 255, 0.9);
  }

  .mode-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .mode-badge {
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: rgba(74, 222, 128, 0.15);
    color: #4ade80;
    border: 1px solid rgba(74, 222, 128, 0.3);
  }

  .mode-badge.run {
    background: rgba(251, 191, 36, 0.15);
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.3);
  }

  .mode-badge.fly {
    background: rgba(96, 165, 250, 0.15);
    color: #60a5fa;
    border-color: rgba(96, 165, 250, 0.3);
  }

  .mode-keys {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.3);
  }

  /* Click to enable mouse look (desktop) */
  .click-to-look {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    padding: 16px 24px;
    border-radius: 8px;
    pointer-events: none;
    z-index: 200;
  }

  .click-to-look p {
    margin: 0;
    color: rgba(255, 255, 255, 0.8);
    font-size: 14px;
  }

  /* First-person overlay */
  .fp-overlay {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 200;
  }

  .fp-controls {
    background: rgba(0, 0, 0, 0.7);
    padding: 12px 20px;
    border-radius: 8px;
    text-align: center;
  }

  .fp-controls p {
    margin: 4px 0;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
  }

  .fp-controls strong {
    color: #f97316;
  }

  /* Mobile controls */
  .mobile-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    padding: 20px;
    pointer-events: none;
    z-index: 200;
  }

  .joystick-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: auto;
  }

  .joystick-base {
    width: 100px;
    height: 100px;
    background: rgba(255, 255, 255, 0.15);
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
  }

  .joystick-knob {
    width: 40px;
    height: 40px;
    background: rgba(249, 115, 22, 0.8);
    border: 2px solid #f97316;
    border-radius: 50%;
    transition: transform 0.05s ease-out;
  }

  .joystick-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .look-hint {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px;
    color: rgba(255, 255, 255, 0.5);
  }

  .look-hint i {
    font-size: 24px;
  }

  .look-hint span {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .exit-fp-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: rgba(0, 0, 0, 0.8);
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 12px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    z-index: 200;
  }

  .exit-fp-btn i {
    font-size: 16px;
    color: #f97316;
  }

  .exit-fp-btn:active {
    background: rgba(249, 115, 22, 0.2);
    border-color: #f97316;
  }
</style>
