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
  import {
    SHELF_Y,
    WATERLINE_Y,
    DOME_APEX_Y,
  } from "$lib/features/museum/data/drowned-gallery-terrain";
  import { buildDrownedGalleryWalkSetup } from "./drowned-gallery-graybox-colliders";

  interface Props {
    resetToken: number;
    onAssetReady?: () => void;
    onPositionChange?: (position: { x: number; y: number; z: number }) => void;
  }

  const props: Props = $props();
  const setup = buildDrownedGalleryWalkSetup();
  const { layout, origin, colliders, spawn } = setup;

  const alcoveLightObjects = layout.alcoves.map((anchor, index) => {
    const light = new PointLight(new Color("#ffb35c"), 46, 11, 2);
    light.position.set(
      anchor.x - origin.x,
      SHELF_Y + 2.3,
      anchor.z - origin.z - 0.4
    );
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    light.shadow.camera.near = 0.2;
    light.shadow.camera.far = 12;
    light.shadow.bias = -0.0015;
    light.shadow.normalBias = 0.025;
    light.shadow.autoUpdate = false;
    light.shadow.needsUpdate = true;
    return { id: `alcove-${index}`, light };
  });

  const grottoCentre = {
    x: (layout.grotto.minX + layout.grotto.maxX) / 2 - origin.x,
    z: (layout.grotto.minZ + layout.grotto.maxZ) / 2 - origin.z,
  };
  const poolCentre = {
    x: (layout.pool.minX + layout.pool.maxX) / 2 - origin.x,
    z: (layout.pool.minZ + layout.pool.maxZ) / 2 - origin.z,
  };
  const bloom = {
    x: layout.bloomAnchor.x - origin.x,
    z: layout.bloomAnchor.z - origin.z,
  };
  const shaftLights = layout.openShafts.map((shaft, index) => ({
    id: `shaft-${index}`,
    position: [
      (shaft.minX + shaft.maxX) / 2 - origin.x,
      1.6,
      (shaft.minZ + shaft.maxZ) / 2 - origin.z,
    ] as [number, number, number],
  }));

  let physicsState: PhysicsWorldState | null = null;
  let playerState: PlayerControllerState | null = null;
  let physicsProvider = $state<PhysicsProvider | null>(null);
  let isInitialized = $state(false);
  let isDisposed = false;
  let appliedResetToken = -1;
  let fireElapsed = 0;

  let playerPosition = $state({ x: spawn.x, y: spawn.y, z: spawn.z });
  let playerYaw = $state(spawn.yaw);
  let targetPlayerYaw = $state(spawn.yaw);
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
    const target = { x: spawn.x, y: spawn.y, z: spawn.z };
    physicsProvider?.teleport?.(target);
    playerPosition = target;
    playerYaw = spawn.yaw;
    targetPlayerYaw = spawn.yaw;
  }

  function handleGrayboxReady(scene: Object3D): void {
    scene.traverse((object) => {
      if (!(object instanceof Mesh) || !object.visible) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    alcoveLightObjects.forEach(({ light }) => {
      light.shadow.needsUpdate = true;
    });
    props.onAssetReady?.();
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
      position: { x: spawn.x, y: spawn.y, z: spawn.z },
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
    alcoveLightObjects.forEach(({ light }, index) => {
      const phase = index * 2.17;
      const flicker =
        Math.sin(fireElapsed * 1.2 + phase) * 0.12 +
        Math.sin(fireElapsed * 4.7 + phase) * 0.08 +
        Math.sin(fireElapsed * 19.3 + phase) * 0.045;
      light.intensity = 46 * (1 + flicker);
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
    alcoveLightObjects.forEach(({ light }) => light.dispose());
  });
</script>

<T.Color attach="background" args={["#020407"]} />
<T.FogExp2 attach="fog" args={["#03080c", 0.02]} />

<T.HemisphereLight color="#5c7c86" groundColor="#04121a" intensity={0.4} />
<T.DirectionalLight
  position={[6, 18, -8]}
  color="#9fc4c8"
  intensity={0.35}
  castShadow={false}
/>

<!-- Glowworm dome fill over the grotto -->
<T.PointLight
  position={[grottoCentre.x, DOME_APEX_Y - 1.5, grottoCentre.z]}
  color="#73e8c8"
  intensity={95}
  distance={26}
  decay={2}
/>
<!-- Mirror pool underlight -->
<T.PointLight
  position={[poolCentre.x, WATERLINE_Y + 1.2, poolCentre.z]}
  color="#2e93b8"
  intensity={40}
  distance={14}
  decay={2}
/>
<!-- Drowned gallery bloom + shaft light wells -->
<T.PointLight
  position={[bloom.x, -2.4, bloom.z]}
  color="#5cd8b8"
  intensity={26}
  distance={11}
  decay={2}
/>
{#each shaftLights as entry (entry.id)}
  <T.PointLight
    position={entry.position}
    color="#5aa8c0"
    intensity={30}
    distance={12}
    decay={2}
  />
{/each}
{#each alcoveLightObjects as entry (entry.id)}
  <T is={entry.light} />
{/each}

<GltfAsset
  url="/models/museum/cave/drowned-gallery-graybox.glb"
  emissiveBoost={1.1}
  onReady={handleGrayboxReady}
/>

{#if isInitialized && physicsProvider}
  <UnifiedCameraController
    destinationId="drowned-gallery-graybox-walk"
    {avatarState}
    {physicsProvider}
    enabled={true}
    initialYaw={spawn.yaw}
    initialPitch={0}
    allowedModes={[CameraMode.FIRST_PERSON]}
    disableModeToggle={true}
    moveSpeed={3.2}
    sprintMultiplier={1.8}
    gravity={9.81}
    jumpForce={4.5}
  />
{/if}
