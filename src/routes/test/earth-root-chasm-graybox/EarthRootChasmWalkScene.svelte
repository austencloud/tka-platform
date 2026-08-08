<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { CameraMode, UnifiedCameraController } from "@austencloud/camera-3d";
  import type { AvatarState, PhysicsProvider } from "@austencloud/camera-3d";
  import { Mesh, type Object3D } from "three";
  import GltfAsset from "$lib/shared/3d/environments/primitives/GltfAsset.svelte";
  import { buildEarthCanyonBlenderContract } from "$lib/features/museum/data/earth-canyon-blender-contract";
  import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";
  import { createMuseumPhysicsProvider } from "$lib/features/museum/services/museum-physics-provider";

  interface Props {
    resetToken: number;
    onAssetReady?: () => void;
    onPositionChange?: (position: { x: number; y: number; z: number }) => void;
  }

  const props: Props = $props();
  const contract = buildEarthCanyonBlenderContract();
  const cave = buildVulcanCaveFloorPlan();
  const spawn = {
    x: contract.route.fireEntry.plan.x,
    y: contract.route.fireEntry.elevation,
    z: contract.route.fireEntry.plan.z,
  };
  const initialYaw = Math.PI / 2;
  const physicsProvider: PhysicsProvider = createMuseumPhysicsProvider(
    cave.grid,
    cave.grid.tileScale,
    spawn
  );

  let appliedResetToken = -1;
  let playerPosition = $state(physicsProvider.getPlayerPosition());
  let playerYaw = $state(initialYaw);
  let targetPlayerYaw = $state(initialYaw);
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
    physicsProvider.teleport?.(spawn);
    playerPosition = physicsProvider.getPlayerPosition();
    playerYaw = initialYaw;
    targetPlayerYaw = initialYaw;
  }

  function handleAssetReady(scene: Object3D): void {
    scene.traverse((object) => {
      if (!(object instanceof Mesh) || !object.visible) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    props.onAssetReady?.();
  }

  $effect(() => {
    if (props.resetToken === appliedResetToken) return;
    appliedResetToken = props.resetToken;
    resetPlayer();
  });

  useTask(() => {
    playerPosition = physicsProvider.getPlayerPosition();
    props.onPositionChange?.(playerPosition);
  });
</script>

<T.Color attach="background" args={["#050804"]} />
<T.FogExp2 attach="fog" args={["#0a1008", 0.012]} />

<T.HemisphereLight color="#b4c598" groundColor="#100b06" intensity={0.48} />
<T.DirectionalLight
  position={[105, 18, 9]}
  color="#d9e5b4"
  intensity={1.05}
  castShadow={false}
/>
<T.PointLight
  position={[88, 2.4, 8]}
  color="#6ba82b"
  intensity={45}
  distance={17}
  decay={2}
/>
{#each contract.performers as performer, index (performer.id)}
  <T.PointLight
    position={[performer.planCentre.x, -3.7, performer.planCentre.z]}
    color={index === 1 ? "#f2a43b" : "#82c94c"}
    intensity={48}
    distance={11}
    decay={2}
  />
{/each}
<T.PointLight
  position={[contract.route.airExit.plan.x, 2.4, contract.route.airExit.plan.z]}
  color="#83bfe7"
  intensity={42}
  distance={12}
  decay={2}
/>

<GltfAsset
  url="/models/museum/cave/earth-root-chasm-graybox.glb"
  position={[contract.room.planCentre.x, 0, contract.room.planCentre.z]}
  emissiveBoost={1.15}
  onReady={handleAssetReady}
/>

<UnifiedCameraController
  destinationId="earth-root-chasm-graybox-walk"
  {avatarState}
  {physicsProvider}
  enabled={true}
  {initialYaw}
  initialPitch={0}
  allowedModes={[CameraMode.FIRST_PERSON]}
  disableModeToggle={true}
  moveSpeed={3.2}
  sprintMultiplier={1.8}
  gravity={9.81}
  jumpForce={4.5}
/>
