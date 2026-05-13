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
  import type { EmberFountainsConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    config: EmberFountainsConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  interface FountainParticle {
    angle: number;
    radius: number;
    y: number;
    speed: number;
    size: number;
    colorIndex: number;
    phase: number;
    lateralDrift: number;
  }

  let particles: FountainParticle[] = [];
  let geometry = $state<BufferGeometry | null>(null);
  let material = $state<ShaderMaterial | null>(null);

  function spawnParticle(): FountainParticle {
    const angle = Math.random() * Math.PI * 2;
    return {
      angle,
      radius: Math.random() * config.spawnRadius * 0.3,
      y: 0,
      speed: config.riseSpeed * (0.6 + Math.random() * 0.8),
      size:
        config.sizeRange[0] +
        Math.random() * (config.sizeRange[1] - config.sizeRange[0]),
      colorIndex: Math.floor(Math.random() * config.colors.length),
      phase: Math.random() * Math.PI * 2,
      lateralDrift: (Math.random() - 0.5) * 0.4,
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
      // Hot center, darker edge
      float core = 1.0 - smoothstep(0.0, 0.25, dist);
      vec3 finalColor = mix(color, color * 2.5, core);
      gl_FragColor = vec4(finalColor, glow * vAlpha);
    }
  `;

  onMount(() => {
    const count = config.count;
    geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(count * 3), 3),
    );
    geometry.setAttribute(
      "aSize",
      new Float32BufferAttribute(new Float32Array(count), 1),
    );
    geometry.setAttribute(
      "aAlpha",
      new Float32BufferAttribute(new Float32Array(count), 1),
    );
    geometry.setAttribute(
      "aColorIndex",
      new Float32BufferAttribute(new Float32Array(count), 1),
    );

    const colorArray = config.colors
      .slice(0, 4)
      .map((c) => new Color(c));
    while (colorArray.length < 4)
      colorArray.push(colorArray[0] || new Color("#ff4400"));

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
        p.lateralDrift = fresh.lateralDrift;
      }

      // Fast initial burst, then decelerate and drift
      const progress = p.y / config.maxHeight;
      const decel = 1.0 - progress * 0.6;
      p.y += (p.speed * decel - p.speed) * delta;

      const fadeIn = Math.min(p.y / 0.3, 1.0);
      const fadeOut = 1.0 - Math.max(
        (p.y - config.maxHeight * 0.6) / (config.maxHeight * 0.4),
        0,
      );
      const sway = Math.sin(p.y * 2 + p.phase) * 0.2 * progress;

      // Expanding cone as particles rise
      const expandedRadius = p.radius + progress * config.spawnRadius * 0.5;

      posArr[i * 3] = Math.cos(p.angle + sway + p.lateralDrift * progress) * expandedRadius;
      posArr[i * 3 + 1] = p.y;
      posArr[i * 3 + 2] = Math.sin(p.angle + sway + p.lateralDrift * progress) * expandedRadius;
      sizeArr[i] = p.size * (1.0 - progress * 0.3);
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
