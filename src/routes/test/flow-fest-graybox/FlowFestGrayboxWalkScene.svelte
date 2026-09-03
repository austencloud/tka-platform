<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { T, useTask, useThrelte } from "@threlte/core";
  import { CameraMode, UnifiedCameraController } from "@austencloud/camera-3d";
  import type {
    AvatarState,
    CameraCollisionProbe,
    PhysicsProvider,
  } from "@austencloud/camera-3d";
  import type { FlowFestProductionCollisionSet } from "$lib/features/flow-fest-sim/domain/flow-fest-simulation-contract";
  import {
    FLOW_FEST_EUC_CONFIG,
    createFlowFestElectricUnicycleDynamics,
    deriveFlowFestEucTerrainAttitude,
    flowFestEucTraversalEnvelope,
    type FlowFestElectricUnicycleDynamics,
    type FlowFestElectricUnicycleInput,
    type FlowFestElectricUnicycleTerrainAttitude,
    type FlowFestStandardGamepadSample,
  } from "$lib/features/flow-fest-sim/domain/flow-fest-electric-unicycle";
  import {
    FLOW_FEST_EUC_CONTACT_THRESHOLDS,
    FLOW_FEST_EUC_PEDAL_SEPARATION_METERS,
    FLOW_FEST_EUC_PEDAL_SURFACE_HEIGHT_METERS,
    type FlowFestEucMountedPoseDiagnostic,
  } from "$lib/features/flow-fest-sim/domain/flow-fest-euc-mounted-pose";
  import { FlowFestElectricUnicycleDrive } from "$lib/features/flow-fest-sim/services/flow-fest-electric-unicycle-drive";
  import {
    mobilityDynamicsFromSnapshot,
    type FlowFestMobilityRuntimeUpdate,
    type FlowFestMobilitySnapshot,
  } from "$lib/features/flow-fest-sim/state/flow-fest-mobility-state.svelte";
  import {
    Mesh,
    TextureLoader,
    Vector3,
    type Group,
    type PerspectiveCamera,
    type WebGLRenderer,
  } from "three";
  import {
    loadGeospatialEvidenceLayers,
    loadGeospatialTerrain,
    parseGeospatialTerrainManifest,
  } from "$lib/shared/3d/procedural-engine/generation/geospatial-terrain";
  import { buildFlowFestEntranceGradedTerrain } from "../flow-fest-sim/flow-fest-entrance-terrain";
  import { FLOW_FEST_CAMP_PLAN_BOUNDS } from "../flow-fest-sim/flow-fest-camp-plan";
  import {
    createPhysicsWorldState,
    createRigidBody,
    castRay,
    disposePhysicsWorld,
    initPhysicsWorld,
    removeRigidBody,
    stepPhysics,
  } from "$lib/shared/3d/physics/rapier-world";
  import {
    createPlayerController,
    disposePlayerController,
  } from "$lib/shared/3d/physics/player-controller";
  import { createRapierPhysicsProvider } from "$lib/shared/3d/physics/rapier-physics-provider";
  import type {
    PhysicsWorldState,
    PhysicsBodyComponent,
    PlayerControllerState,
  } from "$lib/shared/3d/physics/types";
  import {
    buildFlowFestTerrainHost,
    buildFlowFestChunkSeamTraversal,
    flowFestColliderWindowKey,
    sampleFlowFestTerrainWorldY,
    type FlowFestTerrainHost,
    type FlowFestTerrainHostMode,
  } from "./flow-fest-terrain-host";
  import {
    allFlowFestSegments,
    horizontalToVerticalFovDegrees,
    loadFlowFestRuntimeContract,
    verticalToHorizontalFovDegrees,
    type FlowFestBranchId,
    type FlowFestReviewCamera,
    type FlowFestRuntimeContract,
  } from "./flow-fest-runtime-contract";
  import {
    auditFlowFestBarrierTopology,
    buildFlowFestLidarBarrierGeometry,
    buildFlowFestReviewOverlay,
    type FlowFestBarrierGeometry,
  } from "./flow-fest-review-geometry";
  import type { FlowFestGrayboxReadyDetails } from "./flow-fest-graybox-types";
  import FlowFestElectricUnicycle from "../flow-fest-sim/FlowFestElectricUnicycle.svelte";

  interface Props {
    resetToken: number;
    cameraToken: number;
    cameraId: string | null;
    externalReviewCameras?: FlowFestReviewCamera[];
    stageToken?: number;
    stagePosition?: { x: number; z: number } | null;
    selectedBranch: FlowFestBranchId;
    hostMode: FlowFestTerrainHostMode;
    moveSpeedMetersPerSecond?: number;
    sprintMultiplier?: number;
    jumpForce?: number;
    enableSprint?: boolean;
    enableJump?: boolean;
    enableCrouch?: boolean;
    showReviewOverlay?: boolean;
    /**
     * The graybox walk owns a fixed daylight rig so it can be inspected on its
     * own. A host that supplies a time-of-day rig — the production layer's
     * visual profile — must pass "none". The graybox key light and hemisphere
     * sum to 2.95 in three.js light units against the night profile's 0.37, so
     * leaving them on renders 2:13 AM as an overcast noon.
     */
    ambientLighting?: "graybox-daylight" | "none";
    collisionMode?: "measured-topology" | "visible-production";
    productionCollision?: FlowFestProductionCollisionSet | null;
    productionCampEstablished?: boolean;
    productionFestivalActive?: boolean;
    electricUnicycleEnabled?: boolean;
    electricUnicycleRevision?: number;
    electricUnicycleSnapshot?: FlowFestMobilitySnapshot | null;
    electricUnicycleLightsOn?: boolean;
    onReady?: (details: FlowFestGrayboxReadyDetails) => void;
    onPositionChange?: (position: { x: number; y: number; z: number }) => void;
    onViewRotationChange?: (yaw: number, pitch: number) => void;
    /**
     * The live camera eye rather than the body centre: its world position plus
     * the yaw and pitch it is aimed with, reported alongside the position task.
     *
     * A consumer that wants to describe "the view I am looking at right now"
     * must read the camera the frame was actually drawn from. Deriving it from
     * the body position and a fixed eye height is wrong the moment the player
     * crouches or mounts the wheel, both of which move the eye without moving
     * the body centre by the same amount.
     */
    onCameraPoseChange?: (pose: {
      x: number;
      y: number;
      z: number;
      yawRadians: number;
      pitchRadians: number;
      horizontalFovDegrees: number;
    }) => void;
    onElectricUnicycleChange?: (update: FlowFestMobilityRuntimeUpdate) => void;
    onError?: (message: string) => void;
  }

  const props: Props = $props();
  const { renderer, size } = useThrelte() as unknown as {
    renderer: WebGLRenderer;
    size: {
      subscribe: (
        run: (value: { width: number; height: number }) => void
      ) => () => void;
    };
  };
  const MANIFEST_PATH = "/data/flow-fest-sim/terrain.manifest.json";
  const PLAYER_RADIUS = 0.3;
  const PLAYER_HALF_HEIGHT = 0.55;
  const PLAYER_OFFSET = 0.02;
  const BODY_CENTRE_ABOVE_GROUND =
    PLAYER_HALF_HEIGHT + PLAYER_RADIUS + PLAYER_OFFSET;
  const EYE_HEIGHT = 1.7;
  const CAMERA_OFFSET = EYE_HEIGHT - BODY_CENTRE_ABOVE_GROUND;
  /**
   * Below this the rig is first person and the body already carries the camera.
   * The first-person rig still nudges the eye 5 cm forward, so the floor sits
   * well above that rather than treating the nudge as a chase boom.
   */
  const MINIMUM_RIG_BOOM_METERS = 0.25;
  /** Above this the reading is a rig mid-settle, not a real chase distance. */
  const MAXIMUM_RIG_BOOM_METERS = 12;
  /** Frames a deferred boom correction may wait for the rig to produce one. */
  const RIG_CORRECTION_FRAME_BUDGET = 90;
  /** Past this the player has taken over and the correction is not ours to make. */
  const RIG_CORRECTION_DRIFT_TOLERANCE_METERS = 0.5;
  const DESTINATION_ID = "flow-fest-gate2-measured-walk";
  const REVIEW_WALK_SPEED_METERS_PER_SECOND = 1.2;
  const CHUNK_SIZE_METERS = 32;
  const CHUNK_COLLIDER_BUFFER_METERS = 64;

  let physicsState: PhysicsWorldState | null = null;
  let playerState: PlayerControllerState | null = null;
  let physicsProvider = $state<PhysicsProvider | null>(null);
  let electricUnicycleDrive: FlowFestElectricUnicycleDrive | null = null;
  let terrainHost = $state<FlowFestTerrainHost | null>(null);
  let overlay = $state<Group | null>(null);
  let barrier = $state<FlowFestBarrierGeometry | null>(null);
  let contract = $state<FlowFestRuntimeContract | null>(null);
  let terrain: Awaited<ReturnType<typeof loadGeospatialTerrain>> | null = null;
  let initialized = $state(false);
  let disposed = false;
  const probeThirdPersonCameraCollision: CameraCollisionProbe = (
    origin,
    direction,
    maxDistance
  ) => {
    if (!physicsState?.world || !playerState) return null;
    return (
      castRay(
        physicsState,
        origin,
        direction,
        maxDistance,
        playerState.collider
      )?.distance ?? null
    );
  };
  let appliedResetToken = props.resetToken;
  let appliedCameraToken = props.cameraToken;
  let appliedStageToken = props.stageToken ?? 0;
  let appliedBranch: FlowFestBranchId | null = null;
  let cameraRevision = $state(0);
  let reviewCamera = $state<PerspectiveCamera>();
  let initialPitch = $state(0);
  let activeHorizontalFov = $state(65);
  let playerYaw = $state(0);
  let targetPlayerYaw = $state(0);
  let playerPosition = $state({ x: 340, y: 12, z: -20 });
  let electricUnicycleMounted = $state(false);
  let electricUnicycleDynamics = $state<FlowFestElectricUnicycleDynamics>(
    createFlowFestElectricUnicycleDynamics()
  );
  let electricUnicycleInput = $state<FlowFestElectricUnicycleInput>({
    throttle: 0,
    brake: 0,
    steer: 0,
    performanceMode: false,
    source: "none",
  });
  let electricUnicycleWheelPosition = $state({ x: 340, y: 12, z: -20 });
  let electricUnicycleTerrainAttitude =
    $state<FlowFestElectricUnicycleTerrainAttitude>({
      pitchRadians: 0,
      rollRadians: 0,
      roughnessMeters: 0,
    });
  let electricUnicycleParkedBody: PhysicsBodyComponent | null = null;
  let electricUnicycleLongitudinalAcceleration = $state(0);
  /**
   * A review-camera teleport that ran before the chase rig had produced a frame,
   * waiting to redo itself once the boom can be measured. See
   * `reviewCameraRigBoom`.
   */
  let pendingRigCorrection: {
    cameraId: string;
    expectedX: number;
    expectedZ: number;
    framesRemaining: number;
  } | null = null;
  // View angles and the scratch vector behind `onCameraPoseChange`. Held
  // outside `$state` because nothing in this component renders from them; they
  // are read once per frame by the position task and handed straight out.
  let viewYawRadians = 0;
  let viewPitchRadians = 0;
  const cameraWorldPosition = new Vector3();
  /**
   * Last mounted-pose report. Held outside `$state` on purpose: it lands every
   * frame, and the runtime-proof surface samples it at its own throttle rather
   * than re-rendering the scene sixty times a second for a diagnostic.
   */
  let electricUnicycleMountedPose: FlowFestEucMountedPoseDiagnostic | null =
    null;
  let electricUnicycleGamepadConnected = $state(false);
  let electricUnicycleCollisionLimited = $state(false);
  let electricUnicycleTraversalDiagnostics = $state<{
    grounded: boolean;
    actualVelocity: { x: number; y: number; z: number };
    requestedVelocity: { x: number; y: number; z: number };
  } | null>(null);
  let electricUnicycleInteractionMessage = $state("Park wheel");
  let electricUnicycleKeyPressed = false;
  let electricUnicycleGamepadButtonPressed = false;
  let lastElectricUnicycleReportAt = 0;
  let appliedElectricUnicycleRevision = props.electricUnicycleRevision ?? 0;
  let isMoving = $state(false);
  let moveDirection = $state({ x: 0, z: 0 });
  let loadStartedAt = 0;
  let frameTimes: number[] = [];
  let performanceWarmupFrames = 0;
  let performanceCaptureOrdinal = 0;
  let missingColliderFrames = 0;
  const activeTerrainBodies = new Map<string, PhysicsBodyComponent>();
  let activeTerrainColliderWindowKey: string | null = null;
  let productionCollisionBodies: PhysicsBodyComponent[] = [];
  let mountedProductionCollision: FlowFestProductionCollisionSet | null = null;
  let mountedCampEstablished = false;
  let mountedFestivalActive = false;
  let activeCameraMode = CameraMode.FIRST_PERSON;
  const readinessTimeline: Record<string, number> = {};
  const cameraAspect = $derived(
    $size.height > 0 ? $size.width / $size.height : 16 / 9
  );
  const verticalCameraFov = $derived(
    horizontalToVerticalFovDegrees(activeHorizontalFov, cameraAspect)
  );

  function sampleElectricUnicycleTerrainAttitude(): void {
    if (!terrain) return;
    const { x, z } = electricUnicycleWheelPosition;
    const heading = electricUnicycleDynamics.headingRadians;
    const forwardX = Math.sin(heading);
    const forwardZ = Math.cos(heading);
    const leftX = Math.cos(heading);
    const leftZ = -Math.sin(heading);
    const longitudinalOffset = 0.55;
    const lateralOffset = 0.39;
    electricUnicycleTerrainAttitude = deriveFlowFestEucTerrainAttitude({
      centerMeters: sampleFlowFestTerrainWorldY(terrain, x, z),
      forwardMeters: sampleFlowFestTerrainWorldY(
        terrain,
        x + forwardX * longitudinalOffset,
        z + forwardZ * longitudinalOffset
      ),
      rearMeters: sampleFlowFestTerrainWorldY(
        terrain,
        x - forwardX * longitudinalOffset,
        z - forwardZ * longitudinalOffset
      ),
      leftMeters: sampleFlowFestTerrainWorldY(
        terrain,
        x + leftX * lateralOffset,
        z + leftZ * lateralOffset
      ),
      rightMeters: sampleFlowFestTerrainWorldY(
        terrain,
        x - leftX * lateralOffset,
        z - leftZ * lateralOffset
      ),
      longitudinalSpanMeters: longitudinalOffset * 2,
      lateralSpanMeters: lateralOffset * 2,
    });
  }

  function updateActiveColliderProof(): void {
    const proof = (globalThis as Record<string, unknown>).__flowFestGate2 as
      | {
          terrain?: Record<string, unknown>;
          readiness?: Record<string, unknown>;
        }
      | undefined;
    if (proof?.terrain) {
      proof.terrain.activeColliderMeshes = activeTerrainBodies.size;
    }
    if (proof?.readiness) {
      proof.readiness.missingColliderFrames = missingColliderFrames;
    }
  }

  function updateProductionCollisionProof(): void {
    const proof = (globalThis as Record<string, unknown>).__flowFestGate2 as
      | Record<string, unknown>
      | undefined;
    if (!proof) return;
    proof.productionCollision = {
      mode: props.collisionMode ?? "measured-topology",
      invisibleTopologyScreenActive:
        (props.collisionMode ?? "measured-topology") === "measured-topology",
      activeBodies: productionCollisionBodies.length,
      staticVisibleObjects:
        props.productionCollision?.staticMesh.visibleObjectCount ?? 0,
      campEstablishedVisibleObjects: props.productionCampEstablished
        ? (props.productionCollision?.campEstablishedMesh.visibleObjectCount ??
          0)
        : 0,
      festivalActiveVisibleObjects: props.productionFestivalActive
        ? (props.productionCollision?.festivalActiveMesh.visibleObjectCount ??
          0)
        : 0,
    };
  }

  function clearProductionCollisionBodies(): void {
    if (physicsState) {
      for (const body of productionCollisionBodies) {
        removeRigidBody(physicsState, body);
      }
    }
    productionCollisionBodies = [];
  }

  function mountProductionCollisionMesh(
    mesh: FlowFestProductionCollisionSet["staticMesh"]
  ): void {
    if (!physicsState || mesh.visibleObjectCount === 0) return;
    const body = createRigidBody(
      physicsState,
      { type: "static", position: { x: 0, y: 0, z: 0 } },
      {
        type: "trimesh",
        vertices: mesh.vertices,
        indices: mesh.indices,
        friction: 0.8,
      }
    );
    if (body) productionCollisionBodies.push(body);
  }

  function reconcileProductionCollision(
    collision: FlowFestProductionCollisionSet | null | undefined,
    campEstablished: boolean,
    festivalActive: boolean
  ): void {
    if (
      !initialized ||
      !physicsState?.world ||
      (props.collisionMode ?? "measured-topology") !== "visible-production"
    ) {
      return;
    }
    if (
      collision === mountedProductionCollision &&
      campEstablished === mountedCampEstablished &&
      festivalActive === mountedFestivalActive
    ) {
      return;
    }
    clearProductionCollisionBodies();
    mountedProductionCollision = collision ?? null;
    mountedCampEstablished = campEstablished;
    mountedFestivalActive = festivalActive;
    if (collision) {
      mountProductionCollisionMesh(collision.staticMesh);
      if (campEstablished) {
        mountProductionCollisionMesh(collision.campEstablishedMesh);
      }
      if (festivalActive) {
        mountProductionCollisionMesh(collision.festivalActiveMesh);
      }
      stepPhysics(physicsState, 1 / 120);
    }
    updateProductionCollisionProof();
  }

  function ensureTerrainColliders(
    x: number,
    z: number,
    pruneDistant = true
  ): boolean {
    if (!physicsState?.world || !terrainHost) return false;

    const nextWindowKey =
      props.hostMode === "bounded-static"
        ? "bounded-static"
        : terrain
          ? flowFestColliderWindowKey(
              x,
              z,
              terrain.worldBounds,
              CHUNK_SIZE_METERS
            )
          : null;
    if (
      pruneDistant &&
      nextWindowKey !== null &&
      nextWindowKey === activeTerrainColliderWindowKey
    ) {
      return true;
    }
    if (!pruneDistant) activeTerrainColliderWindowKey = null;

    const desired = new Set<string>();
    for (const collider of terrainHost.colliders) {
      const isNeeded =
        props.hostMode === "bounded-static" ||
        (Math.abs(collider.centerX - x) <=
          CHUNK_COLLIDER_BUFFER_METERS + collider.halfExtentX &&
          Math.abs(collider.centerZ - z) <=
            CHUNK_COLLIDER_BUFFER_METERS + collider.halfExtentZ);
      if (!isNeeded) continue;
      desired.add(collider.name);
      if (activeTerrainBodies.has(collider.name)) continue;

      const body = createRigidBody(
        physicsState,
        { type: "static", position: { x: 0, y: 0, z: 0 } },
        {
          type: "trimesh",
          vertices: collider.vertices,
          indices: collider.indices,
          friction: 0.8,
        }
      );
      if (body) activeTerrainBodies.set(collider.name, body);
    }

    if (pruneDistant) {
      for (const [name, body] of activeTerrainBodies) {
        if (desired.has(name)) continue;
        removeRigidBody(physicsState, body);
        activeTerrainBodies.delete(name);
      }
    }

    const containingColliderIsActive = terrainHost.colliders.some(
      (collider) =>
        activeTerrainBodies.has(collider.name) &&
        Math.abs(collider.centerX - x) <= collider.halfExtentX + 1e-6 &&
        Math.abs(collider.centerZ - z) <= collider.halfExtentZ + 1e-6
    );
    activeTerrainColliderWindowKey =
      pruneDistant && containingColliderIsActive ? nextWindowKey : null;
    updateActiveColliderProof();
    return containingColliderIsActive;
  }

  function auditDynamicTerrainTraversal(): Record<string, unknown> {
    if (!physicsState || !playerState || !terrain || !contract) {
      return { status: "not-ready" };
    }
    const savedPosition =
      physicsProvider?.getPlayerPosition() ?? playerPosition;
    let samples = 0;
    let seamCrossings = 0;
    let seamAdjacentProbes = 0;
    let endpointProbes = 0;
    let colliderWindowTransitions = 0;
    let missingColliderSamples = 0;
    let missingGroundHits = 0;
    let maximumAbsoluteErrorMeters = 0;
    let minimumActiveColliders = Number.POSITIVE_INFINITY;
    let maximumActiveColliders = 0;
    let previousWindow = "";

    for (const segment of allFlowFestSegments(contract).filter(
      (candidate) => candidate.mode === "person"
    )) {
      for (let leg = 1; leg < segment.points.length; leg += 1) {
        const start = segment.points[leg - 1]!;
        const end = segment.points[leg]!;
        const traversal = buildFlowFestChunkSeamTraversal(
          start,
          end,
          terrain.worldBounds,
          CHUNK_SIZE_METERS
        );
        seamCrossings += traversal.seamCrossings;
        seamAdjacentProbes += traversal.seamAdjacentProbes;
        endpointProbes += traversal.endpointProbes;
        for (const { x, z } of traversal.probes) {
          samples += 1;

          if (!ensureTerrainColliders(x, z)) missingColliderSamples += 1;
          const window = [...activeTerrainBodies.keys()].sort().join("|");
          if (previousWindow && window !== previousWindow) {
            colliderWindowTransitions += 1;
          }
          previousWindow = window;
          minimumActiveColliders = Math.min(
            minimumActiveColliders,
            activeTerrainBodies.size
          );
          maximumActiveColliders = Math.max(
            maximumActiveColliders,
            activeTerrainBodies.size
          );

          physicsProvider?.teleport?.(bodyPositionAt(x, z));
          stepPhysics(physicsState, 1 / 120);
          const expected = sampleFlowFestTerrainWorldY(terrain, x, z);
          const hit = castRay(
            physicsState,
            { x, y: 60, z },
            { x: 0, y: -1, z: 0 },
            100,
            playerState.collider
          );
          if (!hit) {
            missingGroundHits += 1;
          } else {
            maximumAbsoluteErrorMeters = Math.max(
              maximumAbsoluteErrorMeters,
              Math.abs(hit.point.y - expected)
            );
          }
        }
      }
    }

    ensureTerrainColliders(savedPosition.x, savedPosition.z);
    physicsProvider?.teleport?.(savedPosition);
    stepPhysics(physicsState, 1 / 120);
    const status =
      samples > 0 &&
      samples === seamAdjacentProbes + endpointProbes &&
      seamCrossings > 0 &&
      missingColliderSamples === 0 &&
      missingGroundHits === 0 &&
      maximumAbsoluteErrorMeters <= 0.05 &&
      maximumActiveColliders <= 36
        ? "passed"
        : "failed";
    return {
      status,
      samples,
      seamCrossings,
      seamAdjacentProbes,
      endpointProbes,
      colliderWindowTransitions,
      missingColliderSamples,
      missingGroundHits,
      maximumAbsoluteErrorMeters,
      minimumActiveColliders: Number.isFinite(minimumActiveColliders)
        ? minimumActiveColliders
        : 0,
      maximumActiveColliders,
    };
  }

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
      if (electricUnicycleMounted) {
        playerYaw = electricUnicycleDynamics.headingRadians;
        targetPlayerYaw = electricUnicycleDynamics.headingRadians;
        return;
      }
      targetPlayerYaw = angle;
    },
    snapFacingAngle(angle) {
      playerYaw = angle;
      targetPlayerYaw = angle;
    },
    updateLocomotion(delta) {
      if (electricUnicycleMounted) {
        playerYaw = electricUnicycleDynamics.headingRadians;
        targetPlayerYaw = electricUnicycleDynamics.headingRadians;
        return;
      }
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
    ensureTerrainColliders(x, z);
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
    viewYawRadians = orientation.yaw;
    viewPitchRadians = orientation.pitch;
    activeHorizontalFov = lowerGateCamera?.horizontalFovDegrees ?? 65;
    if (props.electricUnicycleEnabled && electricUnicycleDrive && terrain) {
      clearElectricUnicycleParkedBody();
      electricUnicycleDynamics = createFlowFestElectricUnicycleDynamics({
        headingRadians: orientation.yaw,
      });
      electricUnicycleDrive.replaceDynamics(electricUnicycleDynamics, true);
      electricUnicycleMounted = true;
      applyElectricUnicycleTraversalEnvelope(true);
      initialPitch = FLOW_FEST_EUC_CONFIG.chaseCameraPitchRadians;
      electricUnicycleWheelPosition = {
        x,
        y: sampleFlowFestTerrainWorldY(terrain, x, z),
        z,
      };
      emitElectricUnicycleUpdate(true);
    }
    cameraRevision += 1;
  }

  /**
   * How far the rendered camera currently sits from the body it follows.
   *
   * In first person the two coincide apart from eye height, but the electric
   * unicycle's chase rig holds the camera a fixed boom behind the aim and a
   * little above it. A review camera's `positionWorld` says where the CAMERA
   * belongs, so the body has to be planted that far forward or the frame lands
   * short of the authored one — and a shared viewpoint link, which reports the
   * real camera position, walks backwards by one boom every time it is opened.
   *
   * Measured from the live rig rather than read from config so it stays correct
   * when a collision probe shortens the boom or the mode changes. Returns a zero
   * boom before the rig has produced a plausible frame, which keeps the
   * first-person path on its exact existing arithmetic.
   */
  function reviewCameraRigBoom(): { forward: number; vertical: number } {
    if (!reviewCamera) return { forward: 0, vertical: 0 };
    const body = physicsProvider?.getPlayerPosition() ?? playerPosition;
    reviewCamera.getWorldPosition(cameraWorldPosition);
    const forward = Math.hypot(
      cameraWorldPosition.x - body.x,
      cameraWorldPosition.z - body.z
    );
    if (
      !Number.isFinite(forward) ||
      forward < MINIMUM_RIG_BOOM_METERS ||
      forward > MAXIMUM_RIG_BOOM_METERS
    ) {
      return { forward: 0, vertical: 0 };
    }
    return { forward, vertical: cameraWorldPosition.y - body.y };
  }

  function teleportToReviewCamera(
    cameraId: string,
    correctingRigBoom = false
  ): boolean {
    if (!contract || !terrain) return false;
    const camera =
      contract.reviewCameras.find((candidate) => candidate.id === cameraId) ??
      props.externalReviewCameras?.find(
        (candidate) => candidate.id === cameraId
      );
    if (!camera) return false;
    const orientation = yawPitchForCamera(camera);
    const boom = reviewCameraRigBoom();
    const position = {
      x: camera.positionWorld[0] + boom.forward * Math.sin(orientation.yaw),
      y:
        camera.positionWorld[1] -
        (boom.forward > 0 ? boom.vertical : CAMERA_OFFSET),
      z: camera.positionWorld[2] + boom.forward * Math.cos(orientation.yaw),
    };
    ensureTerrainColliders(position.x, position.z);
    physicsProvider?.teleport?.(position);
    playerPosition = position;
    playerYaw = orientation.yaw;
    targetPlayerYaw = orientation.yaw;
    initialPitch = orientation.pitch;
    viewYawRadians = orientation.yaw;
    viewPitchRadians = orientation.pitch;
    activeHorizontalFov = camera.horizontalFovDegrees;
    cameraRevision += 1;
    // The first teleport of a page load runs before the rig has drawn anything,
    // so its boom is unmeasurable and the frame lands one boom short. Redo it
    // once the rig can answer, unless this pass already is that redo.
    pendingRigCorrection =
      correctingRigBoom || boom.forward > 0
        ? null
        : {
            cameraId,
            expectedX: position.x,
            expectedZ: position.z,
            framesRemaining: RIG_CORRECTION_FRAME_BUDGET,
          };
    return true;
  }

  function stagePlayerAt(position: { x: number; z: number }): void {
    if (!terrain) return;
    ensureTerrainColliders(position.x, position.z);
    const body = bodyPositionAt(position.x, position.z);
    physicsProvider?.teleport?.(body);
    playerPosition = body;
    cameraRevision += 1;
  }

  function clearElectricUnicycleParkedBody(): void {
    if (!electricUnicycleParkedBody || !physicsState) return;
    removeRigidBody(physicsState, electricUnicycleParkedBody);
    electricUnicycleParkedBody = null;
  }

  function mountElectricUnicycleParkedBody(): void {
    if (
      !physicsState?.world ||
      electricUnicycleMounted ||
      electricUnicycleParkedBody
    ) {
      return;
    }
    const halfYaw = electricUnicycleDynamics.headingRadians / 2;
    const yawSin = Math.sin(halfYaw);
    const yawCos = Math.cos(halfYaw);
    const quarterTurn = Math.SQRT1_2;
    electricUnicycleParkedBody = createRigidBody(
      physicsState,
      {
        type: "static",
        position: {
          x: electricUnicycleWheelPosition.x,
          y:
            electricUnicycleWheelPosition.y +
            FLOW_FEST_EUC_CONFIG.wheelRadiusMeters,
          z: electricUnicycleWheelPosition.z,
        },
        // Rapier cylinders point along local Y. Compose the wheel heading with
        // a 90-degree local-Z turn so the collider shares the visible axle.
        rotation: {
          x: yawSin * quarterTurn,
          y: yawSin * quarterTurn,
          z: yawCos * quarterTurn,
          w: yawCos * quarterTurn,
        },
      },
      {
        type: "cylinder",
        radius: FLOW_FEST_EUC_CONFIG.wheelRadiusMeters,
        halfHeight: 0.14,
        friction: 0.82,
        restitution: 0.04,
      }
    );
  }

  function electricUnicycleDistanceToPlayer(): number {
    const position = physicsProvider?.getPlayerPosition() ?? playerPosition;
    return Math.hypot(
      position.x - electricUnicycleWheelPosition.x,
      position.z - electricUnicycleWheelPosition.z
    );
  }

  function emitElectricUnicycleUpdate(force = false): void {
    if (!props.electricUnicycleEnabled || !electricUnicycleDrive || !terrain) {
      return;
    }
    const now = performance.now();
    if (!force && now - lastElectricUnicycleReportAt < 100) return;
    lastElectricUnicycleReportAt = now;
    const currentPlayer =
      physicsProvider?.getPlayerPosition() ?? playerPosition;
    if (electricUnicycleMounted) {
      electricUnicycleWheelPosition = {
        x: currentPlayer.x,
        y: sampleFlowFestTerrainWorldY(
          terrain,
          currentPlayer.x,
          currentPlayer.z
        ),
        z: currentPlayer.z,
      };
    }
    const distanceToWheelMeters = electricUnicycleMounted
      ? 0
      : electricUnicycleDistanceToPlayer();
    const canMount =
      !electricUnicycleMounted &&
      distanceToWheelMeters <= FLOW_FEST_EUC_CONFIG.mountRangeMeters;
    const canDismount =
      electricUnicycleMounted &&
      Math.abs(electricUnicycleDynamics.speedMetersPerSecond) <=
        FLOW_FEST_EUC_CONFIG.safeDismountSpeedMetersPerSecond;
    electricUnicycleInteractionMessage = electricUnicycleMounted
      ? canDismount
        ? "Park wheel"
        : "Brake below 3.4 mph to step off"
      : canMount
        ? "Mount wheel"
        : `${distanceToWheelMeters.toFixed(1)} m to your wheel`;
    const update: FlowFestMobilityRuntimeUpdate = {
      mounted: electricUnicycleMounted,
      player: { x: currentPlayer.x, z: currentPlayer.z },
      wheel: {
        x: electricUnicycleWheelPosition.x,
        z: electricUnicycleWheelPosition.z,
      },
      dynamics: { ...electricUnicycleDynamics },
      input: { ...electricUnicycleInput },
      parkedColliderActive: electricUnicycleParkedBody !== null,
      distanceToWheelMeters,
      canMount,
      canDismount,
      interactionMessage: electricUnicycleInteractionMessage,
      gamepadConnected: electricUnicycleGamepadConnected,
      collisionLimited: electricUnicycleCollisionLimited,
    };
    (globalThis as Record<string, unknown>).__flowFestEuc = {
      status: initialized ? "ready" : "initializing",
      coordinateFingerprint:
        contract?.coordinateContentFingerprint.canonicalPayloadSha256 ?? null,
      mounted: update.mounted,
      player: update.player,
      wheel: update.wheel,
      playerWheelDistanceMeters: update.distanceToWheelMeters,
      parkedCollider: {
        active: update.parkedColliderActive,
        shape: "visible-wheel-envelope-cylinder",
        radiusMeters: FLOW_FEST_EUC_CONFIG.wheelRadiusMeters,
        halfHeightMeters: 0.14,
      },
      dynamics: update.dynamics,
      terrainAttitude: { ...electricUnicycleTerrainAttitude },
      traversalEnvelope: {
        ...flowFestEucTraversalEnvelope(update.mounted),
        mode: update.mounted ? "mounted-euc" : "on-foot",
      },
      traversalDiagnostics: electricUnicycleTraversalDiagnostics,
      input: update.input,
      gamepadConnected: update.gamepadConnected,
      collisionLimited: update.collisionLimited,
      affordance: update.interactionMessage,
      cameraEyeHeightMeters:
        EYE_HEIGHT +
        (update.mounted ? FLOW_FEST_EUC_CONFIG.mountedEyeHeightGainMeters : 0),
      camera: {
        mode: update.mounted
          ? CameraMode.THIRD_PERSON
          : CameraMode.FIRST_PERSON,
        behavior: update.mounted
          ? "collision-aware-heading-chase"
          : "established-first-person-walk",
        headingRadians: update.dynamics.headingRadians,
      },
      avatar: {
        visible: update.mounted,
        owner: "@austencloud/scene-3d/Avatar3D",
        modelId: FLOW_FEST_EUC_CONFIG.riderAvatarId,
        // The rider no longer hangs off a single root offset. Its feet are
        // placed on the pedal anchors by the mounted-pose rig, so the honest
        // report is the pedal surface plus the measured contact error below.
        pedalSurfaceHeightMeters: FLOW_FEST_EUC_PEDAL_SURFACE_HEIGHT_METERS,
        stanceWidthMeters: FLOW_FEST_EUC_PEDAL_SEPARATION_METERS,
        contactPose: "flow-fest-euc-mounted-pose-rig",
      },
      longitudinalAccelerationMetersPerSecondSquared:
        electricUnicycleLongitudinalAcceleration,
      mountedPose: update.mounted ? electricUnicycleMountedPose : null,
      mountedPoseThresholds: FLOW_FEST_EUC_CONTACT_THRESHOLDS,
      config: FLOW_FEST_EUC_CONFIG,
    };
    props.onElectricUnicycleChange?.(update);
  }

  function handleElectricUnicycleDriveFrame(frame: {
    mounted: boolean;
    dynamics: FlowFestElectricUnicycleDynamics;
    input: FlowFestElectricUnicycleInput;
    collisionLimited: boolean;
    traversal: {
      grounded: boolean;
      actualVelocity: { x: number; y: number; z: number };
      requestedVelocity: { x: number; y: number; z: number };
    } | null;
  }): void {
    electricUnicycleMounted = frame.mounted;
    electricUnicycleDynamics = frame.dynamics;
    if (frame.mounted) {
      playerYaw = frame.dynamics.headingRadians;
      targetPlayerYaw = frame.dynamics.headingRadians;
    }
    electricUnicycleInput = frame.input;
    electricUnicycleCollisionLimited = frame.collisionLimited;
    electricUnicycleLongitudinalAcceleration =
      frame.longitudinalAccelerationMetersPerSecondSquared;
    electricUnicycleTraversalDiagnostics = frame.traversal;
    emitElectricUnicycleUpdate();
  }

  function handleMountedPoseDiagnostic(
    diagnostic: FlowFestEucMountedPoseDiagnostic
  ): void {
    electricUnicycleMountedPose = diagnostic;
  }

  function applyElectricUnicycleTraversalEnvelope(mounted: boolean): void {
    const controller = playerState?.controller;
    if (!controller) return;
    const envelope = flowFestEucTraversalEnvelope(mounted);
    controller.setMaxSlopeClimbAngle(envelope.maxSlopeClimbAngleRadians);
    controller.setMinSlopeSlideAngle(envelope.minSlopeSlideAngleRadians);
    controller.enableAutostep(
      envelope.autoStepMaxHeightMeters,
      envelope.autoStepMinWidthMeters,
      true
    );
    controller.enableSnapToGround(envelope.snapToGroundDistanceMeters);
  }

  function parkElectricUnicycle(): void {
    if (!electricUnicycleDrive || !terrain) return;
    if (
      Math.abs(electricUnicycleDynamics.speedMetersPerSecond) >
      FLOW_FEST_EUC_CONFIG.safeDismountSpeedMetersPerSecond
    ) {
      electricUnicycleInteractionMessage = "Brake below 3.4 mph to step off";
      emitElectricUnicycleUpdate(true);
      return;
    }
    const current = electricUnicycleDrive.getPlayerPosition();
    const heading = electricUnicycleDynamics.headingRadians;
    const wheelX = Math.max(
      -511,
      Math.min(
        511,
        current.x +
          Math.cos(heading) * FLOW_FEST_EUC_CONFIG.parkedSideOffsetMeters
      )
    );
    const wheelZ = Math.max(
      -511,
      Math.min(
        511,
        current.z -
          Math.sin(heading) * FLOW_FEST_EUC_CONFIG.parkedSideOffsetMeters
      )
    );
    electricUnicycleWheelPosition = {
      x: wheelX,
      y: sampleFlowFestTerrainWorldY(terrain, wheelX, wheelZ),
      z: wheelZ,
    };
    electricUnicycleDrive.dismount();
    electricUnicycleMounted = false;
    applyElectricUnicycleTraversalEnvelope(false);
    playerYaw = heading;
    targetPlayerYaw = heading;
    initialPitch = 0;
    cameraRevision += 1;
    mountElectricUnicycleParkedBody();
    emitElectricUnicycleUpdate(true);
  }

  function mountElectricUnicycle(): void {
    if (!electricUnicycleDrive || electricUnicycleMounted) return;
    if (
      electricUnicycleDistanceToPlayer() > FLOW_FEST_EUC_CONFIG.mountRangeMeters
    ) {
      emitElectricUnicycleUpdate(true);
      return;
    }
    clearElectricUnicycleParkedBody();
    electricUnicycleDrive.mount(electricUnicycleDynamics.headingRadians);
    electricUnicycleMounted = true;
    applyElectricUnicycleTraversalEnvelope(true);
    playerYaw = electricUnicycleDynamics.headingRadians;
    targetPlayerYaw = electricUnicycleDynamics.headingRadians;
    initialPitch = FLOW_FEST_EUC_CONFIG.chaseCameraPitchRadians;
    cameraRevision += 1;
    emitElectricUnicycleUpdate(true);
  }

  function toggleElectricUnicycleMount(): void {
    if (!props.electricUnicycleEnabled || !electricUnicycleDrive) return;
    if (electricUnicycleMounted) parkElectricUnicycle();
    else mountElectricUnicycle();
  }

  function handleElectricUnicycleCodes(activeCodes: readonly string[]): void {
    electricUnicycleDrive?.setKeyboardCodes(activeCodes);
    const pressed = activeCodes.includes("KeyE");
    if (pressed && !electricUnicycleKeyPressed) {
      toggleElectricUnicycleMount();
    }
    electricUnicycleKeyPressed = pressed;
  }

  function pollElectricUnicycleGamepad(): void {
    if (!electricUnicycleDrive || typeof navigator === "undefined") return;
    const gamepad = navigator
      .getGamepads?.()
      .find((candidate): candidate is Gamepad =>
        Boolean(candidate?.connected && candidate.mapping === "standard")
      );
    electricUnicycleGamepadConnected = Boolean(gamepad);
    electricUnicycleDrive.setGamepad(
      (gamepad as FlowFestStandardGamepadSample | undefined) ?? null
    );
    const mountPressed = gamepad?.buttons[0]?.pressed ?? false;
    if (mountPressed && !electricUnicycleGamepadButtonPressed) {
      toggleElectricUnicycleMount();
    }
    electricUnicycleGamepadButtonPressed = mountPressed;
  }

  function applyElectricUnicycleSnapshot(
    snapshot: FlowFestMobilitySnapshot
  ): void {
    if (
      !electricUnicycleDrive ||
      !terrain ||
      snapshot.contractFingerprint !==
        contract?.coordinateContentFingerprint.canonicalPayloadSha256
    ) {
      return;
    }
    clearElectricUnicycleParkedBody();
    electricUnicycleDynamics = mobilityDynamicsFromSnapshot(snapshot);
    electricUnicycleMounted = snapshot.mounted;
    electricUnicycleDrive.replaceDynamics(
      electricUnicycleDynamics,
      snapshot.mounted
    );
    applyElectricUnicycleTraversalEnvelope(snapshot.mounted);
    const body = bodyPositionAt(snapshot.player.x, snapshot.player.z);
    ensureTerrainColliders(body.x, body.z);
    physicsProvider?.teleport?.(body);
    playerPosition = body;
    electricUnicycleWheelPosition = snapshot.mounted
      ? {
          x: body.x,
          y: sampleFlowFestTerrainWorldY(terrain, body.x, body.z),
          z: body.z,
        }
      : {
          x: snapshot.wheel.x,
          y: sampleFlowFestTerrainWorldY(
            terrain,
            snapshot.wheel.x,
            snapshot.wheel.z
          ),
          z: snapshot.wheel.z,
        };
    if (!snapshot.mounted) mountElectricUnicycleParkedBody();
    playerYaw = snapshot.headingRadians;
    targetPlayerYaw = snapshot.headingRadians;
    initialPitch = 0;
    cameraRevision += 1;
    emitElectricUnicycleUpdate(true);
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

  function percentile(values: number[], fraction: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[
      Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))
    ]!;
  }

  $effect(() => {
    reconcileProductionCollision(
      props.productionCollision,
      props.productionCampEstablished ?? false,
      props.productionFestivalActive ?? false
    );
  });

  onMount(async () => {
    try {
      loadStartedAt = performance.now();
      const manifestResponse = await fetch(MANIFEST_PATH);
      if (!manifestResponse.ok) {
        throw new Error(
          `Flow Fest terrain manifest failed to load (${manifestResponse.status})`
        );
      }
      const manifest = parseGeospatialTerrainManifest(
        await manifestResponse.json()
      );
      const [sourceTerrain, loadedContract, evidence] = await Promise.all([
        loadGeospatialTerrain(MANIFEST_PATH),
        loadFlowFestRuntimeContract(),
        loadGeospatialEvidenceLayers(manifest),
      ]);
      if (disposed) return;
      const loadedTerrain =
        buildFlowFestEntranceGradedTerrain(sourceTerrain).terrain;
      terrain = loadedTerrain;
      contract = loadedContract;
      const usesMeasuredTopology =
        (props.collisionMode ?? "measured-topology") === "measured-topology";
      readinessTimeline.sourcesVerifiedMilliseconds =
        performance.now() - loadStartedAt;

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
        texture,
        props.hostMode === "chunked"
          ? {
              fullDetailBounds: FLOW_FEST_CAMP_PLAN_BOUNDS,
              fullDetailPaddingMeters: 32,
              farSampleStep: 2,
            }
          : undefined
      );
      overlay = buildFlowFestReviewOverlay(
        loadedContract,
        loadedTerrain,
        props.selectedBranch
      );
      appliedBranch = props.selectedBranch;
      let barrierTopologyAudit: ReturnType<
        typeof auditFlowFestBarrierTopology
      > | null = null;
      if (usesMeasuredTopology) {
        barrier = buildFlowFestLidarBarrierGeometry(
          loadedContract,
          loadedTerrain,
          evidence.surfaceOffsetsCentimeters
        );
        barrierTopologyAudit = auditFlowFestBarrierTopology(
          loadedContract,
          barrier
        );
        if (barrierTopologyAudit.status !== "passed") {
          throw new Error(
            "Flow Fest lidar topology does not preserve the approved corridors"
          );
        }
      }
      readinessTimeline.geometryReadyMilliseconds =
        performance.now() - loadStartedAt;

      physicsState = createPhysicsWorldState();
      await initPhysicsWorld(physicsState, { x: 0, y: -9.81, z: 0 });
      if (
        disposed ||
        !physicsState.world ||
        !terrainHost ||
        (usesMeasuredTopology && !barrier)
      )
        return;

      const [spawnX, , spawnZ] = loadedContract.spawn.positionWorld;
      if (!ensureTerrainColliders(spawnX, spawnZ)) {
        throw new Error(
          "Flow Fest authoritative spawn collider failed to mount"
        );
      }
      if (barrier) {
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
      }
      readinessTimeline.collisionReadyMilliseconds =
        performance.now() - loadStartedAt;

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
        maxSlopeClimbAngle: flowFestEucTraversalEnvelope(
          props.electricUnicycleEnabled
        ).maxSlopeClimbAngleRadians,
        minSlopeSlideAngle: flowFestEucTraversalEnvelope(
          props.electricUnicycleEnabled
        ).minSlopeSlideAngleRadians,
        autoStepMaxHeight: flowFestEucTraversalEnvelope(
          props.electricUnicycleEnabled
        ).autoStepMaxHeightMeters,
        autoStepMinWidth: flowFestEucTraversalEnvelope(
          props.electricUnicycleEnabled
        ).autoStepMinWidthMeters,
        snapToGroundDistance: flowFestEucTraversalEnvelope(
          props.electricUnicycleEnabled
        ).snapToGroundDistanceMeters,
      });
      const basePhysicsProvider = createRapierPhysicsProvider(
        physicsState,
        playerState
      );
      if (props.electricUnicycleEnabled) {
        electricUnicycleDrive = new FlowFestElectricUnicycleDrive(
          basePhysicsProvider,
          undefined,
          handleElectricUnicycleDriveFrame
        );
        physicsProvider = electricUnicycleDrive;
      } else {
        physicsProvider = basePhysicsProvider;
      }
      initialized = true;
      resetToGate();
      if (props.electricUnicycleSnapshot) {
        applyElectricUnicycleSnapshot(props.electricUnicycleSnapshot);
      }
      readinessTimeline.playerReadyMilliseconds =
        performance.now() - loadStartedAt;

      const details: FlowFestGrayboxReadyDetails = {
        hostMode: props.hostMode,
        buildMilliseconds: terrainHost.metrics.buildMilliseconds,
        renderMeshes: terrainHost.metrics.renderMeshes + 1 + (barrier ? 1 : 0),
        colliderMeshes: activeTerrainBodies.size + (barrier ? 1 : 0),
        vertices: terrainHost.metrics.vertices,
        triangles: terrainHost.metrics.triangles,
        geometryBytes: terrainHost.metrics.geometryBytes,
        barrierCells: barrier?.occupiedCellCount ?? 0,
        spawnGroundY,
        eyeHeightMeters: EYE_HEIGHT,
        sampleGroundY: (x: number, z: number) =>
          sampleFlowFestTerrainWorldY(loadedTerrain, x, z),
      };
      (globalThis as Record<string, unknown>).__flowFestGate2 = {
        status: "ready",
        contractFingerprint:
          loadedContract.coordinateContentFingerprint.canonicalPayloadSha256,
        worldFrame: loadedContract.runtimeWorldFrame,
        movement: {
          metersPerSecond:
            props.moveSpeedMetersPerSecond ??
            REVIEW_WALK_SPEED_METERS_PER_SECOND,
          sprint: props.enableSprint ?? false,
          sprintMultiplier: props.sprintMultiplier ?? 1,
          jump: props.enableJump ?? false,
          jumpForce: props.jumpForce ?? 0,
          crouch: props.enableCrouch ?? false,
          noclip: false,
          cameraMode: activeCameraMode,
        },
        player: {
          radius: PLAYER_RADIUS,
          halfHeight: PLAYER_HALF_HEIGHT,
          bodyCentreAboveGround: BODY_CENTRE_ABOVE_GROUND,
          cameraOffset: CAMERA_OFFSET,
          eyeHeightMeters: EYE_HEIGHT,
        },
        cameraProjection: () => ({
          registeredHorizontalFovDegrees: activeHorizontalFov,
          actualVerticalFovDegrees: reviewCamera?.fov ?? verticalCameraFov,
          actualHorizontalFovDegrees: verticalToHorizontalFovDegrees(
            reviewCamera?.fov ?? verticalCameraFov,
            cameraAspect
          ),
          aspect: cameraAspect,
        }),
        terrain: {
          sourceSamples: loadedTerrain.heightmap.heights.length,
          renderColliderIdentity: props.hostMode === "bounded-static",
          renderColliderHeightParity: props.hostMode === "bounded-static",
          fullDetailColliderHeightParity: true,
          renderStrategy:
            props.hostMode === "chunked"
              ? "independently culled 192 m adaptive render tiles: 1 m campground detail, 2 m far field, and separate 32 m full-resolution collision chunks"
              : "one full-resolution visible/collider mesh",
          cameraCollisionStrategy: "rapier-active-chunk-broadphase",
          candidateColliderMeshes: terrainHost.metrics.colliderMeshes,
          activeColliderMeshes: activeTerrainBodies.size,
          colliderBufferMeters:
            props.hostMode === "chunked" ? CHUNK_COLLIDER_BUFFER_METERS : null,
          ...terrainHost.metrics,
        },
        barriers: barrier
          ? {
              active: true,
              occupiedCells: barrier.occupiedCellCount,
              cellSizeMeters: barrier.cellSizeMeters,
              corridorClearanceMeters: barrier.corridorClearanceMeters,
              vehicleCorridorClearanceMeters:
                barrier.vehicleCorridorClearanceMeters,
              vehicleHalfWidthMeters: barrier.vehicleHalfWidthMeters,
              conservativeDilationMeters: barrier.conservativeDilationMeters,
              renderColliderIdentity: true,
              topologyAudit: barrierTopologyAudit,
              sourceClass:
                loadedContract.nodePolicy.runtimeTopologyBarrierPolicy
                  .sourceClass,
            }
          : {
              active: false,
              occupiedCells: 0,
              renderColliderIdentity: true,
              topologyAudit: null,
              sourceClass: "visible-production-solids",
            },
        spawn: { x: spawnX, z: spawnZ, groundY: spawnGroundY },
        readiness: { ...readinessTimeline, missingColliderFrames },
        auditTerrainCollision: () => {
          if (!physicsState || !playerState || !terrain) {
            return { status: "not-ready" };
          }
          let samples = 0;
          let missing = 0;
          let maximumAbsoluteErrorMeters = 0;
          const failures: Array<{
            segmentId: string;
            x: number;
            z: number;
            reason: string;
          }> = [];
          const personSegments = allFlowFestSegments(loadedContract).filter(
            (segment) => segment.mode === "person"
          );

          // Mount the union of route-adjacent chunks before querying. A single
          // physics step registers new bodies with Rapier's broad phase; the
          // player is kinematic, so this does not advance locomotion.
          for (const segment of personSegments) {
            for (const point of segment.points) {
              ensureTerrainColliders(point.x, point.z, false);
            }
          }
          stepPhysics(physicsState, 1 / 120);

          for (const segment of personSegments) {
            for (const point of segment.points) {
              samples += 1;
              const expected = sampleFlowFestTerrainWorldY(
                loadedTerrain,
                point.x,
                point.z
              );
              const hit = castRay(
                physicsState,
                { x: point.x, y: 60, z: point.z },
                { x: 0, y: -1, z: 0 },
                100,
                playerState.collider
              );
              if (!hit) {
                missing += 1;
                failures.push({
                  segmentId: segment.id,
                  x: point.x,
                  z: point.z,
                  reason: "missing-ground-hit",
                });
                continue;
              }
              const error = Math.abs(hit.point.y - expected);
              maximumAbsoluteErrorMeters = Math.max(
                maximumAbsoluteErrorMeters,
                error
              );
              if (error > 0.05) {
                failures.push({
                  segmentId: segment.id,
                  x: point.x,
                  z: point.z,
                  reason: `collision-height-error:${error.toFixed(6)}`,
                });
              }
            }
          }
          ensureTerrainColliders(playerPosition.x, playerPosition.z);
          return {
            status: failures.length === 0 ? "passed" : "failed",
            samples,
            missing,
            maximumAbsoluteErrorMeters,
            failures: failures.slice(0, 20),
          };
        },
        auditDynamicTerrainTraversal,
        teleportToReviewCamera,
        stagePlayerAt,
        playerSnapshot: () => {
          const position =
            physicsProvider?.getPlayerPosition() ?? playerPosition;
          const groundY = sampleFlowFestTerrainWorldY(
            loadedTerrain,
            position.x,
            position.z
          );
          return {
            position,
            groundY,
            eyeHeightMeters: position.y + CAMERA_OFFSET - groundY,
          };
        },
      };
      updateProductionCollisionProof();
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
    const token = props.stageToken ?? 0;
    if (!initialized || token === appliedStageToken) return;
    appliedStageToken = token;
    if (props.stagePosition) stagePlayerAt(props.stagePosition);
  });

  $effect(() => {
    const revision = props.electricUnicycleRevision ?? 0;
    if (
      !initialized ||
      !props.electricUnicycleEnabled ||
      revision === appliedElectricUnicycleRevision ||
      !props.electricUnicycleSnapshot
    ) {
      return;
    }
    appliedElectricUnicycleRevision = revision;
    applyElectricUnicycleSnapshot(props.electricUnicycleSnapshot);
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
    if (props.electricUnicycleEnabled) pollElectricUnicycleGamepad();
    const liveProof = (globalThis as Record<string, unknown>)
      .__flowFestGate2 as Record<string, unknown> | undefined;
    const liveMovement = liveProof?.movement as
      | Record<string, unknown>
      | undefined;
    if (liveMovement) {
      liveMovement.hasInput = isMoving;
      liveMovement.velocity = physicsProvider?.getVelocity() ?? {
        x: 0,
        y: 0,
        z: 0,
      };
    }
    const livePlayer = liveProof?.player as Record<string, unknown> | undefined;
    if (livePlayer && playerState?.collider) {
      livePlayer.currentCapsuleHalfHeight = playerState.collider.halfHeight();
    }
    if (delta > 0 && delta < 0.25) {
      if (performanceWarmupFrames < 120) {
        performanceWarmupFrames += 1;
      } else {
        frameTimes.push(delta * 1000);
      }
      if (frameTimes.length >= 240) {
        const proof = (globalThis as Record<string, unknown>)
          .__flowFestGate2 as Record<string, unknown> | undefined;
        if (proof) {
          performanceCaptureOrdinal += 1;
          proof.performance = {
            captureOrdinal: performanceCaptureOrdinal,
            samples: frameTimes.length,
            p50FrameMilliseconds: percentile(frameTimes, 0.5),
            p95FrameMilliseconds: percentile(frameTimes, 0.95),
            p99FrameMilliseconds: percentile(frameTimes, 0.99),
            drawCalls: renderer.info.render.calls,
            renderedTriangles: renderer.info.render.triangles,
            programs: renderer.info.programs?.length ?? 0,
            geometries: renderer.info.memory.geometries,
            textures: renderer.info.memory.textures,
          };
        }
        frameTimes = [];
      }
    }
    const currentPosition =
      physicsProvider?.getPlayerPosition() ?? playerPosition;
    if (!ensureTerrainColliders(currentPosition.x, currentPosition.z)) {
      missingColliderFrames += 1;
      updateActiveColliderProof();
      return;
    }
    stepPhysics(physicsState, Math.min(delta, 1 / 30));
    const position = physicsProvider?.getPlayerPosition();
    if (!position) return;
    playerPosition = position;
    if (props.electricUnicycleEnabled && electricUnicycleMounted && terrain) {
      electricUnicycleWheelPosition = {
        x: position.x,
        y: sampleFlowFestTerrainWorldY(terrain, position.x, position.z),
        z: position.z,
      };
      sampleElectricUnicycleTerrainAttitude();
    }
    // A parked wheel still has a moving player. Reporting only while mounted
    // restored the dismount point after reload instead of the campsite that
    // the player had actually walked to.
    if (props.electricUnicycleEnabled) emitElectricUnicycleUpdate();
    props.onPositionChange?.(position);
    if (pendingRigCorrection) {
      const drifted =
        Math.hypot(
          position.x - pendingRigCorrection.expectedX,
          position.z - pendingRigCorrection.expectedZ
        ) > RIG_CORRECTION_DRIFT_TOLERANCE_METERS;
      pendingRigCorrection.framesRemaining -= 1;
      if (drifted || pendingRigCorrection.framesRemaining <= 0) {
        pendingRigCorrection = null;
      } else if (reviewCameraRigBoom().forward > 0) {
        const { cameraId } = pendingRigCorrection;
        pendingRigCorrection = null;
        teleportToReviewCamera(cameraId, true);
      }
    }
    if (props.onCameraPoseChange && reviewCamera) {
      reviewCamera.getWorldPosition(cameraWorldPosition);
      props.onCameraPoseChange({
        x: cameraWorldPosition.x,
        y: cameraWorldPosition.y,
        z: cameraWorldPosition.z,
        yawRadians: viewYawRadians,
        pitchRadians: viewPitchRadians,
        horizontalFovDegrees: activeHorizontalFov,
      });
    }
  });

  onDestroy(() => {
    disposed = true;
    clearElectricUnicycleParkedBody();
    if (playerState && physicsState) {
      disposePlayerController(physicsState, playerState);
    }
    clearProductionCollisionBodies();
    if (physicsState) disposePhysicsWorld(physicsState);
    activeTerrainBodies.clear();
    activeTerrainColliderWindowKey = null;
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
    delete (globalThis as Record<string, unknown>).__flowFestEuc;
  });
</script>

{#if (props.ambientLighting ?? "graybox-daylight") === "graybox-daylight"}
  <T.Color attach="background" args={["#b8c4b1"]} />
  <T.HemisphereLight color="#eef3e7" groundColor="#445044" intensity={1.25} />
  <T.DirectionalLight
    position={[-180, 260, 120]}
    color="#fff5dc"
    intensity={1.7}
    castShadow={false}
  />
{/if}

{#if terrainHost}
  <T is={terrainHost.root} />
{/if}
{#if barrier}
  <T is={barrier.mesh} />
{/if}
{#if overlay && props.showReviewOverlay !== false}
  <T is={overlay} />
{/if}

{#if props.electricUnicycleEnabled && initialized}
  <FlowFestElectricUnicycle
    position={electricUnicycleWheelPosition}
    dynamics={electricUnicycleDynamics}
    terrainAttitude={electricUnicycleTerrainAttitude}
    mounted={electricUnicycleMounted}
    lightsOn={props.electricUnicycleLightsOn ?? false}
    longitudinalAccelerationMetersPerSecondSquared={electricUnicycleLongitudinalAcceleration}
    onMountedPoseDiagnostic={handleMountedPoseDiagnostic}
  />
{/if}

{#if initialized && physicsProvider}
  {#key cameraRevision}
    <T.PerspectiveCamera
      makeDefault
      bind:ref={reviewCamera}
      fov={verticalCameraFov}
      near={0.1}
      far={10000}
    />
    <UnifiedCameraController
      destinationId={DESTINATION_ID}
      destinationDefaults={{
        [DESTINATION_ID]:
          props.electricUnicycleEnabled && electricUnicycleMounted
            ? CameraMode.THIRD_PERSON
            : CameraMode.FIRST_PERSON,
      }}
      preferencesKey="flow-fest-gate2-camera"
      {avatarState}
      {physicsProvider}
      cameraCollisionProbe={probeThirdPersonCameraCollision}
      enabled={true}
      initialYaw={playerYaw}
      {initialPitch}
      externalYaw={props.electricUnicycleEnabled && electricUnicycleMounted
        ? playerYaw
        : null}
      allowedModes={props.electricUnicycleEnabled && electricUnicycleMounted
        ? [CameraMode.THIRD_PERSON]
        : [CameraMode.FIRST_PERSON]}
      disableModeToggle={true}
      showControlsHint={false}
      moveSpeed={props.moveSpeedMetersPerSecond ??
        REVIEW_WALK_SPEED_METERS_PER_SECOND}
      sprintMultiplier={props.sprintMultiplier ?? 1}
      jumpForce={props.jumpForce ?? 0}
      gravity={9.81}
      maximumFrameDeltaSeconds={props.electricUnicycleEnabled &&
      electricUnicycleMounted
        ? FLOW_FEST_EUC_CONFIG.maximumSimulationCatchUpSeconds
        : undefined}
      firstPersonCameraOffset={CAMERA_OFFSET +
        (props.electricUnicycleEnabled && electricUnicycleMounted
          ? FLOW_FEST_EUC_CONFIG.mountedEyeHeightGainMeters
          : 0)}
      enableSprint={(props.enableSprint ?? false) &&
        !(props.electricUnicycleEnabled && electricUnicycleMounted)}
      enableJump={(props.enableJump ?? false) &&
        !(props.electricUnicycleEnabled && electricUnicycleMounted)}
      enableCrouch={(props.enableCrouch ?? false) &&
        !(props.electricUnicycleEnabled && electricUnicycleMounted)}
      enableNoclip={false}
      onModeChange={(nextMode) => {
        activeCameraMode = nextMode;
        const proof = (globalThis as Record<string, unknown>)
          .__flowFestGate2 as Record<string, unknown> | undefined;
        const movement = proof?.movement as Record<string, unknown> | undefined;
        if (movement) movement.cameraMode = nextMode;
      }}
      onRotationChange={(yaw, pitch) => {
        viewYawRadians = yaw;
        viewPitchRadians = pitch;
        props.onViewRotationChange?.(yaw, pitch);
      }}
      onInputStateChange={(input) => {
        if (props.electricUnicycleEnabled) {
          handleElectricUnicycleCodes(input.activeCodes);
        }
        const proof = (globalThis as Record<string, unknown>)
          .__flowFestGate2 as Record<string, unknown> | undefined;
        const movement = proof?.movement as Record<string, unknown> | undefined;
        if (movement) movement.input = input;
      }}
      onControlReadinessChange={(ready) => {
        const proof = (globalThis as Record<string, unknown>)
          .__flowFestGate2 as Record<string, unknown> | undefined;
        const movement = proof?.movement as Record<string, unknown> | undefined;
        if (movement) movement.controllerReady = ready;
      }}
    />
  {/key}
{/if}
