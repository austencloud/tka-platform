<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    AdditiveBlending,
    DataTexture,
    LinearFilter,
    RGBAFormat,
    SpriteMaterial,
    SRGBColorSpace,
  } from "three";

  interface Props {
    position?: [number, number, number];
    color?: string;
    size?: number;
    pulse?: number;
  }

  let {
    position = [0, 14, -115],
    color = "#ffe3ad",
    size = 9,
    pulse = 0,
  }: Props = $props();

  function createSunTexture(kind: "core" | "halo"): DataTexture {
    const dimension = 192;
    const data = new Uint8Array(dimension * dimension * 4);
    for (let y = 0; y < dimension; y += 1) {
      for (let x = 0; x < dimension; x += 1) {
        const dx = x / (dimension - 1) - 0.5;
        const dy = y / (dimension - 1) - 0.5;
        const distance = Math.hypot(dx, dy) * 2;
        const edge = Math.max(0, Math.min(1, (distance - 0.78) / 0.16));
        const core = 1 - edge * edge * (3 - 2 * edge);
        const halo = Math.pow(Math.max(0, 1 - distance), 2.7);
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
    color: "#fff8dc",
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    fog: false,
    toneMapped: false,
  });
  const haloMaterial = new SpriteMaterial({
    map: haloTexture,
    color: "#f2bf78",
    transparent: true,
    opacity: 0.27,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    fog: false,
    toneMapped: false,
  });
  let pulseEnergy = 0;
  let elapsed = 0;

  $effect(() => {
    coreMaterial.color.set(color === "#ffe3ad" ? "#fff8dc" : color);
  });

  $effect(() => {
    void pulse;
    if (pulse > 0) pulseEnergy = 1;
  });

  useTask((delta) => {
    elapsed += delta;
    pulseEnergy = Math.max(0, pulseEnergy - delta * 0.55);
    haloMaterial.opacity =
      0.26 + Math.sin(elapsed * 0.22) * 0.014 + pulseEnergy * 0.08;
    coreMaterial.opacity = 0.985 + pulseEnergy * 0.015;
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
  scale.x={size * 2.15}
  scale.y={size * 2.15}
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
