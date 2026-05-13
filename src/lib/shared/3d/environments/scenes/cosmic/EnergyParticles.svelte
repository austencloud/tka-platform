<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onMount, onDestroy } from "svelte";
  import {
    BufferGeometry,
    Float32BufferAttribute,
    ShaderMaterial,
    AdditiveBlending,
    Color,
  } from "three";
  import type { EnergyParticlesConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    config: EnergyParticlesConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  interface EnergyParticle {
    angle: number;
    radius: number;
    y: number;
    speed: number;
    size: number;
    colorIndex: number;
    phase: number;
  }

  let particles: EnergyParticle[] = [];
  let geometry = $state<BufferGeometry | null>(null);
  let material = $state<ShaderMaterial | null>(null);

  function spawnParticle(): EnergyParticle {
    const angle = Math.random() * Math.PI * 2;
    const radiusJitter = (Math.random() - 0.5) * 0.5;
    return {
      angle,
      radius: config.spawnRadius + radiusJitter,
      y: 0,
      speed: config.riseSpeed * (0.7 + Math.random() * 0.6),
      size: config.sizeRange[0] + Math.random() * (config.sizeRange[1] - config.sizeRange[0]),
      colorIndex: Math.floor(Math.random() * config.colors.length),
      phase: Math.random() * Math.PI * 2,
    };
  }

  const vertexShader = /* glsl */ `
    attribute float aSize;
    attribute float aAlpha;
    attribute float aColorIndex;
    varying float vAlpha;
    varying float vColorIndex;
    void main() {
      vAlpha = aAlpha;
      vColorIndex = aColorIndex;
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (1000.0 / -mvPos.z);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColors[4];
    varying float vAlpha;
    varying float vColorIndex;
    void main() {
      float dist = length(gl_PointCoord - 0.5);
      float glow = 1.0 - smoothstep(0.0, 0.5, dist);
      if (glow < 0.01) discard;
      int idx = int(floor(vColorIndex));
      vec3 color = uColors[min(idx, 3)];
      gl_FragColor = vec4(color, glow * vAlpha);
    }
  `;

  onMount(() => {
    const count = config.count;
    geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("aSize", new Float32BufferAttribute(new Float32Array(count), 1));
    geometry.setAttribute("aAlpha", new Float32BufferAttribute(new Float32Array(count), 1));
    geometry.setAttribute("aColorIndex", new Float32BufferAttribute(new Float32Array(count), 1));

    const colorArray = config.colors.slice(0, 4).map((c) => new Color(c));
    while (colorArray.length < 4) colorArray.push(colorArray[0] || new Color("#ffffff"));

    material = new ShaderMaterial({
      uniforms: { uColors: { value: colorArray } },
      vertexShader,
      fragmentShader,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });

    for (let i = 0; i < count; i++) {
      const p = spawnParticle();
      p.y = Math.random() * config.maxHeight;
      particles.push(p);
    }
  });

  onDestroy(() => {
    geometry?.dispose();
    material?.dispose();
    particles = [];
  });

  useTask((delta) => {
    if (!geometry || !material || !config.enabled) return;

    const posArr = geometry.attributes.position!.array as Float32Array;
    const sizeArr = geometry.attributes.aSize!.array as Float32Array;
    const alphaArr = geometry.attributes.aAlpha!.array as Float32Array;
    const colorArr = geometry.attributes.aColorIndex!.array as Float32Array;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]!;
      p.y += p.speed * delta;

      if (p.y > config.maxHeight) {
        const fresh = spawnParticle();
        p.angle = fresh.angle;
        p.radius = fresh.radius;
        p.y = 0;
        p.speed = fresh.speed;
        p.size = fresh.size;
        p.colorIndex = fresh.colorIndex;
        p.phase = fresh.phase;
      }

      const fadeIn = Math.min(p.y / 0.5, 1.0);
      const fadeOut = 1.0 - Math.max((p.y - config.maxHeight * 0.7) / (config.maxHeight * 0.3), 0);
      const sway = Math.sin(p.y * 3 + p.phase) * 0.15;

      posArr[i * 3] = Math.cos(p.angle + sway) * p.radius;
      posArr[i * 3 + 1] = p.y;
      posArr[i * 3 + 2] = Math.sin(p.angle + sway) * p.radius;
      sizeArr[i] = p.size;
      alphaArr[i] = fadeIn * fadeOut;
      colorArr[i] = p.colorIndex;
    }

    geometry.attributes.position!.needsUpdate = true;
    geometry.attributes.aSize!.needsUpdate = true;
    geometry.attributes.aAlpha!.needsUpdate = true;
    geometry.attributes.aColorIndex!.needsUpdate = true;
    geometry.computeBoundingSphere();
  });
</script>

{#if config.enabled && geometry && material}
  <T.Points {geometry} {material} position.y={groundY} frustumCulled={false} />
{/if}
