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
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    size: number;
    colorIndex: number;
    phase: number;
    life: number;
    maxLife: number;
    isBurst: boolean;
  }

  let particles: FountainParticle[] = [];
  let geometry = $state<BufferGeometry | null>(null);
  let material = $state<ShaderMaterial | null>(null);
  let burstTimer = 0;

  function spawnParticle(isBurst: boolean): FountainParticle {
    const angle = Math.random() * Math.PI * 2;
    const spreadRadius = Math.random() * config.spawnRadius * 0.3;
    const speedMult = isBurst
      ? 1.5 + Math.random() * 0.5
      : 0.6 + Math.random() * 0.8;
    const lateralSpeed = isBurst ? 0.8 : 0.3;
    return {
      x: Math.cos(angle) * spreadRadius,
      y: 0,
      z: Math.sin(angle) * spreadRadius,
      vx: Math.cos(angle) * lateralSpeed * (Math.random() * 0.5 + 0.5),
      vy: config.riseSpeed * speedMult,
      vz: Math.sin(angle) * lateralSpeed * (Math.random() * 0.5 + 0.5),
      size:
        config.sizeRange[0] +
        Math.random() * (config.sizeRange[1] - config.sizeRange[0]),
      colorIndex: Math.floor(Math.random() * config.colors.length),
      phase: Math.random() * Math.PI * 2,
      life: 0,
      maxLife: (config.maxHeight / (config.riseSpeed * speedMult)) * 1.5,
      isBurst,
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
      float core = 1.0 - smoothstep(0.0, 0.2, dist);
      vec3 finalColor = mix(color, color * 3.0, core);
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
      const p = spawnParticle(false);
      // Stagger initial life so particles don't all spawn at ground simultaneously
      p.life = Math.random() * p.maxLife;
      const t = p.life / p.maxLife;
      p.x += p.vx * p.life;
      p.y += p.vy * p.life - 0.5 * config.gravity * p.life * p.life;
      p.z += p.vz * p.life;
      p.vy -= config.gravity * p.life;
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

    // Burst eruption mechanic
    burstTimer += delta;
    if (burstTimer >= config.burstInterval) {
      burstTimer -= config.burstInterval;
      for (let j = 0; j < config.burstCount && j < particles.length; j++) {
        const idx = Math.floor(Math.random() * particles.length);
        Object.assign(particles[idx]!, spawnParticle(true));
      }
    }

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]!;

      p.vy -= config.gravity * delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;

      // Advance life
      p.life += delta;
      const t = p.life / p.maxLife;

      // Recycle dead particles (fallen below ground or expired)
      if (p.y < -0.5 || p.life > p.maxLife) {
        Object.assign(p, spawnParticle(false));
        continue;
      }

      // Life-based fade: quick fade in, smooth quadratic fade out
      const fadeIn = Math.min(t * 5.0, 1.0);
      const fadeOut = 1.0 - Math.pow(Math.max(t - 0.5, 0.0) * 2.0, 2.0);
      const alpha = fadeIn * fadeOut;

      // Shrink as they cool
      const size = p.size * (1.0 - t * 0.4);

      posArr[i * 3] = p.x;
      posArr[i * 3 + 1] = p.y;
      posArr[i * 3 + 2] = p.z;
      sizeArr[i] = size;
      alphaArr[i] = alpha;
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
