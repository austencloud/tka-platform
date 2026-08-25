<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { T, useTask } from "@threlte/core";
  import { CameraMode, UnifiedCameraController } from "@austencloud/camera-3d";
  import type { AvatarState, PhysicsProvider } from "@austencloud/camera-3d";
  import { Mesh, TextureLoader, type Group } from "three";
  import {
    loadGeospatialEvidenceLayers,
    loadGeospatialTerrain,
    parseGeospatialTerrainManifest,
  } from "$lib/shared/3d/procedural-engine/generation/geospatial-terrain";
  import {
    createPhysicsWorldState,
    createRigidBody,
    disposePhysicsWorld,
    initPhysicsWorld,
    stepPhysics,
  } from "$lib/shared/3d/physics/rapier-world";
  import {
    createPlayerController,
    disposePlayerController,
  } from "$lib/shared/3d/physics/player-controller";
  import { createRapierPhysicsProvider } from "$lib/shared/3d/physics/rapier-physics-provider";
  import type {
    PhysicsWorldState,
    PlayerControllerState,
  } from "$lib/shared/3d/physics/types";
  import {
    buildFlowFestTerrainHost,
    sampleFlowFestTerrainWorldY,
    type FlowFestTerrainHost,
    type FlowFestTerrainHostMode,
  } from "./flow-fest-terrain-host";
  import {
    loadFlowFestRuntimeContract,
    type FlowFestBranchId,
    type FlowFestReviewCamera,
    type FlowFestRuntimeContract,
  } from "./flow-fest-runtime-contract";
  import {
    buildFlowFestLidarBarrierGeometry,
    buildFlowFestReviewOverlay,
    type FlowFestBarrierGeometry,
  } from "./flow-fest-review-geometry";
  import type { FlowFestGrayboxReadyDetails } from "./flow-fest-graybox-types";

  interface Props {
    resetToken: number;
    cameraToken: number;
    cameraId: string | null;
    selectedBranch: FlowFestBranchId;
    hostMode: FlowFestTerrainHostMode;
    onReady?: (details: FlowFestGrayboxReadyDetails) => void;
    onPositionChange?: (position: { x: number; y: number; z: number }) => void;
    onError?: (message: string) => void;
  }

  const props: Props = $props();
  const MANIFEST_PATH = "/data/flow-fest-sim/terrain.manifest.json";
  const PLAYER_RADIUS = 0.3;
  const PLAYER_HALF_HEIGHT = 0.55;
  const PLAYER_OFFSET = 0.02;
  const BODY_CENTRE_ABOVE_GROUND =
    PLAYER_HALF_HEIGHT + PLAYER_RADIUS + PLAYER_OFFSET;
  const EYE_HEIGHT = 1.7;
  const CAMERA_OFFSET = EYE_HEIGHT - BODY_CENTRE_ABOVE_GROUND;
  const DESTINATION_ID = "flow-fest-gate2-measured-walk";

  let physicsState: PhysicsWorldState | null = null;
  let playerState: PlayerControllerState | null = null;
  let physicsProvider = $state<PhysicsProvider | null>(null);
  let terrainHost = $state<FlowFestTerrainHost | null>(null);
  let overlay = $state<Group | null>(null);
  let barrier = $state<FlowFestBarrierGeometry | null>(null);
  let contract = $state<FlowFestRuntimeContract | null>(null);
  let terrain: Awaited<ReturnType<typeof loadGeospatialTerrain>> | null = null;
  let initialized = $state(false);
  let disposed = false;
  let appliedResetToken = -1;
  let appliedCameraToken = props.cameraToken;
  let appliedBranch: FlowFestBranchId | null = null;
  let cameraRevision = $state(0);
  let initialPitch = $state(0);
  let playerYaw = $state(0);
  let targetPlayerYaw = $state(0);
  let playerPosition = $state({ x: 340, y: 12, z: -20 });
  let isMoving = $state(false);
  let moveDirection = $state({ x: 0, z: 0 });

  const avatarState: AvatarState = {
    get position() {
      return playerPosition;
    },
    get facingAngle() {
      return playerYaw;
    },
    get isMoving() {
      return isMoving;
    },
    get moveDirection() {
      return moveDirection;
    },
    setMoveInput(input) {
      moveDirection = input;
      isMoving = input.x !== 0 || input.z !== 0;
    },
    updateMovement() {},
    setFacingAngle(angle) {
      targetPlayerYaw = angle;
    },
    snapFacingAngle(angle) {
      playerYaw = angle;
      targetPlayerYaw = angle;
    },
    updateLocomotion(delta) {
      let difference = targetPlayerYaw - playerYaw;
      while (difference > Math.PI) difference -= Math.PI * 2;
      while (difference < -Math.PI) difference += Math.PI * 2;
      const step = Math.min(Math.abs(difference), 12 * delta);
      playerYaw += Math.sign(difference) * step;
    },
  };

  function bodyPositionAt(
    x: number,
    z: number
  ): { x: number; y: number; z: number } {
    if (!terrain) return { x, y: 50, z };
    return {
      x,
      y: sampleFlowFestTerrainWorldY(terrain, x, z) + BODY_CENTRE_ABOVE_GROUND,
      z,
    };
  }

  function yawPitchForCamera(camera: FlowFestReviewCamera): {
    yaw: number;
    pitch: number;
  } {
    const dx = camera.targetWorld[0] - camera.positionWorld[0];
    const dz = camera.targetWorld[2] - camera.positionWorld[2];
    const horizontal = Math.hypot(dx, dz);
    return {
      yaw: Math.atan2(dx, dz),
      pitch: Math.atan2(
        camera.positionWorld[1] - camera.targetWorld[1],
        horizontal
      ),
    };
  }

  function resetToGate(): void {
    if (!contract) return;
    const [x, , z] = contract.spawn.positionWorld;
    const position = bodyPositionAt(x, z);
    const lowerGateCamera = contract.reviewCameras.find(
      (camera) => camera.id === "lower-gate"
    );
    const orientation = lowerGateCamera
      ? yawPitchForCamera(lowerGateCamera)
      : { yaw: Math.PI, pitch: 0 };
    physicsProvider?.teleport?.(position);
    playerPosition = position;
    playerYaw = orientation.yaw;
    targetPlayerYaw = orientation.yaw;
    initialPitch = orientation.pitch;
    cameraRevision += 1;
  }

  function teleportToReviewCamera(cameraId: string): boolean {
    if (!contract || !terrain) return false;
    const camera = contract.reviewCameras.find(
      (candidate) => candidate.id === cameraId
    );
    if (!camera) return false;
    const orientation = yawPitchForCamera(camera);
    const position = {
      x: camera.positionWorld[0],
      y: camera.positionWorld[1] - CAMERA_OFFSET,
      z: camera.positionWorld[2],
    };
    physicsProvider?.teleport?.(position);
    playerPosition = position;
    playerYaw = orientation.yaw;
    targetPlayerYaw = orientation.yaw;
    initialPitch = orientation.pitch;
    cameraRevision += 1;
    return true;
  }

  function disposeOverlay(group: Group | null): void {
    group?.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      materials.forEach((material) => material.dispose());
    });
  }

  onMount(async () => {
    try {
      const manifestResponse = await fetch(MANIFEST_PATH);
      if (!manifestResponse.ok) {
        throw new Error(
          `Flow Fest terrain manifest failed to load (${manifestResponse.status})`
        );
      }
      const manifest = parseGeospatialTerrainManifest(
        await manifestResponse.json()
      );
      const [loadedTerrain, loadedContract, evidence] = await Promise.all([
        loadGeospatialTerrain(MANIFEST_PATH),
        loadFlowFestRuntimeContract(),
        loadGeospatialEvidenceLayers(manifest),
      ]);
      if (disposed) return;
      terrain = loadedTerrain;
      contract = loadedContract;

      const objectUrl = URL.createObjectURL(
        new Blob([evidence.orthophotoBytes], { type: "image/webp" })
      );
      let texture;
      try {
        texture = await new TextureLoader().loadAsync(objectUrl);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
      if (disposed) {
        texture.dispose();
        return;
      }

      terrainHost = buildFlowFestTerrainHost(
        loadedTerrain,
        props.hostMode,
        texture
      );
      overlay = buildFlowFestReviewOverlay(
        loadedContract,
        loadedTerrain,
        props.selectedBranch
      );
      appliedBranch = props.selectedBranch;
      barrier = buildFlowFestLidarBarrierGeometry(
        loadedContract,
        loadedTerrain,
        evidence.surfaceOffsetsCentimeters
      );

      physicsState = createPhysicsWorldState();
      await initPhysicsWorld(physicsState, { x: 0, y: -9.81, z: 0 });
      if (disposed || !physicsState.world || !terrainHost || !barrier) return;

      for (const collider of terrainHost.colliders) {
        createRigidBody(
          physicsState,
          { type: "static", position: { x: 0, y: 0, z: 0 } },
          {
            type: "trimesh",
            vertices: collider.vertices,
            indices: collider.indices,
            friction: 0.8,
          }
        );
      }
      createRigidBody(
        physicsState,
        { type: "static", position: { x: 0, y: 0, z: 0 } },
        {
          type: "trimesh",
          vertices: barrier.vertices,
          indices: barrier.indices,
          friction: 0.8,
        }
      );

      const [spawnX, , spawnZ] = loadedContract.spawn.positionWorld;
      const spawnGroundY = sampleFlowFestTerrainWorldY(
        loadedTerrain,
        spawnX,
        spawnZ
      );
      playerPosition = bodyPositionAt(spawnX, spawnZ);
      playerState = createPlayerController(physicsState, {
        radius: PLAYER_RADIUS,
        halfHeight: PLAYER_HALF_HEIGHT,
        offset: PLAYER_OFFSET,
        position: playerPosition,
        maxSlopeClimbAngle: (25 * Math.PI) / 180,
        minSlopeSlideAngle: (35 * Math.PI) / 180,
        autoStepMaxHeight: 0.3,
        autoStepMinWidth: 0.3,
        snapToGroundDistance: 0.35,
      });
      physicsProvider = createRapierPhysicsProvider(physicsState, playerState);
      initialized = true;
      resetToGate();

      const details: FlowFestGrayboxReadyDetails = {
        hostMode: props.hostMode,
        buildMilliseconds: terrainHost.metrics.buildMilliseconds,
        renderMeshes: terrainHost.metrics.renderMeshes + 2,
        colliderMeshes: terrainHost.metrics.colliderMeshes + 1,
        vertices: terrainHost.metrics.vertices,
        triangles: terrainHost.metrics.triangles,
        geometryBytes: terrainHost.metrics.geometryBytes,
        barrierProxies: barrier.proxyCount,
        spawnGroundY,
        eyeHeightMeters: EYE_HEIGHT,
      };
      (globalThis as Record<string, unknown>).__flowFestGate2 = {
        status: "ready",
        contractFingerprint:
          loadedContract.coordinateContentFingerprint.canonicalPayloadSha256,
        worldFrame: loadedContract.runtimeWorldFrame,
        movement: {
          metersPerSecond: 1.2,
          sprint: false,
          jump: false,
          crouch: false,
          noclip: false,
        },
        player: {
          radius: PLAYER_RADIUS,
          halfHeight: PLAYER_HALF_HEIGHT,
          bodyCentreAboveGround: BODY_CENTRE_ABOVE_GROUND,
          cameraOffset: CAMERA_OFFSET,
          eyeHeightMeters: EYE_HEIGHT,
        },
        terrain: {
          sourceSamples: loadedTerrain.heightmap.heights.length,
          renderColliderIdentity: true,
          ...terrainHost.metrics,
        },
        barriers: {
          proxies: barrier.proxyCount,
          renderColliderIdentity: true,
          sourceClass:
            loadedContract.nodePolicy.runtimeTopologyBarrierPolicy.sourceClass,
        },
        spawn: { x: spawnX, z: spawnZ, groundY: spawnGroundY },
      };
      props.onReady?.(details);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      (globalThis as Record<string, unknown>).__flowFestGate2 = {
        status: "error",
        message,
      };
      props.onError?.(message);
    }
  });

  $effect(() => {
    if (!initialized || props.resetToken === appliedResetToken) return;
    appliedResetToken = props.resetToken;
    resetToGate();
  });

  $effect(() => {
    if (!initialized || props.cameraToken === appliedCameraToken) return;
    appliedCameraToken = props.cameraToken;
    if (props.cameraId) teleportToReviewCamera(props.cameraId);
  });

  $effect(() => {
    if (
      !initialized ||
      !contract ||
      !terrain ||
      props.selectedBranch === appliedBranch
    ) {
      return;
    }
    const previous = overlay;
    overlay = buildFlowFestReviewOverlay(
      contract,
      terrain,
      props.selectedBranch
    );
    appliedBranch = props.selectedBranch;
    disposeOverlay(previous);
  });

  useTask((delta) => {
    if (!initialized || !physicsState?.world || disposed) return;
    stepPhysics(physicsState, Math.min(delta, 1 / 30));
    const position = physicsProvider?.getPlayerPosition();
    if (!position) return;
    playerPosition = position;
    props.onPositionChange?.(position);
  });

  onDestroy(() => {
    disposed = true;
    if (playerState && physicsState) {
      disposePlayerController(physicsState, playerState);
    }
    if (physicsState) disposePhysicsWorld(physicsState);
    terrainHost?.dispose();
    disposeOverlay(overlay);
    if (barrier) {
      barrier.mesh.geometry.dispose();
      const materials = Array.isArray(barrier.mesh.material)
        ? barrier.mesh.material
        : [barrier.mesh.material];
      materials.forEach((material) => material.dispose());
    }
    delete (globalThis as Record<string, unknown>).__flowFestGate2;
  });
</script>

<T.Color attach="background" args={["#b8c4b1"]} />
<T.HemisphereLight color="#eef3e7" groundColor="#445044" intensity={1.25} />
<T.DirectionalLight
  position={[-180, 260, 120]}
  color="#fff5dc"
  intensity={1.7}
  castShadow={false}
/>

{#if terrainHost}
  <T is={terrainHost.root} />
{/if}
{#if barrier}
  <T is={barrier.mesh} />
{/if}
{#if overlay}
  <T is={overlay} />
{/if}

{#if initialized && physicsProvider}
  {#key cameraRevision}
    <UnifiedCameraController
      destinationId={DESTINATION_ID}
      destinationDefaults={{ [DESTINATION_ID]: CameraMode.FIRST_PERSON }}
      preferencesKey="flow-fest-gate2-camera"
      {avatarState}
      {physicsProvider}
      enabled={true}
      initialYaw={playerYaw}
      {initialPitch}
      allowedModes={[CameraMode.FIRST_PERSON]}
      disableModeToggle={true}
      showControlsHint={false}
      moveSpeed={1.2}
      sprintMultiplier={1}
      jumpForce={0}
      gravity={9.81}
      firstPersonCameraOffset={CAMERA_OFFSET}
      enableSprint={false}
      enableJump={false}
      enableCrouch={false}
      enableNoclip={false}
    />
  {/key}
{/if}
