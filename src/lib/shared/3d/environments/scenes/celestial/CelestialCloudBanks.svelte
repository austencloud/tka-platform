<script lang="ts">
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    ClampToEdgeWrapping,
    DataTexture,
    LinearFilter,
    RGBAFormat,
    SpriteMaterial,
    SRGBColorSpace,
  } from "three";
  import type { CloudIslandsConfig } from "../../domain/models/scene-configs";
  import coordinateManifest from "../../../../../../../docs/superpowers/specs/seraphic-vault/seraphic-vault-gate2-cloudbreak-r2-coordinate-manifest.json";

  interface Props {
    config: CloudIslandsConfig;
    count: number;
    stageWidth: number;
    stageDepth: number;
  }

  let { config, count, stageWidth, stageDepth }: Props = $props();

  function smoothstep(edge0: number, edge1: number, value: number): number {
    const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return amount * amount * (3 - 2 * amount);
  }

  function noise2d(u: number, v: number, scale: number, seed: number): number {
    const x = u * scale;
    const y = v * scale;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = smoothstep(0, 1, x - x0);
    const ty = smoothstep(0, 1, y - y0);
    const sample = (sampleX: number, sampleY: number) =>
      random(seed + sampleX * 127.1 + sampleY * 311.7);
    const lower = sample(x0, y0) * (1 - tx) + sample(x0 + 1, y0) * tx;
    const upper = sample(x0, y0 + 1) * (1 - tx) + sample(x0 + 1, y0 + 1) * tx;
    return lower * (1 - ty) + upper * ty;
  }

  function createCloudTexture(seed: number): DataTexture {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    const lobes = Array.from({ length: 11 }, (_, index) => ({
      x: 0.12 + random(seed + index * 7 + 1) * 0.76,
      y: 0.25 + random(seed + index * 7 + 2) * 0.48,
      radiusX: 0.14 + random(seed + index * 7 + 3) * 0.22,
      radiusY: 0.11 + random(seed + index * 7 + 4) * 0.2,
      weight: 0.72 + random(seed + index * 7 + 5) * 0.42,
    }));

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const u = x / (size - 1);
        const v = y / (size - 1);
        let field = 0;
        for (const lobe of lobes) {
          const dx = (u - lobe.x) / lobe.radiusX;
          const dy = (v - lobe.y) / lobe.radiusY;
          field = Math.max(
            field,
            Math.exp(-(dx * dx + dy * dy) * 1.7) * lobe.weight
          );
        }
        const detail =
          noise2d(u, v, 5, seed + 19) * 0.52 +
          noise2d(u, v, 13, seed + 31) * 0.3 +
          noise2d(u, v, 31, seed + 47) * 0.18;
        const density = field * (0.72 + detail * 0.46);
        const textureEdge = Math.min(u, v, 1 - u, 1 - v);
        const alpha =
          smoothstep(0.16, 0.72, density) *
          smoothstep(0.015, 0.095, textureEdge);
        const verticalLight = smoothstep(0.12, 0.88, v);
        const innerDepth = smoothstep(0.25, 0.92, density);
        const edgeLight =
          smoothstep(0.08, 0.34, alpha) * (1 - smoothstep(0.42, 0.86, alpha));
        const light = Math.max(
          0,
          Math.min(
            1,
            0.34 +
              verticalLight * 0.45 +
              detail * 0.13 -
              innerDepth * (1 - verticalLight) * 0.24 +
              edgeLight * 0.28
          )
        );
        const index = (y * size + x) * 4;
        data[index] = Math.round(116 + light * 139);
        data[index + 1] = Math.round(132 + light * 122);
        data[index + 2] = Math.round(158 + light * 94);
        data[index + 3] = Math.round(alpha * 255);
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

  const cloudTextures = [
    createCloudTexture(17),
    createCloudTexture(53),
    createCloudTexture(101),
  ];
  const materials = [
    new SpriteMaterial({
      map: cloudTextures[0],
      color: config.color,
      opacity: 0.96,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: true,
    }),
    new SpriteMaterial({
      map: cloudTextures[1],
      color: "#cad5e2",
      opacity: 0.88,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: true,
    }),
    new SpriteMaterial({
      map: cloudTextures[2],
      color: "#f1d9bd",
      opacity: 0.72,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: true,
    }),
    new SpriteMaterial({
      map: cloudTextures[0],
      color: "#8496b0",
      opacity: 0.78,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: true,
    }),
  ];

  const atmosphereGuides = [
    ...coordinateManifest.distantMesas.map((mesa) => ({
      position: [mesa.position[0], mesa.cloudBaseY + 1.2, mesa.position[2]] as [
        number,
        number,
        number,
      ],
      width: mesa.width * 1.72,
      depthWidth: Math.max(5.4, mesa.width * 0.62),
      height: 3.4,
      puffCount: Math.max(8, Math.round(mesa.width * 0.82)),
    })),
    {
      position: [-46, -4, -92] as [number, number, number],
      width: 34,
      depthWidth: 12,
      height: 7,
      puffCount: 14,
    },
    {
      position: [48, -4.5, -98] as [number, number, number],
      width: 36,
      depthWidth: 13,
      height: 7,
      puffCount: 15,
    },
    {
      position: [0, -8, -108] as [number, number, number],
      width: 44,
      depthWidth: 10,
      height: 4,
      puffCount: 16,
    },
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
        const width = baseSize * depthFade * (1.05 + random(seed + 43) * 0.62);
        result.push({
          x:
            centerX +
            (lobe - 1.5) * baseSize * 0.68 +
            (random(seed + 53) - 0.5),
          y: -6.4 + random(seed + 61) * 2.1 + lobe * 0.22,
          z: centerZ + (random(seed + 71) - 0.5) * 1.8,
          width,
          height: width * (0.42 + random(seed + 83) * 0.16),
          material: materials[(cluster + lobe) % materials.length]!,
        });
      }
    }

    for (const [guideIndex, guide] of atmosphereGuides.entries()) {
      const [centerX, centerY, centerZ] = guide.position;
      const baseSize = guide.width / Math.max(3.2, guide.puffCount * 0.42);
      for (let index = 0; index < guide.puffCount; index += 1) {
        const seed = 1_000 + guideIndex * 31 + index;
        const normalized =
          guide.puffCount === 1 ? 0.5 : index / (guide.puffCount - 1);
        const width =
          baseSize *
          (1.75 + random(seed + 17) * 0.95) *
          (guideIndex < coordinateManifest.distantMesas.length ? 0.92 : 1.08);
        result.push({
          x:
            centerX +
            (normalized - 0.5) * guide.width +
            (random(seed + 29) - 0.5) * baseSize * 1.6,
          y: centerY + (random(seed + 41) - 0.38) * guide.height * 1.8,
          z: centerZ + (random(seed + 53) - 0.5) * guide.depthWidth,
          width,
          height: width * (0.44 + random(seed + 67) * 0.16),
          material: materials[(guideIndex + index + 1) % materials.length]!,
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
    for (const texture of cloudTextures) texture.dispose();
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
