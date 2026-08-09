<script lang="ts">
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    AdditiveBlending,
    ClampToEdgeWrapping,
    DataTexture,
    LinearFilter,
    RGBAFormat,
    SpriteMaterial,
    SRGBColorSpace,
  } from "three";
  import type { CloudIslandsConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: CloudIslandsConfig;
    count: number;
    stageWidth: number;
    stageDepth: number;
  }

  let { config, count, stageWidth, stageDepth }: Props = $props();

  function createCloudTexture(): DataTexture {
    const size = 128;
    const data = new Uint8Array(size * size * 4);
    const lobes = [
      [0.5, 0.58, 0.42, 0.22],
      [0.28, 0.57, 0.24, 0.19],
      [0.72, 0.56, 0.23, 0.18],
      [0.42, 0.4, 0.25, 0.24],
      [0.61, 0.38, 0.22, 0.22],
      [0.5, 0.25, 0.18, 0.18],
    ] as const;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const u = x / (size - 1);
        const v = y / (size - 1);
        let field = 0;
        for (const [cx, cy, rx, ry] of lobes) {
          const dx = (u - cx) / rx;
          const dy = (v - cy) / ry;
          field = Math.max(field, Math.exp(-(dx * dx + dy * dy) * 2.2));
        }
        const edgeNoise =
          Math.sin(x * 0.41 + y * 0.17) * 0.035 +
          Math.sin(x * 0.11 - y * 0.29) * 0.025;
        const alpha = Math.max(
          0,
          Math.min(1, (field + edgeNoise - 0.08) / 0.72)
        );
        const index = (y * size + x) * 4;
        data[index] = 244;
        data[index + 1] = 248;
        data[index + 2] = 255;
        data[index + 3] = Math.round(alpha * alpha * (3 - 2 * alpha) * 255);
      }
    }

    const texture = new DataTexture(data, size, size, RGBAFormat);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  const cloudTexture = createCloudTexture();
  const materials = [
    new SpriteMaterial({
      map: cloudTexture,
      color: config.color,
      opacity: 0.82,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: true,
    }),
    new SpriteMaterial({
      map: cloudTexture,
      color: "#acbdd4",
      opacity: 0.7,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: true,
    }),
    new SpriteMaterial({
      map: cloudTexture,
      color: "#ffe2b4",
      opacity: 0.28,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      fog: true,
    }),
  ];

  function random(seed: number): number {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  interface Puff {
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    material: SpriteMaterial;
  }

  const puffs = $derived.by((): Puff[] => {
    if (!config.enabled || count <= 0) return [];
    const result: Puff[] = [];
    const protectedRadius = Math.hypot(stageWidth, stageDepth) / 2;
    const ringRadius = Math.max(config.spawnRadius, protectedRadius + 3.6);

    for (let cluster = 0; cluster < count; cluster += 1) {
      const angle =
        (cluster / count) * Math.PI * 2 + random(cluster + 2) * 0.24;
      const radius = ringRadius * (0.82 + random(cluster + 11) * 0.24);
      const centerX = Math.cos(angle) * radius;
      const centerZ = Math.sin(angle) * radius - 1.4;
      const baseSize =
        config.sizeRange[0] +
        random(cluster + 31) * (config.sizeRange[1] - config.sizeRange[0]);
      const depthFade = Math.max(0.65, Math.min(1.18, (22 - centerZ) / 22));

      for (let lobe = 0; lobe < 4; lobe += 1) {
        const seed = cluster * 7 + lobe;
        const width = baseSize * depthFade * (1.5 + random(seed + 43) * 0.85);
        result.push({
          x:
            centerX +
            (lobe - 1.5) * baseSize * 0.68 +
            (random(seed + 53) - 0.5),
          y: -0.1 + random(seed + 61) * 1.5 + lobe * 0.18,
          z: centerZ + (random(seed + 71) - 0.5) * 1.8,
          width,
          height: width * (0.42 + random(seed + 83) * 0.16),
          material: materials[(cluster + lobe) % materials.length]!,
        });
      }
    }
    return result;
  });

  $effect(() => {
    materials[0]!.color.set(config.color);
  });

  onDestroy(() => {
    for (const material of materials) material.dispose();
    cloudTexture.dispose();
  });
</script>

{#if config.enabled}
  {#each puffs as puff, index (index)}
    <T.Sprite
      material={puff.material}
      position.x={puff.x}
      position.y={puff.y}
      position.z={puff.z}
      scale.x={puff.width}
      scale.y={puff.height}
      scale.z={1}
      renderOrder={1}
    />
  {/each}
{/if}
