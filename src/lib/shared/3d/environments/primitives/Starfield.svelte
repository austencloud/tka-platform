<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import {
    BufferGeometry,
    Float32BufferAttribute,
    ShaderMaterial,
    AdditiveBlending,
  } from "three";
  import type { StarfieldConfig } from "../domain/models/scene-configs";
  import {
    prefersReducedMotion,
    resolveMotionScale,
  } from "./motion-preference";

  interface Props {
    config: StarfieldConfig;
  }

  let { config }: Props = $props();

  // Legibility knobs. The defaults reproduce the original field exactly, so
  // Cosmic / Forest / Winter are untouched; only a scene that opts in changes.
  const magnitudeFalloff = $derived(config.magnitudeFalloff ?? 3);
  const brightnessFloor = $derived(config.brightnessFloor ?? 0.3);
  const horizonSpread = $derived(config.horizonSpread ?? 0.6);
  const intensity = $derived(config.intensity ?? 1);

  const reducedMotion = $derived(prefersReducedMotion());
  const motionScale = $derived(resolveMotionScale(reducedMotion));

  let geometry = $state<BufferGeometry | null>(null);
  let material = $state<ShaderMaterial | null>(null);

  // Shaders

  const vertexShader = /* glsl */ `
    attribute float aSize;
    attribute float aPhase;
    attribute float aBrightness;

    uniform float uTime;
    uniform float uTwinkleSpeed;
    uniform float uIntensity;

    varying float vBrightness;
    varying float vTwinkle;

    void main() {
      // Intensity rides on brightness so the fragment stage needs no second
      // uniform. Alpha is clamped downstream, so values above 1 lift the dim
      // majority without blowing out the few bright stars.
      vBrightness = aBrightness * uIntensity;

      // per-star twinkle oscillates between 0.6 and 1.0
      vTwinkle = 0.6 + 0.4 * sin(uTime * uTwinkleSpeed + aPhase);

      // Stars are directions on the celestial sphere. Camera rotation changes
      // the view, while camera translation cannot create nearby parallax.
      mat4 rotationalView = mat4(mat3(viewMatrix));
      vec4 mvPos = rotationalView * vec4(position, 1.0);
      // perspective-correct point size; brighter stars are slightly larger
      gl_PointSize = aSize * vTwinkle * (600.0 / -mvPos.z);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    // Warm white core, cooler blue-white halo
    const vec3 CORE_COLOR = vec3(1.0, 0.97, 0.90);
    const vec3 HALO_COLOR = vec3(0.75, 0.85, 1.0);

    varying float vBrightness;
    varying float vTwinkle;

    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float dist = length(uv);

      // hard core: 0.0 – 0.15 radius
      float core = 1.0 - smoothstep(0.0, 0.15, dist);

      // soft halo: 0.1 – 0.5 radius (edge of point sprite)
      float halo = 1.0 - smoothstep(0.1, 0.5, dist);
      halo = pow(halo, 2.5);

      if (halo < 0.01) discard;

      // warm core blends into cool halo
      vec3 color = mix(HALO_COLOR, CORE_COLOR, core);

      // total alpha = hard core + softer halo contribution
      float alpha = (core + halo * 0.6) * vBrightness * vTwinkle;

      gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
    }
  `;

  // Geometry + material setup

  onMount(() => {
    const count = config.count;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const brightnesses = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Upper-hemisphere distribution: phi clamped to ≈ upper 60% of sphere
      // phi = acos(2*u-1) normally covers full sphere [0, π].
      // Multiplying by 0.6 keeps phi < ~108° — stars stay above horizon.
      const theta = Math.random() * Math.PI * 2;
      if (config.elevationRangeDegrees) {
        const [minimumElevation, maximumElevation] =
          config.elevationRangeDegrees;
        const elevation =
          ((minimumElevation +
            Math.random() * (maximumElevation - minimumElevation)) *
            Math.PI) /
          180;
        const horizontalRadius = config.radius * Math.cos(elevation);
        positions[i * 3] = horizontalRadius * Math.cos(theta);
        positions[i * 3 + 1] = config.radius * Math.sin(elevation);
        positions[i * 3 + 2] = horizontalRadius * Math.sin(theta);
      } else {
        const u = Math.random();
        const phi = Math.acos(2 * u - 1) * horizonSpread;
        const sinPhi = Math.sin(phi);
        positions[i * 3] = config.radius * sinPhi * Math.cos(theta);
        positions[i * 3 + 1] = config.radius * Math.cos(phi);
        positions[i * 3 + 2] = config.radius * sinPhi * Math.sin(theta);
      }

      // Magnitude distribution. A high exponent yields many dim stars and few
      // bright ones, which is realistic but disappears against a black sky at
      // small point sizes. Scenes that need the sky to actually read can
      // flatten the falloff and lift the floor.
      const magnitude = Math.pow(Math.random(), magnitudeFalloff);

      // Map magnitude → size: bright stars are larger
      sizes[i] =
        config.sizeRange[0] +
        magnitude * (config.sizeRange[1] - config.sizeRange[0]);

      // brightness tracks magnitude so dim stars fade appropriately
      brightnesses[i] = brightnessFloor + magnitude * (1 - brightnessFloor);

      // Random phase offset per star so they don't all twinkle in sync
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new Float32BufferAttribute(phases, 1));
    geo.setAttribute(
      "aBrightness",
      new Float32BufferAttribute(brightnesses, 1)
    );

    const mat = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTwinkleSpeed: { value: config.twinkleSpeed },
        uIntensity: { value: intensity },
      },
      vertexShader,
      fragmentShader,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    geometry = geo;
    material = mat;
  });

  onDestroy(() => {
    geometry?.dispose();
    material?.dispose();
  });

  // Animation — update uTime each frame

  let elapsed = 0;

  useTask((delta) => {
    if (!material || !config.enabled) return;
    // Twinkle is the only motion a starfield has, so reduced motion simply
    // freezes the clock and leaves a still sky.
    elapsed += delta * motionScale;
    material.uniforms.uTime!.value = elapsed;
  });

  // Reactive uniform sync when config changes

  $effect(() => {
    if (!material) return;
    material.uniforms.uTwinkleSpeed!.value = config.twinkleSpeed;
    material.uniforms.uIntensity!.value = intensity;
  });
</script>

{#if config.enabled && geometry && material}
  <T.Points {geometry} {material} frustumCulled={false} />
{/if}
