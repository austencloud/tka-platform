<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import {
    MathUtils,
    Vector3,
    Quaternion,
    Euler,
    Object3D,
    BoxGeometry,
    CylinderGeometry,
    MeshStandardMaterial,
    InstancedMesh,
    TextureLoader,
    RepeatWrapping,
    FogExp2,
    Color,
  } from "three";
  import type { Texture } from "three";
  import type { PerspectiveCamera } from "three";
  import MuseumPostProcessing from "./MuseumPostProcessing.svelte";
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
  import MuseumPortal from "./MuseumPortal.svelte";
  import MuseumTorchLight from "./MuseumTorchLight.svelte";
  import MuseumPlaque3D from "./MuseumPlaque3D.svelte";
  import type { PlaqueContent, PlaqueSize } from "../../services/contracts/IPlaqueTextureGenerator";
  import { PlaqueTextureGenerator } from "../../services/implementations/PlaqueTextureGenerator";

  // Shared texture generator — one instance for all plaques (caches internally)
  const plaqueGenerator = new PlaqueTextureGenerator();

  // Scene reference for fog control — scene may not be available at init,
  // so we defer fog setup to the first frame via $effect
  const threlteCtx = useThrelte();
  const sceneFog = new FogExp2("#1a1008", 0.08);
  $effect(() => {
    const sc = (threlteCtx as any).scene?.current ?? (threlteCtx as any).scene;
    if (sc && sc.fog !== sceneFog) sc.fog = sceneFog;
  });

  // Track current wing for ambient/fog transitions
  let currentWingTheme: WingTheme | null = $state(null);
  const fogColorTarget = new Color("#1a1008");
  const fogColorCurrent = new Color("#1a1008");
  let fogDensityTarget = 0.08;
  const FOG_LERP_SPEED = 2.0; // Speed of fog color/density transition

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
    /** Called once on the first rendered frame — signals the 3D scene is interactive */
    onReady?: () => void;
  }

  let {
    grid, flipRequested, heldKeys = new Set(), topDownHeight = 12, onPlayerUpdate,
    initialFpsActive = false, initialPlayerPos, initialPlayerYaw, resetRequested = 0,
    onReady,
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

  // ── Per-wing fog settings — density and color vary by atmosphere ──
  const WING_FOG: Record<WingTheme, { density: number; color: string }> = {
    cave:          { density: 0.12, color: "#1a1008" },   // thick warm amber — firelit cavern
    classical:     { density: 0.06, color: "#1a1510" },   // light warm haze — oil lamp warmth
    renaissance:   { density: 0.05, color: "#14120e" },   // gentle mist — studio atmosphere
    industrial:    { density: 0.07, color: "#141414" },   // sooty grey — gas lamp era
    digital:       { density: 0.08, color: "#0a0a14" },   // cold blue haze — CRT glow
    institutional: { density: 0.06, color: "#121218" },   // sterile — fluorescent buzz
    gallery:       { density: 0.04, color: "#0e0a10" },   // minimal — let spotlights do the work
    modern:        { density: 0.05, color: "#0a0a0a" },   // near-dark — dramatic
    futuristic:    { density: 0.05, color: "#0a0a10" },   // cool darkness
    outdoor:       { density: 0.02, color: "#1a2010" },   // light — open air feeling
    construction:  { density: 0.08, color: "#14120a" },   // dusty — construction site
    retail:        { density: 0.04, color: "#141210" },   // light — gift shop clarity
  };

  // ── Per-wing ambient light tint — each wing gets a distinct atmosphere ──
  const WING_AMBIENT: Record<WingTheme, { color: string; intensity: number }> = {
    cave:          { color: "#8a6030", intensity: 0.45 },  // deep amber — torch-warmed stone
    classical:     { color: "#a08050", intensity: 0.55 },  // golden — oil lamp warmth
    renaissance:   { color: "#907050", intensity: 0.55 },  // warm wood tones
    industrial:    { color: "#808080", intensity: 0.5 },   // neutral grey — gas lamps
    digital:       { color: "#4060a0", intensity: 0.5 },   // cool blue — CRT screens
    institutional: { color: "#8090a0", intensity: 0.55 },  // cold fluorescent
    gallery:       { color: "#a09080", intensity: 0.5 },   // warm neutral — spotlight room
    modern:        { color: "#606060", intensity: 0.45 },  // minimal
    futuristic:    { color: "#506080", intensity: 0.45 },  // cool
    outdoor:       { color: "#90a080", intensity: 0.65 },  // natural daylight tint
    construction:  { color: "#908060", intensity: 0.5 },   // dusty warm
    retail:        { color: "#a09080", intensity: 0.55 },  // commercial warm
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

    // No fade-in needed — loading gate holds everything behind an opaque
    // overlay until all assets are loaded. Scene appears fully textured.
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

  // ── Portal pair positions (cave ↔ gallery) ──
  const portalCaveWing = grid.wings.find(w => w.theme === "cave");
  const portalGalleryWing = grid.wings.find(w => w.theme === "gallery");
  // Blue: WEST wall of cave, centered vertically. Faces east (into room).
  // Cave corridors are on south and east walls — west wall is solid.
  // Wall tile center is at bounds.x * TILE_SIZE. Wall box is TILE_SIZE wide.
  // Inner face (facing east into room) is at bounds.x * TILE_SIZE + TILE_SIZE/2.
  // Place portal flush on that inner face.
  const portalBluePos: [number, number, number] = portalCaveWing
    ? [
        portalCaveWing.bounds.x * TILE_SIZE + TILE_SIZE / 2,  // inner face of west wall
        1.5,
        (portalCaveWing.bounds.y + portalCaveWing.bounds.height / 2) * TILE_SIZE,
      ]
    : [0, 0, 0];
  const portalBlueRot: [number, number, number] = [0, Math.PI / 2, 0]; // faces east

  const portalOrangePos: [number, number, number] = portalGalleryWing
    ? [
        portalGalleryWing.bounds.x * TILE_SIZE + TILE_SIZE / 2,  // inner face of west wall
        1.5,
        (portalGalleryWing.bounds.y + portalGalleryWing.bounds.height / 2) * TILE_SIZE,
      ]
    : [0, 0, 0];
  const portalOrangeRot: [number, number, number] = [0, Math.PI / 2, 0]; // faces east

  // ── Portal teleportation ──
  // Arrive 3 tiles INSIDE the target room (north of its portal wall)
  const PORTAL_RADIUS = 1.0;
  const PORTAL_COOLDOWN_MS = 1500;
  const ARRIVAL_OFFSET = 3 * TILE_SIZE;
  let portalCooldownUntil = 0;

  interface PortalLink { srcX: number; srcZ: number; destX: number; destZ: number; destYaw: number; }

  // destYaw: In UCC, yaw=0 → camera looks along +Z (south). yaw=Math.PI → looks along -Z (north).
  // Portal is on the south wall. Player arrives north of it, should face NORTH (deeper into room) = -Z = yaw Math.PI.
  // BUT: the player walks INTO the portal heading south (+Z), so they should EXIT heading north (-Z).
  // UCC yaw convention: sin(yaw) for X, cos(yaw) for Z. yaw=0 → (0,1) = +Z = south.
  // To face -Z (north, into the room): yaw = Math.PI.
  // WAIT — screenshot shows they're facing the portal (south). So Math.PI is producing south-facing.
  // Let's try yaw=0 which should face +Z... no that's also south.
  // The issue: the ARRIVAL position is NORTH of the portal (destZ - offset = more negative Z).
  // "Into the room" from that position means FURTHER north = more negative Z = yaw = Math.PI.
  // But the screenshot shows facing south (toward the portal). So playerYaw isn't being applied
  // to the camera — only to the avatar. The FPS camera yaw is separate (managed by UCC).
  // We need to update UCC's internal yaw too, not just playerYaw.
  // Portals on west wall face east. Arrive east of portal (inside room), facing east.
  // UCC yaw: sin(yaw) = X component, cos(yaw) = Z component.
  // East = +X direction → yaw = π/2 (sin(π/2)=1, cos(π/2)=0)
  const PORTAL_DEST_YAW = Math.PI / 2;
  const portalPairs: PortalLink[] =
    portalCaveWing && portalGalleryWing
      ? [
          { srcX: portalBluePos[0], srcZ: portalBluePos[2],
            destX: portalOrangePos[0] + ARRIVAL_OFFSET, destZ: portalOrangePos[2],
            destYaw: PORTAL_DEST_YAW },
          { srcX: portalOrangePos[0], srcZ: portalOrangePos[2],
            destX: portalBluePos[0] + ARRIVAL_OFFSET, destZ: portalBluePos[2],
            destYaw: PORTAL_DEST_YAW },
        ]
      : [];

  /**
   * Check if the player is standing inside a portal and teleport them to
   * the linked destination. Returns true if a teleport happened.
   */
  function checkPortalProximity(playerX: number, playerZ: number): boolean {
    if (portalPairs.length === 0) return false;

    const now = performance.now();
    if (now < portalCooldownUntil) return false;

    const r2 = PORTAL_RADIUS * PORTAL_RADIUS;
    for (const link of portalPairs) {
      const dx = playerX - link.srcX;
      const dz = playerZ - link.srcZ;
      if (dx * dx + dz * dz < r2) {
        physicsProvider.teleport!({ x: link.destX, y: 0, z: link.destZ });
        syncPositionFromPhysics();
        // Set facing for both avatar and camera
        playerYaw = link.destYaw;
        targetPlayerYaw = link.destYaw;
        // Force UCC to remount with new yaw by updating the initial snapshot
        fpsInitialYaw = link.destYaw;
        fpsInitialPitch = 0;
        // Brief unmount/remount of UCC to apply new yaw
        fpsActive = false;
        requestAnimationFrame(() => {
          fpsActive = true;
          progress = 1; // Skip flip animation — go straight to FPS
        });
        portalCooldownUntil = now + PORTAL_COOLDOWN_MS;
        return true;
      }
    }
    return false;
  }

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

  // Track the user's preferred 3D camera mode so flipping back to 3D restores it.
  // Default to first-person; updated whenever the user presses V to switch modes.
  // Persisted to sessionStorage so it survives HMR remounts.
  const CAMERA_MODE_HMR_KEY = "museum-last-camera-mode";
  function loadLastCameraMode(): CameraMode {
    try {
      const raw = sessionStorage.getItem(CAMERA_MODE_HMR_KEY);
      if (raw === "THIRD_PERSON") return CameraMode.THIRD_PERSON;
    } catch { /* sessionStorage unavailable */ }
    return CameraMode.FIRST_PERSON;
  }
  let lastCameraMode: CameraMode = $state(loadLastCameraMode());

  // Avatar state for UnifiedCameraController (follows the established pattern)
  // Yaw and pitch persist across flip cycles so the player's view direction is restored.
  let playerYaw = $state(initialPlayerYaw ?? 0);
  let targetPlayerYaw = $state(initialPlayerYaw ?? 0);
  let playerPitch = $state(0);

  // Snapshot of yaw/pitch at the moment we enter FPS mode.
  // Passed as initialYaw/initialPitch to UCC — these must NOT update while UCC is mounted,
  // or UCC's $effect.pre will reset yaw/pitch every frame, creating a feedback loop.
  let fpsInitialYaw = $state(initialPlayerYaw ?? 0);
  let fpsInitialPitch = $state(0);
  let isMoving = $state(false);
  let moveDir = $state({ x: 0, z: 0 });
  let playerPosition = $state({ x: spawnWorldX, y: 0, z: spawnWorldZ });
  const ROTATION_SPEED = 12;

  const avatarState: AvatarState = {
    get position() { return playerPosition; },
    get facingAngle() { return playerYaw; },
    get isMoving() { return isMoving; },
    get moveDirection() { return moveDir; },
    setMoveInput(input: { x: number; z: number }) {
      moveDir = input;
      isMoving = input.x !== 0 || input.z !== 0;
    },
    updateMovement(_delta: number, _cameraAngle: number) {
      // Handled by physics provider
    },
    setFacingAngle(angle: number) { targetPlayerYaw = angle; },
    snapFacingAngle(angle: number) {
      playerYaw = angle;
      targetPlayerYaw = angle;
    },
    updateLocomotion(delta: number) {
      let diff = targetPlayerYaw - playerYaw;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      if (Math.abs(diff) < 0.01) {
        playerYaw = targetPlayerYaw;
      } else {
        const maxStep = ROTATION_SPEED * delta;
        playerYaw += Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
      }
    },
  };

  // Physics provider for grid-based wall collision
  const physicsProvider: PhysicsProvider = createMuseumPhysicsProvider(
    grid,
    TILE_SIZE,
    { x: spawnWorldX, y: 0, z: spawnWorldZ }
  );

  // Initialize FPS target at spawn (must be after physicsProvider is created)
  syncFpsFromPlayer();

  // ── Atmospheric updates: fog and ambient light smoothly transition per wing ──
  // Ambient light reference — we'll update its color/intensity per frame
  let ambientLightRef: { color: Color; intensity: number } | null = null;

  function updateAtmosphere(tileX: number, tileZ: number, delta: number): void {
    const theme = getWingThemeAt(tileX, tileZ);

    if (theme && theme !== currentWingTheme) {
      currentWingTheme = theme;
      const fogCfg = WING_FOG[theme];
      fogColorTarget.set(fogCfg.color);
      fogDensityTarget = fogCfg.density;
    }

    // Smoothly lerp fog color and density toward targets
    fogColorCurrent.lerp(fogColorTarget, FOG_LERP_SPEED * delta);
    sceneFog.color.copy(fogColorCurrent);
    sceneFog.density += (fogDensityTarget - sceneFog.density) * FOG_LERP_SPEED * delta;
  }

  // ── Flip animation loop ──
  // When fpsActive, UnifiedCameraController owns the camera — we don't touch it.
  useTask((delta) => {
    if (!camera) return;

    // First frame: initialize camera
    if (!initialized) {
      initialized = true;
      if (initialFpsActive) {
        // HMR restore: go straight to FPS — skip top-down and flip animation
        cameraPreferences.setModeForDestination("museum", lastCameraMode);
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
      onReady?.();
      return;
    }

    // If FPS mode is active, UCC owns the camera — skip everything
    if (fpsActive) {
      // Still report player position to parent for interaction detection
      const fpsPos = physicsProvider.getPlayerPosition();
      // Void recovery in FPS mode too
      const fpsTileKey = `${Math.round(fpsPos.x / TILE_SIZE)},${Math.round(fpsPos.z / TILE_SIZE)}`;
      if (!grid.tiles.has(fpsTileKey)) {
        const spawnX = grid.spawn.x * TILE_SIZE;
        const spawnZ = grid.spawn.y * TILE_SIZE;
        physicsProvider.teleport!({ x: spawnX, y: 0, z: spawnZ });
        const corrected = physicsProvider.getPlayerPosition();
        fpsPos.x = corrected.x;
        fpsPos.y = corrected.y;
        fpsPos.z = corrected.z;
      }
      // Portal teleportation check — if the player walked into a portal, jump to dest
      if (checkPortalProximity(fpsPos.x, fpsPos.z)) {
        const teleported = physicsProvider.getPlayerPosition();
        fpsPos.x = teleported.x;
        fpsPos.y = teleported.y;
        fpsPos.z = teleported.z;
      }

      const fpsTileX = Math.round(fpsPos.x / TILE_SIZE);
      const fpsTileZ = Math.round(fpsPos.z / TILE_SIZE);
      updateAtmosphere(fpsTileX, fpsTileZ, delta);
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

      // If the player ended up in void (no tile at their position), teleport to spawn.
      // This recovers from stale HMR restores or any physics edge case that escapes bounds.
      const currentTileKey = `${Math.round(pos.x / TILE_SIZE)},${Math.round(pos.z / TILE_SIZE)}`;
      if (!grid.tiles.has(currentTileKey)) {
        const spawnX = grid.spawn.x * TILE_SIZE;
        const spawnZ = grid.spawn.y * TILE_SIZE;
        physicsProvider.teleport!({ x: spawnX, y: 0, z: spawnZ });
        const corrected = physicsProvider.getPlayerPosition();
        pos.x = corrected.x;
        pos.y = corrected.y;
        pos.z = corrected.z;
      }

      // Portal teleportation check — walk into a portal, appear at the linked one
      if (checkPortalProximity(pos.x, pos.z)) {
        const teleported = physicsProvider.getPlayerPosition();
        pos.x = teleported.x;
        pos.y = teleported.y;
        pos.z = teleported.z;
      }

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
      updateAtmosphere(tileX, tileZ, delta);
      onPlayerUpdate?.(pos.x, pos.z, tileX, tileZ, yawToFacing(playerYaw), false, playerYaw);
      return;
    }

    // ── Flip animation ──
    const step = delta / DURATION;
    if (goingDown) {
      progress = Math.min(progress + step, 1);
      if (progress >= 1) {
        animating = false;
        // Restore the user's last 3D mode (first-person or third-person) before UCC mounts
        cameraPreferences.setModeForDestination("museum", lastCameraMode);
        // Snapshot yaw/pitch ONCE for UCC's initialYaw/initialPitch.
        // Do NOT pass live playerYaw — it creates a feedback loop with $effect.pre.
        fpsInitialYaw = playerYaw;
        fpsInitialPitch = playerPitch;
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

  // ── MCP Game Bridge (lets Claude walk around the museum) ──
  let gameBridgeInitialized = false;

  $effect(() => {
    if (typeof window === "undefined" || !import.meta.env.DEV) return;
    if (gameBridgeInitialized) return;
    gameBridgeInitialized = true;

    import("$lib/shared/3d/debug/game-bridge").then(async ({ initGameBridge }) => {
      const bridge = initGameBridge({
        physics: {
          getPlayerPosition: () => physicsProvider?.getPlayerPosition() ?? null,
          getPlayerVelocity: () => physicsProvider?.getVelocity() ?? { x: 0, y: 0, z: 0 },
          isGrounded: () => physicsProvider?.isGrounded() ?? false,
          movePlayer: (movement, deltaTime) => physicsProvider?.movePlayer(movement, deltaTime),
          teleportPlayer: (position) => physicsProvider?.teleport?.(position),
          raycast: (_origin, _direction, _maxDistance) => ({ hit: false }),
        },
        camera: {
          getMode: () => fpsActive
            ? (lastCameraMode === CameraMode.THIRD_PERSON ? "third_person" : "first_person")
            : "orbit",
          setMode: (mode: string) => {
            if (mode === "first_person") {
              lastCameraMode = CameraMode.FIRST_PERSON;
              if (!fpsActive) { fpsActive = true; }
            } else if (mode === "third_person") {
              lastCameraMode = CameraMode.THIRD_PERSON;
              if (!fpsActive) { fpsActive = true; }
            } else if (mode === "orbit" && fpsActive) {
              fpsActive = false;
            }
          },
          getYaw: () => playerYaw,
          getPitch: () => playerPitch,
          setYaw: (yaw: number) => { playerYaw = yaw; },
          setPitch: (_pitch: number) => { /* UCC manages pitch internally */ },
        },
        playback: {
          getPerformerManager: () => null,
          getSpeed: () => 1,
          setSpeed: () => {},
        },
      }, { debug: true });

      try {
        await bridge.connect();
        console.log("[Museum3DScene] MCP Game Bridge connected");
      } catch {
        console.log("[Museum3DScene] MCP Game Bridge not available (run the MCP server to enable)");
      }
    });

    return () => {
      import("$lib/shared/3d/debug/game-bridge").then(({ destroyGameBridge }) => {
        destroyGameBridge();
      });
    };
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
  interface PlaquePlacement {
    worldX: number;
    worldZ: number;
    yaw: number;
    wallOffsetX: number;
    wallOffsetZ: number;
    content: PlaqueContent;
    size: PlaqueSize;
    refId: string;
  }

  // Rotation and wall-offset lookup per facing direction.
  // Each plaque faces INTO the room, mounted flush against its wall.
  const PLAQUE_YAW: Record<string, number> = {
    south: 0,                // on north wall, faces south
    north: Math.PI,          // on south wall, faces north
    east: Math.PI / 2,       // on west wall, faces east
    west: -Math.PI / 2,      // on east wall, faces west
  };
  // Shift the plaque toward its wall so it appears mounted, not floating
  const PLAQUE_WALL_SHIFT: Record<string, { x: number; z: number }> = {
    south: { x: 0, z: -TILE_SIZE * 0.4 },  // toward north wall
    north: { x: 0, z: TILE_SIZE * 0.4 },    // toward south wall
    east: { x: -TILE_SIZE * 0.4, z: 0 },    // toward west wall
    west: { x: TILE_SIZE * 0.4, z: 0 },     // toward east wall
  };

  const plaquePlacements: PlaquePlacement[] = [];
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
        // Look up exhibit definition for this tile to get plaque content and size
        const exhibitDef = grid.exhibits.find(e => e.tileX === tileX && e.tileY === tileY);
        const facing = tile.facing ?? "south";
        const plaqueContent: PlaqueContent = exhibitDef?.plaque ?? {
          title: exhibitDef?.id ?? "Exhibit",
          body: "This exhibit is under construction.",
        };
        const plaqueSize: PlaqueSize = exhibitDef?.size ?? "standard";
        const yaw = PLAQUE_YAW[facing] ?? 0;
        const wallShift = PLAQUE_WALL_SHIFT[facing] ?? { x: 0, z: 0 };
        plaquePlacements.push({
          worldX,
          worldZ,
          yaw,
          wallOffsetX: wallShift.x,
          wallOffsetZ: wallShift.z,
          content: plaqueContent,
          size: plaqueSize,
          refId: exhibitDef?.id ?? `exhibit-${tileX}-${tileY}`,
        });
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
  const performerGeo = new CylinderGeometry(TILE_SIZE * 0.2, TILE_SIZE * 0.2, 0.5, 8);
  const pedestalGeo = new BoxGeometry(TILE_SIZE * 0.7, 0.5, TILE_SIZE * 0.7);
  const signGeo = new BoxGeometry(TILE_SIZE * 0.6, 0.4, 0.06);
  // Torch sphere geo removed — torches now use MuseumTorch3D with full flame shader

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

  // Exhibit spot lighting — populated from plaque placements
  const exhibitLightPositions: { x: number; z: number }[] = plaquePlacements.map(p => ({
    x: p.worldX,
    z: p.worldZ,
  }));
  const useSpotLights = plaquePlacements.length > 0 && plaquePlacements.length < 20;

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

  // Torch point light budget — each MuseumTorch3D has its own point light,
  // so we limit to MAX_POINT_LIGHTS torches with lights, rest get visuals only
  const MAX_POINT_LIGHTS = 32;
  const torchesWithLight = torchPositions.length <= MAX_POINT_LIGHTS
    ? torchPositions
    : (() => {
        const selected: { x: number; z: number }[] = [];
        const step = torchPositions.length / MAX_POINT_LIGHTS;
        for (let i = 0; i < MAX_POINT_LIGHTS; i++) {
          selected.push(torchPositions[Math.floor(i * step)]!);
        }
        return selected;
      })();
  const torchLightSet = new Set(torchesWithLight.map(t => `${t.x},${t.z}`));
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
{:else if lastCameraMode === CameraMode.THIRD_PERSON}
  <!-- Player avatar (only in third-person — hidden in first-person to avoid seeing own body) -->
  <Avatar3D
    id="museum-player"
    bluePropState={null}
    redPropState={null}
    position={{ x: playerPosition.x, y: 0.001, z: playerPosition.z }}
    facingAngle={playerYaw}
    isActive={false}
    isMoving={isMoving}
    moveDirection={moveDir}
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
    initialYaw={fpsInitialYaw}
    initialPitch={fpsInitialPitch}
    allowedModes={[CameraMode.FIRST_PERSON, CameraMode.THIRD_PERSON]}
    onModeChange={(mode) => {
      // Remember the user's preferred 3D mode so flipping back from 2D restores it.
      if (mode === CameraMode.FIRST_PERSON || mode === CameraMode.THIRD_PERSON) {
        lastCameraMode = mode;
        try {
          sessionStorage.setItem(CAMERA_MODE_HMR_KEY, mode === CameraMode.THIRD_PERSON ? "THIRD_PERSON" : "FIRST_PERSON");
        } catch { /* non-critical */ }
      }
    }}
    onRotationChange={(newYaw, newPitch) => {
      playerYaw = newYaw;
      playerPitch = newPitch;
    }}
  />
{/if}

<!-- Post-processing: bloom, vignette, ACES tone mapping -->
<MuseumPostProcessing />

<!-- Lighting — per-wing ambient tint smoothly transitions as player moves -->
<T.AmbientLight
  intensity={currentWingTheme ? WING_AMBIENT[currentWingTheme].intensity : 0.4}
  color={currentWingTheme ? WING_AMBIENT[currentWingTheme].color : "#c8b890"}
/>
<T.DirectionalLight
  intensity={0.75}
  position={[gridCenterX, 30, gridCenterZ]}
  color="#fff0d0"
/>
<T.HemisphereLight
  intensity={0.35}
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

<!-- Exhibit plaques: individually textured with readable content -->
{#each plaquePlacements as plaque (plaque.refId)}
  <MuseumPlaque3D
    worldX={plaque.worldX}
    worldZ={plaque.worldZ}
    yaw={plaque.yaw}
    wallOffsetX={plaque.wallOffsetX}
    wallOffsetZ={plaque.wallOffsetZ}
    content={plaque.content}
    size={plaque.size}
    refId={plaque.refId}
    generator={plaqueGenerator}
  />
{/each}
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
    showGrid={true}
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

<!-- Torch point lights — animated flicker for firelit atmosphere -->
{#each torchPositions as torch}
  <MuseumTorchLight x={torch.x} z={torch.z} />
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

<!-- Portal pair — blue in cave, orange in gallery. Each shows the other room. -->
{#if portalCaveWing && portalGalleryWing}
  <MuseumPortal
    position={portalBluePos}
    rotation={portalBlueRot}
    destPosition={portalOrangePos}
    destRotation={portalOrangeRot}
    color="#0088ff"
    label="Gallery"
  />
  <MuseumPortal
    position={portalOrangePos}
    rotation={portalOrangeRot}
    destPosition={portalBluePos}
    destRotation={portalBlueRot}
    color="#ff8800"
    label="Cave"
  />
{/if}
