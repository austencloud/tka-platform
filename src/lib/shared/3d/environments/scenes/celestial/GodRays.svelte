<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    PlaneGeometry,
    ShaderMaterial,
    AdditiveBlending,
    DoubleSide,
    Color,
  } from "three";
  import type { CelestialGodRaysConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: CelestialGodRaysConfig;
  }

  let { config }: Props = $props();

  const geometry = new PlaneGeometry(38, 28, 1, 1);

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uCount;
    varying vec2 vUv;

    float hash(float n) { return fract(sin(n) * 43758.5453); }

    void main() {
      const float sourceY = 0.53;
      float descent = clamp((sourceY - vUv.y) / sourceY, 0.0, 1.0);
      float belowSun = 1.0 - smoothstep(sourceY, sourceY + 0.035, vUv.y);
      float beams = 0.0;
      for (float i = 0.0; i < 8.0; i++) {
        if (i >= uCount) break;
        float fan = (hash(i * 127.1) - 0.5) * 1.35;
        float drift = sin(uTime * 0.28 + i * 2.1) * 0.015;
        float center = 0.5 + fan * descent + drift * descent;
        float width = 0.035 + descent * (0.085 + hash(i * 311.7) * 0.055);
        float beam = smoothstep(width, 0.0, abs(vUv.x - center));
        beam *= (0.32 + hash(i * 197.3) * 0.28);
        beams += beam;
      }

      float vFade = smoothstep(0.0, 0.12, vUv.y) * belowSun;

      float noise = fract(sin(dot(vUv * 32.0 + uTime * 0.06, vec2(12.9898, 78.233))) * 43758.5453);
      beams *= (0.9 + noise * 0.1);

      float alpha = beams * vFade * uIntensity;

      gl_FragColor = vec4(uColor * 1.5, alpha);
    }
  `;

  let time = 0;

  let material = $state<ShaderMaterial | undefined>(undefined);

  $effect(() => {
    const mat = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new Color(config.color) },
        uIntensity: { value: config.intensity },
        uCount: { value: config.count },
      },
      vertexShader,
      fragmentShader,
      side: DoubleSide,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    material = mat;
    return () => mat.dispose();
  });

  onDestroy(() => geometry.dispose());

  useTask((delta) => {
    if (!material) return;
    time += delta * config.speed;
    material.uniforms.uTime!.value = time;
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uColor!.value = new Color(config.color);
    material.uniforms.uIntensity!.value = config.intensity;
    material.uniforms.uCount!.value = config.count;
  });
</script>

{#if config.enabled}
  <T.Mesh
    {geometry}
    {material}
    position.y={5}
    position.z={-25}
    renderOrder={-1}
  />
{/if}
