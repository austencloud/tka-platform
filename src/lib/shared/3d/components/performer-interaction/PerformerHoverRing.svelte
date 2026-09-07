<script lang="ts">
  import { T } from "@threlte/core";
  import { DoubleSide } from "three";

  interface Props {
    position: { x: number; z: number };
    groundY: number;
    color: string;
    dragging?: boolean;
  }

  let { position, groundY, color, dragging = false }: Props = $props();
</script>

<T.Mesh
  position={[position.x, groundY + 0.02, position.z]}
  rotation={[-Math.PI / 2, 0, 0]}
>
  <T.RingGeometry args={[0.48, 0.64, 48]} />
  <T.MeshBasicMaterial
    {color}
    transparent
    opacity={dragging ? 0.86 : 0.55}
    side={DoubleSide}
    depthWrite={false}
  />
</T.Mesh>
