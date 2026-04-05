<script lang="ts">
  /**
   * Buugeng3D Component
   *
   * Renders a 3D buugeng (S-shaped curved staff) with:
   * - 5 cylinder segments forming a smooth S-curve
   * - Center grip at the origin (buugeng are center-gripped)
   * - Segments progress from ~35° at tips to 0° at center
   * - Sphere caps at each tip
   * - White grip ring (torus) at origin
   * - Trail indicator sphere for path visualization
   *
   * The S-curve uses 5 segments instead of 3 for a smoother shape.
   * Overall length is ~90% of staffLength since buugeng are slightly
   * shorter than full staves.
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

  const BUUGENG_LENGTH_RATIO = 0.9;

  const effectiveLength = $derived(
    (length ?? userProportionsState.staffLength) * BUUGENG_LENGTH_RATIO * scale
  );
  const baseRadius = $derived(
    (thickness ?? userProportionsState.dimensions.staffRadius) * scale
  );

  const palette = $derived(PROP_COLORS[color]);

  const rotation = $derived(computePropRotation(propState));

  // Tube radius: 1.8x base staff radius
  const tubeRadius = $derived(baseRadius * 1.8);

  // Each of the 5 segments is ~18% of total length
  const segLength = $derived(effectiveLength * 0.18);

  // Angles progress from 0° at center to ~35° at tips.
  // Segment 3 (center) = 0°, segments 2/4 = 18°, segments 1/5 = 35°
  const ANGLE_TIP = (35 * Math.PI) / 180;
  const ANGLE_MID = (18 * Math.PI) / 180;
  const ANGLE_CENTER = 0;

  // Build the upper half of the S-curve (segments 3, 4, 5 going upward).
  // Each segment's base connects to the previous segment's top.
  // A cylinder in Three.js is centered on its own origin, aligned along Y.
  // We compute each segment's center position and Z-rotation so the
  // chain connects end-to-end with no gaps.

  // Segment center (seg 3): straight, centered at origin
  // Its top end is at (0, segLength/2, 0)
  const seg3Pos = $derived({ x: 0, y: 0 });

  // Segment 4 (upper mid): angled at ANGLE_MID from vertical
  // Its bottom end must meet seg3's top end
  const seg4Pos = $derived.by(() => {
    const halfPrev = segLength / 2; // top of seg3
    const halfCurr = segLength / 2;
    const baseX = 0;
    const baseY = halfPrev;
    return {
      x: baseX + halfCurr * Math.sin(ANGLE_MID),
      y: baseY + halfCurr * Math.cos(ANGLE_MID),
    };
  });

  // Segment 5 (upper tip): angled at ANGLE_TIP from vertical
  // Its bottom end must meet seg4's top end
  const seg5Pos = $derived.by(() => {
    const seg4TopX = seg4Pos.x + (segLength / 2) * Math.sin(ANGLE_MID);
    const seg4TopY = seg4Pos.y + (segLength / 2) * Math.cos(ANGLE_MID);
    const halfCurr = segLength / 2;
    return {
      x: seg4TopX + halfCurr * Math.sin(ANGLE_TIP),
      y: seg4TopY + halfCurr * Math.cos(ANGLE_TIP),
    };
  });

  // Tip positions (very end of seg 5, for sphere caps)
  const upperTip = $derived.by(() => ({
    x: seg5Pos.x + (segLength / 2) * Math.sin(ANGLE_TIP),
    y: seg5Pos.y + (segLength / 2) * Math.cos(ANGLE_TIP),
  }));

  // Lower half mirrors upper half across the origin
  const seg2Pos = $derived({ x: -seg4Pos.x, y: -seg4Pos.y });
  const seg1Pos = $derived({ x: -seg5Pos.x, y: -seg5Pos.y });
  const lowerTip = $derived({ x: -upperTip.x, y: -upperTip.y });

  // Tip cap radius slightly larger than tube
  const tipCapRadius = $derived(tubeRadius * 1.15);

  // Grip ring at center
  const gripOuterRadius = $derived(baseRadius * 1.3);
  const gripTubeRadius = $derived(baseRadius * 0.15);
</script>

{#if visible}
  <T.Group {rotation} layers={propLayer}>
    <!-- Segment 3: center grip section (straight, 0° angle) -->
    <T.Mesh position={[seg3Pos.x, seg3Pos.y, 0]}>
      <T.CylinderGeometry args={[tubeRadius, tubeRadius, segLength, 16, 1]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Segment 4: upper mid (18° from vertical, curving outward) -->
    <T.Mesh
      position={[seg4Pos.x, seg4Pos.y, 0]}
      rotation={[0, 0, -ANGLE_MID]}
    >
      <T.CylinderGeometry args={[tubeRadius, tubeRadius, segLength, 16, 1]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Segment 5: upper tip (35° from vertical, most angled) -->
    <T.Mesh
      position={[seg5Pos.x, seg5Pos.y, 0]}
      rotation={[0, 0, -ANGLE_TIP]}
    >
      <T.CylinderGeometry args={[tubeRadius, tubeRadius, segLength, 16, 1]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Segment 2: lower mid (mirrors segment 4) -->
    <T.Mesh
      position={[seg2Pos.x, seg2Pos.y, 0]}
      rotation={[0, 0, -ANGLE_MID]}
    >
      <T.CylinderGeometry args={[tubeRadius, tubeRadius, segLength, 16, 1]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Segment 1: lower tip (mirrors segment 5) -->
    <T.Mesh
      position={[seg1Pos.x, seg1Pos.y, 0]}
      rotation={[0, 0, -ANGLE_TIP]}
    >
      <T.CylinderGeometry args={[tubeRadius, tubeRadius, segLength, 16, 1]} />
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Upper tip cap -->
    <T.Mesh position={[upperTip.x, upperTip.y, 0]}>
      <T.SphereGeometry args={[tipCapRadius, 12, 12]} />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Lower tip cap -->
    <T.Mesh position={[lowerTip.x, lowerTip.y, 0]}>
      <T.SphereGeometry args={[tipCapRadius, 12, 12]} />
      <T.MeshStandardMaterial
        color={palette.dark}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Center grip ring (white, at the hand point) -->
    <T.Mesh>
      <T.TorusGeometry args={[gripOuterRadius, gripTubeRadius, 12, 24]} />
      <T.MeshStandardMaterial color="white" roughness={0.4} metalness={0.1} />
    </T.Mesh>
  </T.Group>

  <!-- Trail indicator sphere -->
  <T.Mesh layers={propLayer}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={palette.main} opacity={0.3} transparent />
  </T.Mesh>
{/if}
