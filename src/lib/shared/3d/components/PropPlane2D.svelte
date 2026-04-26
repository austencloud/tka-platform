<script lang="ts">
  /**
   * PropPlane2D
   *
   * Renders a single prop as a colored plane in the orthographic 2D scene.
   * The plane is rotated by staffRotationAngle around the Z axis.
   *
   * Width = long axis (length of staff), Height = short axis (thickness).
   * Coordinates are in world units where 1.0 = grid hand point radius.
   */

  import { T } from "@threlte/core";
  import { DoubleSide } from "three";

  interface Props {
    position: [number, number, number];
    rotation: number;
    width: number;
    height: number;
    color: string;
    zIndex?: number;
  }

  let {
    position,
    rotation,
    width,
    height,
    color,
    zIndex = 0,
  }: Props = $props();

  const pos = $derived<[number, number, number]>([
    position[0],
    position[1],
    position[2] + zIndex,
  ]);
</script>

<T.Mesh position={pos} rotation.z={-rotation}>
  <T.PlaneGeometry args={[width, height]} />
  <T.MeshBasicMaterial {color} side={DoubleSide} transparent opacity={0.9} />
</T.Mesh>
