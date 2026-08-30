<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { T, useTask, useThrelte } from "@threlte/core";
  import {
    FogExp2,
    type Mesh,
    type MeshStandardMaterial,
    type Object3D,
  } from "three";
  import type { InstanceFrustumCullingStats } from "$lib/shared/3d/rendering/instance-frustum-culling";
  import SkyGradient from "$lib/shared/3d/environments/primitives/SkyGradient.svelte";
  import FallingParticles from "$lib/shared/3d/environments/primitives/FallingParticles.svelte";
  import ForestLighting from "$lib/shared/3d/environments/scenes/forest/ForestLighting.svelte";
  import {
    loadGeospatialEvidenceLayers,
    loadGeospatialTerrain,
    parseGeospatialTerrainManifest,
  } from "$lib/shared/3d/procedural-engine/generation/geospatial-terrain";
  import type {
    FlowFestMoment,
    FlowFestProgressPhase,
  } from "$lib/features/flow-fest-sim/state/flow-fest-progress";
  import { isFlowFestCampEstablishedPhase } from "$lib/features/flow-fest-sim/state/flow-fest-progress";
  import {
    loadFlowFestRuntimeContract,
    type FlowFestBranchId,
    type FlowFestRuntimeContract,
  } from "../flow-fest-graybox/flow-fest-runtime-contract";
  import type { FlowFestFireJamState } from "$lib/features/flow-fest-sim/domain/flow-fest-fire-jam";
  import type { FlowFestLivingCommunityFrame } from "$lib/features/flow-fest-sim/domain/flow-fest-living-fire-jam";
  import {
    buildFlowFestProductionDressing,
    type FlowFestProductionDressing,
  } from "./flow-fest-production-geometry";
  import FlowFestFestivalCommunity from "./FlowFestFestivalCommunity.svelte";
  import FlowFestPopulation from "./FlowFestPopulation.svelte";
  import {
    createFlowFestPopulationSite,
    flowFestTerrainGroundY,
  } from "./flow-fest-population-site";
  import {
    composeFlowFestFireJamLayout,
    flowFestClockLabel,
    flowFestFireJamAttendance,
    type FlowFestPopulationFrame,
    type FlowFestPopulationSite,
  } from "$lib/features/flow-fest-sim/domain/flow-fest-population";
  import type { FlowFestPerformerSequenceProof } from "./flow-fest-performer-sequences";
  import FlowFestForestEcology from "./FlowFestForestEcology.svelte";
  import FlowFestGroundSurface from "./FlowFestGroundSurface.svelte";
  import FlowFestHeroFire from "./FlowFestHeroFire.svelte";
  import { getFlowFestVisualProfile } from "./flow-fest-visual-system";
  import { buildFlowFestEntranceGradedTerrain } from "./flow-fest-entrance-terrain";

  interface Props {
    selectedBranch: FlowFestBranchId;
    moment: FlowFestMoment;
    progressPhase: FlowFestProgressPhase;
    fireJamState?: FlowFestFireJamState;
    fireJamEnergy?: number;
    playerPosition?: { x: number; y: number; z: number };
    showCampDressing?: boolean;
    onForestCullingSample?: (details: InstanceFrustumCullingStats) => void;
    onGrassCullingSample?: (details: InstanceFrustumCullingStats) => void;
    onReady?: (
      details: FlowFestProductionDressing["counts"] & {
        contract: FlowFestRuntimeContract;
        spatialAudit: FlowFestProductionDressing["spatialAudit"];
        collision: FlowFestProductionDressing["collision"];
        festivalCommunity: FlowFestProductionDressing["festivalCommunity"];
        festivalCommunityAudit: FlowFestProductionDressing["festivalCommunityAudit"];
      }
    ) => void;
    onError?: (message: string) => void;
  }

  const props: Props = $props();
  const { renderer, scene } = useThrelte();
  const MANIFEST_PATH = "/data/flow-fest-sim/terrain.manifest.json";

  let dressing = $state<FlowFestProductionDressing | null>(null);
  let contract = $state<FlowFestRuntimeContract | null>(null);
  let heroFireY = $state(12);
  let nightHeartY = $state(12);
  let heroFirePosition = $state({ x: 89, z: -113.5 });
  let nightHeartPosition = $state({ x: 120, z: -103 });
  let readyCommunityAvatarIds = $state<string[]>([]);
  let populationSite = $state<FlowFestPopulationSite | null>(null);
  let fireJamAttendance = $state({ spectators: 0, performers: 0 });
  let builtBranch: FlowFestBranchId | null = null;
  let buildEpoch = 0;
  let destroyed = false;
  let sceneElapsed = 0;
  let animatedLedRings: Object3D[] = [];
  let staticSceneSetupComplete = false;

  const campEstablished = $derived(
    isFlowFestCampEstablishedPhase(props.progressPhase)
  );
  const festivalActive = $derived(
    props.moment === "night" ||
      props.moment === "dawn" ||
      props.progressPhase === "festival-night" ||
      props.progressPhase === "night-free-roam" ||
      props.progressPhase === "night-return"
  );

  // The authored fire-circle layout is the capacity. The population layer says
  // who actually walked in, and the circle is composed down to that.
  const festivalCommunity = $derived(
    dressing
      ? composeFlowFestFireJamLayout(
          dressing.festivalCommunity,
          fireJamAttendance
        )
      : null
  );

  const atmosphere = $derived(getFlowFestVisualProfile(props.moment));
  const forestHemisphere = $derived({
    skyColor: atmosphere.hemisphere.sky,
    groundColor: atmosphere.hemisphere.ground,
    intensity: atmosphere.hemisphere.intensity,
  });
  const forestLighting = $derived({
    key: {
      color: atmosphere.sun.color,
      intensity: atmosphere.sun.intensity,
      direction: atmosphere.sun.direction,
      shadowIntensity: props.moment === "night" ? 0.42 : 0.72,
    },
    fill: { ...atmosphere.fill },
    ambient: { ...atmosphere.ambient },
    stage: { color: "#b9d9d4", intensity: 0, distance: 0 },
  });
  const forestLightAnchor = $derived(
    props.playerPosition ?? {
      x: nightHeartPosition.x,
      y: nightHeartY,
      z: nightHeartPosition.z,
    }
  );
  const forestShadowRefreshToken = $derived(
    [
      props.selectedBranch,
      props.moment,
      props.progressPhase,
      campEstablished,
      festivalActive,
      props.showCampDressing !== false,
    ].join(":")
  );

  async function build(branch: FlowFestBranchId): Promise<void> {
    const epoch = ++buildEpoch;
    const [loadedContract, sourceTerrain, manifestResponse] = await Promise.all(
      [
        loadFlowFestRuntimeContract(),
        loadGeospatialTerrain(MANIFEST_PATH),
        fetch(MANIFEST_PATH),
      ]
    );
    if (!manifestResponse.ok) {
      throw new Error(
        `Flow Fest surface manifest failed to load (${manifestResponse.status})`
      );
    }
    const manifest = parseGeospatialTerrainManifest(
      await manifestResponse.json()
    );
    const evidence = await loadGeospatialEvidenceLayers(manifest);
    if (destroyed || epoch !== buildEpoch) return;
    const terrain = buildFlowFestEntranceGradedTerrain(sourceTerrain).terrain;
    const next = buildFlowFestProductionDressing(
      loadedContract,
      terrain,
      {
        offsetsCentimeters: evidence.surfaceOffsetsCentimeters,
        width: terrain.heightmap.width,
        height: terrain.heightmap.height,
      },
      branch
    );
    readyCommunityAvatarIds = [];
    const cameraColliderPrefixes = [
      "FFS_TreeTrunks_",
      "FFS_Tents_",
      "FFS_PlayerTent_",
      "FFS_Cars_",
      "FFS_LEDFlowCircle_CanopyPost_",
      "FFS_FireJam_CentralFireRing_",
      "FFS_EntranceGatehouse_",
      "FFS_EntranceFence_",
      "FFS_EntranceUtilityPole_",
    ];
    const nextAnimatedLedRings: Object3D[] = [];
    next.root.traverse((object) => {
      if (
        cameraColliderPrefixes.some((prefix) => object.name.startsWith(prefix))
      ) {
        object.userData.cameraCollider = true;
      }
      if (object.name.startsWith("FFS_LEDFlowCircle_HangingRing_")) {
        nextAnimatedLedRings.push(object);
      }
    });
    if (destroyed || epoch !== buildEpoch) {
      next.dispose();
      return;
    }
    next.setCampEstablished(campEstablished);
    next.setCampDressingVisible(props.showCampDressing !== false);
    next.setFestivalActive(festivalActive);
    dressing?.dispose();
    dressing = next;
    animatedLedRings = nextAnimatedLedRings;
    contract = loadedContract;
    builtBranch = branch;
    const population = createFlowFestPopulationSite({
      contract: loadedContract,
      plan: next.campPlan,
      branch,
      fireCenter: next.festivalCommunity.fireCenter,
      ledCircleCenter: next.festivalCommunity.ledCircleCenter,
      groundY: flowFestTerrainGroundY(terrain),
    });
    populationSite = population.site;
    fireJamAttendance = { spectators: 0, performers: 0 };
    heroFirePosition = {
      x: next.festivalCommunity.fireCenter.x,
      z: next.festivalCommunity.fireCenter.z,
    };
    heroFireY = next.festivalCommunity.fireCenter.y;
    nightHeartPosition = {
      x: next.festivalCommunity.ledCircleCenter.x,
      z: next.festivalCommunity.ledCircleCenter.z,
    };
    nightHeartY = next.festivalCommunity.ledCircleCenter.y;
    const proof = {
      contractFingerprint:
        loadedContract.coordinateContentFingerprint.canonicalPayloadSha256,
      branch,
      moment: props.moment,
      counts: next.counts,
      sourceClasses: {
        terrain: "measured-dtm",
        canopy: "lidar-derived-local-canopy-peaks",
        forestEcology:
          "forest-scene-approved-tree-families-and-rooted-wind-ground-system",
        publicRoad: "ODOT-road-inventory-centerline-terrain-conforming-surface",
        internalDrives:
          "2023-public-domain-orthophoto-interpreted-private-access",
        footConnectors: "austen-traced-over-registered-orthophoto",
        entranceReference:
          "august-2024-google-street-view-observed-proportions-without-repository-imagery-copy",
        festival: "authored-fictional-rehearsal",
      },
      orientationAudit: next.orientationAudit,
      collisionPolicy:
        "measured terrain plus LiDAR-center tree-trunk volumes and visible-derived tent, vehicle, and festival-fixture collision",
      collision: {
        staticVisibleObjects: next.collision.staticMesh.visibleObjectCount,
        campEstablishedVisibleObjects:
          next.collision.campEstablishedMesh.visibleObjectCount,
        festivalActiveVisibleObjects:
          next.collision.festivalActiveMesh.visibleObjectCount,
        ...next.collision.visibleSolidCounts,
      },
      spatialAudit: next.spatialAudit,
      campEstablished,
      visualProfile: atmosphere.id,
      visualHierarchy:
        "measured land > registered paths > organic fire-jam perimeter and open ingress > rotating active fire floor > separate LED circle",
      festivalCommunity: {
        spectators: next.festivalCommunity.spectatorCount,
        performers: next.festivalCommunity.performerCount,
        avatarsReady: 0,
        fireCenter: next.festivalCommunity.fireCenter,
        ledCircleCenter: next.festivalCommunity.ledCircleCenter,
        interactionState: props.fireJamState ?? "not-started",
        responseIntensity: props.fireJamEnergy ?? 0,
        spatialAudit: next.festivalCommunityAudit,
      },
      population: {
        ...population.report,
        corridorPolicy:
          "registered person legs plus camp-plan foot connectors; open-field drift only inside measured-open zone envelopes",
        clockLabel: flowFestClockLabel(0),
        dayPhase: null as string | null,
        agentsSimulated: 0,
        agentsRendered: 0,
        fireJamAttendees: 0,
        travelling: 0,
        interrupted: 0,
        unroutable: 0,
      },
      performerSequences: {
        source: "boot-placeholders",
        note: "Generated LOOPs replace these once the generator answers.",
      } as Record<string, unknown>,
      forestEcology: {
        ...next.forestEcology.audit,
        treeAssetsReady: 0,
        grassAssetsReady: 0,
        groundLifeAssetsReady: 0,
      },
      groundSurface: next.groundSurface.audit,
    };
    (globalThis as Record<string, unknown>).__flowFestProduction = proof;
    props.onReady?.({
      ...next.counts,
      contract: loadedContract,
      spatialAudit: next.spatialAudit,
      collision: next.collision,
      festivalCommunity: next.festivalCommunity,
      festivalCommunityAudit: next.festivalCommunityAudit,
    });
  }

  function recordLivingCommunityFrame(
    frame: FlowFestLivingCommunityFrame
  ): void {
    const proof = (globalThis as Record<string, unknown>)
      .__flowFestProduction as
      | { festivalCommunity?: Record<string, unknown> }
      | undefined;
    if (!proof?.festivalCommunity) return;
    proof.festivalCommunity.rotationOrdinal = frame.rotationOrdinal;
    proof.festivalCommunity.activeFirePerformerIds =
      frame.activeFirePerformerIds;
    proof.festivalCommunity.movingSpectators = frame.movingSpectatorCount;
    proof.festivalCommunity.talkingSpectators = frame.talkingSpectatorCount;
  }

  function recordPopulationFrame(frame: FlowFestPopulationFrame): void {
    const attendance = flowFestFireJamAttendance(frame);
    if (
      attendance.spectators !== fireJamAttendance.spectators ||
      attendance.performers !== fireJamAttendance.performers
    ) {
      fireJamAttendance = attendance;
    }
    const proof = (globalThis as Record<string, unknown>)
      .__flowFestProduction as
      | { population?: Record<string, unknown> }
      | undefined;
    if (!proof?.population) return;
    proof.population.clockLabel = flowFestClockLabel(frame.minuteOfDay);
    proof.population.dayPhase = frame.dayPhase;
    proof.population.agentsSimulated = frame.agents.length;
    proof.population.agentsRendered = frame.agents.filter(
      (agent) => !agent.atFireJam
    ).length;
    proof.population.fireJamAttendees = frame.fireJamAttendeeCount;
    proof.population.travelling = frame.travellingCount;
    proof.population.interrupted = frame.interruptedCount;
    proof.population.unroutable = frame.unroutableCount;
  }

  function recordPerformerSequences(
    details: FlowFestPerformerSequenceProof
  ): void {
    const proof = (globalThis as Record<string, unknown>)
      .__flowFestProduction as Record<string, unknown> | undefined;
    if (!proof) return;
    proof.performerSequences = { ...details };
  }

  function markCommunityAvatarReady(id: string): void {
    if (readyCommunityAvatarIds.includes(id)) return;
    readyCommunityAvatarIds = [...readyCommunityAvatarIds, id];
    const proof = (globalThis as Record<string, unknown>)
      .__flowFestProduction as
      | { festivalCommunity?: Record<string, unknown> }
      | undefined;
    if (proof?.festivalCommunity) {
      proof.festivalCommunity.avatarsReady = readyCommunityAvatarIds.length;
    }
  }

  function recordForestEcologyReady(details: {
    treeInstances: number;
    grassInstances: number;
    groundLifeInstances: number;
    treeFamilies: number;
    treeDrawBatches: number;
    treeRenderedTriangles: number;
    treeCullingSourceBatches: number;
    treeCullingBatches: number;
    treeCullingCoveredVertices: number;
    treeMidRenderedTriangles: number;
    treeFarRenderedTriangles: number;
  }): void {
    const proof = (globalThis as Record<string, unknown>)
      .__flowFestProduction as
      | { forestEcology?: Record<string, unknown> }
      | undefined;
    if (!proof?.forestEcology) return;
    proof.forestEcology.treeAssetsReady = details.treeInstances;
    proof.forestEcology.grassAssetsReady = details.grassInstances;
    proof.forestEcology.groundLifeAssetsReady = details.groundLifeInstances;
    proof.forestEcology.treeFamiliesReady = details.treeFamilies;
    proof.forestEcology.treeDrawBatches = details.treeDrawBatches;
    proof.forestEcology.treeRenderedTriangles = details.treeRenderedTriangles;
    proof.forestEcology.treeMidRenderedTriangles =
      details.treeMidRenderedTriangles;
    proof.forestEcology.treeFarRenderedTriangles =
      details.treeFarRenderedTriangles;
    proof.forestEcology.treeCullingSourceBatches =
      details.treeCullingSourceBatches;
    proof.forestEcology.treeCullingBatches = details.treeCullingBatches;
    proof.forestEcology.treeCullingCoveredVertices =
      details.treeCullingCoveredVertices;
  }

  function recordForestEcologyCulling(
    details: InstanceFrustumCullingStats
  ): void {
    props.onForestCullingSample?.({ ...details });
    const proof = (globalThis as Record<string, unknown>)
      .__flowFestProduction as
      | { forestEcology?: Record<string, unknown> }
      | undefined;
    if (!proof?.forestEcology) return;
    proof.forestEcology.treeCullingBatchInstances = details.instances;
    proof.forestEcology.treeVisibleBatchInstances = details.visibleInstances;
    proof.forestEcology.treeCullingCoveredVertices =
      details.estimatedVerticesCovered;
    proof.forestEcology.treeSubmittedVertices =
      details.estimatedSubmittedVertices;
  }

  function recordForestGrassCulling(
    details: InstanceFrustumCullingStats
  ): void {
    props.onGrassCullingSample?.({ ...details });
    const proof = (globalThis as Record<string, unknown>)
      .__flowFestProduction as
      | { forestEcology?: Record<string, unknown> }
      | undefined;
    if (!proof?.forestEcology) return;
    proof.forestEcology.grassCullingBatchInstances = details.instances;
    proof.forestEcology.grassVisibleBatchInstances = details.visibleInstances;
    proof.forestEcology.grassSubmittedVertices =
      details.estimatedSubmittedVertices;
  }

  function configureStaticScene(activeScene: Object3D): boolean {
    const reviewOverlay = activeScene.getObjectByName("FFS_ReviewOverlay");
    if (reviewOverlay) reviewOverlay.visible = false;
    const terrainMesh = (activeScene.getObjectByName(
      "FFS_Terrain_ChunkedRenderBatch"
    ) ?? activeScene.getObjectByName("FFS_Terrain_Bounded")) as
      | Mesh
      | undefined;
    if (!terrainMesh) return false;
    const material = terrainMesh.material as MeshStandardMaterial;
    // The grade is a restrained multiplicative color, so the orthophoto still
    // owns roads and clearing edges instead of collapsing into synthetic turf.
    material.color.set(atmosphere.grade.terrainTint);
    material.roughness = 1;
    terrainMesh.receiveShadow = true;
    return true;
  }

  onMount(() => {
    void build(props.selectedBranch).catch((error: unknown) => {
      props.onError?.(
        error instanceof Error
          ? error.message
          : "Festival dressing did not load"
      );
    });
  });

  $effect(() => {
    if (!dressing || props.selectedBranch === builtBranch) return;
    void build(props.selectedBranch).catch((error: unknown) => {
      props.onError?.(
        error instanceof Error
          ? error.message
          : "Festival dressing did not rebuild"
      );
    });
  });

  $effect(() => {
    dressing?.setCampEstablished(campEstablished);
    dressing?.setCampDressingVisible(props.showCampDressing !== false);
    dressing?.setFestivalActive(festivalActive);
    const proof = (globalThis as Record<string, unknown>)
      .__flowFestProduction as Record<string, unknown> | undefined;
    if (proof) {
      proof.campEstablished = campEstablished;
      proof.festivalActive = festivalActive;
    }
  });

  $effect(() => {
    const fog = new FogExp2(atmosphere.fog.color, atmosphere.fog.density);
    const activeScene = scene.current;
    const activeRenderer = renderer.current;
    if (!activeScene || !activeRenderer) return;
    activeScene.fog = fog;
    activeRenderer.toneMappingExposure = atmosphere.grade.exposure;
    staticSceneSetupComplete = false;
    const proof = (globalThis as Record<string, unknown>)
      .__flowFestProduction as Record<string, unknown> | undefined;
    if (proof) proof.moment = props.moment;
    return () => {
      if (activeScene.fog === fog) activeScene.fog = null;
    };
  });

  $effect(() => {
    dressing?.root.traverse((object) => {
      if (!("material" in object)) return;
      const mesh = object as Mesh;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        if (!("color" in material)) continue;
        const standard = material as MeshStandardMaterial;
        if (object.name.startsWith("FFS_TreeTrunks")) {
          standard.color.set(atmosphere.grade.barkTint);
        }
      }
    });

    const proof = (globalThis as Record<string, unknown>)
      .__flowFestProduction as Record<string, unknown> | undefined;
    if (proof) {
      proof.visualProfile = atmosphere.id;
      proof.visualExposure = atmosphere.grade.exposure;
      proof.shadowKey =
        "camera-bounded-92m-frustum-6m-anchor-grid-30hz-refresh";
    }
  });

  $effect(() => {
    const proof = (globalThis as Record<string, unknown>)
      .__flowFestProduction as
      | { festivalCommunity?: Record<string, unknown> }
      | undefined;
    if (!proof?.festivalCommunity) return;
    proof.festivalCommunity.interactionState =
      props.fireJamState ?? "not-started";
    proof.festivalCommunity.responseIntensity = props.fireJamEnergy ?? 0;
  });

  useTask((delta) => {
    sceneElapsed += delta;
    const proof = (globalThis as Record<string, unknown>)
      .__flowFestProduction as Record<string, unknown> | undefined;
    if (proof) {
      proof.sceneAvailable = true;
      proof.sceneTaskFrames =
        ((proof.sceneTaskFrames as number | undefined) ?? 0) + 1;
    }
    const activeScene = scene.current;
    if (!activeScene) return;
    if (!staticSceneSetupComplete) {
      staticSceneSetupComplete = configureStaticScene(activeScene);
    }

    const energy = props.fireJamEnergy ?? 0;
    const pulse =
      1 + Math.sin(sceneElapsed * (1.8 + energy * 3.2)) * energy * 0.045;
    for (const ring of animatedLedRings) {
      ring.rotation.z += delta * (0.035 + energy * 0.52);
      ring.scale.setScalar(pulse);
    }
  });

  onDestroy(() => {
    destroyed = true;
    buildEpoch += 1;
    animatedLedRings = [];
    dressing?.dispose();
    delete (globalThis as Record<string, unknown>).__flowFestProduction;
  });
</script>

<SkyGradient
  topColor={atmosphere.sky.top}
  midColor={atmosphere.sky.mid}
  bottomColor={atmosphere.sky.bottom}
  radius={9000}
  gradientStart={0.22}
  gradientEnd={0.92}
  sun={{
    enabled: atmosphere.sun.enabled,
    direction: atmosphere.sun.direction,
    color: atmosphere.sun.color,
    angularDiameterDegrees: atmosphere.sun.angularDiameterDegrees,
    glowScale: atmosphere.sun.glowScale,
    glowOpacity: atmosphere.sun.glowOpacity,
  }}
/>

<ForestLighting
  hemisphere={forestHemisphere}
  profile={forestLighting}
  anchor={forestLightAnchor}
  shadowExtentMeters={46}
  keyLightDistanceMeters={92}
  shadowAnchorSnapMeters={6}
  shadowRefreshIntervalSeconds={1 / 30}
  shadowRefreshMinimumFrameGap={2}
  shadowMapSize={1024}
  shadowRefreshToken={forestShadowRefreshToken}
/>

{#if dressing}
  <T is={dressing.root} />
  <FlowFestGroundSurface
    surface={dressing.groundSurface}
    scene={dressing.root}
  />
  <FlowFestForestEcology
    layout={dressing.forestEcology}
    foliageTint={atmosphere.grade.foliageTint}
    barkTint={atmosphere.grade.barkTint}
    onReady={recordForestEcologyReady}
    onCullingSample={recordForestEcologyCulling}
    onGrassCullingSample={recordForestGrassCulling}
  />
{/if}

{#if populationSite}
  <FlowFestPopulation
    site={populationSite}
    moment={props.moment}
    onFrame={recordPopulationFrame}
  />
{/if}

{#if festivalCommunity && festivalActive}
  <FlowFestFestivalCommunity
    community={festivalCommunity}
    energy={props.fireJamEnergy}
    onAvatarReady={markCommunityAvatarReady}
    onSimulationFrame={recordLivingCommunityFrame}
    onSequencePool={recordPerformerSequences}
  />
{/if}

{#if contract && (props.moment === "night" || props.moment === "dawn")}
  <FlowFestHeroFire
    position={{
      x: heroFirePosition.x,
      y: heroFireY + 0.1,
      z: heroFirePosition.z,
    }}
    energy={props.fireJamEnergy}
  />
  <T.PointLight
    position={[nightHeartPosition.x, nightHeartY + 2.5, nightHeartPosition.z]}
    color="#8bdfff"
    intensity={12 + (props.fireJamEnergy ?? 0) * 9}
    distance={22}
    decay={2}
  />
  <T.Group
    position={[nightHeartPosition.x, nightHeartY + 0.4, nightHeartPosition.z]}
  >
    <FallingParticles
      type="fireflies"
      count={34}
      area={{ width: 36, height: 8, depth: 30 }}
      speed={0.16}
      colors={["#ffe59a", "#bbffb7", "#8ee8ff"]}
      sizeRange={[0.025, 0.085]}
      spin={true}
    />
  </T.Group>
{/if}
