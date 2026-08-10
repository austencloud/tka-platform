<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { T, useTask } from "@threlte/core";
  import { Color, Mesh, PointLight, type Object3D } from "three";
  import { CameraMode, UnifiedCameraController } from "@austencloud/camera-3d";
  import type { AvatarState, PhysicsProvider } from "@austencloud/camera-3d";
  import MuseumPerformerStation3D from "$lib/features/museum/components/game/MuseumPerformerStation3D.svelte";
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
  import GltfAsset from "$lib/shared/3d/environments/primitives/GltfAsset.svelte";
  import { buildFirstFireBlenderContract } from "$lib/features/museum/data/first-fire-blender-contract";
  import { findFirstFireLockedCameraView } from "$lib/features/museum/data/first-fire-locked-cameras";
  import { firstFireCourtEffectId } from "./first-fire-court-vocabulary";
  import type { FirstFireShrineId } from "$lib/features/museum/data/first-fire-procession-plan";
  import {
    buildFirstFireGrayboxColliders,
    FIRST_FIRE_GRAYBOX_SPAWN,
  } from "./first-fire-graybox-colliders";
  import FirstFireCinderStateEffects from "./FirstFireCinderStateEffects.svelte";
  import FirstFireProcessionFlames from "./FirstFireProcessionFlames.svelte";
  import FirstFireShrineVolumes from "./FirstFireShrineVolumes.svelte";
  import FirstFireEmberDressing from "./FirstFireEmberDressing.svelte";
  import FirstFireCoalDressing from "./FirstFireCoalDressing.svelte";
  import {
    applyFirstFireCourtMaterials,
    type FirstFireMaterialReport,
  } from "./first-fire-court-materials";
  import {
    extractFirstFireFlameAnchors,
    FIRST_FIRE_EXPECTED_FLAME_COUNT,
    type FirstFireFlameAnchor,
  } from "./first-fire-flame-field";
  import {
    activeFirstFireShrine,
    advanceFirstFireGrayboxProof,
    createFirstFireGrayboxReviewState,
    displayedFirstFireShrine,
    firstFirePhaseLabel,
    litFirstFireShrine,
    updateFirstFireGrayboxReview,
    visibleFirstFireFlameGroups,
  } from "./first-fire-graybox-review";

  interface FirstFireGrayboxReviewDetails {
    phase: string;
    label: string;
    activeShrineId: FirstFireShrineId | null;
    displayedShrineId: FirstFireShrineId | null;
    orbitProgress: Record<FirstFireShrineId, number>;
    blackoutElapsedMs: number;
    performer: {
      performerId: string;
      sequenceId: string;
      catalogId: string;
      word: string;
    } | null;
  }

  interface Props {
    resetToken: number;
    reviewAdvanceToken: number;
    onAssetReady?: (details: { flameCount: number }) => void;
    onPositionChange?: (position: { x: number; y: number; z: number }) => void;
    onReviewChange?: (details: FirstFireGrayboxReviewDetails) => void;
  }

  const props: Props = $props();
  const contract = buildFirstFireBlenderContract();
  /** ?camera=<id> stands the player at a Gate 3 locked camera for capture. */
  const lockedCameraId =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("camera");
  const colliders = buildFirstFireGrayboxColliders(contract);
  const heroLight = new PointLight(new Color("#ff4a18"), 0, 13, 2);
  heroLight.castShadow = true;
  heroLight.shadow.mapSize.set(512, 512);
  heroLight.shadow.camera.near = 0.2;
  heroLight.shadow.camera.far = 13;
  heroLight.shadow.bias = -0.0015;
  heroLight.shadow.normalBias = 0.025;

  let physicsState: PhysicsWorldState | null = null;
  let playerState: PlayerControllerState | null = null;
  let physicsProvider = $state<PhysicsProvider | null>(null);
  let isInitialized = $state(false);
  let isDisposed = false;
  let appliedResetToken = -1;
  let appliedReviewAdvanceToken = props.reviewAdvanceToken;
  let fireElapsed = 0;
  let assetRevision = $state(0);
  let cameraRevision = $state(0);
  let stagedMeshes: Mesh[] = [];
  /** Re-materialisation counts, surfaced for verification. */
  let materialReport: FirstFireMaterialReport | null = $state(null);
  let flameAnchors = $state<FirstFireFlameAnchor[]>([]);
  let reviewState = $state(createFirstFireGrayboxReviewState());

  let playerPosition = $state({
    x: FIRST_FIRE_GRAYBOX_SPAWN.x,
    y: FIRST_FIRE_GRAYBOX_SPAWN.y,
    z: FIRST_FIRE_GRAYBOX_SPAWN.z,
  });
  let playerYaw = $state(FIRST_FIRE_GRAYBOX_SPAWN.yaw);
  let targetPlayerYaw = $state(FIRST_FIRE_GRAYBOX_SPAWN.yaw);
  let isMoving = $state(false);
  let moveDirection = $state({ x: 0, z: 0 });

  const activeShrineId = $derived(
    activeFirstFireShrine(reviewState.procession.phase)
  );
  const displayedShrineId = $derived(
    displayedFirstFireShrine(reviewState.procession.phase)
  );
  // The court still burning. Equal to the active court while it is being
  // walked, then the finished court the visitor has not yet left: a performer
  // must not freeze and go dark the instant the orbit completes, while the
  // visitor is still standing next to them.
  const litShrineId = $derived(litFirstFireShrine(reviewState));
  const activeShrine = $derived(
    contract.shrines.find((candidate) => candidate.id === litShrineId) ?? null
  );
  const displayedShrine = $derived(
    contract.shrines.find((candidate) => candidate.id === displayedShrineId) ??
      null
  );
  const visibleFlameGroups = $derived(visibleFirstFireFlameGroups(reviewState));
  // The volcanic dressing is the room's only light source, so it must go out
  // at the extinguish beat for the blackout to actually be black.
  const emberDressingLit = $derived(
    reviewState.procession.phase !== "fire-extinguished" &&
      reviewState.procession.phase !== "growth-complete"
  );
  const growthVisible = $derived(
    reviewState.procession.phase === "growth-complete"
  );

  function yawToward(
    from: { x: number; z: number },
    to: { x: number; z: number }
  ): number {
    return Math.atan2(to.x - from.x, to.z - from.z);
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

  function resetReview(): void {
    const spawn = {
      x: FIRST_FIRE_GRAYBOX_SPAWN.x,
      y: FIRST_FIRE_GRAYBOX_SPAWN.y,
      z: FIRST_FIRE_GRAYBOX_SPAWN.z,
    };
    reviewState = createFirstFireGrayboxReviewState();
    physicsProvider?.teleport?.(spawn);
    playerPosition = spawn;
    playerYaw = FIRST_FIRE_GRAYBOX_SPAWN.yaw;
    targetPlayerYaw = FIRST_FIRE_GRAYBOX_SPAWN.yaw;
    cameraRevision += 1;
  }

  /**
   * Gate 3 evidence capture. Stands the player at one locked camera so the
   * captured frame is registered to its approved Gate 2 counterpart by
   * construction rather than by eyeball.
   */
  function teleportToLockedCamera(cameraId: string): boolean {
    const view = findFirstFireLockedCameraView(contract, cameraId);
    if (!view) return false;
    const destination = {
      x: view.position.x,
      y: view.position.y,
      z: view.position.z,
    };
    physicsProvider?.teleport?.(destination);
    playerPosition = destination;
    playerYaw = view.yaw;
    targetPlayerYaw = view.yaw;
    avatarState.snapFacingAngle?.(view.yaw);
    cameraRevision += 1;
    return true;
  }

  function teleportForReviewPhase(): void {
    const phase = reviewState.procession.phase;
    const shrineId = activeFirstFireShrine(phase);
    const shrine = contract.shrines.find(
      (candidate) => candidate.id === shrineId
    );
    const targetShrineId =
      phase === "approach"
        ? "dj"
        : phase === "dj-complete"
          ? "ek"
          : phase === "ek-complete"
            ? "fl"
            : shrineId;
    const targetShrine = contract.shrines.find(
      (candidate) => candidate.id === targetShrineId
    );
    // The S-procession has no hub: between courts the visitor stands at the
    // exit mouth of the court they just finished, facing the next one.
    const previousShrine =
      phase === "dj-complete"
        ? contract.shrines.find((candidate) => candidate.id === "dj")
        : phase === "ek-complete"
          ? contract.shrines.find((candidate) => candidate.id === "ek")
          : undefined;
    const fallback = previousShrine
      ? previousShrine.blenderExit
      : contract.threshold.blenderCentre;
    const destination =
      phase === "approach"
        ? {
            x: FIRST_FIRE_GRAYBOX_SPAWN.x,
            y: FIRST_FIRE_GRAYBOX_SPAWN.y,
            z: FIRST_FIRE_GRAYBOX_SPAWN.z,
          }
        : shrine
          ? {
              x: shrine.blenderEntry.x,
              y: FIRST_FIRE_GRAYBOX_SPAWN.y,
              z: -shrine.blenderEntry.y,
            }
          : phase === "growth-complete"
            ? {
                x: contract.pathSections.at(-1)?.blenderPoints[1]?.x ?? fallback.x,
                y: FIRST_FIRE_GRAYBOX_SPAWN.y,
                z: -(
                  contract.pathSections.at(-1)?.blenderPoints[1]?.y ?? fallback.y
                ),
              }
            : {
                x: fallback.x,
                y: FIRST_FIRE_GRAYBOX_SPAWN.y,
                z: -fallback.y,
              };
    const target = shrine
      ? { x: shrine.blenderCentre.x, z: -shrine.blenderCentre.y }
      : targetShrine
      ? {
          x: targetShrine.blenderEntry.x,
          z: -targetShrine.blenderEntry.y,
        }
      : {
          x: contract.doors.earth.blender.x,
          z: -contract.doors.earth.blender.y,
        };
    physicsProvider?.teleport?.(destination);
    playerPosition = destination;
    avatarState.snapFacingAngle?.(yawToward(destination, target));
    cameraRevision += 1;
  }

  function handleGrayboxReady(scene: Object3D): void {
    flameAnchors = extractFirstFireFlameAnchors(scene, contract.fireGuides);
    // Give each court its own rock, pad and molten channel. The GLB is
    // digest-locked Gate 2 evidence, so this re-materialises in memory only.
    materialReport = applyFirstFireCourtMaterials(scene);
    stagedMeshes = [];
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (object.visible) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
      // FF_Trench_(dj|ek|fl): the authored node names. The filter used to ask
      // for FF_Trench_*_Magma, which the GLB has never contained, so no trench
      // was ever staged and all three molten channels glowed from load - the
      // finished court's channel included.
      if (
        /^FF_(Trench_(dj|ek|fl)|Growth_|Bridge_EmberBed|FireState_)/i.test(
          object.name
        )
      ) {
        stagedMeshes.push(object);
      }
    });
    assetRevision += 1;
    // Verification seam: the re-materialisation counts have to be readable
    // from the page, otherwise "each court is its own environment" is a claim
    // rather than a measurement.
    (globalThis as Record<string, unknown>).__firstFireMaterialReport =
      materialReport;
    // Scene-graph handle for the same reason: composition defects have to be
    // measurable (which mesh, what size, where) instead of guessed at from a
    // screenshot. Root is the render tree, not just the graybox subtree.
    let root: Object3D = scene;
    while (root.parent) root = root.parent;
    (globalThis as Record<string, unknown>).__firstFireScene = root;
    if (flameAnchors.length !== FIRST_FIRE_EXPECTED_FLAME_COUNT) {
      console.warn(
        `[FirstFireGraybox] Expected ${FIRST_FIRE_EXPECTED_FLAME_COUNT} semantic flame guides, found ${flameAnchors.length}.`
      );
    }
    props.onAssetReady?.({ flameCount: flameAnchors.length });
  }

  onMount(async () => {
    physicsState = createPhysicsWorldState();
    await initPhysicsWorld(physicsState, { x: 0, y: -9.81, z: 0 });
    if (isDisposed || !physicsState) return;

    for (const collider of colliders) {
      createRigidBody(
        physicsState,
        {
          type: "static",
          position: {
            x: collider.position[0],
            y: collider.position[1],
            z: collider.position[2],
          },
          ...(collider.rotation ? { rotation: collider.rotation } : {}),
        },
        {
          type: "box",
          size: {
            x: collider.size[0],
            y: collider.size[1],
            z: collider.size[2],
          },
        }
      );
    }

    playerState = createPlayerController(physicsState, {
      position: {
        x: FIRST_FIRE_GRAYBOX_SPAWN.x,
        y: FIRST_FIRE_GRAYBOX_SPAWN.y,
        z: FIRST_FIRE_GRAYBOX_SPAWN.z,
      },
      autoStepMaxHeight: 0.45,
      snapToGroundDistance: 0.35,
    });
    physicsProvider = createRapierPhysicsProvider(physicsState, playerState);
    isInitialized = true;
    if (lockedCameraId) teleportToLockedCamera(lockedCameraId);
  });

  $effect(() => {
    if (!isInitialized || props.resetToken === appliedResetToken) return;
    appliedResetToken = props.resetToken;
    resetReview();
    // The initial reset token lands right after mount, so without this the
    // spawn teleport silently overwrites the ?camera= capture position and
    // every locked-camera frame is shot from the Water arrival instead.
    if (lockedCameraId) teleportToLockedCamera(lockedCameraId);
  });

  $effect(() => {
    if (
      !isInitialized ||
      props.reviewAdvanceToken === appliedReviewAdvanceToken
    ) {
      return;
    }
    appliedReviewAdvanceToken = props.reviewAdvanceToken;
    reviewState = advanceFirstFireGrayboxProof(reviewState);
    teleportForReviewPhase();
    // A locked camera outranks the phase teleport: the phase sets the room's
    // state, the camera decides where the evidence is shot from.
    if (lockedCameraId) teleportToLockedCamera(lockedCameraId);
  });

  $effect(() => {
    const phase = reviewState.procession.phase;
    const groups = visibleFlameGroups;
    assetRevision;
    stagedMeshes.forEach((mesh) => {
      const name = mesh.name.toLowerCase();
      if (name.startsWith("ff_firestate_")) {
        mesh.visible = false;
        return;
      }
      if (name.startsWith("ff_growth_")) {
        mesh.visible = phase === "growth-complete";
        return;
      }
      // The authored nodes are FF_Trench_dj / _ek / _fl. The old selectors
      // carried a trailing underscore, so none of them ever matched and every
      // trench fell through to the "any group lit" branch: all three channels
      // glowed from the moment the room loaded, including courts the visitor
      // had not reached. Measured in the running scene, not assumed.
      if (name.includes("trench_dj")) mesh.visible = groups.has("dj");
      else if (name.includes("trench_ek")) mesh.visible = groups.has("ek");
      else if (name.includes("trench_fl")) mesh.visible = groups.has("fl");
      else mesh.visible = groups.size > 0;
    });
  });

  $effect(() => {
    const shrine = activeShrine;
    if (!shrine) {
      heroLight.intensity = 0;
      heroLight.visible = false;
      return;
    }
    heroLight.position.set(
      shrine.blenderCentre.x,
      2.3,
      -shrine.blenderCentre.y
    );
    heroLight.intensity = 68;
    heroLight.visible = true;
  });

  $effect(() => {
    props.onReviewChange?.({
      phase: reviewState.procession.phase,
      label: firstFirePhaseLabel(reviewState),
      activeShrineId,
      displayedShrineId,
      orbitProgress: { ...reviewState.procession.orbitProgress },
      blackoutElapsedMs: reviewState.blackoutElapsedMs,
      performer: displayedShrine
        ? {
            performerId: displayedShrine.performerId,
            sequenceId: displayedShrine.sequenceId,
            catalogId: displayedShrine.catalogId,
            word: displayedShrine.word,
          }
        : null,
    });
  });

  useTask((delta) => {
    fireElapsed += Math.min(delta, 1 / 20);
    const flicker =
      Math.sin(fireElapsed * 1.2) * 0.12 +
      Math.sin(fireElapsed * 4.7) * 0.08 +
      Math.sin(fireElapsed * 19.3) * 0.045;
    if (heroLight.visible) {
      heroLight.intensity = 68 * (1 + flicker);
      heroLight.color.setRGB(
        1,
        0.27 + Math.sin(fireElapsed * 2.3) * 0.025,
        0.075
      );
    }

    if (!isInitialized || !physicsState?.world || isDisposed) return;
    stepPhysics(physicsState, Math.min(delta, 1 / 30));
    const position = physicsProvider?.getPlayerPosition();
    if (!position) return;
    playerPosition = position;
    reviewState = updateFirstFireGrayboxReview(
      reviewState,
      contract,
      position,
      delta * 1000
    );
    props.onPositionChange?.(position);
  });

  onDestroy(() => {
    isDisposed = true;
    if (playerState && physicsState) {
      disposePlayerController(physicsState, playerState);
    }
    if (physicsState) disposePhysicsWorld(physicsState);
    heroLight.dispose();
  });
</script>

<T.Color attach="background" args={["#040303"]} />
<T.FogExp2 attach="fog" args={["#0b0807", 0.012]} />

<!--
  Gate 3: no ambient fill and no key light. Every photon in the Cinder Court
  comes from something that is burning, which is the only way the extinguish
  beat can take the room to true black. The graybox's neutral hemisphere and
  directional pair washed the basalt to salmon and are deliberately gone. A
  floor-level bounce term stands in for radiosity off the magma without
  surviving the blackout.
-->
<T.HemisphereLight
  color="#3a1206"
  groundColor="#1a0704"
  intensity={emberDressingLit ? 0.09 : 0}
/>
<T.PointLight
  position={[-27, 2.6, 0]}
  color="#7cc7dd"
  intensity={24}
  distance={11}
  decay={2}
/>
<T is={heroLight} />
{#if growthVisible}
  <T.PointLight
    position={[
      contract.doors.earth.blender.x - 2.5,
      2.1,
      -contract.doors.earth.blender.y,
    ]}
    color="#72d957"
    intensity={52}
    distance={15}
    decay={2}
    castShadow
    shadow.mapSize.width={512}
    shadow.mapSize.height={512}
  />
{/if}

<GltfAsset
  url="/models/museum/cave/first-fire-cinder-court-graybox.glb"
  emissiveBoost={1.05}
  onReady={handleGrayboxReady}
/>

{#if flameAnchors.length > 0}
  <FirstFireProcessionFlames
    anchors={flameAnchors}
    visibleGroups={visibleFlameGroups}
  />
{/if}

<FirstFireCinderStateEffects {contract} {reviewState} />

<FirstFireEmberDressing
  {contract}
  lit={emberDressingLit}
  activeShrineId={litShrineId ?? null}
/>

<!-- The coal vocabulary applied to the first section of the walk. Follows the
     same lit flag as the rest of the dressing so the extinguish beat still
     takes the room to true black. -->
<FirstFireCoalDressing {contract} lit={emberDressingLit} />

{#if activeShrine}
  <FirstFireShrineVolumes
    shrineId={activeShrine.id}
    position={[activeShrine.blenderCentre.x, 0, -activeShrine.blenderCentre.y]}
  />
{/if}

{#if displayedShrine}
  {#key displayedShrine.id}
    {@const entry = {
      x: displayedShrine.blenderEntry.x,
      z: -displayedShrine.blenderEntry.y,
    }}
    {@const centre = {
      x: displayedShrine.blenderCentre.x,
      z: -displayedShrine.blenderCentre.y,
    }}
    <MuseumPerformerStation3D
      stationId={displayedShrine.performerId}
      worldX={centre.x}
      worldY={0}
      worldZ={centre.z}
      facingAngle={yawToward(centre, entry)}
      sequenceId={displayedShrine.sequenceId}
      autoPlay={true}
      active={displayedShrine.id === litShrineId}
      showGrid={displayedShrine.id === activeShrineId}
      showPlatform={false}
      standingSurfaceHeight={0.22}
      effectId={firstFireCourtEffectId(displayedShrine.id)}
    />
  {/key}
{/if}

{#if isInitialized && physicsProvider}
  {#key cameraRevision}
    <UnifiedCameraController
      destinationId="first-fire-cinder-court-graybox-walk"
      {avatarState}
      {physicsProvider}
      enabled={true}
      initialYaw={playerYaw}
      initialPitch={0}
      allowedModes={[CameraMode.FIRST_PERSON]}
      disableModeToggle={true}
      showControlsHint={false}
      moveSpeed={4}
      sprintMultiplier={1.8}
      gravity={9.81}
      jumpForce={4.5}
    />
  {/key}
{/if}
