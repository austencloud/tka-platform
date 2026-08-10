<script lang="ts">
  /**
   * MuseumPortal - lightweight luminous gateway between paired rooms.
   *
   * A live destination view used to render the entire museum again every third
   * frame. The portal now keeps the same readable frame and glow without adding
   * a second multi-million-triangle scene pass while the visitor walks.
   */
  import { T } from "@threlte/core";

  interface Props {
    /** Portal's own position in world space */
    position: [number, number, number];
    /** Portal's own rotation (Euler angles) */
    rotation: [number, number, number];
    /** Portal surface width */
    width?: number;
    /** Portal surface height */
    height?: number;
    /** Destination portal's position */
    destPosition: [number, number, number];
    /** Destination portal's rotation (Euler angles) */
    destRotation: [number, number, number];
    /** Glow color - "#0088ff" for blue, "#ff8800" for orange */
    color?: string;
    /** Optional label shown above the portal */
    label?: string;
    /** Controls the nearby portal surface and frame. */
    visible?: boolean;
  }

  const props: Props = $props();

  // Resolve defaults (plain consts - initial values for Three.js objects, not reactive)
  const position = props.position;
  const rotation = props.rotation;
  const width = props.width ?? 1.2;
  const height = props.height ?? 2.2;
  const color = props.color ?? "#0088ff";
  const label = props.label ?? "";
</script>

<!-- Glowing rectangular frame around the portal -->
<T.Group
  visible={props.visible !== false}
  position.x={position[0]}
  position.y={position[1]}
  position.z={position[2]}
  rotation.x={rotation[0]}
  rotation.y={rotation[1]}
  rotation.z={rotation[2]}
>
  <!-- A cheap opaque-enough core preserves the portal silhouette and color. -->
  <T.Mesh name={`portal-surface-${color}`}>
    <T.PlaneGeometry args={[width, height]} />
    <T.MeshBasicMaterial
      {color}
      transparent
      opacity={0.62}
      depthWrite={false}
      toneMapped={false}
    />
  </T.Mesh>

  <!-- Top bar -->
  <T.Mesh position.y={height / 2} position.z={-0.02}>
    <T.BoxGeometry args={[width + 0.12, 0.06, 0.06]} />
    <T.MeshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={1.5}
      metalness={0.6}
      roughness={0.3}
    />
  </T.Mesh>
  <!-- Bottom bar -->
  <T.Mesh position.y={-height / 2} position.z={-0.02}>
    <T.BoxGeometry args={[width + 0.12, 0.06, 0.06]} />
    <T.MeshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={1.5}
      metalness={0.6}
      roughness={0.3}
    />
  </T.Mesh>
  <!-- Left bar -->
  <T.Mesh position.x={-width / 2} position.z={-0.02}>
    <T.BoxGeometry args={[0.06, height + 0.12, 0.06]} />
    <T.MeshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={1.5}
      metalness={0.6}
      roughness={0.3}
    />
  </T.Mesh>
  <!-- Right bar -->
  <T.Mesh position.x={width / 2} position.z={-0.02}>
    <T.BoxGeometry args={[0.06, height + 0.12, 0.06]} />
    <T.MeshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={1.5}
      metalness={0.6}
      roughness={0.3}
    />
  </T.Mesh>

  <!-- Point light at the portal - casts colored glow on nearby surfaces -->
  <T.PointLight
    color={color}
    intensity={3}
    distance={4}
    position.z={0.3}
  />
</T.Group>
