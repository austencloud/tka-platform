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

  let { groundY = 0, size = 50, segments = 256 }: Props = $props();

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
      // The 2.2 base wave keeps the shortest octave spread over roughly 4.5
      // segments at the default tessellation: detailed, but still sampled.
      uWaveScale: { value: 2.2 },
      uWaveSpeed: { value: 0.35 },
      uWaveAmplitude: { value: 0.12 },
      uCameraPosition: { value: new Vector3() },
      uSnellEnabled: { value: true },
      uSkyColor: { value: new Color("#3f7892") },
      uSunColor: { value: new Color("#ffffdd") },
      uSunSize: { value: 0.08 },
      uTirDarkness: { value: 0.82 },
      uEdgeSoftness: { value: 0.08 },
      uNoiseScale: { value: 1.4 },
      uNoiseSpeed: { value: 0.4 },
      uNoiseAmplitude: { value: 0.012 },
    },
  });

  // PlaneGeometry has no overlapping layers that benefit from Three's default
  // two-pass DoubleSide transparency path. Drawing it once also prevents the
  // dark TIR region from being alpha-composited over itself.
  material.forceSinglePass = true;

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
