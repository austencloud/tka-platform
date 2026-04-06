<script lang="ts">
  import { untrack } from "svelte";
  import { T, useTask, useThrelte } from "@threlte/core";
  import { PCFSoftShadowMap } from "three";
  import {
    MathUtils,
    Vector3,
    Quaternion,
    Euler,
    FogExp2,
    Color,
    Object3D,
  } from "three";
  import type { BatchedMesh, PerspectiveCamera } from "three";
  import MuseumPostProcessing from "./MuseumPostProcessing.svelte";
  import type { MuseumGrid } from "../../domain/museum-grid-types";
  import { tileKey } from "../../domain/museum-grid-types";
  import type { AvatarState, PhysicsProvider } from "$lib/shared/3d/camera/types";
  import { CameraMode } from "$lib/shared/3d/camera/types";
  import UnifiedCameraController from "$lib/shared/3d/camera/UnifiedCameraController.svelte";
  import { createMuseumPhysicsProvider, MuseumPhysicsProvider } from "../../services/implementations/MuseumPhysicsProvider";
  import { cameraPreferences } from "$lib/shared/3d/camera/camera-preferences.svelte";
  import MuseumFurniture from "./MuseumFurniture.svelte";
  import MuseumPerformerStation3D from "./MuseumPerformerStation3D.svelte";
  import TelekineticFormation3D from "./TelekineticFormation3D.svelte";
  import Avatar3D from "$lib/shared/3d/components/Avatar3D.svelte";
  import MuseumMirror from "./MuseumMirror.svelte";
  import MuseumPortal from "./MuseumPortal.svelte";
  import MuseumTorch3D from "./MuseumTorch3D.svelte";
  import { TorchMaterialCache } from "../../services/implementations/TorchMaterialCache";
  import { FIXTURE_REGISTRY } from "../../domain/fixture-registry";
  import MuseumPlaque3D from "./MuseumPlaque3D.svelte";
  import MuseumSceneEditor from "./MuseumSceneEditor.svelte";
  import PlacementPickerPanel from '../editor/PlacementPickerPanel.svelte';
  import PlacementGhost from '../editor/PlacementGhost.svelte';
  import { PlacementPersister } from '../../services/implementations/PlacementPersister';
  import { OrbitControls } from "@threlte/extras";
  import { museum3dEditorState } from "../../state/museum-3d-editor-state.svelte";
  import { museumEditorOverrides } from "../../state/museum-editor-overrides";
  import { ProximityGrid } from "../../services/implementations/ProximityGrid";
  import { PlaqueTextureGenerator } from "../../services/implementations/PlaqueTextureGenerator";
  import {
    bucketMuseumTilesByRoom,
    buildRoomChunk,
  } from "../../services/implementations/MuseumGeometryBuilder";
  import type {
    RoomChunk,
    BatchedMeshData,
    PlaquePlacement,
    TorchPosition,
    LightPosition,
    RoomLight,
  } from "../../services/implementations/MuseumGeometryBuilder";
  import { RoomStreamingManager } from "../../services/implementations/RoomStreamingManager";
  import { MUSEUM_EDGES } from "../../data/museum-room-graph";

  // Shared texture generator — one instance for all plaques (caches internally)
  const plaqueGenerator = new PlaqueTextureGenerator();
  const torchMaterialCache = new TorchMaterialCache();
  const placementPersister = new PlacementPersister();

  // Scene reference for fog control — scene may not be available at init,
  // so we defer fog setup to the first frame via $effect
  const threlteCtx = useThrelte();
  const sceneFog = new FogExp2("#1a1008", 0.08);
  $effect(() => {
    const sc = (threlteCtx as any).scene?.current ?? (threlteCtx as any).scene;
    if (sc && sc.fog !== sceneFog) sc.fog = sceneFog;
  });

  // Enable shadow maps on the renderer
  $effect(() => {
    const renderer = (threlteCtx as any).renderer?.current ?? (threlteCtx as any).renderer;
    if (renderer && !renderer.shadowMap.enabled) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFSoftShadowMap;
    }
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
    /** Increment to trigger instant first-person → third-person switch */
    modeChangeRequested?: number;
    /** Called once on the first rendered frame — signals the 3D scene is interactive */
    onReady?: () => void;
    /** Called when view mode changes between first-person and third-person */
    onViewModeChange?: (mode: "first-person" | "third-person") => void;
    /** Called during async geometry build with the current phase name */
    onBuildStage?: (stage: string) => void;
    /** Called when async geometry build completes — all meshes are ready to render */
    onGeometryReady?: () => void;
  }

  const props: Props = $props();

  // Resolve initial-value props as plain consts (used once at init, not reactive)
  const grid = props.grid;
  const initialFpsActive = props.initialFpsActive ?? false;
  const initialPlayerPos = props.initialPlayerPos;
  const initialPlayerYaw = props.initialPlayerYaw;
  const onReady = props.onReady;

  // ── Tile scale: each tile = 0.5m in world space ──
  const TILE_SIZE = 0.5;



  // ── Progressive mount: break heavy sub-components into stages so the
  // browser can paint between each batch. Without this, mounting all torches,
  // plaques, performers etc. in one frame blocks the main thread for ~6-9s.

  // ── Editor overrides: sync dragged world positions back into grid data ──
  // Bumping this counter triggers Svelte reactivity for performer/exhibit positions.
  let overrideVersion = $state(0);

  /**
   * Called by MuseumSceneEditor after any drag/undo/redo. Converts world-space
   * overrides back to tile coordinates and patches grid.performers / grid.exhibits
   * so the tile-based interaction system uses the new positions.
   */
  function applyEditorOverrides() {
    const allOverrides = museumEditorOverrides.getAll();

    for (const performer of grid.performers) {
      const override = allOverrides[`performer-station-${performer.id}`];
      if (override) {
        const oldKey = tileKey(performer.tileX, performer.tileY);
        const newTX = Math.round(override.x / TILE_SIZE);
        const newTY = Math.round(override.z / TILE_SIZE);
        const newKey = tileKey(newTX, newTY);

        // Move the interactable tile entry so the proximity check works
        if (oldKey !== newKey) {
          const oldTile = grid.tiles.get(oldKey);
          if (oldTile?.type === "performer-station") {
            grid.tiles.delete(oldKey);
            grid.tiles.set(newKey, { ...oldTile });
          }
        }

        performer.tileX = newTX;
        performer.tileY = newTY;
      }
    }

    for (const exhibit of grid.exhibits) {
      const override = allOverrides[`plaque-${exhibit.id}`];
      if (override) {
        const oldKey = tileKey(exhibit.tileX, exhibit.tileY);
        const newTX = Math.round(override.x / TILE_SIZE);
        const newTY = Math.round(override.z / TILE_SIZE);
        const newKey = tileKey(newTX, newTY);

        // Move the interactable tile entry
        if (oldKey !== newKey) {
          const oldTile = grid.tiles.get(oldKey);
          if (oldTile?.type === "exhibit-panel") {
            grid.tiles.delete(oldKey);
            grid.tiles.set(newKey, { ...oldTile, refId: exhibit.id });
          }
        }

        exhibit.tileX = newTX;
        exhibit.tileY = newTY;
      }
    }

    for (const furn of (grid.furniture ?? [])) {
      const override = allOverrides[`furniture-${furn.id}`];
      if (override) {
        furn.tileX = Math.round(override.x / TILE_SIZE);
        furn.tileY = Math.round(override.z / TILE_SIZE);
      }
    }

    // Sync imperative performer mesh instances to match editor overrides.
    // Uses performerMeshLookup (built at init) to find the right instance.
    const dummy = new Object3D();
    for (const performer of grid.performers) {
      const override = allOverrides[`performer-station-${performer.id}`];
      if (!override) continue;
      const entry = performerMeshLookup.get(performer.id);
      if (!entry) continue;
      dummy.position.set(override.x, 0.25, override.z);
      dummy.updateMatrix();
      entry.chunk.performerMesh!.setMatrixAt(entry.instanceIdx, dummy.matrix);
      entry.chunk.performerMesh!.instanceMatrix.needsUpdate = true;
    }

    // Bump version to trigger reactive re-reads of performer/exhibit positions
    overrideVersion++;
  }

  function handlePlace(worldX: number, worldZ: number, yaw: number, wallFacing: string | null): void {
    const def = museum3dEditorState.placementDef;
    if (!def) return;

    const tileX = Math.round(worldX / TILE_SIZE);
    const tileY = Math.round(worldZ / TILE_SIZE);
    const wing = grid.wings.find(w => {
      const b = w.bounds;
      return tileX >= b.x && tileX < b.x + b.width && tileY >= b.y && tileY < b.y + b.height;
    });
    const roomId = wing?.id ?? 'unknown';

    const placement = {
      id: `${roomId}-${def.id}-${Date.now()}`,
      objectDefId: def.id,
      tileX,
      tileY,
      wallFacing: wallFacing as any,
      yaw,
    };

    placementPersister.save(roomId, placement);
  }

  // Apply any persisted overrides on mount (from previous editor sessions).
  // Must use untrack: applyEditorOverrides reads+writes grid.performers/exhibits
  // which are reactive — without untrack this creates an infinite effect loop.
  let editorOverridesApplied = false;
  $effect(() => {
    if (editorOverridesApplied) return;
    editorOverridesApplied = true;
    untrack(() => {
      const all = museumEditorOverrides.getAll();
      if (Object.keys(all).length > 0) {
        applyEditorOverrides();
      }
    });
  });

  import type { WingTheme } from "../../domain/museum-grid-types";

  // ── Per-wing fog settings — density and color vary by atmosphere ──
  const WING_FOG: Record<WingTheme, { density: number; color: string }> = {
    cave:          { density: 0.06, color: "#1a1008" },   // warm amber haze
    classical:     { density: 0.03, color: "#1a1510" },   // light warm
    renaissance:   { density: 0.03, color: "#14120e" },   // gentle
    industrial:    { density: 0.04, color: "#141414" },   // slight grey
    digital:       { density: 0.04, color: "#0a0a14" },   // cool blue hint
    institutional: { density: 0.02, color: "#606068" },   // light grey haze — fluorescent wash
    gallery:       { density: 0.02, color: "#0e0a10" },   // minimal
    modern:        { density: 0.03, color: "#0a0a0a" },   // slight
    futuristic:    { density: 0.03, color: "#0a0a10" },   // slight cool
    outdoor:       { density: 0.008, color: "#2a2418" },  // warm haze, nearly clear
    construction:  { density: 0.04, color: "#14120a" },   // dusty
    retail:        { density: 0.02, color: "#141210" },   // clear
  };

  // Wall height — used for ceiling light placement in the template
  const WALL_HEIGHT = 4.5;

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
  let currentTopDownHeight = props.topDownHeight ?? 12;
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
  const DURATION = 0.8;
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
  let isCrouching = $state(false);
  let playerSpeed = $state(0);
  let moveDir = $state({ x: 0, z: 0 });
  let playerPosition = $state({ x: spawnWorldX, y: 0, z: spawnWorldZ });
  let playerGrounded = $state(true);
  let playerVerticalVelocity = $state(0);
  let playerJumpRequested = $state(false);

  // Detect jump input on the EXACT frame Space is pressed — no physics delay.
  // The UCC processes the same keypress for physics; we just need the signal
  // to reach the animation state machine on the same frame.
  $effect(() => {
    function onJumpKey(e: KeyboardEvent) {
      if (e.code === "Space" && fpsActive && playerGrounded) {
        playerJumpRequested = true;
        // Clear after one full animation frame so Avatar3D's update loop reads it
        requestAnimationFrame(() => { playerJumpRequested = false; });
      }
    }
    window.addEventListener("keydown", onJumpKey);
    return () => window.removeEventListener("keydown", onJumpKey);
  });
  const ROTATION_SPEED = 12;

  const avatarState: AvatarState = {
    get position() { return playerPosition; },
    get facingAngle() { return playerYaw; },
    get isMoving() { return isMoving; },
    get isCrouching() { return isCrouching; },
    set isCrouching(v: boolean) { isCrouching = v; },
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
  const physicsProvider = createMuseumPhysicsProvider(
    grid,
    TILE_SIZE,
    { x: spawnWorldX, y: 0, z: spawnWorldZ }
  ) as MuseumPhysicsProvider;

  // Root motion disabled — code-driven movement for responsive controls.
  // The root motion infrastructure is preserved for future A/B testing.
  // To re-enable: set rootMotionEnabled = fpsActive and enableRootMotion={true} on Avatar3D.

  // Initialize FPS target at spawn (must be after physicsProvider is created)
  syncFpsFromPlayer();

  // Simple wing theme lookup — used once per frame for atmosphere transitions.
  // Not performance-critical (the hot path tile→theme lookup is in MuseumGeometryBuilder).
  function getWingThemeAt(tileX: number, tileY: number): WingTheme | null {
    for (const wing of grid.wings) {
      const b = wing.bounds;
      if (tileX >= b.x && tileX < b.x + b.width && tileY >= b.y && tileY < b.y + b.height) {
        return wing.theme;
      }
    }
    return null;
  }

  // ── Atmospheric updates: fog smoothly transitions per wing ──
  // (Ambient light is now per-room static PointLights from the geometry builder)

  function updateAtmosphere(tileX: number, tileZ: number, delta: number): void {
    const theme = getWingThemeAt(tileX, tileZ);

    if (theme && theme !== currentWingTheme) {
      currentWingTheme = theme;
      const fogCfg = WING_FOG[theme];
      fogColorTarget.set(fogCfg.color);
      fogDensityTarget = fogCfg.density;
      // Update room lights when crossing a room boundary
      recomputeNearbyRoomLights(tileX * TILE_SIZE, tileZ * TILE_SIZE);
    }

    // Fog only in FPS — from overhead it just muddies the view with no benefit.
    if (fpsActive) {
      fogColorCurrent.lerp(fogColorTarget, FOG_LERP_SPEED * delta);
      sceneFog.color.copy(fogColorCurrent);
      sceneFog.density += (fogDensityTarget - sceneFog.density) * FOG_LERP_SPEED * delta;
    } else {
      sceneFog.density += (0 - sceneFog.density) * FOG_LERP_SPEED * delta;
    }
  }

  // ── Flip animation loop ──
  // When fpsActive, UnifiedCameraController owns the camera — we don't touch it.
  useTask((delta) => {
    if (!camera) return;

    // In editor mode, OrbitControls owns the camera — skip all movement/animation
    if (museum3dEditorState.editorActive) return;

    // Drain pending mount queue (max 5 per frame to avoid spikes)
    if (pendingMounts.length > 0) {
      const batch = pendingMounts.splice(0, MAX_MOUNTS_PER_FRAME);
      for (const { category, item } of batch) {
        switch (category) {
          case "plaque": visiblePlaques = [...visiblePlaques, item]; break;
          case "performer": visiblePerformers = [...visiblePerformers, item]; break;
          case "exhibitLight": visibleExhibitLights = [...visibleExhibitLights, item]; break;
          case "ceilingLight": visibleCeilingLights = [...visibleCeilingLights, item]; break;
          case "sunlight": visibleSunlights = [...visibleSunlights, item]; break;
          case "furniture": visibleFurniture = [...visibleFurniture, item]; break;
        }
      }
    }

    // Proximity visibility recheck — when player moves 2+ tiles
    const currentTX = Math.round(playerPosition.x / TILE_SIZE);
    const currentTY = Math.round(playerPosition.z / TILE_SIZE);
    const dCheckX = currentTX - lastCheckTX;
    const dCheckY = currentTY - lastCheckTY;
    if (dCheckX * dCheckX + dCheckY * dCheckY >= 16) {
      recomputeVisibility(currentTX, currentTY);
    }

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

      // Sync reactive state for Avatar3D's animation system
      const vel = physicsProvider.getVelocity();
      playerSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
      playerGrounded = physicsProvider.isGrounded();
      playerVerticalVelocity = vel.y;
      // playerJumpRequested is set/cleared by the keydown handler with rAF delay

      const fpsTileX = Math.round(fpsPos.x / TILE_SIZE);
      const fpsTileZ = Math.round(fpsPos.z / TILE_SIZE);
      updateAtmosphere(fpsTileX, fpsTileZ, delta);
      updateStreaming(fpsTileX, fpsTileZ);
      props.onPlayerUpdate?.(fpsPos.x, fpsPos.z, fpsTileX, fpsTileZ, yawToFacing(playerYaw), true, playerYaw);
      return;
    }

    // Detect new flip request (must check before movement/animation branches)
    if ((props.flipRequested ?? 0) !== lastFlipCount) {
      lastFlipCount = props.flipRequested ?? 0;
      if (!animating) {
        // Entering FPS: compute target from player position (NOT from top-down camera)
        syncFpsFromPlayer();
        animating = true;
        goingDown = progress < 0.5;
      }
    }

    // ── Top-down WASD movement (when not animating) ──
    if (!animating) {
      const keys = props.heldKeys ?? new Set<string>();
      const forward = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
                      (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
      const strafe = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
                     (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);

      if (forward !== 0 || strafe !== 0) {
        // Sprint when Shift is held

        const isSprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
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
        const topVel = physicsProvider.getVelocity();
        playerSpeed = Math.sqrt(topVel.x * topVel.x + topVel.z * topVel.z);

        // Update facing direction from movement
        if (Math.abs(moveX) > 0.001 || Math.abs(moveZ) > 0.001) {
          playerYaw = Math.atan2(moveX, moveZ);
        }
      } else {
        playerSpeed = 0;
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
      currentTopDownHeight += ((props.topDownHeight ?? 12) - currentTopDownHeight) * ZOOM_SMOOTHING;
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
      updateStreaming(tileX, tileZ);
      props.onPlayerUpdate?.(pos.x, pos.z, tileX, tileZ, yawToFacing(playerYaw), false, playerYaw);
      return;
    }

    // ── Flip animation ──
    const step = delta / DURATION;
    if (goingDown) {
      progress = Math.min(progress + step, 1);
      if (progress >= 1) {
        animating = false;
        // Q cycle always enters first-person from top-down. Third-person is the next Q press.
        lastCameraMode = CameraMode.FIRST_PERSON;
        cameraPreferences.setModeForDestination("museum", CameraMode.FIRST_PERSON);
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

  // When Q is pressed again while in FPS mode, exit back to top-down.
  // CRITICAL: Exit pointer lock SYNCHRONOUSLY before starting the flip.
  // Chrome blocks rAF callbacks for ~4 seconds during pointer lock exit
  // (notification banner UI). If we let UCC's deferred exit handle it,
  // the block happens mid-animation. By exiting here, Chrome's freeze
  // happens on the static FPS view (which the user is already looking at),
  // then the animation plays at 60fps.
  $effect(() => {
    const flip = props.flipRequested;
    if (fpsActive && flip !== lastFlipCount) {
      lastFlipCount = flip;

      // Exit pointer lock FIRST — Chrome will process this synchronously
      // and any UI freeze from Chrome's lock-exit notification happens
      // before we start the flip animation.
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }

      syncFpsFromCamera();
      syncPositionFromPhysics();
      // Clear held keys to prevent stale movement (mutate parent's Set)
      (props.heldKeys ?? new Set()).clear();
      fpsActive = false;
      animating = true;
      goingDown = false;
    }
  });

  // Instant mode switch (first-person → third-person) triggered by parent's Q cycle
  let lastModeChangeCount = 0;
  $effect(() => {
    const modeChange = props.modeChangeRequested ?? 0;
    if (modeChange !== lastModeChangeCount) {
      lastModeChangeCount = modeChange;
      if (fpsActive) {
        // Switch to third-person via camera preferences — UCC reacts automatically
        // via its $effect.pre that syncs mode from cameraPreferences
        lastCameraMode = CameraMode.THIRD_PERSON;
        cameraPreferences.setModeForDestination("museum", CameraMode.THIRD_PERSON);
        try {
          sessionStorage.setItem(CAMERA_MODE_HMR_KEY, "THIRD_PERSON");
        } catch { /* non-critical */ }
        props.onViewModeChange?.("third-person");
      }
    }
  });

  // Reset to spawn when requested (R key or Home)
  let lastResetCount = 0;
  $effect(() => {
    const reset = props.resetRequested ?? 0;
    if (reset !== lastResetCount) {
      lastResetCount = reset;
      const spawnX = grid.spawn.x * TILE_SIZE;
      const spawnZ = grid.spawn.y * TILE_SIZE;
      physicsProvider.teleport!({ x: spawnX, y: 0, z: spawnZ });
      // Face north — looking down the hallway toward the cave
      playerYaw = Math.PI;
      targetPlayerYaw = Math.PI;
      if (fpsActive) {
        fpsInitialYaw = Math.PI;
        fpsInitialPitch = 0;
        fpsActive = false;
        requestAnimationFrame(() => {
          fpsActive = true;
          progress = 1;
        });
      }
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

  // ── Per-room geometry streaming ──
  // Instead of loading all 16 rooms at once, we only build geometry for
  // the current room + adjacent rooms. Corridors are always loaded (cheap).
  // This reduces GPU shader compilation from ~16 rooms to ~3 rooms on load.

  let geometryReady = $state(false);
  const streamingManager = new RoomStreamingManager(MUSEUM_EDGES, 5000);

  // Per-room bucketing (pure data, computed once synchronously — fast)
  const perRoomBuckets = bucketMuseumTilesByRoom(grid);

  // Loaded room chunks — keyed by wingId
  let loadedChunks = $state<Map<string, RoomChunk>>(new Map());
  // Corridor chunk — always loaded
  let corridorChunk = $state<RoomChunk | null>(null);

  const MAX_POINT_LIGHTS = 32;

  // ── Proximity-based rendering ──
  const CELL_SIZE = 8;
  const MOUNT_RADIUS = 30;
  const UNMOUNT_RADIUS = 40;
  const MAX_MOUNTS_PER_FRAME = 2;

  // Proximity grids — rebuilt when chunks load/unload
  let torchGrid = new ProximityGrid<TorchPosition>(CELL_SIZE);
  let plaqueGrid = new ProximityGrid<PlaquePlacement>(CELL_SIZE);
  let performerGrid = new ProximityGrid<typeof grid.performers[0]>(CELL_SIZE);
  let exhibitLightGrid = new ProximityGrid<LightPosition>(CELL_SIZE);
  let ceilingLightGrid = new ProximityGrid<LightPosition>(CELL_SIZE);
  let sunlightGrid = new ProximityGrid<LightPosition>(CELL_SIZE);
  let furnitureGrid = new ProximityGrid<NonNullable<typeof grid.furniture>[0]>(CELL_SIZE);

  // Populate furniture and performer grids immediately (not per-room)
  for (const f of (grid.furniture ?? [])) furnitureGrid.insert(f, f.tileX, f.tileY);
  for (const p of grid.performers) performerGrid.insert(p, p.tileX, p.tileY);

  // Visible sets — only these items get rendered
  let visibleTorches = $state<TorchPosition[]>([]);
  let visiblePlaques = $state<PlaquePlacement[]>([]);
  let visiblePerformers = $state<typeof grid.performers>([]);
  let visibleExhibitLights = $state<LightPosition[]>([]);
  let visibleCeilingLights = $state<LightPosition[]>([]);
  let visibleSunlights = $state<LightPosition[]>([]);
  let visibleFurniture = $state<NonNullable<typeof grid.furniture>>([]);
  let useSpotLights = $state(false);

  // ── Imperative mesh management ──
  // Meshes are added directly to the Three.js scene during init, NOT through
  // Svelte templates. This eliminates reactive overhead (no $derived arrays,
  // no {#each} template diffing, no Threlte component mounting). Visibility
  // is controlled with mesh.visible instead of mount/unmount.
  const allSceneMeshes: BatchedMesh[] = [];        // for cleanup on destroy
  const ceilingChunkRefs: BatchedMeshData[] = [];  // toggle per-instance visibility with fpsActive

  /** Build global proximity grids once from ALL chunks (called after all chunks built) */
  function buildGlobalProximityGrids(): void {
    torchGrid = new ProximityGrid<TorchPosition>(CELL_SIZE);
    plaqueGrid = new ProximityGrid<PlaquePlacement>(CELL_SIZE);
    exhibitLightGrid = new ProximityGrid<LightPosition>(CELL_SIZE);
    ceilingLightGrid = new ProximityGrid<LightPosition>(CELL_SIZE);
    sunlightGrid = new ProximityGrid<LightPosition>(CELL_SIZE);

    const allChunks = [corridorChunk, ...prebuiltChunks.values()].filter(Boolean) as RoomChunk[];
    for (const chunk of allChunks) {
      for (const t of chunk.torchPositions) torchGrid.insert(t, t.tileX, t.tileY);
      for (const p of chunk.plaquePlacements) plaqueGrid.insert(p, p.tileX, p.tileY);
      for (const l of chunk.exhibitLightPositions) exhibitLightGrid.insert(l, l.tileX, l.tileY);
      for (const l of chunk.ceilingLightPositions) ceilingLightGrid.insert(l, l.tileX, l.tileY);
      for (const l of chunk.sunlightPositions) sunlightGrid.insert(l, l.tileX, l.tileY);
    }
  }

  /** No-op — proximity grids are built once globally, not per-active-chunk */
  function rebuildProximityGrids(): void {
    // All grids built once in buildGlobalProximityGrids. Nothing to rebuild.
  }


  // ── Pre-build ALL room chunks behind the loading overlay ──
  // Build every room's geometry upfront so room transitions are instant.
  // The overlay stays visible until all chunks are built + textures loaded.
  // This is ~300ms of JS work + GPU shader compilation (absorbed by overlay).
  const prebuiltChunks = new Map<string, RoomChunk>();
  // Maps performer ID → { chunk, instanceIdx } for editor mesh updates.
  // Built once after all chunks are created, before any overrides.
  const performerMeshLookup = new Map<string, { chunk: RoomChunk; instanceIdx: number }>();
  const spawnRoomId = streamingManager.getRoomAtTile(grid.spawn.x, grid.spawn.y, grid.wings);

  props.onBuildStage?.("Tile bucketing");

  (async () => {
    // Build corridor chunk first
    const corridorDryRun = perRoomBuckets.corridorBucket;
    console.log(`[Museum3D] Corridor bucket: ${corridorDryRun.totalTiles} tiles, ${corridorDryRun.totalFloorInstances} floor, ${corridorDryRun.totalWallInstances} wall`);
    const cc = await buildRoomChunk(corridorDryRun, "__corridor__", null);
    corridorChunk = cc;
    console.log(`[Museum3D] Corridor chunk: ${cc.floorMeshes.length} floor meshes, ${cc.wallMeshes.length} wall meshes`);
    props.onBuildStage?.("Corridors");

    // Build ALL room chunks sequentially (yields between phases keep overlay responsive)
    for (const wing of grid.wings) {
      const buckets = perRoomBuckets.roomBuckets.get(wing.id);
      if (!buckets) continue;
      const chunk = await buildRoomChunk(buckets, wing.id, wing);
      prebuiltChunks.set(wing.id, chunk);
      props.onBuildStage?.(wing.name);
    }

    // Build global proximity grids from ALL chunks (torches, lights, plaques)
    buildGlobalProximityGrids();

    // Build performer mesh lookup: match each grid performer to its chunk instance
    // by comparing initial world positions (before any editor overrides).
    for (const performer of grid.performers) {
      const perfWorldX = performer.tileX * TILE_SIZE;
      const perfWorldZ = performer.tileY * TILE_SIZE;
      for (const chunk of prebuiltChunks.values()) {
        if (!chunk.performerMesh) continue;
        for (let idx = 0; idx < chunk.performerPositions.length; idx++) {
          const pos = chunk.performerPositions[idx]!;
          if (Math.abs(pos.x - perfWorldX) < 0.3 && Math.abs(pos.z - perfWorldZ) < 0.3) {
            performerMeshLookup.set(performer.id, { chunk, instanceIdx: idx });
            break;
          }
        }
        if (performerMeshLookup.has(performer.id)) break;
      }
    }

    // Apply any persisted editor overrides to the performer meshes NOW
    // (the $effect that runs at mount fires before chunks exist, so it
    // can't update meshes — we catch up here after the lookup is built).
    const persistedOverrides = museumEditorOverrides.getAll();
    if (Object.keys(persistedOverrides).length > 0) {
      const d = new Object3D();
      for (const performer of grid.performers) {
        const override = persistedOverrides[`performer-station-${performer.id}`];
        if (!override) continue;
        const entry = performerMeshLookup.get(performer.id);
        if (!entry?.chunk.performerMesh) continue;
        d.position.set(override.x, 0.25, override.z);
        d.updateMatrix();
        entry.chunk.performerMesh.setMatrixAt(entry.instanceIdx, d.matrix);
        entry.chunk.performerMesh.instanceMatrix.needsUpdate = true;
      }
    }

    // ── Imperative scene setup: add ALL meshes directly to Three.js ──
    // No Svelte templates, no reactive arrays, no component mounting.
    // Just scene.add() for each mesh. This is how game engines do it.
    props.onBuildStage?.("Adding geometry to scene");

    const renderer = (threlteCtx as any).renderer?.current ?? (threlteCtx as any).renderer;
    const sceneObj = (threlteCtx as any).scene?.current ?? (threlteCtx as any).scene;

    if (sceneObj) {
      function addChunkToScene(chunk: RoomChunk): void {
        for (const { mesh } of chunk.floorMeshes) {
          mesh.receiveShadow = true;
          sceneObj.add(mesh);
          allSceneMeshes.push(mesh);
        }
        for (const { mesh } of chunk.wallMeshes) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          sceneObj.add(mesh);
          allSceneMeshes.push(mesh);
        }
        if (chunk.ceilingMesh) {
          // Start with all ceiling instances hidden (top-down mode)
          const cm = chunk.ceilingMesh;
          for (const id of (cm.instanceIds ?? [])) {
            cm.mesh.setVisibleAt(id, false);
          }
          sceneObj.add(cm.mesh);
          allSceneMeshes.push(cm.mesh);
          ceilingChunkRefs.push(cm);
        }
        if (chunk.pedestalMesh) {
          chunk.pedestalMesh.castShadow = true;
          chunk.pedestalMesh.receiveShadow = true;
          sceneObj.add(chunk.pedestalMesh);
          allSceneMeshes.push(chunk.pedestalMesh);
        }
        if (chunk.signMesh) {
          chunk.signMesh.castShadow = true;
          chunk.signMesh.receiveShadow = true;
          sceneObj.add(chunk.signMesh);
          allSceneMeshes.push(chunk.signMesh);
        }
        if (chunk.performerMesh) {
          sceneObj.add(chunk.performerMesh);
          allSceneMeshes.push(chunk.performerMesh);
        }
      }

      // Add corridor geometry
      addChunkToScene(cc);
      // Add all room geometry
      for (const chunk of prebuiltChunks.values()) {
        addChunkToScene(chunk);
      }

      // Force-compile ALL shaders now (behind overlay)
      if (renderer && camera) {
        renderer.compile(sceneObj, camera);
      }

      console.log(`[Museum3D] BatchedMesh scene: ${allSceneMeshes.length} batches added, ${ceilingChunkRefs.length} ceiling batches (GPU frustum culling enabled)`);

      // Seed the streaming manager: all rooms start as "loaded" since we
      // built them all upfront. This ensures the hysteresis tracking works
      // correctly when update() starts hiding distant rooms.
      for (const wingId of prebuiltChunks.keys()) {
        streamingManager.forceLoad(wingId);
      }
    }

    // Yield so overlay can paint
    await new Promise<void>(r => setTimeout(r, 0));

    // Mount ALL torches globally — flame shaders compile once behind overlay
    const allTorches: TorchPosition[] = [];
    const allExhibitLights: LightPosition[] = [];
    const allCeilingLights: LightPosition[] = [];
    const allSunlights: LightPosition[] = [];
    const allChunks = [cc, ...prebuiltChunks.values()];
    for (const chunk of allChunks) {
      allTorches.push(...chunk.torchPositions);
      allExhibitLights.push(...chunk.exhibitLightPositions);
      allCeilingLights.push(...chunk.ceilingLightPositions);
      allSunlights.push(...chunk.sunlightPositions);
    }
    // ── Staggered component mounting ──
    // Mount Svelte components in groups with yields between each so the
    // loading overlay stays responsive. Each group triggers a Svelte render
    // cycle that mounts components + compiles their shaders.

    props.onBuildStage?.("Mounting lights");
    visibleExhibitLights = allExhibitLights;
    visibleCeilingLights = allCeilingLights;
    visibleSunlights = allSunlights;
    await new Promise<void>(r => setTimeout(r, 0));

    props.onBuildStage?.("Mounting torches");
    visibleTorches = allTorches;
    await new Promise<void>(r => setTimeout(r, 0));

    props.onBuildStage?.("Mounting plaques");
    visiblePlaques = getAllPlaquePlacements();
    useSpotLights = visiblePlaques.length > 0 && visiblePlaques.length < 20;
    await new Promise<void>(r => setTimeout(r, 0));

    props.onBuildStage?.("Mounting performers");
    visiblePerformers = grid.performers;
    await new Promise<void>(r => setTimeout(r, 0));

    props.onBuildStage?.("Mounting furniture");
    visibleFurniture = grid.furniture ?? [];
    await new Promise<void>(r => setTimeout(r, 0));

    geometryReady = true;
    props.onGeometryReady?.();
  })();

  // ── Visibility-based room streaming ──
  // All geometry stays permanently in the scene graph (no add/remove) so the
  // 2D top-down view can show everything instantly. In FPS mode, distant room
  // chunks get mesh.visible = false — Three.js skips them entirely (zero draw
  // calls, zero fragment work). On flip back to top-down, everything goes
  // visible again with no loading delay.
  //
  // This is the pattern indoor games use (Portal, Resident Evil, Dishonored):
  // "visibility sets" rather than true loading/unloading. The GPU memory cost
  // stays the same, but per-frame draw calls drop ~80% in FPS mode.

  let activeRoomSet = new Set<string>();
  // Track last room ID to avoid redundant visibility updates every frame
  let lastStreamingRoomId: string | null = null;

  /** Set mesh.visible on every mesh in a room chunk */
  function setChunkVisible(chunk: RoomChunk, visible: boolean): void {
    for (const { mesh } of chunk.floorMeshes) mesh.visible = visible;
    for (const { mesh } of chunk.wallMeshes) mesh.visible = visible;
    // Ceiling visibility is handled separately (hidden in top-down, shown in FPS)
    // so we only touch it here when hiding the entire room
    if (chunk.ceilingMesh) chunk.ceilingMesh.mesh.visible = visible && fpsActive;
    if (chunk.pedestalMesh) chunk.pedestalMesh.visible = visible;
    if (chunk.signMesh) chunk.signMesh.visible = visible;
    if (chunk.performerMesh) chunk.performerMesh.visible = visible;
  }

  /** Show all room chunks — used in top-down mode and during flip animation */
  function showAllRooms(): void {
    for (const chunk of prebuiltChunks.values()) {
      setChunkVisible(chunk, true);
    }
    lastStreamingRoomId = null; // Force re-evaluation on next FPS frame
  }

  // Toggle ceiling visibility when switching between FPS and top-down.
  // In top-down, ceilings hide so the floor plan is visible.
  // In FPS, ceilings show — but only for rooms in the active set.
  $effect(() => {
    if (fpsActive) {
      // FPS: show ceilings only for active rooms
      for (const [wingId, chunk] of prebuiltChunks) {
        if (chunk.ceilingMesh) {
          chunk.ceilingMesh.mesh.visible = activeRoomSet.has(wingId);
        }
      }
      // Corridor ceiling always visible
      if (corridorChunk?.ceilingMesh) {
        corridorChunk.ceilingMesh.mesh.visible = true;
      }
    } else {
      // Top-down: hide all ceilings so the floor plan is readable,
      // but make sure all room geometry is visible for the overview
      for (const cm of ceilingChunkRefs) {
        cm.mesh.visible = false;
      }
      showAllRooms();
    }
  });

  function updateStreaming(playerTX: number, playerTZ: number): void {
    if (!geometryReady) return;

    // In top-down or during flip animation: everything visible, no streaming
    if (!fpsActive) return;

    // Determine which room the player is in
    const currentRoomId = streamingManager.getRoomAtTile(playerTX, playerTZ, grid.wings);

    // Skip if player hasn't moved to a new room
    if (currentRoomId === lastStreamingRoomId) return;
    lastStreamingRoomId = currentRoomId;

    // Ask the streaming manager which rooms should be active
    const { activeSet } = streamingManager.update(currentRoomId);
    activeRoomSet = activeSet;

    // Toggle visibility on each room chunk
    for (const [wingId, chunk] of prebuiltChunks) {
      setChunkVisible(chunk, activeSet.has(wingId));
    }

    // Corridor is always visible (cheap, connects everything)
    if (corridorChunk) setChunkVisible(corridorChunk, true);
  }

  // Shadow disabled on dynamic lights — toggling castShadow reactively causes
  // Three.js deallocateRenderTarget crashes, and PBR wall textures already consume
  // most of the 16 WebGL texture units. Shadows are still received by floors/walls.

  type MountCategory = "torch" | "plaque" | "performer" | "exhibitLight" | "ceilingLight" | "sunlight" | "furniture";
  let pendingMounts: { category: MountCategory; item: any }[] = [];

  let lastCheckTX = -999;
  let lastCheckTY = -999;

  /** All plaque placements across all chunks */
  function getAllPlaquePlacements(): PlaquePlacement[] {
    const all: PlaquePlacement[] = [];
    if (corridorChunk) all.push(...corridorChunk.plaquePlacements);
    for (const chunk of prebuiltChunks.values()) all.push(...chunk.plaquePlacements);
    return all;
  }

  function recomputeVisibility(_playerTX: number, _playerTY: number): void {
    // All components (performers, plaques, furniture, torches, lights) are
    // mounted globally at init. No proximity-based mount/unmount needed.
    // This eliminates Svelte component mounting during gameplay entirely.
  }

  // Torch light set — derived from visible torches, capped at MAX_POINT_LIGHTS
  const torchLightSet = $derived.by(() => {
    const withLight = visibleTorches.length <= MAX_POINT_LIGHTS
      ? visibleTorches
      : visibleTorches.slice(0, MAX_POINT_LIGHTS);
    return new Set(withLight.map(t => `${t.x},${t.z}`));
  });

  // Room lights from all pre-built chunks (static after init)
  let roomLights = $derived.by(() => {
    const lights: RoomLight[] = [];
    for (const chunk of prebuiltChunks.values()) {
      if (chunk.roomLight) lights.push(chunk.roomLight);
    }
    return lights;
  });

  // Per-room ambient lights — fixed-size pool to avoid shader recompilation.
  // Three.js recompiles every material's shader when lights are added/removed from
  // the scene graph (20-30 second freeze). Instead, we keep MAX_ROOM_LIGHTS slots
  // always mounted and update their position/color/intensity reactively. Unused
  // slots get intensity=0 — they're still in the shader but cost nothing to render.
  interface RoomLightSlot { x: number; z: number; color: string; intensity: number; distance: number; }
  const MAX_ROOM_LIGHTS = 16;
  const ROOM_LIGHT_PROXIMITY = 15; // world units — roughly 30 tiles

  // Initialize pool with all slots off (intensity=0) at origin
  const EMPTY_SLOT: RoomLightSlot = { x: 0, z: 0, color: "#000000", intensity: 0, distance: 1 };
  let roomLightPool = $state<RoomLightSlot[]>(Array.from({ length: MAX_ROOM_LIGHTS }, () => ({ ...EMPTY_SLOT })));

  function recomputeNearbyRoomLights(px: number, pz: number): void {
    if (roomLights.length === 0) return;
    const nearby: (RoomLightSlot & { distSq: number })[] = [];
    for (const light of roomLights) {
      for (const pos of light.positions) {
        const dx = pos.x - px;
        const dz = pos.z - pz;
        const distSq = dx * dx + dz * dz;
        if (distSq <= ROOM_LIGHT_PROXIMITY * ROOM_LIGHT_PROXIMITY) {
          nearby.push({ x: pos.x, z: pos.z, color: light.color, intensity: light.intensity, distance: light.distance, distSq });
        }
      }
    }
    if (nearby.length > MAX_ROOM_LIGHTS) {
      nearby.sort((a, b) => a.distSq - b.distSq);
    }

    // Update pool slots in-place — active slots get real values, rest get zeroed
    const newPool: RoomLightSlot[] = [];
    for (let i = 0; i < MAX_ROOM_LIGHTS; i++) {
      if (i < nearby.length) {
        const n = nearby[i]!;
        newPool.push({ x: n.x, z: n.z, color: n.color, intensity: n.intensity, distance: n.distance });
      } else {
        newPool.push({ ...EMPTY_SLOT });
      }
    }
    roomLightPool = newPool;
  }
</script>

<!-- Camera (owned by flip animation when not in FPS, by UCC when in FPS, by OrbitControls in editor) -->
<T.PerspectiveCamera
  makeDefault
  bind:ref={camera}
  fov={TOP_DOWN.fov}
  near={0.1}
  far={maxExtent * 3}
>
  {#if museum3dEditorState.editorActive}
    <OrbitControls
      enableDamping
      enablePan
      panSpeed={1.5}
      rotateSpeed={0.8}
      zoomSpeed={1.2}
      minDistance={1}
      maxDistance={50}
      onchange={(e) => {
        // Persist editor camera + orbit target across HMR
        if (camera) {
          const controls = e.target;
          museum3dEditorState.saveCamera({
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            targetX: controls.target.x,
            targetY: controls.target.y,
            targetZ: controls.target.z,
          });
        }
      }}
      oncreate={(controls) => {
        // Store controls ref so editor state can update the orbit target
        museum3dEditorState.setOrbitControls(controls);

        const saved = museum3dEditorState.loadCamera();
        if (saved && camera) {
          camera.position.set(saved.x, saved.y, saved.z);
          controls.target.set(saved.targetX, saved.targetY, saved.targetZ);
        } else {
          // First time: orbit target is where the player is looking at, 5m ahead
          const lookAheadDist = 5;
          controls.target.set(
            playerPosition.x + Math.sin(playerYaw) * lookAheadDist,
            1.2,
            playerPosition.z + Math.cos(playerYaw) * lookAheadDist,
          );
        }
        controls.update();

        // Clean up on destroy
        return () => {
          museum3dEditorState.setOrbitControls(null);
        };
      }}
    />
  {/if}
</T.PerspectiveCamera>

<!-- Player representation: top-down marker always mounted, visibility toggled -->
<T.Group
  position.x={playerPosition.x}
  position.y={0.15}
  position.z={playerPosition.z}
  visible={!fpsActive && !museum3dEditorState.editorActive}
>
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

<!-- Player avatar: always mounted, visible only in third-person FPS mode.
     Stays initialized so the first Q press doesn't pay skeleton/animation setup cost. -->
<Avatar3D
  id="museum-player"
  bluePropState={null}
  redPropState={null}
  position={{ x: playerPosition.x, y: playerPosition.y - 0.85 + 0.001, z: playerPosition.z }}
  facingAngle={playerYaw}
  isActive={false}
  isMoving={fpsActive && lastCameraMode === CameraMode.THIRD_PERSON ? isMoving : false}
  moveSpeed={playerSpeed}
  moveDirection={moveDir}
  enableLocomotion={true}
  enableRootMotion={false}
  isGrounded={playerGrounded}
  verticalVelocity={playerVerticalVelocity}
  isCrouching={isCrouching}
  isJumpRequested={playerJumpRequested}
  visible={fpsActive && lastCameraMode === CameraMode.THIRD_PERSON && !museum3dEditorState.editorActive}
/>

<!-- UnifiedCameraController: always mounted, enabled only in FPS mode.
     Pre-mounting eliminates first-flip initialization freeze (event listeners,
     pointer lock setup, camera state sync). -->
<UnifiedCameraController
  destinationId="museum"
  {avatarState}
  {physicsProvider}
  enabled={fpsActive && !museum3dEditorState.editorActive}
  moveSpeed={3}
  initialYaw={fpsInitialYaw}
  initialPitch={fpsInitialPitch}
  allowedModes={[CameraMode.FIRST_PERSON, CameraMode.THIRD_PERSON]}
  disableModeToggle={true}
  onModeChange={(mode) => {
    // Remember the user's preferred 3D mode so flipping back from 2D restores it.
    if (mode === CameraMode.FIRST_PERSON || mode === CameraMode.THIRD_PERSON) {
      lastCameraMode = mode;
      try {
        sessionStorage.setItem(CAMERA_MODE_HMR_KEY, mode === CameraMode.THIRD_PERSON ? "THIRD_PERSON" : "FIRST_PERSON");
      } catch { /* non-critical */ }
      // Report to parent so DimensionFlipProof's viewMode stays in sync
      props.onViewModeChange?.(mode === CameraMode.THIRD_PERSON ? "third-person" : "first-person");
    }
  }}
  onRotationChange={(newYaw, newPitch) => {
    playerYaw = newYaw;
    playerPitch = newPitch;
  }}
/>

<!-- Post-processing: bloom in FPS only, plain render everywhere else.
     Pre-warm behind loading overlay absorbs the shader compilation cost.
     Bloom off in top-down avoids the render target switch that causes 8s stall.
     spawnPosition gives the pre-warm a second render from FPS perspective. -->
<MuseumPostProcessing {geometryReady} {fpsActive} {animating} spawnPosition={{ x: spawnWorldX, z: spawnWorldZ }} />

<!-- Per-room ambient fill lights — fixed pool of MAX_ROOM_LIGHTS slots.
     Slots are always mounted (no shader recompilation). Unused slots have intensity=0. -->
{#each roomLightPool as slot, i (i)}
  <T.PointLight
    position={[slot.x, WALL_HEIGHT - 0.5, slot.z]}
    color={slot.color}
    intensity={slot.intensity}
    distance={slot.distance}
    decay={2}
  />
{/each}

<!-- Global baseline — dim enough that rooms define their own character,
     bright enough that corridors and doorways aren't pitch black -->
<T.AmbientLight intensity={0.15} color="#c8b890" />
<T.HemisphereLight intensity={0.3} color="#fff8e0" groundColor="#2a2015" />

<!-- Floor, wall, ceiling, pedestal, sign meshes are added directly to the Three.js
     scene via scene.add() during init — NOT through Svelte templates. This eliminates
     reactive overhead (no $derived arrays, no {#each} diffing, no Threlte component
     mounting/unmounting). Ceiling visibility toggled via mesh.visible in $effect. -->

<!-- Exhibit plaques: individually textured with readable content -->
{#each visiblePlaques as plaque (plaque.refId)}
  {@const plaqueOverride = overrideVersion >= 0 ? museumEditorOverrides.get(`plaque-${plaque.refId}`) : null}
  <MuseumPlaque3D
    worldX={plaqueOverride?.x ?? plaque.worldX}
    worldZ={plaqueOverride?.z ?? plaque.worldZ}
    yaw={plaque.yaw}
    wallOffsetX={plaqueOverride ? 0 : plaque.wallOffsetX}
    wallOffsetZ={plaqueOverride ? 0 : plaque.wallOffsetZ}
    content={plaque.content}
    size={plaque.size}
    refId={plaque.refId}
    generator={plaqueGenerator}
  />
{/each}
{#each visibleExhibitLights as pos (`${pos.x},${pos.z}`)}
  {#if useSpotLights}
    <T.SpotLight
      position={[pos.x, 2.5, pos.z]}
      target-position={[pos.x, 1.2, pos.z]}
      intensity={3}
      color="#fff8e0"
      distance={4}
      angle={0.4}
      penumbra={0.5}
      castShadow={false}
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

<!-- Ceiling fluorescent lights — cold white overhead wash for institutional rooms -->
{#each visibleCeilingLights as cLight (`${cLight.x},${cLight.z}`)}
  <T.PointLight
    position={[cLight.x, WALL_HEIGHT - 0.3, cLight.z]}
    intensity={2.5}
    color="#e8ecf0"
    distance={12}
    decay={1.5}
  />
{/each}

<!-- Sunlight shafts — warm golden pools for outdoor rooms.
     Each spot has a bright downward SpotLight (the sun shaft) plus a
     soft PointLight fill to brighten the surrounding ground. -->
{#each visibleSunlights as sun (`${sun.x},${sun.z}`)}
  <T.SpotLight
    position={[sun.x + 2, WALL_HEIGHT + 3, sun.z - 1]}
    target-position={[sun.x, 0, sun.z]}
    intensity={5}
    color="#fff4d6"
    distance={18}
    angle={0.5}
    penumbra={0.8}
    castShadow={false}
  />
  <T.PointLight
    position={[sun.x, 2.5, sun.z]}
    intensity={1.5}
    color="#ffe8b0"
    distance={8}
    decay={2}
  />
{/each}

<!-- Light fixtures — model and effects vary by wing theme/era -->
{#each visibleTorches as torch (`${torch.x},${torch.z}`)}
  <MuseumTorch3D
    x={torch.x}
    z={torch.z}
    wallOffsetX={torch.wallOffsetX}
    wallOffsetZ={torch.wallOffsetZ}
    wingTheme={torch.wingTheme}
    baseIntensity={torchLightSet.has(`${torch.x},${torch.z}`) ? 4 : 0}
    materials={torchMaterialCache.createInstance(FIXTURE_REGISTRY[torch.wingTheme].lightColor)}
    castShadow={false}
    playerPosition={playerPosition}
  />
{/each}

<!-- Performer stations: 3D mannequins with spinning staves -->
<!-- overrideVersion dependency ensures reactivity when editor moves objects -->
{#each visiblePerformers as performer (performer.id)}
  {@const posOverride = overrideVersion >= 0 ? museumEditorOverrides.get(`performer-station-${performer.id}`) : null}
  {#if performer.id.includes("telekinetic-formation")}
    <TelekineticFormation3D
      stationId={performer.id}
      worldX={posOverride?.x ?? performer.tileX * TILE_SIZE}
      worldZ={posOverride?.z ?? performer.tileY * TILE_SIZE}
      sequenceId={performer.sequenceId}
      autoPlay={performer.autoPlay}
    />
  {:else}
    <MuseumPerformerStation3D
      stationId={performer.id}
      worldX={posOverride?.x ?? performer.tileX * TILE_SIZE}
      worldZ={posOverride?.z ?? performer.tileY * TILE_SIZE}
      facingAngle={FACING_TO_YAW[performer.facing] ?? 0}
      sequenceId={performer.sequenceId}
      autoPlay={performer.autoPlay}
      showGrid={true}
    />
  {/if}
{/each}

<!-- Pedestal + sign meshes managed imperatively via scene.add() -->

<!-- GLTF furniture models (Kenney CC0 kit) -->
<MuseumFurniture placements={visibleFurniture} tileSize={TILE_SIZE} />

<!-- Mirrors — placed in rooms that historically feature them -->
{#each grid.wings as wing}
  {#if wing.theme === "renaissance"}
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

<!-- Portal pair — blue in cave, orange in gallery -->
{#if portalCaveWing && portalGalleryWing}
  <MuseumPortal
    position={portalBluePos}
    rotation={portalBlueRot}
    destPosition={portalOrangePos}
    destRotation={portalOrangeRot}
    color="#0088ff"
    label="Gallery"
    playerPosition={playerPosition}
  />
  <MuseumPortal
    position={portalOrangePos}
    rotation={portalOrangeRot}
    destPosition={portalBluePos}
    destRotation={portalBlueRot}
    color="#ff8800"
    label="Cave"
    playerPosition={playerPosition}
  />
{/if}

<!-- 3D Scene Editor — click to select, gizmo to transform -->
{#if museum3dEditorState.editorActive}
  <MuseumSceneEditor onOverrideChanged={applyEditorOverrides} />
  <PlacementPickerPanel />
  {#if museum3dEditorState.placementDef}
    <PlacementGhost def={museum3dEditorState.placementDef} onPlace={handlePlace} />
  {/if}
{/if}
