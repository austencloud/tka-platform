<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    CylinderGeometry,
    ShaderMaterial,
    Color,
    DoubleSide,
  } from "three";
  import type { CelestialPillarsConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    config: CelestialPillarsConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const VERTEX_SHADER = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;
    void main() {
      vUv = uv;
      vPosition = position;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const FRAGMENT_SHADER = /* glsl */ `
    uniform float uTime;
    uniform vec3 uBaseColor;
    uniform vec3 uGlowColor;
    uniform float uGlowIntensity;

    varying vec2 vUv;
    varying vec3 vPosition;
    varying vec3 vNormal;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                 mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
    }

    void main() {
      vec2 marbleUv = vUv * vec2(2.0, 4.0);
      float marble = noise(marbleUv * 3.0 + vec2(0.0, uTime * 0.05));
      marble = smoothstep(0.4, 0.6, marble);

      float veinUv = vUv.y * 8.0 - uTime * 0.8;
      float vein = noise(vec2(vUv.x * 6.0, veinUv));
      vein = pow(smoothstep(0.45, 0.55, vein), 2.0);

      vec3 color = uBaseColor;
      color = mix(color, uBaseColor * 0.85, marble * 0.3);
      color += uGlowColor * vein * uGlowIntensity;

      float lighting = dot(vNormal, vec3(0.0, 1.0, 0.0)) * 0.3 + 0.7;
      color *= lighting;

      float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
      float alpha = 0.7 + fresnel * 0.2;

      alpha *= smoothstep(0.0, 0.15, vUv.y);

      gl_FragColor = vec4(color, alpha);
    }
  `;

  const geometry = new CylinderGeometry(0.15, 0.2, 1, 8);

  const material = $derived.by(() => {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: new Color(config.baseColor) },
        uGlowColor: { value: new Color(config.glowColor) },
        uGlowIntensity: { value: config.glowIntensity },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uBaseColor!.value = new Color(config.baseColor);
    material.uniforms.uGlowColor!.value = new Color(config.glowColor);
    material.uniforms.uGlowIntensity!.value = config.glowIntensity;
  });

  const placements = $derived.by(() => {
    if (!config.enabled) return [];
    const result: { x: number; z: number; height: number; scale: number }[] = [];
    for (const ring of config.rings) {
      for (let i = 0; i < ring.count; i++) {
        const angle = (i / ring.count) * Math.PI * 2 + Math.sin(i * 7.1) * 0.2;
        const r = ring.radius + Math.sin(i * 4.7) * ring.radiusJitter;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const scale =
          ring.scaleBase + Math.abs(Math.sin(i * 3.2)) * ring.scaleVariation;
        const [minH, maxH] = config.heightRange;
        const height = minH + (maxH - minH) * (0.5 + Math.sin(i * 5.3) * 0.5);
        result.push({ x, z, height, scale });
      }
    }
    return result;
  });

  useTask((delta) => {
    if (!config.enabled || !material) return;
    material.uniforms.uTime!.value += delta;
  });

  onDestroy(() => {
    geometry.dispose();
    material?.dispose();
  });
</script>

{#if config.enabled}
  {#each placements as p}
    <T.Mesh
      {geometry}
      {material}
      position.x={p.x}
      position.y={groundY + p.height / 2}
      position.z={p.z}
      scale.x={p.scale}
      scale.y={p.height}
      scale.z={p.scale}
    />
    <T.PointLight
      position.x={p.x}
      position.y={groundY + p.height + 0.3}
      position.z={p.z}
      color={config.glowColor}
      intensity={config.glowIntensity * 3}
      distance={4}
      decay={2}
    />
  {/each}
{/if}
