<script lang="ts">
  import { T } from "@threlte/core";
  import { Avatar3D } from "@austencloud/scene-3d";
  import {
    FLOW_FEST_EUC_CONFIG,
    type FlowFestElectricUnicycleDynamics,
    type FlowFestElectricUnicycleTerrainAttitude,
  } from "$lib/features/flow-fest-sim/domain/flow-fest-electric-unicycle";

  interface Props {
    position: { x: number; y: number; z: number };
    dynamics: FlowFestElectricUnicycleDynamics;
    terrainAttitude?: FlowFestElectricUnicycleTerrainAttitude;
    mounted: boolean;
    lightsOn?: boolean;
  }

  const props: Props = $props();
  const spokeAngles = Array.from(
    { length: 8 },
    (_, index) => (index / 8) * Math.PI * 2
  );
  const terrainAttitude = $derived(
    props.terrainAttitude ?? {
      pitchRadians: 0,
      rollRadians: 0,
      roughnessMeters: 0,
    }
  );
  const suspensionOffset = $derived(
    -terrainAttitude.roughnessMeters * 0.48 +
      Math.sin(props.dynamics.wheelRotationRadians * 0.43) *
        terrainAttitude.roughnessMeters *
        0.32
  );
</script>

<T.Group
  name="FFS_ElectricUnicycle"
  position={[props.position.x, props.position.y, props.position.z]}
  rotation={[
    terrainAttitude.pitchRadians,
    props.dynamics.headingRadians,
    terrainAttitude.rollRadians,
  ]}
>
  <T.Group
    name="FFS_EUC_RiderLean"
    position={[0, suspensionOffset, 0]}
    rotation={[props.dynamics.pitchRadians, 0, props.dynamics.leanRadians]}
  >
    <T.Group
      name="FFS_EUC_WheelSpin"
      position={[0, 0.36, 0]}
      rotation={[props.dynamics.wheelRotationRadians, 0, 0]}
    >
      <T.Mesh rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
        <T.TorusGeometry args={[0.285, 0.078, 18, 48]} />
        <T.MeshStandardMaterial
          color="#171c21"
          roughness={0.88}
          metalness={0.05}
        />
      </T.Mesh>

      <T.Mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <T.CylinderGeometry args={[0.238, 0.238, 0.23, 32]} />
        <T.MeshStandardMaterial
          color="#4b5a67"
          roughness={0.32}
          metalness={0.72}
        />
      </T.Mesh>
      <T.Mesh position={[-0.101, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <T.CylinderGeometry args={[0.14, 0.14, 0.018, 32]} />
        <T.MeshStandardMaterial
          color="#6d7782"
          roughness={0.22}
          metalness={0.9}
        />
      </T.Mesh>
      <T.Mesh position={[0.101, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <T.CylinderGeometry args={[0.14, 0.14, 0.018, 32]} />
        <T.MeshStandardMaterial
          color="#6d7782"
          roughness={0.22}
          metalness={0.9}
        />
      </T.Mesh>

      {#each spokeAngles as angle}
        <T.Group rotation={[angle, 0, 0]}>
          <T.Mesh position={[0, 0.115, 0]} castShadow>
            <T.BoxGeometry args={[0.026, 0.225, 0.026]} />
            <T.MeshStandardMaterial
              color="#aeb8c0"
              roughness={0.26}
              metalness={0.82}
            />
          </T.Mesh>
        </T.Group>
      {/each}
    </T.Group>

    <T.Mesh
      position={[0, 0.58, 0.035]}
      scale={[0.88, 0.86, 0.9]}
      castShadow
      receiveShadow
    >
      <T.CapsuleGeometry args={[0.205, 0.22, 8, 24]} />
      <T.MeshPhysicalMaterial
        color="#2d3a49"
        emissive="#080d12"
        emissiveIntensity={0.32}
        roughness={0.24}
        metalness={0.48}
        clearcoat={0.85}
        clearcoatRoughness={0.18}
      />
    </T.Mesh>

    <T.Mesh position={[-0.19, 0.64, 0.015]} castShadow>
      <T.BoxGeometry args={[0.045, 0.24, 0.18]} />
      <T.MeshStandardMaterial
        color="#26323d"
        roughness={0.68}
        metalness={0.18}
      />
    </T.Mesh>
    <T.Mesh position={[0.19, 0.64, 0.015]} castShadow>
      <T.BoxGeometry args={[0.045, 0.24, 0.18]} />
      <T.MeshStandardMaterial
        color="#26323d"
        roughness={0.68}
        metalness={0.18}
      />
    </T.Mesh>

    <T.Mesh position={[0, 0.73, 0.182]} rotation={[0.22, 0, 0]}>
      <T.BoxGeometry args={[0.21, 0.075, 0.035]} />
      <T.MeshStandardMaterial
        color="#e8f5ff"
        emissive="#b9e7ff"
        emissiveIntensity={props.lightsOn ? 4.2 : 1.3}
        roughness={0.15}
      />
    </T.Mesh>
    <T.Mesh position={[0, 0.67, -0.17]} rotation={[-0.12, 0, 0]}>
      <T.BoxGeometry args={[0.18, 0.055, 0.03]} />
      <T.MeshStandardMaterial
        color="#ff4f48"
        emissive="#ff231c"
        emissiveIntensity={props.lightsOn ? 4.8 : 1.8}
        roughness={0.2}
      />
    </T.Mesh>

    <T.Mesh position={[-0.23, 0.25, 0.015]} castShadow receiveShadow>
      <T.BoxGeometry args={[0.27, 0.035, 0.25]} />
      <T.MeshStandardMaterial
        color="#20252b"
        roughness={0.72}
        metalness={0.45}
      />
    </T.Mesh>
    <T.Mesh position={[0.23, 0.25, 0.015]} castShadow receiveShadow>
      <T.BoxGeometry args={[0.27, 0.035, 0.25]} />
      <T.MeshStandardMaterial
        color="#20252b"
        roughness={0.72}
        metalness={0.45}
      />
    </T.Mesh>
    {#each [-0.23, 0.23] as x}
      {#each [-0.05, 0.02, 0.09] as z}
        <T.Mesh position={[x, 0.272, z]}>
          <T.BoxGeometry args={[0.2, 0.01, 0.014]} />
          <T.MeshStandardMaterial
            color="#8f9aa3"
            roughness={0.4}
            metalness={0.8}
          />
        </T.Mesh>
      {/each}
    {/each}

    <T.Mesh position={[0, 0.48, 0.197]}>
      <T.BoxGeometry args={[0.12, 0.26, 0.024]} />
      <T.MeshStandardMaterial
        color="#1f99ff"
        emissive="#0b65ff"
        emissiveIntensity={1.8}
        roughness={0.28}
        metalness={0.4}
      />
    </T.Mesh>
    <T.Mesh position={[0, 0.875, 0.01]}>
      <T.BoxGeometry args={[0.2, 0.035, 0.18]} />
      <T.MeshStandardMaterial
        color="#07090c"
        roughness={0.6}
        metalness={0.22}
      />
    </T.Mesh>

    {#if !props.mounted}
      <T.Mesh
        position={[0.2, 0.19, -0.12]}
        rotation={[0.48, 0, -0.22]}
        castShadow
      >
        <T.CylinderGeometry args={[0.012, 0.018, 0.34, 8]} />
        <T.MeshStandardMaterial
          color="#68717b"
          roughness={0.36}
          metalness={0.78}
        />
      </T.Mesh>
    {/if}

    {#if props.mounted}
      <T.Group name="FFS_EUC_MountedRider">
        <Avatar3D
          id="flow-fest-player"
          avatarId={FLOW_FEST_EUC_CONFIG.riderAvatarId}
          bluePropState={null}
          redPropState={null}
          visible={true}
          isActive={false}
          position={{
            x: 0,
            y: FLOW_FEST_EUC_CONFIG.riderPedalHeightMeters,
            z: FLOW_FEST_EUC_CONFIG.riderOffsetZMeters,
          }}
          facingAngle={0}
          isMoving={false}
          moveSpeed={Math.min(
            1,
            Math.abs(props.dynamics.speedMetersPerSecond) /
              FLOW_FEST_EUC_CONFIG.cruiseSpeedMetersPerSecond
          )}
          moveDirection={{ x: 0, z: 1 }}
          enableLocomotion={true}
          enableRootMotion={false}
          isGrounded={true}
          spinePitchOffset={Math.max(0, -props.dynamics.pitchRadians * 0.7)}
        />
      </T.Group>
    {/if}
  </T.Group>

  {#if props.lightsOn}
    <T.PointLight
      position={[0, 0.83, 0.45]}
      color="#b8e8ff"
      intensity={2.6}
      distance={7}
      decay={2}
      castShadow={false}
    />
  {/if}
</T.Group>
