<script lang="ts">
  /**
   * AvatarLoadingIndicator
   *
   * A 3D loading spinner shown while avatar GLTF models are loading.
   * Displays as a rotating ring at the avatar's position.
   */

  import { T, useTask } from "@threlte/core";
  import * as THREE from "three";

  interface Props {
    /** Position to show the indicator */
    position?: { x: number; y?: number; z: number };
  }

  let { position = { x: 0, y: 0, z: 0 } }: Props = $props();

  // Rotation animation
  let rotation = $state(0);

  useTask((delta) => {
    rotation += delta * 2; // Rotate at 2 radians/second
  });

  // Create a ring geometry for the spinner
  const ringGeometry = new THREE.RingGeometry(30, 35, 32, 1, 0, Math.PI * 1.5);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x8b5cf6,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });
</script>

<T.Group position={[position.x, 80, position.z]}>
  <!-- Rotating ring -->
  <T.Mesh
    geometry={ringGeometry}
    material={ringMaterial}
    rotation.z={rotation}
  />

  <!-- Secondary faint ring for depth -->
  <T.Mesh rotation.z={-rotation * 0.5}>
    <T.RingGeometry args={[25, 28, 32]} />
    <T.MeshBasicMaterial
      color={0x8b5cf6}
      side={THREE.DoubleSide}
      transparent
      opacity={0.3}
    />
  </T.Mesh>
</T.Group>
