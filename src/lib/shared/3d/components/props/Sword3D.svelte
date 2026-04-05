<script lang="ts">
  /**
   * Sword3D Component
   *
   * Renders a 3D sword with tapered blade, pointed tip, curved crossguard,
   * leather-wrapped handle, and flattened gold pommel.
   *
   * The hand grips at the guard (origin). Blade extends in +Y (thumb direction),
   * handle and pommel extend in -Y (pinky direction).
   */

  import { T } from "@threlte/core";
  import type { Prop3DProps } from "./Prop3DProps";
  import { PROP_COLORS, METAL_COLORS } from "./Prop3DProps";
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
  const palette = $derived(PROP_COLORS[color]);

  const staffLength = $derived(length ?? userProportionsState.staffLength);
  const staffRadius = $derived(
    thickness ?? userProportionsState.dimensions.staffRadius * 2
  );

  // === Blade: 80% of total length, tapered and flat ===
  const bladeLength = $derived(staffLength * 0.8);

  // Lower blade section (wider, near guard): 60% of blade length
  const lowerBladeLength = $derived(bladeLength * 0.6);
  const lowerBladeWidthBottom = $derived(staffRadius * 1.8); // wide at guard
  const lowerBladeWidthTop = $derived(staffRadius * 1.2); // narrows toward upper
  const lowerBladeDepth = $derived(staffRadius * 0.3); // flat cross-section

  // Upper blade section (narrower, toward tip): 35% of blade length
  const upperBladeLength = $derived(bladeLength * 0.35);
  const upperBladeWidthBottom = $derived(staffRadius * 1.2); // matches lower top
  const upperBladeWidthTop = $derived(staffRadius * 0.5); // narrow near tip
  const upperBladeDepth = $derived(staffRadius * 0.25);

  // Tip cone: 5% of blade length
  const tipHeight = $derived(bladeLength * 0.08);
  const tipBaseWidth = $derived(staffRadius * 0.5);
  const tipBaseDepth = $derived(staffRadius * 0.2);

  // Blade section Y positions (stacked from guard upward)
  const lowerBladeCenterY = $derived(lowerBladeLength / 2);
  const upperBladeCenterY = $derived(
    lowerBladeLength + upperBladeLength / 2
  );
  const tipY = $derived(lowerBladeLength + upperBladeLength + tipHeight / 2);

  // === Guard/crossguard: at origin, wider than blade ===
  const guardWidth = $derived(bladeLength * 0.2);
  const guardHeight = $derived(staffRadius * 2.5);
  const guardDepth = $derived(staffRadius * 0.8);
  const guardRounding = $derived(staffRadius * 0.3);

  // === Handle: 12% of total length, slightly thicker than blade ===
  const handleLength = $derived(staffLength * 0.12);
  const handleRadius = $derived(staffRadius * 0.7);
  const handleCenterY = $derived(-(handleLength / 2));

  // === Pommel: flattened gold sphere at handle bottom ===
  const pommelRadius = $derived(staffRadius * 1.4);
  const pommelY = $derived(-(handleLength + pommelRadius * 0.4));

  const rotation = $derived(computePropRotation(propState));
</script>

{#if visible}
  <T.Group {rotation} layers={propLayer} scale={scale}>
    <!-- Lower blade: wider section near the guard -->
    <T.Mesh position={[0, lowerBladeCenterY, 0]}>
      <T.BoxGeometry
        args={[lowerBladeWidthBottom, lowerBladeLength, lowerBladeDepth]}
      />
      <T.MeshStandardMaterial
        color={METAL_COLORS.blade}
        roughness={0.2}
        metalness={0.7}
      />
    </T.Mesh>

    <!-- Upper blade: narrower section tapering toward tip -->
    <T.Mesh position={[0, upperBladeCenterY, 0]}>
      <T.BoxGeometry
        args={[upperBladeWidthTop, upperBladeLength, upperBladeDepth]}
      />
      <T.MeshStandardMaterial
        color={METAL_COLORS.blade}
        roughness={0.2}
        metalness={0.7}
      />
    </T.Mesh>

    <!-- Blade tip: pointed cone instead of sphere -->
    <T.Mesh position={[0, tipY, 0]}>
      <T.ConeGeometry args={[tipBaseWidth, tipHeight, 4]} />
      <T.MeshStandardMaterial
        color={METAL_COLORS.blade}
        roughness={0.2}
        metalness={0.7}
      />
    </T.Mesh>

    <!-- Guard/crossguard: wide flattened piece at origin -->
    <T.Mesh>
      <T.BoxGeometry args={[guardWidth, guardHeight, guardDepth]} />
      <T.MeshStandardMaterial
        color={METAL_COLORS.guard}
        roughness={0.3}
        metalness={0.6}
      />
    </T.Mesh>

    <!-- Guard end caps: rounded ends of the crossguard -->
    <T.Mesh position={[guardWidth / 2, 0, 0]}>
      <T.SphereGeometry args={[guardHeight / 2, 8, 8]} />
      <T.MeshStandardMaterial
        color={METAL_COLORS.guard}
        roughness={0.3}
        metalness={0.6}
      />
    </T.Mesh>
    <T.Mesh position={[-guardWidth / 2, 0, 0]}>
      <T.SphereGeometry args={[guardHeight / 2, 8, 8]} />
      <T.MeshStandardMaterial
        color={METAL_COLORS.guard}
        roughness={0.3}
        metalness={0.6}
      />
    </T.Mesh>

    <!-- Handle: leather-wrapped grip cylinder -->
    <T.Mesh position={[0, handleCenterY, 0]}>
      <T.CylinderGeometry
        args={[handleRadius, handleRadius * 0.9, handleLength, 12, 1]}
      />
      <T.MeshStandardMaterial
        color={METAL_COLORS.grip}
        roughness={0.8}
        metalness={0.05}
      />
    </T.Mesh>

    <!-- Pommel: flattened gold sphere at the handle end -->
    <T.Mesh position={[0, pommelY, 0]} scale={[1, 0.6, 1]}>
      <T.SphereGeometry args={[pommelRadius, 12, 12]} />
      <T.MeshStandardMaterial
        color={METAL_COLORS.guard}
        roughness={0.3}
        metalness={0.6}
      />
    </T.Mesh>
  </T.Group>

  <!-- Trail indicator sphere -->
  <T.Mesh layers={propLayer}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={palette.main} opacity={0.3} transparent />
  </T.Mesh>
{/if}
