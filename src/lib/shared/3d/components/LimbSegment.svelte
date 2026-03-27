<script lang="ts">
  /**
   * LimbSegment Component
   *
   * Renders a cylinder that ACTUALLY connects two 3D points.
   * Uses Three.js Quaternion for proper rotation (no gimbal lock).
   */

  import { T } from "@threlte/core";
  import { Vector3, Quaternion, Matrix4 } from "three";

  interface Props {
    from: [number, number, number];
    to: [number, number, number];
    thickness?: number;
    color?: string;
  }

  let { from, to, thickness = 8, color = "#d4a574" }: Props = $props();

  // Calculate cylinder transform using quaternion (proper 3D rotation)
  const transform = $derived.by(() => {
    const start = new Vector3(...from);
    const end = new Vector3(...to);

    // Midpoint
    const position = start.clone().add(end).multiplyScalar(0.5);

    // Length
    const length = start.distanceTo(end);
    if (length < 0.001) {
      return {
        position: [0, 0, 0] as [number, number, number],
        quaternion: [0, 0, 0, 1] as [number, number, number, number],
        length: 0.001,
      };
    }

    // Direction from start to end
    const direction = end.clone().sub(start).normalize();

    // Cylinder default axis is Y (0, 1, 0)
    // We need to rotate from Y to our direction
    const yAxis = new Vector3(0, 1, 0);

    const quaternion = new Quaternion();

    // Handle special case where direction is parallel to Y axis
    if (Math.abs(direction.y) > 0.9999) {
      // Pointing up or down along Y
      if (direction.y > 0) {
        quaternion.set(0, 0, 0, 1); // No rotation needed
      } else {
        quaternion.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI); // Flip 180°
      }
    } else {
      // General case: rotate from Y axis to direction
      quaternion.setFromUnitVectors(yAxis, direction);
    }

    return {
      position: [position.x, position.y, position.z] as [
        number,
        number,
        number,
      ],
      quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w] as [
        number,
        number,
        number,
        number,
      ],
      length,
    };
  });
</script>

<T.Mesh position={transform.position} quaternion={transform.quaternion}>
  <T.CylinderGeometry args={[thickness, thickness, transform.length, 8]} />
  <T.MeshStandardMaterial {color} roughness={0.6} />
</T.Mesh>
