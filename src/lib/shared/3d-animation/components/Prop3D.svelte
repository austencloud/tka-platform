<script lang="ts">
  /**
   * Prop3D Component
   *
   * Renders a flow prop (staff, club, etc.) in 3D space.
   * Uses billboarding to always face the camera while maintaining
   * correct position and staff rotation.
   */

  import { T } from "@threlte/core";
  import { Billboard } from "@threlte/extras";
  import type { PropState3D } from "../domain/models/PropState3D";

  interface Props {
    /** Prop state with position and rotation */
    propState: PropState3D;
    /** Prop color */
    color: "blue" | "red";
    /** Whether to show the prop */
    visible?: boolean;
    /** Prop length (should match grid radius so opposite props touch) */
    length?: number;
    /** Prop width */
    width?: number;
  }

  let {
    propState,
    color,
    visible = true,
    length = 0.86, // Staff length in meters (~34 inches)
    width = 0.025, // Staff width in meters (2.5cm)
  }: Props = $props();

  // Color hex values - use hex for Three.js compatibility
  const colorHex = $derived(color === "blue" ? "#3b82f6" : "#ef4444");
  const colorDark = $derived(color === "blue" ? "#1d4ed8" : "#b91c1c");

  // Get position as tuple
  const position = $derived<[number, number, number]>([
    propState.worldPosition.x,
    propState.worldPosition.y,
    propState.worldPosition.z,
  ]);
</script>

{#if visible}
  <!-- Billboard keeps the prop facing the camera -->
  <Billboard {position}>
    <!-- Inner group for staff rotation (rotates around the prop's local Z axis) -->
    <T.Group rotation={[0, 0, propState.staffRotationAngle]}>
      <!-- Staff body (elongated box) -->
      <T.Mesh>
        <T.BoxGeometry args={[length, width, 0.02]} />
        <T.MeshStandardMaterial
          color={colorHex}
          roughness={0.4}
          metalness={0.1}
        />
      </T.Mesh>

      <!-- Left end cap (rounded) -->
      <T.Mesh position={[-length / 2, 0, 0]}>
        <T.SphereGeometry args={[width / 2, 16, 16]} />
        <T.MeshStandardMaterial
          color={colorDark}
          roughness={0.3}
          metalness={0.2}
        />
      </T.Mesh>

      <!-- Right end cap (rounded) -->
      <T.Mesh position={[length / 2, 0, 0]}>
        <T.SphereGeometry args={[width / 2, 16, 16]} />
        <T.MeshStandardMaterial
          color={colorDark}
          roughness={0.3}
          metalness={0.2}
        />
      </T.Mesh>

      <!-- Center grip indicator -->
      <T.Mesh position={[0, 0, 0.015]}>
        <T.CylinderGeometry
          args={[0.018, 0.018, width + 0.01, 16]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <T.MeshStandardMaterial color="white" roughness={0.5} />
      </T.Mesh>
    </T.Group>
  </Billboard>

  <!-- Trail indicator (small sphere at prop position for path visualization) -->
  <T.Mesh {position}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={colorHex} opacity={0.5} transparent />
  </T.Mesh>
{/if}
