<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { T, useTask } from "@threlte/core";
  import { Color, Mesh, PointLight, type Object3D } from "three";
  import { CameraMode, UnifiedCameraController } from "@austencloud/camera-3d";
  import type { AvatarState, PhysicsProvider } from "@austencloud/camera-3d";
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
  import {
    buildFirstFireGrayboxColliders,
    FIRST_FIRE_GRAYBOX_SPAWN,
  } from "./first-fire-graybox-colliders";
  import FirstFireProcessionFlames from "./FirstFireProcessionFlames.svelte";
  import FirstFireShrineVolumes from "./FirstFireShrineVolumes.svelte";
  import {
    extractFirstFireFlameAnchors,
    FIRST_FIRE_EXPECTED_FLAME_COUNT,
    type FirstFireFlameAnchor,
  } from "./first-fire-flame-field";

  interface Props {
    resetToken: number;
    onAssetReady?: (details: { flameCount: number }) => void;
    onPositionChange?: (position: { x: number; y: number; z: number }) => void;
  }

  const props: Props = $props();
  const contract = buildFirstFireBlenderContract();
  const colliders = buildFirstFireGrayboxColliders(contract);
  const shrineLights = contract.shrines.map((shrine) => ({
    id: shrine.id,
    position: [shrine.blenderCentre.x, 2.3, -shrine.blenderCentre.y] as [
      number,
      number,
      number,
    ],
  }));
  const shrineLightObjects = shrineLights.map((entry) => {
    const light = new PointLight(new Color("#ff4a18"), 62, 13, 2);
    light.position.set(...entry.position);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    light.shadow.camera.near = 0.2;
    light.shadow.camera.far = 13;
    light.shadow.bias = -0.0015;
    light.shadow.normalBias = 0.025;
    light.shadow.autoUpdate = false;
    light.shadow.needsUpdate = true;
    return { id: entry.id, light };
  });

  let physicsState: PhysicsWorldState | null = null;
  let playerState: PlayerControllerState | null = null;
  let physicsProvider = $state<PhysicsProvider | null>(null);
  let isInitialized = $state(false);
  let isDisposed = false;
  let appliedResetToken = -1;
  let fireElapsed = 0;
  let flameAnchors = $state<FirstFireFlameAnchor[]>([]);

  let playerPosition = $state({
    x: FIRST_FIRE_GRAYBOX_SPAWN.x,
    y: FIRST_FIRE_GRAYBOX_SPAWN.y,
    z: FIRST_FIRE_GRAYBOX_SPAWN.z,
  });
  let playerYaw = $state(FIRST_FIRE_GRAYBOX_SPAWN.yaw);
  let targetPlayerYaw = $state(FIRST_FIRE_GRAYBOX_SPAWN.yaw);
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

  function resetPlayer(): void {
    const spawn = {
      x: FIRST_FIRE_GRAYBOX_SPAWN.x,
      y: FIRST_FIRE_GRAYBOX_SPAWN.y,
      z: FIRST_FIRE_GRAYBOX_SPAWN.z,
    };
    physicsProvider?.teleport?.(spawn);
    playerPosition = spawn;
    playerYaw = FIRST_FIRE_GRAYBOX_SPAWN.yaw;
    targetPlayerYaw = FIRST_FIRE_GRAYBOX_SPAWN.yaw;
  }

  function handleGrayboxReady(scene: Object3D): void {
    flameAnchors = extractFirstFireFlameAnchors(scene);
    scene.traverse((object) => {
      if (!(object instanceof Mesh) || !object.visible) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    shrineLightObjects.forEach(({ light }) => {
      light.shadow.needsUpdate = true;
    });
    if (flameAnchors.length !== FIRST_FIRE_EXPECTED_FLAME_COUNT) {
      console.warn(
        `[FirstFireGraybox] Expected ${FIRST_FIRE_EXPECTED_FLAME_COUNT} flame guides, found ${flameAnchors.length}.`
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
        },
        collider.shape === "box"
          ? {
              type: "box",
              size: {
                x: collider.size[0],
                y: collider.size[1],
                z: collider.size[2],
              },
            }
          : {
              type: "cylinder",
              radius: collider.radius,
              halfHeight: collider.halfHeight,
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
  });

  $effect(() => {
    if (!isInitialized || props.resetToken === appliedResetToken) return;
    appliedResetToken = props.resetToken;
    resetPlayer();
  });

  useTask((delta) => {
    fireElapsed += Math.min(delta, 1 / 20);
    shrineLightObjects.forEach(({ light }, index) => {
      const phase = index * 2.17;
      const flicker =
        Math.sin(fireElapsed * 1.2 + phase) * 0.12 +
        Math.sin(fireElapsed * 4.7 + phase) * 0.08 +
        Math.sin(fireElapsed * 19.3 + phase) * 0.045;
      light.intensity = 62 * (1 + flicker);
      light.color.setRGB(
        1,
        0.27 + Math.sin(fireElapsed * 2.3 + phase) * 0.025,
        0.075
      );
    });

    if (!isInitialized || !physicsState?.world || isDisposed) return;
    stepPhysics(physicsState, Math.min(delta, 1 / 30));
    const position = physicsProvider?.getPlayerPosition();
    if (position) props.onPositionChange?.(position);
  });

  onDestroy(() => {
    isDisposed = true;
    if (playerState && physicsState) {
      disposePlayerController(physicsState, playerState);
    }
    if (physicsState) disposePhysicsWorld(physicsState);
    shrineLightObjects.forEach(({ light }) => light.dispose());
  });
</script>

<T.Color attach="background" args={["#050202"]} />
<T.FogExp2 attach="fog" args={["#100504", 0.018]} />

<T.HemisphereLight color="#8c7980" groundColor="#170402" intensity={0.34} />
<T.DirectionalLight
  position={[-8, 16, 4]}
  color="#d6b5a5"
  intensity={0.55}
  castShadow={false}
/>
<T.PointLight
  position={[-26, 2.6, 0]}
  color="#7cc7dd"
  intensity={32}
  distance={13}
  decay={2}
/>
{#each shrineLightObjects as entry (entry.id)}
  <T is={entry.light} />
{/each}
<T.PointLight
  position={[27.5, 2.2, 12.5]}
  color="#73c946"
  intensity={38}
  distance={12}
  decay={2}
/>

<GltfAsset
  url="/models/museum/cave/first-fire-torch-procession-graybox.glb"
  emissiveBoost={1.15}
  onReady={handleGrayboxReady}
/>

{#if flameAnchors.length > 0}
  <FirstFireProcessionFlames anchors={flameAnchors} />
  <FirstFireShrineVolumes shrines={shrineLights} />
{/if}

{#if isInitialized && physicsProvider}
  <UnifiedCameraController
    destinationId="first-fire-graybox-walk"
    {avatarState}
    {physicsProvider}
    enabled={true}
    initialYaw={FIRST_FIRE_GRAYBOX_SPAWN.yaw}
    initialPitch={0}
    allowedModes={[CameraMode.FIRST_PERSON]}
    disableModeToggle={true}
    moveSpeed={3.2}
    sprintMultiplier={1.8}
    gravity={9.81}
    jumpForce={4.5}
  />
{/if}
