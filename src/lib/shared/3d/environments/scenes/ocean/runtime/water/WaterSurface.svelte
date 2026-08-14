<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";
  import { ShaderMaterial, DoubleSide, Color, Vector3 } from "three";
  import { OCEAN_WATER_DEPTH_METERS } from "$lib/shared/3d/environments/domain/models/ocean-water-depth";
  import vertexShader from "../../shaders/water/gerstner.vert?raw";
  import fragmentShader from "../../shaders/water/snell-window.frag?raw";

  interface Props {
    groundY?: number;
    /**
     * Absolute elevation of the surface. Wins over groundY when given. The
     * ocean scene adds 25 ft to its original deep-water column, which is fine
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
    /**
     * A raw ShaderMaterial gets none of Three's fog chunks, so the surface has
     * to be told the scene's haze itself. Defaults match OceanScene's FogExp2.
     * Without this the plane is the only object in the scene that keeps its
     * colour at distance, and its rim reads as the edge of a lid.
     */
    fogColor?: string;
    fogDensity?: number;
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
    tirDarkness = 1.0,
    fogColor = "#0a2438",
    fogDensity = 0.026,
  }: Props = $props();

  const waterY = $derived(surfaceY ?? groundY + OCEAN_WATER_DEPTH_METERS);

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
      // Wavelength is 2*pi/uWaveScale, so 0.62 is an 10.1 m swell and the
      // fourth octave lands at 3.2 m. The old 2.2 was a 2.9 m chop whose
      // octaves ran down to 0.9 m -- below a metre, seen from ten metres
      // underneath, through fog. It could not read as anything but texture,
      // which is half of why the surface looked programmatic. Amplitude rises
      // with it: 0.12 m on a 2.9 m wave is a ripple, 0.34 m on a 10 m swell is
      // a shape the eye can follow across the frame.
      uWaveScale: { value: 0.62 },
      uWaveSpeed: { value: 0.5 },
      uWaveAmplitude: { value: 0.34 },
      uCameraPosition: { value: new Vector3() },
      uSnellEnabled: { value: true },
      uSkyColor: { value: new Color(skyColor) },
      uSunColor: { value: new Color("#ffffdd") },
      uSunSize: { value: 0.08 },
      uTirDarkness: { value: tirDarkness },
      uEdgeSoftness: { value: 0.08 },
      // 0.11 puts the noise lattice on a ~9 m cell, matched to the swell it is
      // supposed to be riding. At 1.4 the cell was 71 cm, so the value noise
      // resolved as a visible grid of blobs rather than as wave shape.
      uNoiseScale: { value: 0.11 },
      uNoiseSpeed: { value: 0.06 },
      // 0.012 perturbed the Snell boundary by a pixel or two, leaving a
      // geometrically perfect circle. 0.085 is enough to bend the boundary
      // into the swell, which is the whole reason the term exists.
      uNoiseAmplitude: { value: 0.085 },
      uFogColor: { value: new Color(fogColor) },
      uFogDensity: { value: fogDensity },
    },
  });

  $effect(() => {
    material.uniforms.uFogColor!.value.set(fogColor);
    material.uniforms.uFogDensity!.value = fogDensity;
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
