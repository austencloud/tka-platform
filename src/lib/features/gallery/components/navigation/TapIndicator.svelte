<script lang="ts">
  /**
   * TapIndicator
   *
   * Visual feedback for tap-to-walk destination.
   * Shows an animated ring on the floor that pulses and fades when arrived.
   */

  import { T, useTask } from "@threlte/core";
  import { RingGeometry, MeshBasicMaterial, DoubleSide } from "three";

  interface Props {
    /** Target position on the floor */
    position: { x: number; z: number };
    /** Whether we're still walking to this target */
    active: boolean;
  }

  let { position, active }: Props = $props();

  // Animation state
  let outerScale = $state(1);
  let innerScale = $state(0.5);
  let opacity = $state(0.8);
  let pulsePhase = $state(0);

  // Pulse animation
  const PULSE_SPEED = 3; // cycles per second
  const OUTER_RING_SIZE = 40;
  const INNER_RING_SIZE = 20;

  useTask((delta) => {
    if (!active) {
      // Fade out when arrived
      opacity = Math.max(0, opacity - delta * 3);
      return;
    }

    // Pulse animation
    pulsePhase += delta * PULSE_SPEED * Math.PI * 2;

    // Outer ring pulses outward
    outerScale = 1 + Math.sin(pulsePhase) * 0.15;

    // Inner ring pulses in opposite phase
    innerScale = 0.5 + Math.cos(pulsePhase) * 0.1;

    // Gentle opacity pulse
    opacity = 0.6 + Math.sin(pulsePhase * 0.5) * 0.2;
  });

  // Colors
  const INDICATOR_COLOR = "#22d3ee"; // Cyan/teal - visible on most floors
</script>

{#if opacity > 0.01}
  <T.Group position={[position.x, 0.5, position.z]} rotation.x={-Math.PI / 2}>
    <!-- Outer pulsing ring -->
    <T.Mesh scale={[outerScale, outerScale, 1]}>
      <T.RingGeometry args={[OUTER_RING_SIZE - 4, OUTER_RING_SIZE, 32]} />
      <T.MeshBasicMaterial
        color={INDICATOR_COLOR}
        transparent={true}
        opacity={opacity * 0.6}
        side={DoubleSide}
        depthWrite={false}
      />
    </T.Mesh>

    <!-- Middle ring (static) -->
    <T.Mesh>
      <T.RingGeometry args={[INNER_RING_SIZE + 8, INNER_RING_SIZE + 12, 32]} />
      <T.MeshBasicMaterial
        color={INDICATOR_COLOR}
        transparent={true}
        opacity={opacity * 0.4}
        side={DoubleSide}
        depthWrite={false}
      />
    </T.Mesh>

    <!-- Inner pulsing dot -->
    <T.Mesh scale={[innerScale, innerScale, 1]}>
      <T.CircleGeometry args={[INNER_RING_SIZE, 32]} />
      <T.MeshBasicMaterial
        color={INDICATOR_COLOR}
        transparent={true}
        opacity={opacity * 0.5}
        side={DoubleSide}
        depthWrite={false}
      />
    </T.Mesh>

    <!-- Center dot (solid) -->
    <T.Mesh position={[0, 0, 0.1]}>
      <T.CircleGeometry args={[6, 16]} />
      <T.MeshBasicMaterial
        color={INDICATOR_COLOR}
        transparent={true}
        opacity={opacity}
        side={DoubleSide}
        depthWrite={false}
      />
    </T.Mesh>

    <!-- Expanding ripple effect -->
    <T.Mesh scale={[outerScale * 1.3, outerScale * 1.3, 1]}>
      <T.RingGeometry args={[OUTER_RING_SIZE + 10, OUTER_RING_SIZE + 14, 32]} />
      <T.MeshBasicMaterial
        color={INDICATOR_COLOR}
        transparent={true}
        opacity={opacity * 0.2}
        side={DoubleSide}
        depthWrite={false}
      />
    </T.Mesh>
  </T.Group>
{/if}
