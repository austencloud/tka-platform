<script lang="ts">
  import { T, useTask } from "@threlte/core";
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

  const geometry = new PlaneGeometry(40, 25, 1, 1);

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
      float beams = 0.0;
      for (float i = 0.0; i < 8.0; i++) {
        if (i >= uCount) break;
        float offset = hash(i * 127.1) * 0.8 + 0.1;
        float width = 0.02 + hash(i * 311.7) * 0.03;
        float drift = sin(uTime * 0.5 + i * 2.1) * 0.03;
        float beam = smoothstep(width, 0.0, abs(vUv.x - offset - drift));
        beam *= (0.6 + hash(i * 197.3) * 0.4);
        beams += beam;
      }

      float vFade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.4, vUv.y);

      float noise = fract(sin(dot(vUv * 40.0 + uTime * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
      beams *= (0.85 + noise * 0.15);

      float alpha = beams * vFade * uIntensity;

      gl_FragColor = vec4(uColor * 1.5, alpha);
    }
  `;

  let time = 0;

  const material = $derived.by(() => {
    return new ShaderMaterial({
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
  });

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
    position.y={15}
    position.x={-3}
    rotation.x={-0.35}
    rotation.y={0.2}
  />
{/if}
