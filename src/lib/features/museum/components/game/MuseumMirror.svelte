<script lang="ts">
  /**
   * MuseumMirror - a polished static mirror surface with a gilded frame.
   * Real-time planar reflection redrew the complete museum from this plane and
   * caused multi-million-triangle spikes during a walk.
   */
  import { T } from "@threlte/core";
  import { MeshStandardMaterial } from "three";

  interface Props {
    width?: number;
    height?: number;
    textureWidth?: number;
    textureHeight?: number;
    color?: number;
    position?: [number, number, number];
    rotation?: [number, number, number];
    frameColor?: string;
    frameThickness?: number;
  }

  const props: Props = $props();

  // Plain consts - not reactive, used as initial values for Three.js objects.
  const width = props.width ?? 1.5;
  const height = props.height ?? 2.5;
  const position = props.position ?? ([0, 1.5, 0] as [number, number, number]);
  const rotation = props.rotation ?? ([0, 0, 0] as [number, number, number]);
  const frameColor = props.frameColor ?? "#8a7040";
  const frameThickness = props.frameThickness ?? 0.08;

  const frameMat = new MeshStandardMaterial({
    color: frameColor,
    metalness: 0.7,
    roughness: 0.3,
  });

  const fw = width + frameThickness * 2;
  const fh = height + frameThickness * 2;

  // Frame sits behind the reflector along its normal
  const cosY = Math.cos(rotation[1]);
  const sinY = Math.sin(rotation[1]);
  const framePos: [number, number, number] = [
    position[0] - sinY * (frameThickness / 2 + 0.01),
    position[1],
    position[2] - cosY * (frameThickness / 2 + 0.01),
  ];
</script>

<!-- Polished surface: one ordinary draw, never a nested scene render. -->
<T.Mesh
  position.x={position[0]}
  position.y={position[1]}
  position.z={position[2]}
  rotation.x={rotation[0]}
  rotation.y={rotation[1]}
  rotation.z={rotation[2]}
>
  <T.PlaneGeometry args={[width, height]} />
  <T.MeshStandardMaterial
    color={props.color ?? 0xc8b890}
    metalness={0.75}
    roughness={0.18}
  />
</T.Mesh>

<!-- Gilded frame -->
<T.Mesh
  position.x={framePos[0]}
  position.y={framePos[1]}
  position.z={framePos[2]}
  rotation.x={rotation[0]}
  rotation.y={rotation[1]}
  rotation.z={rotation[2]}
>
  <T.BoxGeometry args={[fw, fh, frameThickness]} />
  <T is={frameMat} />
</T.Mesh>
