<script lang="ts">
  /**
   * Triquetra3D Component
   *
   * Renders a 3D triquetra (trefoil knot) prop with:
   * - Three interlocked partial torus arcs, each rotated 120° apart
   * - Each arc shows ~240° of a full circle, creating the woven overlap
   * - Small sphere hub at the center grip point
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

  // Each lobe: torus with radius ~25% of staffLength
  const lobeRadius = $derived(effectiveLength * 0.25);
  const lobeTubeRadius = $derived(baseRadius * 0.7);

  // Show ~240° of each torus (4/3 * PI radians), leaving a gap for the woven look
  const thetaLength = (4 / 3) * Math.PI;

  // Center hub sphere at the grip point
  const hubRadius = $derived(baseRadius * 1.2);

  // Offset each lobe center outward by 60% of lobeRadius at 120° intervals in XY plane
  const lobeOffset = $derived(lobeRadius * 0.6);

  // Three lobes at 120° intervals — positions and rotations computed for XY-plane trefoil
  const LOBE_CONFIGS = [
    { angle: 0 },
    { angle: (2 * Math.PI) / 3 },
    { angle: (4 * Math.PI) / 3 },
  ];
</script>

{#if visible}
  <T.Group {position} {rotation} layers={propLayer}>
    <!-- Three interlocked partial torus arcs in XY plane -->
    {#each LOBE_CONFIGS as lobe}
      <T.Mesh
        position={[
          Math.cos(lobe.angle) * lobeOffset,
          Math.sin(lobe.angle) * lobeOffset,
          0,
        ]}
        rotation={[Math.PI / 2, 0, lobe.angle]}
      >
        <T.TorusGeometry
          args={[lobeRadius, lobeTubeRadius, 16, 48, thetaLength]}
        />
        <T.MeshStandardMaterial
          color={palette.main}
          roughness={0.3}
          metalness={0.2}
        />
      </T.Mesh>
    {/each}

    <!-- Center hub sphere at grip point -->
    <T.Mesh>
      <T.SphereGeometry args={[hubRadius, 12, 12]} />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>
  </T.Group>

  <!-- Trail indicator sphere -->
  <T.Mesh {position} layers={propLayer}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={palette.main} opacity={0.3} transparent />
  </T.Mesh>
{/if}
