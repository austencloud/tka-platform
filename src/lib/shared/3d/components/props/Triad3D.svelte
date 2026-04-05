<script lang="ts">
  /**
   * Triad3D Component
   *
   * Renders a 3D triad (Y-shaped prop with 3 arms radiating from a center hub):
   * - Center hub: sphere slightly larger than arm thickness
   * - Three arms at 120° intervals in the XY plane
   * - One arm points along +Y, others at ±120° from that
   * - Small sphere caps at each arm tip
   * - Grip is at the center hub
   * - Trail indicator sphere for path visualization
   *
   * Each arm is ~45% of staffLength. The Y-shape lies flat so the arms
   * spread in the local XY plane from the center hub.
   */

  import { T } from "@threlte/core";
  import type { Prop3DProps } from "./Prop3DProps";
  import { PROP_COLORS } from "./Prop3DProps";
  import { computePropRotation } from "./prop3d-transforms";
  import { userProportionsState } from "../../state/user-proportions-state.svelte";
  import {
    LAYER_WORLD,
    LAYER_PLAYER_BODY,
  } from "$lib/shared/3d/layers/layer-constants";

  let {
    propState,
    color,
    visible = true,
    length,
    thickness,
    isActivePlayer = false,
    scale = 1,
  }: Prop3DProps = $props();

  const propLayer = $derived(isActivePlayer ? LAYER_PLAYER_BODY : LAYER_WORLD);

  // Each arm is ~45% of staff length
  const ARM_LENGTH_RATIO = 0.45;

  const armLength = $derived(
    (length ?? userProportionsState.staffLength) * ARM_LENGTH_RATIO * scale
  );
  const baseRadius = $derived(
    (thickness ?? userProportionsState.dimensions.staffRadius) * scale
  );

  const palette = $derived(PROP_COLORS[color]);

  const rotation = $derived(computePropRotation(propState));

  // Arm thickness is 2x the base staff radius
  const armRadius = $derived(baseRadius * 2);

  // Hub sphere is slightly larger than arm thickness so the arms blend into it
  const hubRadius = $derived(armRadius * 1.4);

  // Sphere cap radius at each arm tip
  const tipCapRadius = $derived(armRadius * 1.2);

  // Three arms at 120° intervals.
  // Arm 0: along +Y (up in local space)
  // Arm 1: 120° clockwise from +Y
  // Arm 2: 240° clockwise from +Y
  //
  // Each arm's center is offset by half its length along its direction.
  // The cylinder is vertical by default (along Y), so we rotate each arm
  // around Z to point it in the correct direction within the XY plane.
  const arms = $derived.by(() => {
    const result: Array<{
      centerX: number;
      centerY: number;
      tipX: number;
      tipY: number;
      rotationZ: number;
    }> = [];

    for (let i = 0; i < 3; i++) {
      // Angle from +Y axis, measured clockwise in XY plane
      // Arm 0 = 0°, Arm 1 = 120°, Arm 2 = 240°
      const angle = (i * 2 * Math.PI) / 3;

      // Direction vector in XY plane (from +Y, rotating clockwise)
      const dirX = Math.sin(angle);
      const dirY = Math.cos(angle);

      // Cylinder center (halfway along the arm)
      const halfArm = armLength / 2;
      const centerX = dirX * halfArm;
      const centerY = dirY * halfArm;

      // Tip position (end of arm)
      const tipX = dirX * armLength;
      const tipY = dirY * armLength;

      // Rotation around Z to orient the cylinder along this direction.
      // Default cylinder is along +Y, so we rotate by -angle around Z.
      const rotationZ = -angle;

      result.push({ centerX, centerY, tipX, tipY, rotationZ });
    }

    return result;
  });
</script>

{#if visible}
  <T.Group {rotation} layers={propLayer}>
    <!-- Center hub sphere -->
    <T.Mesh>
      <T.SphereGeometry args={[hubRadius, 16, 16]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Three arms at 120° intervals -->
    {#each arms as arm}
      <!-- Arm cylinder -->
      <T.Mesh
        position={[arm.centerX, arm.centerY, 0]}
        rotation={[0, 0, arm.rotationZ]}
      >
        <T.CylinderGeometry args={[armRadius, armRadius, armLength, 16, 1]} />
        <T.MeshStandardMaterial
          color={palette.main}
          roughness={0.3}
          metalness={0.2}
        />
      </T.Mesh>

      <!-- Arm tip cap -->
      <T.Mesh position={[arm.tipX, arm.tipY, 0]}>
        <T.SphereGeometry args={[tipCapRadius, 12, 12]} />
        <T.MeshStandardMaterial
          color={palette.dark}
          roughness={0.3}
          metalness={0.2}
        />
      </T.Mesh>
    {/each}
  </T.Group>

  <!-- Trail indicator sphere -->
  <T.Mesh layers={propLayer}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={palette.main} opacity={0.3} transparent />
  </T.Mesh>
{/if}
