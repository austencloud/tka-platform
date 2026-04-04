<script lang="ts">
  /**
   * MuseumMirror — Planar reflector with gilded frame.
   * Adds the Reflector directly to the Threlte scene (not via T.Primitive)
   * to ensure onBeforeRender fires for real-time reflections.
   */
  import { T, useThrelte } from "@threlte/core";
  import { onMount } from "svelte";
  import { Reflector } from "three/examples/jsm/objects/Reflector.js";
  import { PlaneGeometry, MeshStandardMaterial } from "three";

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

  const { scene } = useThrelte();

  // Resolve defaults from props (plain consts — not reactive, used as initial values for Three.js objects)
  const width = props.width ?? 1.5;
  const height = props.height ?? 2.5;
  const textureWidth = props.textureWidth ?? 512;
  const textureHeight = props.textureHeight ?? 768;
  const color = props.color ?? 0xc8b890;
  const position = props.position ?? [0, 1.5, 0] as [number, number, number];
  const rotation = props.rotation ?? [0, 0, 0] as [number, number, number];
  const frameColor = props.frameColor ?? "#8a7040";
  const frameThickness = props.frameThickness ?? 0.08;

  const frameMat = new MeshStandardMaterial({
    color: frameColor,
    metalness: 0.7,
    roughness: 0.3,
  });

  const fw = width + frameThickness * 2;
  const fh = height + frameThickness * 2;

  // Frame sits behind reflector along its normal
  const cosY = Math.cos(rotation[1]);
  const sinY = Math.sin(rotation[1]);
  const framePos: [number, number, number] = [
    position[0] - sinY * (frameThickness / 2 + 0.01),
    position[1],
    position[2] - cosY * (frameThickness / 2 + 0.01),
  ];

  onMount(() => {
    const geometry = new PlaneGeometry(width, height);
    const reflector = new Reflector(geometry, {
      clipBias: 0.003,
      textureWidth,
      textureHeight,
      color,
    });

    reflector.position.set(...position);
    reflector.rotation.set(...rotation);

    // Add directly to Threlte scene so onBeforeRender fires
    // Guard: scene.current may not be ready during rapid remounts
    if (!scene.current) return;
    scene.current.add(reflector);

    return () => {
      scene.current?.remove(reflector);
      geometry.dispose();
    };
  });
</script>

<!-- Gilded frame (rendered via Threlte) -->
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
