<script lang="ts">
  /**
   * Doublestar3D Component
   *
   * Renders a 3D doublestar (figure-8 / two diamond shapes connected at center):
   * - Two torus rings connected at the grip center
   * - Upper ring centered at +30% of staffLength along Y
   * - Lower ring centered at -30% of staffLength along Y
   * - Connection bar: thin cylinder between the two rings along Y axis
   * - Grip ring at center (torus)
   * - Trail indicator sphere for path visualization
   */

  import { T } from "@threlte/core";
  import type { Prop3DProps } from "./Prop3DProps";
  import { PROP_COLORS } from "./Prop3DProps";
  import { computePropPosition, computePropRotation } from "./prop3d-transforms";
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
    avatarPosition = { x: 0, y: 0, z: 0 },
    facingAngle = 0,
    gridOffset = 0,
    isActivePlayer = false,
    scale = 1,
  }: Prop3DProps = $props();

  const propLayer = $derived(isActivePlayer ? LAYER_PLAYER_BODY : LAYER_WORLD);

  const effectiveLength = $derived(
    (length ?? userProportionsState.staffLength) * scale
  );
  const baseRadius = $derived(
    (thickness ?? userProportionsState.dimensions.staffRadius) * scale
  );

  const palette = $derived(PROP_COLORS[color]);

  const position = $derived.by(() =>
    computePropPosition(propState, avatarPosition, facingAngle, gridOffset)
  );
  const rotation = $derived.by(() =>
    computePropRotation(propState, facingAngle)
  );

  // Each star ring: torus with radius ~30% of staffLength, tube radius ~staffRadius
  const ringRadius = $derived(effectiveLength * 0.3);
  const ringTubeRadius = $derived(baseRadius);

  // Ring centers at +/- 30% of effectiveLength along Y
  const ringOffset = $derived(effectiveLength * 0.3);

  // Connection bar spans between the two ring centers
  const barLength = $derived(ringOffset * 2);
  const barRadius = $derived(baseRadius * 0.6);

  // Grip ring at center
  const gripOuterRadius = $derived(baseRadius * 1.3);
  const gripTubeRadius = $derived(baseRadius * 0.15);

  // Star point cones: 4 per ring, pointing outward at 0°, 90°, 180°, 270°
  const pointHeight = $derived(ringRadius * 0.15);
  const pointBaseRadius = $derived(ringTubeRadius * 1.5);
  // Angles around each ring where star points protrude
  const POINT_ANGLES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
</script>

{#if visible}
  <T.Group {position} {rotation} layers={propLayer}>
    <!-- Upper star ring at +30% along Y -->
    <T.Group position={[0, ringOffset, 0]}>
      <T.Mesh>
        <T.TorusGeometry args={[ringRadius, ringTubeRadius, 16, 24]} />
        <T.MeshStandardMaterial
          color={palette.main}
          roughness={0.3}
          metalness={0.2}
        />
      </T.Mesh>
      <!-- 4 star points protruding outward from the upper ring -->
      {#each POINT_ANGLES as pAngle}
        <T.Mesh
          position={[
            Math.cos(pAngle) * (ringRadius + pointHeight / 2),
            0,
            Math.sin(pAngle) * (ringRadius + pointHeight / 2),
          ]}
          rotation={[0, 0, -pAngle + Math.PI / 2]}
        >
          <T.ConeGeometry args={[pointBaseRadius, pointHeight, 8]} />
          <T.MeshStandardMaterial
            color={palette.main}
            roughness={0.3}
            metalness={0.2}
          />
        </T.Mesh>
      {/each}
    </T.Group>

    <!-- Lower star ring at -30% along Y -->
    <T.Group position={[0, -ringOffset, 0]}>
      <T.Mesh>
        <T.TorusGeometry args={[ringRadius, ringTubeRadius, 16, 24]} />
        <T.MeshStandardMaterial
          color={palette.main}
          roughness={0.3}
          metalness={0.2}
        />
      </T.Mesh>
      <!-- 4 star points protruding outward from the lower ring -->
      {#each POINT_ANGLES as pAngle}
        <T.Mesh
          position={[
            Math.cos(pAngle) * (ringRadius + pointHeight / 2),
            0,
            Math.sin(pAngle) * (ringRadius + pointHeight / 2),
          ]}
          rotation={[0, 0, -pAngle + Math.PI / 2]}
        >
          <T.ConeGeometry args={[pointBaseRadius, pointHeight, 8]} />
          <T.MeshStandardMaterial
            color={palette.main}
            roughness={0.3}
            metalness={0.2}
          />
        </T.Mesh>
      {/each}
    </T.Group>

    <!-- Connection bar between the two rings -->
    <T.Mesh>
      <T.CylinderGeometry args={[barRadius, barRadius, barLength, 12, 1]} />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Center grip ring (white) -->
    <T.Mesh>
      <T.TorusGeometry args={[gripOuterRadius, gripTubeRadius, 12, 24]} />
      <T.MeshStandardMaterial color="white" roughness={0.4} metalness={0.1} />
    </T.Mesh>
  </T.Group>

  <!-- Trail indicator sphere -->
  <T.Mesh {position} layers={propLayer}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={palette.main} opacity={0.3} transparent />
  </T.Mesh>
{/if}
