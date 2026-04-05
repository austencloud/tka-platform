<script lang="ts">
  /**
   * Club3D Component
   *
   * Renders a realistic 3D juggling club with the grip point at origin (0,0,0).
   * The club body extends upward (+Y) from the hand, with a small handle knob
   * extending slightly below (-Y).
   *
   * Anatomy from bottom to top:
   * - Handle knob: small sphere just below the grip point
   * - Handle: thin cylindrical grip section (~15% of length)
   * - Neck: tapered section widening from handle to body (~30% of length)
   * - Body: wide "belly" of the club (~40% of length)
   * - Head: tapered tip with sphere cap (~15% of length)
   *
   * Overall length is ~65% of staff length since clubs are shorter than staves.
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

  // Clubs are ~65% of staff length
  const CLUB_LENGTH_RATIO = 0.65;

  const effectiveLength = $derived(
    (length ?? userProportionsState.staffLength) * CLUB_LENGTH_RATIO * scale
  );
  const baseRadius = $derived(
    (thickness ?? userProportionsState.dimensions.staffRadius) * scale
  );

  const palette = $derived(PROP_COLORS[color]);

  // Rotation only — position handled by PerformerRig scene graph
  const rotation = $derived(computePropRotation(propState));

  // --- Section proportions (fractions of effectiveLength) ---
  // Origin (0,0,0) is the grip point. Club extends upward from there.

  // Handle knob: small sphere just below grip
  const handleKnobOffset = $derived(effectiveLength * 0.05);
  const handleKnobRadius = $derived(baseRadius * 1.5);

  // Handle section: thin grip cylinder from origin up to 15%
  const handleLength = $derived(effectiveLength * 0.15);
  const handleRadius = $derived(baseRadius * 0.7);
  const handleCenterY = $derived(handleLength / 2);

  // Neck taper: widens from handle to body, 15% to 45%
  const neckLength = $derived(effectiveLength * 0.30);
  const neckRadiusBottom = $derived(baseRadius * 0.7); // matches handle top
  const neckRadiusTop = $derived(baseRadius * 2.5); // matches body bottom
  const neckCenterY = $derived(handleLength + neckLength / 2);

  // Body: wide belly, 45% to 85%
  const bodyLength = $derived(effectiveLength * 0.40);
  const bodyRadius = $derived(baseRadius * 2.5);
  const bodyCenterY = $derived(handleLength + neckLength + bodyLength / 2);

  // Head taper: narrows from body to tip, 85% to 100%
  const headLength = $derived(effectiveLength * 0.15);
  const headRadiusBottom = $derived(baseRadius * 2.5); // matches body top
  const headRadiusTop = $derived(baseRadius * 0.6); // tapers to near-point
  const headCenterY = $derived(
    handleLength + neckLength + bodyLength + headLength / 2
  );

  // Tip cap: small sphere at the very top
  const tipCapRadius = $derived(baseRadius * 0.7);
  const tipCapY = $derived(
    handleLength + neckLength + bodyLength + headLength
  );

  // Grip ring at origin (white torus, where the hand holds)
  const gripOuterRadius = $derived(baseRadius * 1.3);
  const gripTubeRadius = $derived(baseRadius * 0.15);
</script>

{#if visible}
  <T.Group {rotation} layers={propLayer}>
    <!-- Handle knob: small sphere below the grip point -->
    <T.Mesh position={[0, -handleKnobOffset, 0]}>
      <T.SphereGeometry args={[handleKnobRadius, 12, 12]} />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.4}
        metalness={0.15}
      />
    </T.Mesh>

    <!-- Handle: thin cylindrical grip section (origin to 15%) -->
    <T.Mesh position={[0, handleCenterY, 0]}>
      <T.CylinderGeometry
        args={[handleRadius, handleRadius, handleLength, 16, 1]}
      />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.5}
        metalness={0.1}
      />
    </T.Mesh>

    <!-- Neck taper: widens from handle to body (15% to 45%) -->
    <T.Mesh position={[0, neckCenterY, 0]}>
      <T.CylinderGeometry
        args={[neckRadiusTop, neckRadiusBottom, neckLength, 16, 1]}
      />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Body: wide belly of the club (45% to 85%) -->
    <T.Mesh position={[0, bodyCenterY, 0]}>
      <T.CylinderGeometry
        args={[bodyRadius, bodyRadius, bodyLength, 16, 1]}
      />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Head taper: narrows from body to tip (85% to 100%) -->
    <T.Mesh position={[0, headCenterY, 0]}>
      <T.CylinderGeometry
        args={[headRadiusTop, headRadiusBottom, headLength, 16, 1]}
      />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Tip cap: rounded sphere at the very top -->
    <T.Mesh position={[0, tipCapY, 0]}>
      <T.SphereGeometry args={[tipCapRadius, 12, 12]} />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Grip ring at origin (white torus where the hand holds) -->
    <T.Mesh>
      <T.TorusGeometry args={[gripOuterRadius, gripTubeRadius, 12, 24]} />
      <T.MeshStandardMaterial color="white" roughness={0.4} metalness={0.1} />
    </T.Mesh>
  </T.Group>

  <!-- Trail indicator sphere at the grip point -->
  <T.Mesh layers={propLayer}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={palette.main} opacity={0.3} transparent />
  </T.Mesh>
{/if}
