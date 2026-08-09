<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";
  import { ShaderMaterial, DoubleSide, Color, Vector3 } from "three";
  import vertexShader from "../../shaders/water/gerstner.vert?raw";
  import fragmentShader from "../../shaders/water/snell-window.frag?raw";

  interface Props {
    groundY?: number;
    /**
     * Absolute elevation of the surface. Wins over groundY when given. The
     * ocean scene sits the surface 12 m over its seabed datum, which is fine
     * for one authored scene and useless to any caller that knows the
     * waterline it wants — the Water Traverse knows it exactly.
     */
    surfaceY?: number;
    size?: number;
    segments?: number;
    /**
     * Underside look. The defaults are the ocean scene's: a 12%-opacity film
     * with a heavy total-internal-reflection ring, correct when you swim just
     * beneath it in that scene's light. Seen from eighteen metres down a
     * flooded trench the same numbers render as a black lid, so any caller
     * that owns its own depth owns these too.
     */
    opacity?: number;
    color?: string;
    skyColor?: string;
    tirDarkness?: number;
  }

  let {
    groundY = 0,
    surfaceY,
    // Matches the seabed's 220 m extent closely enough that fog eats the rim
    // before the eye reaches it. At 50 the plane's circular edge was legible
    // as a black lid with a curved cut-off, which reads as a ceiling rather
    // than a surface — the boundary failure this scene exists to avoid.
    // Segments stay at 256: at 110 m that is ~6.7 per wavelength, and anything
    // finer only sharpens detail beyond 30 m, where fog has already taken it.
    size = 110,
    segments = 256,
    opacity = 0.12,
    color = "#0d3050",
    skyColor = "#3f7892",
    tirDarkness = 0.82,
  }: Props = $props();

  const waterY = $derived(surfaceY ?? groundY + 12);

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
      uColor: { value: new Color(color) },
      uOpacity: { value: opacity },
      // The 2.2 base wave keeps the shortest octave spread over roughly 4.5
      // segments at the default tessellation: detailed, but still sampled.
      uWaveScale: { value: 2.2 },
      uWaveSpeed: { value: 0.35 },
      uWaveAmplitude: { value: 0.12 },
      uCameraPosition: { value: new Vector3() },
      uSnellEnabled: { value: true },
      uSkyColor: { value: new Color(skyColor) },
      uSunColor: { value: new Color("#ffffdd") },
      uSunSize: { value: 0.08 },
      uTirDarkness: { value: tirDarkness },
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
