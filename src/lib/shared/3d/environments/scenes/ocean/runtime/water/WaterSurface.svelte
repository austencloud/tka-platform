<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";
  import { ShaderMaterial, DoubleSide, Color, Vector3 } from "three";
  import vertexShader from "../../shaders/water/gerstner.vert?raw";
  import fragmentShader from "../../shaders/water/snell-window.frag?raw";

  interface Props {
    groundY?: number;
    size?: number;
    segments?: number;
  }

  let { groundY = 0, size = 50, segments = 128 }: Props = $props();

  const waterY = $derived(groundY + 12);

  const { camera } = useThrelte();

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: size },
      uColor: { value: new Color("#0d3050") },
      uOpacity: { value: 0.12 },
      uWaveScale: { value: 5 },
      uWaveSpeed: { value: 0.35 },
      uWaveAmplitude: { value: 0.12 },
      uCameraPosition: { value: new Vector3() },
      uSnellEnabled: { value: true },
      uSkyColor: { value: new Color("#88ccee") },
      uSunColor: { value: new Color("#ffffdd") },
      uSunSize: { value: 0.08 },
      uTirDarkness: { value: 0.15 },
      uEdgeSoftness: { value: 0.06 },
      uNoiseScale: { value: 3.0 },
      uNoiseSpeed: { value: 0.4 },
      uNoiseAmplitude: { value: 0.04 },
    },
  });

  useTask((delta) => {
    material.uniforms.uTime!.value += delta;
    const cam = camera.current;
    if (cam) {
      material.uniforms.uCameraPosition!.value.copy(cam.position);
    }
  });

  onDestroy(() => {
    material.dispose();
  });
</script>

<T.Mesh position.y={waterY} rotation.x={-Math.PI / 2}>
  <T.PlaneGeometry args={[size, size, segments, segments]} />
  <T is={material} />
</T.Mesh>
