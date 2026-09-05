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

<!-- The portal's anchor stays visible for the life of the scene. Three.js keys
     every lit material's shader program on the number of visible lights, so
     a light that appears with the frame would relink every program in view
     (measured: 79 links, 3.1 s, ten steps from the lobby spawn). The frame
     meshes toggle below; the light only fades. -->
<T.Group
  position.x={position[0]}
  position.y={position[1]}
  position.z={position[2]}
  rotation.x={rotation[0]}
  rotation.y={rotation[1]}
  rotation.z={rotation[2]}
>
  <!-- Glowing rectangular frame around the portal -->
  <T.Group visible={props.visible !== false}>
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
        {color}
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
        {color}
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
        {color}
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
        {color}
        emissive={color}
        emissiveIntensity={1.5}
        metalness={0.6}
        roughness={0.3}
      />
    </T.Mesh>
  </T.Group>

  <!-- Point light at the portal - casts colored glow on nearby surfaces.
       Always mounted and visible; distance fades it, never visibility. -->
  <T.PointLight
    {color}
    intensity={props.visible !== false ? 3 : 0}
    distance={4}
    position.z={0.3}
  />
</T.Group>
