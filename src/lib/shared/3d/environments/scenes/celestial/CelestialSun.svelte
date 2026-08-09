<script lang="ts">
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    AdditiveBlending,
    DataTexture,
    LinearFilter,
    NormalBlending,
    RGBAFormat,
    SpriteMaterial,
    SRGBColorSpace,
  } from "three";

  interface Props {
    position?: [number, number, number];
    color?: string;
    size?: number;
  }

  let {
    position = [0, 6.2, -27],
    color = "#ffe3ad",
    size = 7.4,
  }: Props = $props();

  function createSunTexture(kind: "core" | "halo"): DataTexture {
    const dimension = 128;
    const data = new Uint8Array(dimension * dimension * 4);
    for (let y = 0; y < dimension; y += 1) {
      for (let x = 0; x < dimension; x += 1) {
        const dx = x / (dimension - 1) - 0.5;
        const dy = y / (dimension - 1) - 0.5;
        const distance = Math.hypot(dx, dy) * 2;
        const edge = Math.max(0, Math.min(1, (distance - 0.68) / 0.2));
        const core = 1 - edge * edge * (3 - 2 * edge);
        const halo = Math.pow(Math.max(0, 1 - distance), 2.35);
        const alpha = kind === "core" ? core : halo;
        const index = (y * dimension + x) * 4;
        data[index] = 255;
        data[index + 1] = 255;
        data[index + 2] = 255;
        data[index + 3] = Math.round(alpha * 255);
      }
    }
    const texture = new DataTexture(data, dimension, dimension, RGBAFormat);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  const coreTexture = createSunTexture("core");
  const haloTexture = createSunTexture("halo");
  const coreMaterial = new SpriteMaterial({
    map: coreTexture,
    color,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    depthTest: true,
    blending: NormalBlending,
    fog: true,
  });
  const haloMaterial = new SpriteMaterial({
    map: haloTexture,
    color: "#ffc978",
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    fog: true,
  });

  $effect(() => {
    coreMaterial.color.set(color);
  });

  onDestroy(() => {
    coreMaterial.dispose();
    haloMaterial.dispose();
    coreTexture.dispose();
    haloTexture.dispose();
  });
</script>

<T.Sprite
  material={haloMaterial}
  position.x={position[0]}
  position.y={position[1]}
  position.z={position[2] + 0.05}
  scale.x={size * 2.4}
  scale.y={size * 2.4}
  scale.z={1}
  renderOrder={0}
/>

<T.Sprite
  material={coreMaterial}
  position.x={position[0]}
  position.y={position[1]}
  position.z={position[2]}
  scale.x={size}
  scale.y={size}
  scale.z={1}
  renderOrder={0}
/>
