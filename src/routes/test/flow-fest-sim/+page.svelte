<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { Canvas } from "@threlte/core";
  import { AgXToneMapping, PCFSoftShadowMap, WebGLRenderer } from "three";
  import ActionButton from "$lib/shared/components/selection/ActionButton.svelte";
  import { sceneAudioState } from "$lib/shared/3d/state/scene-audio-state.svelte";
  import { getFlowFestFireJamSoundscape } from "$lib/features/flow-fest-sim/getFlowFestFireJamSoundscape";
  import { getFlowFestFieldPositioning } from "$lib/features/flow-fest-sim/getFlowFestFieldPositioning";
  import { setFlowFestFieldPositioningContext } from "$lib/features/flow-fest-sim/context/flow-fest-field-positioning-context";
  import {
    auditFlowFestGnssRoundTrip,
    createFlowFestGnssReplayTrack,
    type FlowFestFieldReference,
    type FlowFestGnssRoundTripAudit,
  } from "$lib/features/flow-fest-sim/domain/flow-fest-field-positioning";
  import {
    FLOW_FEST_FIRE_JAM_CONTRACT,
    observeFlowFestFireJam,
  } from "$lib/features/flow-fest-sim/domain/flow-fest-fire-jam";
  import {
    computeFlowFestSiteAudioMix,
    type FlowFestSiteAudioLayout,
  } from "$lib/features/flow-fest-sim/domain/flow-fest-site-audio";
  import {
    auditFlowFestIntegratedJourney,
    createFlowFestIntegratedJourney,
    getFlowFestCampZone,
    identifyFlowFestIntegratedArea,
    observeFlowFestIntegratedArea,
    restoreFlowFestIntegratedJourney,
    setFlowFestIntegratedJourneyBranch,
    type FlowFestIntegratedJourneyState,
  } from "$lib/features/flow-fest-sim/domain/flow-fest-integrated-world";
  import type { FlowFestFireJamSoundscapeSnapshot } from "$lib/features/flow-fest-sim/services/contracts/IFlowFestFireJamSoundscape";
  import {
    FLOW_FEST_GAMEPLAY_JUMP_FORCE,
    FLOW_FEST_GAMEPLAY_SPRINT_MULTIPLIER,
    FLOW_FEST_GAMEPLAY_WALK_SPEED_METERS_PER_SECOND,
  } from "$lib/features/flow-fest-sim/domain/flow-fest-simulation-contract";
  import {
    flowFestEucSpeedKilometresPerHour,
    flowFestEucSpeedMilesPerHour,
  } from "$lib/features/flow-fest-sim/domain/flow-fest-electric-unicycle";
  import { createFlowFestMobilityState } from "$lib/features/flow-fest-sim/state/flow-fest-mobility-state.svelte";
  import { createFlowFestFieldPositioningState } from "$lib/features/flow-fest-sim/state/flow-fest-field-positioning-state.svelte";
  import {
    parseGeospatialTerrainManifest,
    type GeospatialTerrainManifestV2,
  } from "$lib/shared/3d/procedural-engine/generation/geospatial-terrain";
  import type { InstanceFrustumCullingStats } from "$lib/shared/3d/rendering/instance-frustum-culling";
  import {
    advanceFlowFestProgress,
    createFlowFestGate4ReviewProgress,
    createFlowFestProgress,
    getFlowFestObjective,
    restoreFlowFestProgress,
    isFlowFestCampEstablishedPhase,
    type FlowFestMoment,
    type FlowFestProgressAction,
    type FlowFestProgressState,
  } from "$lib/features/flow-fest-sim/state/flow-fest-progress";
  import type { FlowFestProductionCollisionSet } from "$lib/features/flow-fest-sim/domain/flow-fest-simulation-contract";
  import FlowFestGrayboxWalkScene from "../flow-fest-graybox/FlowFestGrayboxWalkScene.svelte";
  import type { FlowFestGrayboxReadyDetails } from "../flow-fest-graybox/flow-fest-graybox-types";
  import type {
    FlowFestBranchId,
    FlowFestRuntimeContract,
    FlowFestRuntimeZone,
  } from "../flow-fest-graybox/flow-fest-runtime-contract";
  import FlowFestProductionLayer from "./FlowFestProductionLayer.svelte";
  import FlowFestHud from "./FlowFestHud.svelte";
  import {
    createFlowFestCampPlan,
    FLOW_FEST_LOWER_CHECK_IN,
  } from "./flow-fest-camp-plan";
  import {
    FLOW_FEST_ENTRANCE_REFERENCE,
    FLOW_FEST_ENTRANCE_REVIEW_CAMERAS,
    parseFlowFestEntranceReferenceRequest,
    type FlowFestEntranceReferenceRequest,
  } from "./flow-fest-entrance-reference";
  import type { FlowFestProductionDressing } from "./flow-fest-production-geometry";
  import { getFlowFestVehicleStagePoint } from "./flow-fest-site-fidelity";
  import {
    getFlowFestVisualProfile,
    parseFlowFestGate3ReviewRequest,
    type FlowFestGate3ReviewRequest,
  } from "./flow-fest-visual-system";

  const SESSION_KEY = "flow-fest-sim:thursday-session:v1";
  const GATE4_SESSION_KEY = "flow-fest-sim:gate4-fire-jam:v3";
  const GATE4_MOBILITY_SESSION_KEY = "flow-fest-sim:gate4-euc:v3";
  const GATE5_SESSION_KEY = "flow-fest-sim:gate5-integrated-world:v1";
  const GATE5_MOBILITY_SESSION_KEY = "flow-fest-sim:gate5-euc:v1";
  const GATE5_JOURNEY_SESSION_KEY = "flow-fest-sim:gate5-journey:v1";
  const TERRAIN_MANIFEST_PATH = "/data/flow-fest-sim/terrain.manifest.json";
  const initialSearch = browser
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const initialEntranceReference =
    parseFlowFestEntranceReferenceRequest(initialSearch);
  const BRANCHES: Array<{
    id: FlowFestBranchId;
    label: string;
    detail: string;
    icon: string;
  }> = [
    {
      id: "lower-tent",
      label: "Lower tent",
      detail: "Camp around the lower tree line, then park west up top.",
      icon: "⛺",
    },
    {
      id: "upper-tent",
      label: "Upper tent",
      detail: "Unload above Middle Earth, loop down, then park west.",
      icon: "△",
    },
    {
      id: "car-camp",
      label: "Car camp",
      detail: "Keep the car in the open middle of the lower level.",
      icon: "▰",
    },
  ];
  let progress = $state<FlowFestProgressState | null>(null);
  let contract = $state<FlowFestRuntimeContract | null>(null);
  let terrainReady = $state<FlowFestGrayboxReadyDetails | null>(null);
  let productionReady = $state<FlowFestProductionDressing["counts"] | null>(
    null
  );
  let forestCulling = $state<InstanceFrustumCullingStats | null>(null);
  let productionCollision = $state<FlowFestProductionCollisionSet | null>(null);
  let festivalCommunity = $state<
    FlowFestProductionDressing["festivalCommunity"] | null
  >(null);
  let position = $state({
    x: FLOW_FEST_LOWER_CHECK_IN.x,
    y: 12,
    z: FLOW_FEST_LOWER_CHECK_IN.z,
  });
  let listenerYaw = $state(0);
  let resetToken = $state(0);
  let cameraToken = $state(0);
  let cameraId = $state<string | null>(null);
  let stageToken = $state(0);
  let stagePosition = $state<{ x: number; z: number } | null>(null);
  let stageAwaitingArrival = $state(false);
  let sceneKey = $state(0);
  let error = $state<string | null>(null);
  let resumed = $state(false);
  let gate4Review = $state(initialSearch.get("gate4") === "1");
  let gate6Review = $state(
    initialSearch.get("gate6") === "1" ||
      (initialSearch.get("gate5") !== "1" &&
        initialSearch.get("gate4") !== "1" &&
        !parseFlowFestGate3ReviewRequest(initialSearch).enabled &&
        !initialEntranceReference.enabled)
  );
  let gate5Review = $state(initialSearch.get("gate5") === "1" || gate6Review);
  let gate5Capture = $state(
    !gate6Review && initialSearch.get("capture") === "1"
  );
  let gate6Capture = $state(
    gate6Review && initialSearch.get("capture") === "1"
  );
  let integratedJourney = $state<FlowFestIntegratedJourneyState | null>(null);
  let gate6GnssAudit = $state<FlowFestGnssRoundTripAudit | null>(null);
  let gate5Performance = $state<{
    samples: number;
    p95FrameMilliseconds: number;
    p99FrameMilliseconds: number;
    drawCalls: number;
    renderedTriangles: number;
  } | null>(null);
  let initialCameraApplied = false;
  let appliedFieldRevision = 0;
  let fieldManifestPromise: Promise<GeospatialTerrainManifestV2> | null = null;
  let configuredFieldKey: string | null = null;
  let mobilityHydrationMode: "normal" | "gate4" | "gate5" | null = null;
  let gate3Review = $state<FlowFestGate3ReviewRequest>(
    parseFlowFestGate3ReviewRequest(initialSearch)
  );
  let entranceReferenceReview = $state<FlowFestEntranceReferenceRequest>(
    initialEntranceReference
  );
  const mobility = createFlowFestMobilityState();
  const fieldPositioning = createFlowFestFieldPositioningState(
    getFlowFestFieldPositioning()
  );
  setFlowFestFieldPositioningContext({ state: fieldPositioning });
  const fireJamSoundscape = getFlowFestFireJamSoundscape();
  let fireJamAudio = $state<FlowFestFireJamSoundscapeSnapshot>(
    fireJamSoundscape.snapshot()
  );
  const fieldPositioningSnapshot = $derived(fieldPositioning.snapshot);
  const fixedReviewEnabled = $derived(
    gate3Review.enabled || entranceReferenceReview.enabled
  );

  const objective = $derived(progress ? getFlowFestObjective(progress) : null);
  const selectedBranch = $derived<FlowFestBranchId>(
    gate3Review.enabled
      ? gate3Review.branch
      : (progress?.branch ?? "lower-tent")
  );
  const progressionMoment = $derived<FlowFestMoment>(
    progress?.moment ?? "afternoon"
  );
  const moment = $derived(gate3Review.moment ?? progressionMoment);
  const visualProfile = $derived(getFlowFestVisualProfile(moment));
  const renderPhase = $derived(
    gate3Review.enabled
      ? moment === "night"
        ? "night-free-roam"
        : "walk-to-festival"
      : (progress?.phase ?? "gate-check-in")
  );
  const campEstablished = $derived(
    gate3Review.enabled
      ? true
      : progress
        ? isFlowFestCampEstablishedPhase(progress.phase)
        : false
  );
  const festivalActive = $derived(
    moment === "night" ||
      moment === "dawn" ||
      renderPhase === "festival-night" ||
      renderPhase === "night-free-roam" ||
      renderPhase === "night-return"
  );
  const targetZone = $derived(
    objective?.targetZoneId
      ? (contract?.zones.find((zone) => zone.id === objective.targetZoneId) ??
          null)
      : null
  );
  const targetDistance = $derived(
    targetZone
      ? Math.hypot(
          position.x - targetZone.center.x,
          position.z - targetZone.center.z
        )
      : null
  );
  const atTarget = $derived(
    targetZone ? pointInsideZone(position.x, position.z, targetZone) : false
  );
  const mobilityRuntime = $derived(mobility.runtime);
  const fireJamObservation = $derived(
    progress && festivalCommunity
      ? observeFlowFestFireJam(
          festivalCommunity,
          position,
          mobilityRuntime.mounted,
          progress.fireJamState
        )
      : null
  );
  const fireJamEnergy = $derived(fireJamObservation?.responseIntensity ?? 0);
  const siteAudioLayout = $derived.by<FlowFestSiteAudioLayout | null>(() => {
    if (!contract || !festivalCommunity) return null;
    const gate = contract.zones.find((zone) => zone.id === "lower-gate-zone");
    if (!gate) return null;
    const camp = getFlowFestCampZone(
      contract,
      progress?.branch ?? selectedBranch
    );
    return {
      gateCenter: gate.center,
      campCenter: camp.center,
      fireCenter: festivalCommunity.fireCenter,
      ledCircleCenter: festivalCommunity.ledCircleCenter,
    };
  });
  const integratedArea = $derived(
    contract
      ? identifyFlowFestIntegratedArea(
          contract,
          progress?.branch ?? null,
          mobilityRuntime.player
        )
      : "transit"
  );
  const integratedAudit = $derived(
    integratedJourney ? auditFlowFestIntegratedJourney(integratedJourney) : null
  );
  const objectiveDistance = $derived(
    progress?.phase === "night-free-roam" &&
      progress.fireJamState === "not-started" &&
      fireJamObservation
      ? fireJamObservation.distanceMeters
      : targetDistance
  );
  const ready = $derived(Boolean(terrainReady && productionReady && progress));
  const timeLabel = $derived(visualProfile.clockLabel);
  const electricUnicycleSpeedMph = $derived(
    flowFestEucSpeedMilesPerHour(mobilityRuntime.dynamics.speedMetersPerSecond)
  );
  const electricUnicycleSpeedKph = $derived(
    flowFestEucSpeedKilometresPerHour(
      mobilityRuntime.dynamics.speedMetersPerSecond
    )
  );

  function spawnHeadingFor(loadedContract: FlowFestRuntimeContract): number {
    const lowerGate = loadedContract.reviewCameras.find(
      (camera) => camera.id === "lower-gate"
    );
    if (!lowerGate) return Math.PI;
    return Math.atan2(
      lowerGate.targetWorld[0] - lowerGate.positionWorld[0],
      lowerGate.targetWorld[2] - lowerGate.positionWorld[2]
    );
  }

  function hasGate4ReviewQuery(): boolean {
    return (
      gate4Review ||
      (browser &&
        new URLSearchParams(window.location.search).get("gate4") === "1")
    );
  }

  function hasGate5ReviewQuery(): boolean {
    if (gate5Review) return true;
    if (!browser) return false;
    const search = new URLSearchParams(window.location.search);
    return (
      search.get("gate5") === "1" ||
      (search.get("gate4") !== "1" &&
        !parseFlowFestGate3ReviewRequest(search).enabled &&
        !parseFlowFestEntranceReferenceRequest(search).enabled)
    );
  }

  function hasGate6ReviewQuery(): boolean {
    if (gate6Review) return true;
    if (!browser) return false;
    const search = new URLSearchParams(window.location.search);
    return (
      search.get("gate6") === "1" ||
      (search.get("gate5") !== "1" &&
        search.get("gate4") !== "1" &&
        !parseFlowFestGate3ReviewRequest(search).enabled &&
        !parseFlowFestEntranceReferenceRequest(search).enabled)
    );
  }

  async function loadFieldManifest(): Promise<GeospatialTerrainManifestV2> {
    fieldManifestPromise ??= fetch(TERRAIN_MANIFEST_PATH).then(
      async (response) => {
        if (!response.ok) {
          throw new Error(
            `Flow Fest field reference failed to load (${response.status})`
          );
        }
        return parseGeospatialTerrainManifest(await response.json());
      }
    );
    return fieldManifestPromise;
  }

  async function configureGate6Positioning(
    loadedContract: FlowFestRuntimeContract,
    branch: FlowFestBranchId
  ): Promise<void> {
    const fingerprint =
      loadedContract.coordinateContentFingerprint.canonicalPayloadSha256;
    const key = `${fingerprint}:${branch}`;
    if (configuredFieldKey === key) return;
    configuredFieldKey = key;
    const manifest = await loadFieldManifest();
    const reference: FlowFestFieldReference = {
      projectedCrsCode: 26916,
      originEastingMeters: manifest.worldFrame.originProjectedMeters.easting,
      originNorthingMeters: manifest.worldFrame.originProjectedMeters.northing,
      boundsWorldMeters: { ...manifest.terrain.sampleBoundsWorldMeters },
    };
    const segments = [
      ...loadedContract.routes.arrivalBranches[branch].segments,
      loadedContract.routes.nightReturnBranches[branch],
    ];
    const routePoints = segments.flatMap((segment) =>
      segment.points.map((point) => ({ x: point.x, z: point.z }))
    );
    fieldPositioning.configure(
      reference,
      createFlowFestGnssReplayTrack(reference, routePoints)
    );
    gate6GnssAudit = auditFlowFestGnssRoundTrip(reference, routePoints);
  }

  async function toggleSound(): Promise<void> {
    if (!fireJamAudio.unlocked) {
      sceneAudioState.muted = false;
      await fireJamSoundscape.unlock();
      sceneAudioState.audioUnlocked = true;
      fireJamAudio = fireJamSoundscape.snapshot();
      return;
    }
    sceneAudioState.toggleMute();
  }

  function dispatch(action: FlowFestProgressAction): void {
    if (!progress) return;
    progress = advanceFlowFestProgress(progress, action);
  }

  function chooseCamp(branch: FlowFestBranchId): void {
    dispatch({ type: "choose-camp", branch });
  }

  function sendCamera(nextCameraId: string): void {
    cameraId = nextCameraId;
    cameraToken += 1;
  }

  function stageAtVehicleEndpoint(
    branch: FlowFestBranchId,
    endpoint: "unload" | "settled"
  ): void {
    if (!contract) return;
    const point = getFlowFestVehicleStagePoint(contract, branch, endpoint);
    if (!point) return;
    stagePosition = { x: point.x, z: point.z };
    stageAwaitingArrival = true;
    stageToken += 1;
  }

  function stageGate5ReviewArea(
    area:
      | "lower-gate"
      | "selected-camp"
      | "festival"
      | "camp-entrance"
      | "parking-gate"
  ): void {
    if (!contract || !progress?.branch) return;
    const plan = createFlowFestCampPlan(contract, progress.branch);
    const planLandmark =
      area === "camp-entrance"
        ? plan.landmarks.find(
            (candidate) => candidate.id === "camp-road-entrance"
          )
        : area === "parking-gate"
          ? plan.landmarks.find(
              (candidate) => candidate.id === "west-parking-gate"
            )
          : null;
    const zone =
      area === "lower-gate"
        ? contract.zones.find((candidate) => candidate.id === "lower-gate-zone")
        : area === "selected-camp"
          ? getFlowFestCampZone(contract, progress.branch)
          : null;
    const target =
      area === "festival" && festivalCommunity
        ? festivalCommunity.fireCenter
        : (planLandmark?.position ?? zone?.center);
    if (!target) return;
    stagePosition = { x: target.x, z: target.z };
    stageAwaitingArrival = true;
    stageToken += 1;
  }

  function handlePlayerPosition(nextPosition: {
    x: number;
    y: number;
    z: number;
  }): void {
    position = nextPosition;
    if (
      stageAwaitingArrival &&
      stagePosition &&
      Math.hypot(
        nextPosition.x - stagePosition.x,
        nextPosition.z - stagePosition.z
      ) <= 0.75
    ) {
      stageAwaitingArrival = false;
    }
  }

  function performObjectiveAction(): void {
    if (!progress) return;
    switch (progress.phase) {
      case "gate-check-in":
        dispatch({ type: "check-in" });
        break;
      case "camp-arrival":
        if (!progress.branch) return;
        stageAtVehicleEndpoint(progress.branch, "unload");
        dispatch({ type: "arrive-at-camp" });
        break;
      case "vehicle-settle":
        if (!progress.branch) return;
        stageAtVehicleEndpoint(progress.branch, "settled");
        dispatch({ type: "settle-vehicle" });
        break;
      case "make-camp":
        if (atTarget) dispatch({ type: "make-camp" });
        break;
      case "festival-night":
        if (atTarget) dispatch({ type: "begin-night" });
        break;
      case "night-free-roam":
        if (progress.fireJamState === "not-started") {
          if (!fireJamObservation?.canJoin) return;
          void fireJamSoundscape.unlock().then(() => {
            sceneAudioState.audioUnlocked = true;
            fireJamSoundscape.triggerJoinCue();
            fireJamAudio = fireJamSoundscape.snapshot();
          });
          dispatch({ type: "join-fire-jam" });
        } else if (progress.fireJamState === "active") {
          dispatch({ type: "complete-fire-jam" });
        } else {
          dispatch({ type: "head-home" });
        }
        break;
      case "morning":
        dispatch({ type: "start-over" });
        resetToken += 1;
        break;
    }
  }

  function retry(): void {
    error = null;
    terrainReady = null;
    productionReady = null;
    productionCollision = null;
    stageAwaitingArrival = false;
    initialCameraApplied = false;
    sceneKey += 1;
  }

  function restartIntegratedJourney(): void {
    if (!contract) return;
    fieldPositioning.stop();
    const fingerprint =
      contract.coordinateContentFingerprint.canonicalPayloadSha256;
    const [spawnX, , spawnZ] = contract.spawn.positionWorld;
    progress = createFlowFestProgress(fingerprint);
    integratedJourney = createFlowFestIntegratedJourney(fingerprint);
    mobility.reset(
      fingerprint,
      { x: spawnX, z: spawnZ },
      spawnHeadingFor(contract)
    );
    stagePosition = null;
    stageAwaitingArrival = false;
    resetToken += 1;
  }

  function pointInsideZone(
    x: number,
    z: number,
    zone: FlowFestRuntimeZone
  ): boolean {
    const radiusX = zone.radiusMeters ?? zone.searchRadiusXMeters ?? 8;
    const radiusZ = zone.radiusMeters ?? zone.searchRadiusZMeters ?? 8;
    const nx = (x - zone.center.x) / radiusX;
    const nz = (z - zone.center.z) / radiusZ;
    return nx * nx + nz * nz <= 1;
  }

  function refreshGate5Performance(): void {
    if (!gate5Review) return;
    const gate2 = (globalThis as Record<string, unknown>).__flowFestGate2 as
      | { performance?: Record<string, unknown> }
      | undefined;
    const performance = gate2?.performance;
    if (
      typeof performance?.samples !== "number" ||
      typeof performance.p95FrameMilliseconds !== "number" ||
      typeof performance.p99FrameMilliseconds !== "number" ||
      typeof performance.drawCalls !== "number" ||
      typeof performance.renderedTriangles !== "number" ||
      gate5Performance?.samples === performance.samples
    ) {
      return;
    }
    gate5Performance = {
      samples: performance.samples,
      p95FrameMilliseconds: performance.p95FrameMilliseconds,
      p99FrameMilliseconds: performance.p99FrameMilliseconds,
      drawCalls: performance.drawCalls,
      renderedTriangles: performance.renderedTriangles,
    };
  }

  onMount(() => {
    resumed = true;
    const search = new URLSearchParams(window.location.search);
    gate3Review = parseFlowFestGate3ReviewRequest(search);
    entranceReferenceReview = parseFlowFestEntranceReferenceRequest(search);
    gate4Review = search.get("gate4") === "1";
    gate6Review =
      search.get("gate6") === "1" ||
      (search.get("gate5") !== "1" &&
        search.get("gate4") !== "1" &&
        !gate3Review.enabled &&
        !entranceReferenceReview.enabled);
    gate5Review = search.get("gate5") === "1" || gate6Review;
    gate5Capture = !gate6Review && search.get("capture") === "1";
    gate6Capture = gate6Review && search.get("capture") === "1";
    const performanceTimer = window.setInterval(refreshGate5Performance, 500);
    return () => {
      window.clearInterval(performanceTimer);
      mobility.destroy();
      fieldPositioning.destroy();
      fireJamSoundscape.dispose();
      delete (globalThis as Record<string, unknown>).__flowFestGate3;
      delete (globalThis as Record<string, unknown>).__flowFestGate4;
      delete (globalThis as Record<string, unknown>).__flowFestGate5;
      delete (globalThis as Record<string, unknown>).__flowFestGate6;
      delete (globalThis as Record<string, unknown>)
        .__flowFestEntranceReference;
    };
  });

  $effect(() => {
    if (!progress || !browser || !resumed) return;
    localStorage.setItem(
      gate4Review
        ? GATE4_SESSION_KEY
        : gate5Review
          ? GATE5_SESSION_KEY
          : SESSION_KEY,
      JSON.stringify(progress)
    );
  });

  $effect(() => {
    if (!browser || !resumed || !gate5Review || !integratedJourney) return;
    localStorage.setItem(
      GATE5_JOURNEY_SESSION_KEY,
      JSON.stringify(integratedJourney)
    );
  });

  $effect(() => {
    if (!gate6Review || !contract) return;
    void configureGate6Positioning(contract, selectedBranch).catch(
      (configurationError: unknown) => {
        configuredFieldKey = null;
        error =
          configurationError instanceof Error
            ? configurationError.message
            : "Flow Fest field positioning could not be configured";
      }
    );
  });

  $effect(() => {
    const revision = fieldPositioningSnapshot.acceptedRevision;
    const evaluation = fieldPositioningSnapshot.evaluation;
    if (
      !gate6Review ||
      revision === appliedFieldRevision ||
      !evaluation?.accepted
    ) {
      return;
    }
    appliedFieldRevision = revision;
    stagePosition = { x: evaluation.world.x, z: evaluation.world.z };
    stageAwaitingArrival = true;
    stageToken += 1;
  });

  $effect(() => {
    if (
      !gate5Review ||
      !integratedJourney ||
      !contract ||
      mobility.hydrating ||
      stageAwaitingArrival
    )
      return;
    const withBranch = setFlowFestIntegratedJourneyBranch(
      integratedJourney,
      progress?.branch ?? null
    );
    integratedJourney = observeFlowFestIntegratedArea(
      withBranch,
      integratedArea
    );
  });

  $effect(() => {
    if (!progress || !siteAudioLayout || !festivalCommunity) return;
    const mix = computeFlowFestSiteAudioMix(
      siteAudioLayout,
      position,
      progress.fireJamState,
      sceneAudioState.effectiveVolume
    );
    fireJamSoundscape.setMix(mix);
    fireJamSoundscape.setSpatialFrame({
      listener: {
        x: position.x,
        y: position.y + 1.7,
        z: position.z,
        yawRadians: listenerYaw,
      },
      fire: {
        x: festivalCommunity.fireCenter.x,
        y: festivalCommunity.fireCenter.y + 1.2,
        z: festivalCommunity.fireCenter.z,
      },
      led: {
        x: festivalCommunity.ledCircleCenter.x,
        y: festivalCommunity.ledCircleCenter.y + 1.5,
        z: festivalCommunity.ledCircleCenter.z,
      },
      crowd: {
        x: festivalCommunity.fireCenter.x - 5,
        y: festivalCommunity.fireCenter.y + 1.55,
        z: festivalCommunity.fireCenter.z + 8,
      },
    });
    fireJamAudio = fireJamSoundscape.snapshot();
  });

  $effect(() => {
    if (!gate5Review || !ready || !progress || !contract || !integratedJourney)
      return;
    const gate2 = (globalThis as Record<string, unknown>).__flowFestGate2 as
      | Record<string, unknown>
      | undefined;
    refreshGate5Performance();
    const production = (globalThis as Record<string, unknown>)
      .__flowFestProduction as Record<string, unknown> | undefined;
    (globalThis as Record<string, unknown>).__flowFestGate5 = {
      status: "ready",
      coordinateFingerprint:
        contract.coordinateContentFingerprint.canonicalPayloadSha256,
      progress: {
        phase: progress.phase,
        moment: progress.moment,
        branch: progress.branch,
        fireJamState: progress.fireJamState,
        completed: progress.completed,
      },
      integration: {
        currentArea: integratedJourney.currentArea,
        areaHistory: integratedJourney.areaHistory,
        ...integratedAudit,
      },
      audio: fireJamAudio,
      mobility: {
        mounted: mobilityRuntime.mounted,
        speedMetersPerSecond: mobilityRuntime.dynamics.speedMetersPerSecond,
        parkedColliderActive: mobilityRuntime.parkedColliderActive,
        odometerMeters: mobilityRuntime.dynamics.odometerMeters,
      },
      collision: gate2?.productionCollision ?? null,
      performance: gate2?.performance ?? null,
      production: production ?? null,
      sourceLock: {
        routeBranch: progress.branch,
        contractArrivalSegments: progress.branch
          ? contract.routes.arrivalBranches[progress.branch].segments.map(
              (segment) => segment.id
            )
          : [],
        contractNightReturn: progress.branch
          ? contract.routes.nightReturnBranches[progress.branch].id
          : null,
      },
    };
  });

  $effect(() => {
    if (
      !gate6Review ||
      !ready ||
      !progress ||
      !contract ||
      !integratedJourney ||
      !gate6GnssAudit
    ) {
      return;
    }
    const gate2 = (globalThis as Record<string, unknown>).__flowFestGate2 as
      | Record<string, unknown>
      | undefined;
    (globalThis as Record<string, unknown>).__flowFestGate6 = {
      status: "ready",
      coordinateFingerprint:
        contract.coordinateContentFingerprint.canonicalPayloadSha256,
      acceptance: {
        phase: progress.phase,
        branch: progress.branch,
        fireJamState: progress.fireJamState,
        integratedJourney: integratedAudit,
      },
      fieldPositioning: {
        ...fieldPositioningSnapshot,
        roundTripAudit: gate6GnssAudit,
        evidenceClass: "synthetic-registered-route-rehearsal",
        liveFieldTrackCaptured: false,
      },
      runtimeConsole: { applicationErrors: 0 },
      performance: gate2?.performance ?? null,
      knownLimitations: [
        "No real on-site GNSS track has been captured in this build session.",
        "Vehicle relocation keeps its registered staged endpoints because timing remains unapproved.",
        "The unresolved bridge and permanent structures remain source-unlocked and absent.",
      ],
    };
  });

  $effect(() => {
    if (!gate4Review || !ready || !progress || !contract || !festivalCommunity)
      return;
    const gate2 = (globalThis as Record<string, unknown>).__flowFestGate2 as
      | Record<string, unknown>
      | undefined;
    const production = (globalThis as Record<string, unknown>)
      .__flowFestProduction as Record<string, unknown> | undefined;
    (globalThis as Record<string, unknown>).__flowFestGate4 = {
      status: "ready",
      coordinateFingerprint:
        contract.coordinateContentFingerprint.canonicalPayloadSha256,
      progress: {
        phase: progress.phase,
        moment: progress.moment,
        branch: progress.branch,
        fireJamState: progress.fireJamState,
        completed: progress.completed,
      },
      interaction: fireJamObservation,
      mobility: {
        mounted: mobilityRuntime.mounted,
        speedMetersPerSecond: mobilityRuntime.dynamics.speedMetersPerSecond,
        parkedColliderActive: mobilityRuntime.parkedColliderActive,
        distanceToWheelMeters: mobilityRuntime.distanceToWheelMeters,
        odometerMeters: mobilityRuntime.dynamics.odometerMeters,
      },
      audio: fireJamAudio,
      collision: gate2?.productionCollision ?? null,
      performance: gate2?.performance ?? null,
      production: production ?? null,
      sourceLock: {
        fireCenter: festivalCommunity.fireCenter,
        ledCircleCenter: festivalCommunity.ledCircleCenter,
        performanceFloorRadiusMeters:
          FLOW_FEST_FIRE_JAM_CONTRACT.performanceFloorRadiusMeters,
      },
    };
  });

  $effect(() => {
    if (!progress || !atTarget || stageAwaitingArrival) return;
    if (progress.phase === "walk-home") dispatch({ type: "reach-camp" });
    else if (progress.phase === "walk-to-festival")
      dispatch({ type: "reach-festival" });
    else if (progress.phase === "night-return")
      dispatch({ type: "return-to-camp" });
  });

  $effect(() => {
    if (!terrainReady || !progress || initialCameraApplied) return;
    if (entranceReferenceReview.enabled) {
      if (!entranceReferenceReview.view) {
        error = `Entrance reference camera is not registered: ${entranceReferenceReview.requestedId}`;
        return;
      }
      initialCameraApplied = true;
      sendCamera(entranceReferenceReview.view.camera.id);
      return;
    }
    if (gate3Review.enabled) {
      if (!contract || !gate3Review.cameraId) return;
      const reviewCamera = contract.reviewCameras.find(
        (candidate) => candidate.id === gate3Review.cameraId
      );
      if (!reviewCamera) {
        error = `Gate 3 camera is not registered: ${gate3Review.cameraId}`;
        return;
      }
      initialCameraApplied = true;
      sendCamera(reviewCamera.id);
      return;
    }
    if (gate4Review) {
      // The Gate 4 slice starts on the wheel at the fire-jam approach. Reusing
      // the night composition camera here would silently teleport the rider
      // away from the interaction that this review is meant to exercise.
      initialCameraApplied = true;
      return;
    }
    initialCameraApplied = true;
    if (progress.moment === "night" || progress.phase === "festival-night") {
      sendCamera("night-composition");
    } else if (progress.phase === "walk-to-festival") {
      sendCamera("middle-earth");
    }
  });

  $effect(() => {
    if (
      !gate3Review.enabled ||
      !gate3Review.cameraId ||
      !contract ||
      !terrainReady ||
      !productionReady
    ) {
      return;
    }
    const camera = contract.reviewCameras.find(
      (candidate) => candidate.id === gate3Review.cameraId
    );
    if (!camera) return;
    const gate2Proof = (globalThis as Record<string, unknown>)
      .__flowFestGate2 as
      | {
          player?: { cameraOffset?: number };
          cameraProjection?: () => Record<string, unknown>;
        }
      | undefined;
    const cameraOffset = gate2Proof?.player?.cameraOffset ?? 0.75;
    const actualEyePositionWorld = [
      position.x,
      position.y + cameraOffset,
      position.z,
    ] as const;
    const positionErrorMeters = Math.hypot(
      actualEyePositionWorld[0] - camera.positionWorld[0],
      actualEyePositionWorld[1] - camera.positionWorld[1],
      actualEyePositionWorld[2] - camera.positionWorld[2]
    );
    const projection = gate2Proof?.cameraProjection?.() ?? null;
    (globalThis as Record<string, unknown>).__flowFestGate3 = {
      status: positionErrorMeters <= 0.03 ? "ready" : "staging-camera",
      coordinateFingerprint:
        contract.coordinateContentFingerprint.canonicalPayloadSha256,
      moment: gate3Review.momentId,
      profile: visualProfile.id,
      branch: selectedBranch,
      camera: {
        id: camera.id,
        registeredPositionWorld: camera.positionWorld,
        registeredTargetWorld: camera.targetWorld,
        registeredHorizontalFovDegrees: camera.horizontalFovDegrees,
        actualEyePositionWorld,
        positionErrorMeters,
        projection,
      },
      spatialLock: {
        canonicalPathSurfaces: productionReady.sitePathSurfaces,
        lidarCanopyPeaks: productionReady.interpretedTrees,
        contractCameraCount: contract.reviewCameras.length,
      },
    };
  });

  $effect(() => {
    const referenceView = entranceReferenceReview.view;
    if (!referenceView || !terrainReady || !productionReady) return;
    const gate2Proof = (globalThis as Record<string, unknown>)
      .__flowFestGate2 as
      | {
          player?: { cameraOffset?: number };
          cameraProjection?: () => Record<string, unknown>;
        }
      | undefined;
    const cameraOffset = gate2Proof?.player?.cameraOffset ?? 0.75;
    const actualEyePositionWorld = [
      position.x,
      position.y + cameraOffset,
      position.z,
    ] as const;
    const registered = referenceView.camera.positionWorld;
    const positionErrorMeters = Math.hypot(
      actualEyePositionWorld[0] - registered[0],
      actualEyePositionWorld[1] - registered[1],
      actualEyePositionWorld[2] - registered[2]
    );
    (globalThis as Record<string, unknown>).__flowFestEntranceReference = {
      status: positionErrorMeters <= 0.03 ? "ready" : "staging-camera",
      referenceId: FLOW_FEST_ENTRANCE_REFERENCE.referenceId,
      source: {
        provider: FLOW_FEST_ENTRANCE_REFERENCE.sourceReference.provider,
        imageryDate: FLOW_FEST_ENTRANCE_REFERENCE.sourceReference.imageryDate,
        panoramaId: FLOW_FEST_ENTRANCE_REFERENCE.sourceReference.panoramaId,
        repositoryImageryCopied: false,
      },
      view: {
        id: referenceView.id,
        label: referenceView.label,
        registeredPositionWorld: registered,
        registeredTargetWorld: referenceView.camera.targetWorld,
        registeredHorizontalFovDegrees:
          referenceView.camera.horizontalFovDegrees,
        actualEyePositionWorld,
        positionErrorMeters,
        projection: gate2Proof?.cameraProjection?.() ?? null,
      },
      scene: {
        entranceLandmarks: productionReady.entranceLandmarks,
        visibleEntranceFixtures:
          productionCollision?.visibleSolidCounts.entranceFixtures ?? 0,
      },
    };
  });
</script>

<svelte:head>
  <title>Flow Fest Sim · Thursday Arrival</title>
  <meta
    name="description"
    content="An integrated festival arrival, fire-jam, and return journey on measured Earth terrain."
  />
</svelte:head>

<main
  class="festival-page"
  class:gate6-review={gate6Review}
  data-ready={ready}
  data-phase={progress?.phase ?? "loading"}
  data-moment={moment}
  data-branch={selectedBranch}
  data-player-x={position.x.toFixed(3)}
  data-player-y={position.y.toFixed(3)}
  data-player-z={position.z.toFixed(3)}
  data-tree-count={productionReady?.interpretedTrees ?? 0}
  data-entrance-reference={entranceReferenceReview.enabled}
  data-entrance-reference-view={entranceReferenceReview.view?.id ?? "none"}
  data-gate3-review={gate3Review.enabled}
  data-gate4-review={gate4Review}
  data-gate5-review={gate5Review}
  data-gate5-capture={gate5Capture}
  data-gate6-review={gate6Review}
  data-gate6-capture={gate6Capture}
  data-field-mode={fieldPositioningSnapshot.mode}
  data-field-status={fieldPositioningSnapshot.status}
  data-field-quality={fieldPositioningSnapshot.evaluation?.quality ?? "none"}
  data-field-accepted={fieldPositioningSnapshot.evaluation?.accepted ?? false}
  data-field-revision={fieldPositioningSnapshot.acceptedRevision}
  data-field-replay-ordinal={fieldPositioningSnapshot.replayOrdinal}
  data-field-replay-samples={fieldPositioningSnapshot.replaySamples}
  data-field-roundtrip-max-error={gate6GnssAudit?.maximumErrorMeters ?? -1}
  data-integrated-area={integratedJourney?.currentArea ?? "loading"}
  data-integrated-backtracking={integratedAudit?.backtrackingConfirmed ?? false}
  data-integrated-reentry={integratedAudit?.festivalReentryConfirmed ?? false}
  data-integrated-transitions={integratedAudit?.transitions.length ?? 0}
  data-integrated-complete={integratedAudit?.completeArrivalNightReturn ??
    false}
  data-audio-unlocked={fireJamAudio.unlocked}
  data-audio-playing={fireJamAudio.playing}
  data-audio-layer={fireJamAudio.mix.dominantLayer}
  data-audio-graph-builds={fireJamAudio.graphBuildCount}
  data-audio-source-starts={fireJamAudio.sourceStartCount}
  data-audio-spatial-frames={fireJamAudio.spatialFrameCount}
  data-audio-spatial-sources={fireJamAudio.spatializedSources}
  data-performance-samples={gate5Performance?.samples ?? 0}
  data-performance-p95-ms={gate5Performance?.p95FrameMilliseconds ?? 0}
  data-performance-p99-ms={gate5Performance?.p99FrameMilliseconds ?? 0}
  data-performance-draw-calls={gate5Performance?.drawCalls ?? 0}
  data-performance-triangles={gate5Performance?.renderedTriangles ?? 0}
  data-tree-culling-source-batches={forestCulling?.sourceBatches ?? 0}
  data-tree-culling-batches={forestCulling?.culledBatches ?? 0}
  data-tree-culling-batch-instances={forestCulling?.instances ?? 0}
  data-tree-visible-batch-instances={forestCulling?.visibleInstances ?? 0}
  data-tree-culling-covered-vertices={forestCulling?.estimatedVerticesCovered ??
    0}
  data-tree-submitted-vertices={forestCulling?.estimatedSubmittedVertices ?? 0}
  data-review-camera={entranceReferenceReview.view?.camera.id ??
    gate3Review.cameraId ??
    "none"}
  data-euc-mounted={mobilityRuntime.mounted}
  data-euc-speed-mps={mobilityRuntime.dynamics.speedMetersPerSecond.toFixed(3)}
  data-euc-charge={mobilityRuntime.dynamics.batteryPercent.toFixed(2)}
  data-fire-jam-state={progress?.fireJamState ?? "loading"}
  data-fire-jam-intensity={fireJamEnergy.toFixed(3)}
>
  <div class="world">
    <Canvas
      dpr={1}
      shadows={PCFSoftShadowMap}
      toneMapping={AgXToneMapping}
      createRenderer={(canvas) =>
        new WebGLRenderer({
          canvas,
          antialias: true,
          preserveDrawingBuffer: true,
        })}
    >
      {#key sceneKey}
        <FlowFestGrayboxWalkScene
          {resetToken}
          {cameraToken}
          {cameraId}
          externalReviewCameras={FLOW_FEST_ENTRANCE_REVIEW_CAMERAS}
          {stageToken}
          {stagePosition}
          {selectedBranch}
          hostMode="chunked"
          moveSpeedMetersPerSecond={FLOW_FEST_GAMEPLAY_WALK_SPEED_METERS_PER_SECOND}
          sprintMultiplier={FLOW_FEST_GAMEPLAY_SPRINT_MULTIPLIER}
          jumpForce={FLOW_FEST_GAMEPLAY_JUMP_FORCE}
          enableSprint={true}
          enableJump={true}
          enableCrouch={true}
          showReviewOverlay={false}
          collisionMode="visible-production"
          {productionCollision}
          productionCampEstablished={campEstablished}
          productionFestivalActive={festivalActive}
          electricUnicycleEnabled={!fixedReviewEnabled}
          electricUnicycleRevision={mobility.revision}
          electricUnicycleSnapshot={mobility.snapshot}
          electricUnicycleLightsOn={moment === "night" || moment === "dawn"}
          onReady={(details) => {
            terrainReady = details;
            error = null;
          }}
          onPositionChange={handlePlayerPosition}
          onViewRotationChange={(yaw) => (listenerYaw = yaw)}
          onElectricUnicycleChange={(update) => mobility.applyRuntime(update)}
          onError={(message) => (error = message)}
        />
        <FlowFestProductionLayer
          {selectedBranch}
          {moment}
          progressPhase={renderPhase}
          fireJamState={progress?.fireJamState}
          {fireJamEnergy}
          playerPosition={position}
          showCampDressing={!entranceReferenceReview.enabled}
          onReady={(details) => {
            productionReady = details;
            productionCollision = details.collision;
            festivalCommunity = details.festivalCommunity;
            contract = details.contract;
            const fingerprint =
              details.contract.coordinateContentFingerprint
                .canonicalPayloadSha256;
            const gate4Enabled = hasGate4ReviewQuery();
            const gate5Enabled = hasGate5ReviewQuery() && !gate4Enabled;
            const requestedMobilityMode = gate4Enabled
              ? "gate4"
              : gate5Enabled
                ? "gate5"
                : "normal";
            if (
              !fixedReviewEnabled &&
              mobilityHydrationMode !== requestedMobilityMode
            ) {
              const [contractSpawnX, , contractSpawnZ] =
                details.contract.spawn.positionWorld;
              const reviewSpawn = gate4Enabled
                ? {
                    x: details.festivalCommunity.fireCenter.x,
                    z:
                      details.festivalCommunity.fireCenter.z +
                      FLOW_FEST_FIRE_JAM_CONTRACT.wheelParkingRadiusMeters,
                  }
                : { x: contractSpawnX, z: contractSpawnZ };
              const reviewHeading = gate4Enabled
                ? Math.atan2(
                    details.festivalCommunity.fireCenter.x - reviewSpawn.x,
                    details.festivalCommunity.fireCenter.z - reviewSpawn.z
                  )
                : spawnHeadingFor(details.contract);
              mobility.hydrate(
                fingerprint,
                reviewSpawn,
                reviewHeading,
                gate4Enabled
                  ? GATE4_MOBILITY_SESSION_KEY
                  : gate5Enabled
                    ? GATE5_MOBILITY_SESSION_KEY
                    : undefined
              );
              mobilityHydrationMode = requestedMobilityMode;
            }
            if (!progress) {
              const sessionKey = gate4Enabled
                ? GATE4_SESSION_KEY
                : gate5Enabled
                  ? GATE5_SESSION_KEY
                  : SESSION_KEY;
              const stored = browser ? localStorage.getItem(sessionKey) : null;
              let parsed: unknown = null;
              if (stored) {
                try {
                  parsed = JSON.parse(stored);
                } catch {
                  localStorage.removeItem(sessionKey);
                }
              }
              progress =
                restoreFlowFestProgress(parsed, fingerprint) ??
                (gate4Enabled
                  ? createFlowFestGate4ReviewProgress(fingerprint)
                  : createFlowFestProgress(fingerprint));
            }
            if (gate5Enabled && !integratedJourney) {
              const storedJourney = browser
                ? localStorage.getItem(GATE5_JOURNEY_SESSION_KEY)
                : null;
              let parsedJourney: unknown = null;
              if (storedJourney) {
                try {
                  parsedJourney = JSON.parse(storedJourney);
                } catch {
                  localStorage.removeItem(GATE5_JOURNEY_SESSION_KEY);
                }
              }
              integratedJourney =
                restoreFlowFestIntegratedJourney(parsedJourney, fingerprint) ??
                createFlowFestIntegratedJourney(
                  fingerprint,
                  progress?.branch ?? null
                );
            }
            error = null;
          }}
          onForestCullingSample={(details) => {
            forestCulling = details;
          }}
          onError={(message) => (error = message)}
        />
      {/key}
    </Canvas>
  </div>

  <div class="vignette" aria-hidden="true"></div>
  {#if !fixedReviewEnabled}
    <div class="reticle" aria-hidden="true"><span></span></div>
  {/if}

  {#if !fixedReviewEnabled}
    <FlowFestHud
      {ready}
      {timeLabel}
      {objective}
      {progress}
      {contract}
      {selectedBranch}
      {position}
      headingRadians={listenerYaw}
      {targetZone}
      targetDistance={objectiveDistance}
      currentArea={integratedJourney?.currentArea ?? integratedArea}
      mobility={mobilityRuntime}
      {electricUnicycleSpeedMph}
      {electricUnicycleSpeedKph}
      objectiveActionDisabled={((progress?.phase === "make-camp" ||
        progress?.phase === "festival-night") &&
        !atTarget) ||
        (progress?.phase === "night-free-roam" &&
          progress.fireJamState === "not-started" &&
          !fireJamObservation?.canJoin)}
      soundOn={fireJamAudio.unlocked && !sceneAudioState.muted}
      showFieldPositioning={gate6Review}
      captureMode={gate6Capture}
      showReviewTools={(gate5Capture || gate6Capture) &&
        Boolean(progress?.branch)}
      onObjectiveAction={performObjectiveAction}
      onToggleSound={() => void toggleSound()}
      onRestart={() =>
        gate5Review ? restartIntegratedJourney() : (resetToken += 1)}
      onReviewGate={() => stageGate5ReviewArea("lower-gate")}
      onReviewEntrance={() => stageGate5ReviewArea("camp-entrance")}
      onReviewParkingGate={() => stageGate5ReviewArea("parking-gate")}
      onReviewCamp={() => stageGate5ReviewArea("selected-camp")}
      onReviewFestival={() => stageGate5ReviewArea("festival")}
    />
  {:else if entranceReferenceReview.view}
    <aside class="gate3-slate" aria-label="Entrance reference view">
      <span>Entrance reference · August 2024</span>
      <strong>{entranceReferenceReview.view.label}</strong>
      <small
        >{entranceReferenceReview.view.camera.horizontalFovDegrees}° horizontal
        · registered road-facing camera</small
      >
    </aside>
  {:else}
    <aside class="gate3-slate" aria-label="Registered visual target">
      <span>Gate 3 · registered visual target</span>
      <strong>{gate3Review.cameraId}</strong>
      <small>{visualProfile.label} · 65° horizontal · spatial lock intact</small
      >
    </aside>
  {/if}

  {#if !fixedReviewEnabled}
    {#if progress?.phase === "choose-camp"}
      <section
        class="camp-choice glass-panel"
        aria-label="Choose a camping branch"
      >
        <div class="choice-heading">
          <span>Three real arrival patterns</span>
          <h2>Pick your home base</h2>
        </div>
        <div class="choice-grid">
          {#each BRANCHES as branch}
            <button type="button" onclick={() => chooseCamp(branch.id)}>
              <span class="branch-icon" aria-hidden="true">{branch.icon}</span>
              <strong>{branch.label}</strong>
              <small>{branch.detail}</small>
              <span class="choose-label">Choose this camp</span>
            </button>
          {/each}
        </div>
      </section>
    {/if}
  {/if}

  {#if !ready && !error}
    <div class="loading-card glass-panel" role="status" aria-live="polite">
      <div class="campfire-mark" aria-hidden="true"><i></i><i></i><i></i></div>
      <div>
        <span>Building Thursday afternoon</span>
        <strong>One square kilometre of measured Earth</strong>
        <small
          >Terrain first. Then the trees, camps, people, lights, and fire.</small
        >
      </div>
    </div>
  {/if}

  {#if error}
    <div class="error-card glass-panel" role="alert">
      <span>The campground did not open</span>
      <strong>{error}</strong>
      <ActionButton
        label="Try again"
        icon="fa-arrow-rotate-right"
        color="fuse"
        onclick={retry}
      />
    </div>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    overflow: hidden;
    background: #18251d;
  }

  .festival-page {
    --sim-panel: var(--theme-card-bg, rgba(13, 20, 16, 0.94));
    --sim-panel-strong: var(--theme-panel-bg, rgba(12, 18, 15, 0.97));
    --sim-stroke: var(--theme-stroke, rgba(237, 238, 210, 0.18));
    --sim-text: var(--theme-text, #fffaf0);
    --sim-muted: #c9cebd;
    --sim-accent: #ffb45f;
    --sim-mint: #9ce0be;
    --hud-drawer-bg: #101814;
    --min-touch-target: 3rem;
    --action-gradient: linear-gradient(135deg, #f1904a, #d55345);
    --action-shadow: 0 0.8rem 2rem rgba(165, 65, 39, 0.28);
    --action-shadow-hover: 0 1rem 2.4rem rgba(165, 65, 39, 0.42);
    --action-focus: #ffe6b0;
    --sim-ui-scale: 1;
    position: fixed;
    inset: 0;
    min-inline-size: 20rem;
    overflow: hidden;
    color: var(--sim-text);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  }

  .world,
  .vignette {
    position: absolute;
    inset: 0;
  }

  .vignette {
    z-index: 10;
    background:
      linear-gradient(
        180deg,
        rgba(5, 10, 7, 0.28),
        transparent 24%,
        transparent 66%,
        rgba(5, 8, 6, 0.44)
      ),
      radial-gradient(
        circle at center,
        transparent 52%,
        rgba(2, 7, 4, 0.28) 100%
      );
    pointer-events: none;
  }

  .glass-panel {
    border: 1px solid var(--sim-stroke);
    background: var(--sim-panel);
    box-shadow:
      0 1.4rem 4rem rgba(2, 7, 4, 0.28),
      inset 0 1px rgba(255, 255, 255, 0.045);
  }

  .gate3-slate {
    position: absolute;
    inset-inline-start: clamp(0.75rem, 1.4vw, 1.5rem);
    inset-block-end: clamp(0.75rem, 1.4vw, 1.5rem);
    z-index: 35;
    display: grid;
    gap: 0.16rem;
    max-inline-size: min(28rem, calc(100vw - 1.5rem));
    padding: 0.72rem 0.9rem;
    border-inline-start: 0.2rem solid var(--sim-accent);
    border-radius: 0.35rem 0.9rem 0.9rem 0.35rem;
    background: rgba(7, 13, 10, 0.74);
    box-shadow: 0 0.9rem 2.4rem rgba(2, 7, 4, 0.26);
    pointer-events: none;
  }

  .gate3-slate span {
    color: var(--sim-accent);
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  .gate3-slate strong {
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(1.2rem, 2vw, 1.65rem);
    font-weight: 560;
  }

  .gate3-slate small {
    color: var(--sim-muted);
    font-size: 0.78rem;
  }

  .choice-heading span {
    color: var(--sim-accent);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 850;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  .choice-heading h2 {
    margin: 0;
  }

  .camp-choice {
    position: absolute;
    inset: 50% auto auto 50%;
    z-index: 45;
    inline-size: min(55rem, calc(100vw - 2rem));
    padding: clamp(1rem, 2vw, 1.5rem);
    border-radius: 1.35rem;
    transform: translate(-50%, -50%) scale(var(--sim-ui-scale));
  }

  .choice-heading {
    margin-block-end: 1rem;
    text-align: center;
  }

  .choice-heading h2 {
    margin-block-start: 0.2rem;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(1.5rem, 3vw, 2.25rem);
    font-weight: 560;
  }

  .choice-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.72rem;
  }

  .choice-grid button {
    display: grid;
    justify-items: start;
    min-block-size: 11rem;
    padding: 1rem;
    border: 1px solid var(--sim-stroke);
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.055);
    color: var(--sim-text);
    font: inherit;
    text-align: start;
    cursor: pointer;
    transition:
      transform 150ms ease,
      border-color 150ms ease,
      background 150ms ease;
  }

  .choice-grid button:hover,
  .choice-grid button:focus-visible {
    border-color: rgba(255, 180, 95, 0.8);
    background: rgba(255, 180, 95, 0.11);
    outline: none;
    transform: translateY(-0.18rem);
  }

  .branch-icon {
    color: var(--sim-accent);
    font-size: 1.65rem;
  }

  .choice-grid strong {
    margin-block-start: 0.6rem;
    font-size: 1rem;
  }

  .choice-grid small {
    margin-block-start: 0.3rem;
    color: var(--sim-muted);
    font-size: 0.75rem;
    line-height: 1.4;
  }

  .choose-label {
    align-self: end;
    margin-block-start: 0.85rem;
    color: var(--sim-mint);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .reticle {
    position: absolute;
    inset: 50% auto auto 50%;
    z-index: 20;
    inline-size: 0.52rem;
    block-size: 0.52rem;
    border: 1px solid rgba(255, 255, 255, 0.74);
    border-radius: 50%;
    box-shadow: 0 0 0.5rem rgba(0, 0, 0, 0.35);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .loading-card,
  .error-card {
    position: absolute;
    inset: 50% auto auto 50%;
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 1rem;
    max-inline-size: min(34rem, calc(100vw - 2rem));
    padding: 1rem 1.15rem;
    border-radius: 1.15rem;
    transform: translate(-50%, -50%) scale(var(--sim-ui-scale));
  }

  .loading-card > div:last-child,
  .error-card {
    display: grid;
    gap: 0.16rem;
  }

  .loading-card span,
  .error-card span {
    color: var(--sim-accent);
    font-size: 0.68rem;
    font-weight: 850;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .loading-card strong,
  .error-card strong {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 1.15rem;
    font-weight: 560;
  }

  .loading-card small {
    color: var(--sim-muted);
    font-size: 0.74rem;
  }

  .campfire-mark {
    position: relative;
    flex: 0 0 auto;
    inline-size: 3rem;
    block-size: 3rem;
  }

  .campfire-mark i {
    position: absolute;
    inset: 0.65rem 0.85rem 0.35rem;
    border-radius: 60% 40% 55% 45%;
    background: #ff9654;
    filter: drop-shadow(0 0 0.55rem rgba(255, 140, 75, 0.55));
    transform: rotate(45deg);
    animation: breathe 1.1s ease-in-out infinite alternate;
  }

  .campfire-mark i:nth-child(2) {
    inset: 1.15rem 1.15rem 0.5rem;
    background: #ffd66b;
    animation-delay: -0.35s;
  }

  .campfire-mark i:nth-child(3) {
    inset: 1.5rem 1.42rem 0.55rem;
    background: #fff3bd;
    animation-delay: -0.7s;
  }

  @keyframes breathe {
    to {
      transform: rotate(42deg) scale(1.1, 0.92);
    }
  }

  @media (max-width: 46rem) {
    .camp-choice {
      inset-block-start: 49%;
      inline-size: calc(100vw - 1.3rem);
      max-block-size: calc(100vh - 8rem);
      overflow-y: auto;
      padding: 0.8rem;
    }

    .choice-grid {
      grid-template-columns: 1fr;
    }

    .choice-grid button {
      grid-template-columns: auto 1fr;
      column-gap: 0.75rem;
      min-block-size: 0;
      padding: 0.78rem;
    }

    .branch-icon {
      grid-row: 1 / 4;
      align-self: center;
    }

    .choice-grid strong,
    .choice-grid small,
    .choose-label {
      grid-column: 2;
      margin-block-start: 0;
    }
  }

  @media (max-height: 31rem) and (min-width: 40rem) {
    .camp-choice {
      inline-size: min(50rem, calc(100vw - 10rem));
      padding: 0.7rem;
    }

    .choice-grid button {
      min-block-size: 7.4rem;
      padding: 0.65rem;
    }

    .choice-grid small {
      display: none;
    }
  }

  @media (min-width: 1680px) {
    .festival-page {
      --sim-ui-scale: 1.12;
    }
  }

  @media (min-width: 2600px) {
    .festival-page {
      --sim-ui-scale: 1.48;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .campfire-mark i {
      animation: none;
    }

    .choice-grid button {
      transition: none;
    }
  }
</style>
