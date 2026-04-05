<script lang="ts">
  /**
   * Poi3D Component
   *
   * Renders a 3D poi prop with grip point at origin (0,0,0).
   * The hand holds the handle at origin. The leash and ball extend in +Y.
   *
   * Anatomy from grip outward:
   * - Handle (finger loop): small knob at/below origin, extends slightly -Y
   * - Leash (cord): thin cylinder from origin extending +Y (~70% of total)
   * - Swivel: tiny metallic connector where leash meets ball
   * - Ball (weighted head): large colored sphere at far +Y end
   *
   * Total length is ~65% of staffLength.
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

  // Poi is ~65% of staff length
  const POI_LENGTH_RATIO = 0.65;

  const totalLength = $derived(
    (length ?? userProportionsState.staffLength) * POI_LENGTH_RATIO * scale
  );
  const staffRadius = $derived(
    (thickness ?? userProportionsState.dimensions.staffRadius) * scale
  );

  const palette = $derived(PROP_COLORS[color]);

  const rotation = $derived(computePropRotation(propState));

  // --- Handle (finger loop) at and slightly below origin ---
  // ~8% of total length, centered slightly below origin
  const handleLength = $derived(totalLength * 0.08);
  const handleRadius = $derived(staffRadius * 0.8);
  const handleY = $derived(-handleLength / 2);

  // --- Leash (thin cord) from origin extending +Y ---
  // ~70% of total length
  const leashLength = $derived(totalLength * 0.70);
  const leashRadius = $derived(staffRadius * 0.15);
  const leashY = $derived(leashLength / 2);

  // --- Swivel (small connector at leash-ball junction) ---
  const swivelRadius = $derived(staffRadius * 0.4);
  const swivelY = $derived(leashLength + swivelRadius);

  // --- Ball (weighted head) at far +Y end ---
  const ballRadius = $derived(staffRadius * 3.5);
  const ballY = $derived(leashLength + swivelRadius * 2 + ballRadius);
</script>

{#if visible}
  <T.Group {rotation} layers={propLayer}>
    <!-- Handle (finger loop) at origin, extending slightly -Y -->
    <T.Mesh position={[0, handleY, 0]}>
      <T.CylinderGeometry
        args={[handleRadius, handleRadius * 0.9, handleLength, 12]}
      />
      <T.MeshStandardMaterial color="#e8e8e8" roughness={0.3} metalness={0.1} />
    </T.Mesh>

    <!-- Leash (thin cord from origin extending +Y) -->
    <T.Mesh position={[0, leashY, 0]}>
      <T.CylinderGeometry args={[leashRadius, leashRadius, leashLength, 8]} />
      <T.MeshStandardMaterial color="#444444" roughness={0.9} metalness={0.0} />
    </T.Mesh>

    <!-- Swivel (small metallic connector between leash and ball) -->
    <T.Mesh position={[0, swivelY, 0]}>
      <T.SphereGeometry args={[swivelRadius, 10, 10]} />
      <T.MeshStandardMaterial color="#888888" roughness={0.2} metalness={0.7} />
    </T.Mesh>

    <!-- Ball (weighted colored head at far +Y end) -->
    <T.Mesh position={[0, ballY, 0]}>
      <T.SphereGeometry args={[ballRadius, 16, 16]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.35}
        metalness={0.15}
      />
    </T.Mesh>
  </T.Group>

  <!-- Trail indicator sphere -->
  <T.Mesh layers={propLayer}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={palette.main} opacity={0.3} transparent />
  </T.Mesh>
{/if}
