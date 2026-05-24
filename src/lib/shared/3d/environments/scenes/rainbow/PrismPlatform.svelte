<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    CircleGeometry,
    CylinderGeometry,
    MeshPhysicalMaterial,
    ShaderMaterial,
    DoubleSide,
  } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import type { PrismPlatformConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: PrismPlatformConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  let geometry = $state<CircleGeometry | undefined>(undefined);

  $effect(() => {
    const geo = new CircleGeometry(config.radius, 128);
    geometry = geo;
    return () => geo.dispose();
  });

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform float uGlowIntensity;
    uniform float uSpectrumSpeed;
    varying vec2 vUv;

    vec3 hsl2rgb(float h) {
      vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      return rgb;
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float dist = length(centered) * 2.0;
      float angle = atan(centered.y, centered.x);

      // Spectral hue cycles around circumference, rotating over time
      float hue = fract((angle / (2.0 * 3.14159265)) + 0.5 + uTime * uSpectrumSpeed);
      vec3 spectrumColor = hsl2rgb(hue);

      // Prismatic iridescence: subtle color shift based on distance from center
      float iridescentHue = fract(hue + dist * 0.3 + uTime * uSpectrumSpeed * 0.5);
      vec3 iridescentColor = hsl2rgb(iridescentHue);

      // Glass-like base: faint white/clear tint in center
      vec3 glassBase = vec3(0.95, 0.97, 1.0);

      // Rim zone: rainbow is strongest at the rim
      float rimStrength = smoothstep(0.3, 0.85, dist);

      // Blend: center is glass, rim is spectrum
      vec3 color = mix(glassBase, spectrumColor, rimStrength * uGlowIntensity);

      // Add subtle iridescent sheen across the whole surface
      color += iridescentColor * (1.0 - rimStrength) * 0.08;

      // Downstage glow: brighter/wider spectrum on +Z half (positive Y in UV space)
      float downstage = smoothstep(-0.1, 0.3, centered.y);
      color += spectrumColor * rimStrength * downstage * 0.15 * uGlowIntensity;

      // Bright spectral highlights at rim
      float rimHighlight = smoothstep(0.7, 0.95, dist);
      color += spectrumColor * rimHighlight * 0.3 * uGlowIntensity;

      // Alpha: transparent center, more opaque at rim, soft edge falloff
      float centerAlpha = 0.3;
      float rimAlpha = 0.7;
      float alpha = mix(centerAlpha, rimAlpha, rimStrength);

      // Soft edge falloff at very outer edge
      float edgeFade = 1.0 - smoothstep(0.88, 1.0, dist);
      alpha *= edgeFade;

      gl_FragColor = vec4(color, alpha);
    }
  `;

  let material = $state<ShaderMaterial | undefined>(undefined);

  $effect(() => {
    const mat = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGlowIntensity: { value: config.glowIntensity },
        uSpectrumSpeed: { value: config.spectrumSpeed },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    material = mat;
    return () => mat.dispose();
  });

  // Glass prism body geometry + material
  let bodyGeometry = $state<CylinderGeometry | undefined>(undefined);
  let bodyMaterial = $state<MeshPhysicalMaterial | undefined>(undefined);

  $effect(() => {
    const geo = new CylinderGeometry(config.radius, config.radius, config.height, 64);
    bodyGeometry = geo;
    return () => geo.dispose();
  });

  $effect(() => {
    const mat = new MeshPhysicalMaterial({
      color: "#ffffff",
      transmission: 0.7,
      roughness: 0.05,
      metalness: 0.0,
      transparent: true,
      opacity: 0.5,
      ior: 1.5,
    });
    bodyMaterial = mat;
    return () => mat.dispose();
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uGlowIntensity!.value = config.glowIntensity;
    material.uniforms.uSpectrumSpeed!.value = config.spectrumSpeed;
  });

  useTask((delta) => {
    if (!material) return;
    material.uniforms.uTime!.value += delta;
  });
</script>

{#if config.enabled}
  <!-- Translucent glass prism body -->
  <T.Mesh
    geometry={bodyGeometry}
    material={bodyMaterial}
    position.y={groundY + config.height / 2}
  />

  <!-- Rainbow shader top surface -->
  <T.Mesh
    {geometry}
    {material}
    rotation.x={-Math.PI / 2}
    position.y={groundY + config.height}
  />
{/if}
