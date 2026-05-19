<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    BufferGeometry,
    Float32BufferAttribute,
    ShaderMaterial,
    AdditiveBlending,
    Color,
  } from "three";
  import type { MeteorStreaksConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: MeteorStreaksConfig;
  }

  let { config }: Props = $props();

  const POOL_SIZE = 5;
  const TRAIL_SEGMENTS = 12;

  interface Meteor {
    active: boolean;
    x: number; y: number; z: number;
    dx: number; dy: number; dz: number;
    life: number;
    maxLife: number;
    colorIndex: number;
  }

  const pool: Meteor[] = Array.from({ length: POOL_SIZE }, () => ({
    active: false, x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0,
    life: 0, maxLife: 0, colorIndex: 0,
  }));

  let timeSinceSpawn = 0;
  const colorCache = $derived(config.colors.map(c => new Color(c)));

  function spawnMeteor(m: Meteor) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * 30;
    m.x = Math.cos(angle) * dist;
    m.y = 10 + Math.random() * 20;
    m.z = Math.sin(angle) * dist;

    const dirAngle = angle + Math.PI + (Math.random() - 0.5) * 0.8;
    m.dx = Math.cos(dirAngle) * config.speed;
    m.dy = -config.speed * (0.3 + Math.random() * 0.4);
    m.dz = Math.sin(dirAngle) * config.speed;

    m.maxLife = config.trailLength / config.speed;
    m.life = 0;
    m.active = true;
    m.colorIndex = Math.floor(Math.random() * config.colors.length);
  }

  const vertexShader = /* glsl */ `
    attribute float aAlpha;
    varying float vAlpha;
    void main() {
      vAlpha = aAlpha;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColor;
    varying float vAlpha;
    void main() {
      gl_FragColor = vec4(uColor, vAlpha);
    }
  `;

  const geometries: BufferGeometry[] = [];
  const materials: ShaderMaterial[] = [];

  for (let i = 0; i < POOL_SIZE; i++) {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(new Float32Array(TRAIL_SEGMENTS * 3), 3));
    geo.setAttribute("aAlpha", new Float32BufferAttribute(new Float32Array(TRAIL_SEGMENTS), 1));
    geometries.push(geo);

    materials.push(new ShaderMaterial({
      uniforms: { uColor: { value: new Color(config.colors[0] ?? "#ffffff") } },
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    }));
  }

  onDestroy(() => {
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
  });

  useTask((delta) => {
    if (!config.enabled) return;

    timeSinceSpawn += delta;
    const spawnInterval = config.frequency * (0.5 + Math.random());
    if (timeSinceSpawn >= spawnInterval) {
      timeSinceSpawn = 0;
      const idle = pool.find(m => !m.active);
      if (idle) spawnMeteor(idle);
    }

    for (let i = 0; i < POOL_SIZE; i++) {
      const m = pool[i]!;
      const geo = geometries[i]!;
      const mat = materials[i]!;
      const posArr = geo.attributes.position!.array as Float32Array;
      const alphaArr = geo.attributes.aAlpha!.array as Float32Array;

      if (!m.active) {
        for (let j = 0; j < TRAIL_SEGMENTS; j++) alphaArr[j] = 0;
        geo.attributes.aAlpha!.needsUpdate = true;
        continue;
      }

      m.life += delta;
      if (m.life >= m.maxLife) {
        m.active = false;
        for (let j = 0; j < TRAIL_SEGMENTS; j++) alphaArr[j] = 0;
        geo.attributes.aAlpha!.needsUpdate = true;
        continue;
      }

      const trailDt = config.trailLength / config.speed / TRAIL_SEGMENTS;

      for (let j = 0; j < TRAIL_SEGMENTS; j++) {
        const t = m.life - j * trailDt;
        if (t < 0) {
          alphaArr[j] = 0;
        } else {
          posArr[j * 3] = m.x + m.dx * t;
          posArr[j * 3 + 1] = m.y + m.dy * t;
          posArr[j * 3 + 2] = m.z + m.dz * t;
          alphaArr[j] = (1.0 - j / TRAIL_SEGMENTS) * (1.0 - m.life / m.maxLife);
        }
      }

      mat.uniforms.uColor!.value = colorCache[m.colorIndex % colorCache.length] || colorCache[0];
      geo.attributes.position!.needsUpdate = true;
      geo.attributes.aAlpha!.needsUpdate = true;
    }
  });
</script>

{#each pool as _, i}
  <T.Line geometry={geometries[i]} material={materials[i]} frustumCulled={false} />
{/each}
