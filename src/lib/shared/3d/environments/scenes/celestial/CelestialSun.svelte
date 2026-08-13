<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    AdditiveBlending,
    DataTexture,
    LinearFilter,
    MathUtils,
    RGBAFormat,
    SpriteMaterial,
    SRGBColorSpace,
    Vector3,
    type Sprite,
  } from "three";

  interface Props {
    direction?: [number, number, number];
    angularDiameterDegrees?: number;
    color?: string;
    pulse?: number;
  }

  let {
    direction = [-0.1, 0.19, -1],
    angularDiameterDegrees = 0.78,
    color = "#ffe3ad",
    pulse = 0,
  }: Props = $props();

  const { camera } = useThrelte();
  const skyRadius = 145;
  const coreSize = $derived(
    2 * skyRadius * Math.tan(MathUtils.degToRad(angularDiameterDegrees) / 2)
  );
  const sunDirection = $derived(new Vector3(...direction).normalize());

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
    depthTest: false,
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
    depthTest: false,
    blending: AdditiveBlending,
    fog: false,
    toneMapped: false,
  });
  let coreSprite = $state<Sprite>();
  let haloSprite = $state<Sprite>();
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
    const activeCamera = camera.current;
    if (activeCamera) {
      const position = activeCamera.position
        .clone()
        .addScaledVector(sunDirection, skyRadius);
      coreSprite?.position.copy(position);
      haloSprite?.position.copy(position);
    }

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
  bind:ref={haloSprite}
  material={haloMaterial}
  scale.x={coreSize * 2.15}
  scale.y={coreSize * 2.15}
  scale.z={1}
  renderOrder={0}
  frustumCulled={false}
/>

<T.Sprite
  bind:ref={coreSprite}
  material={coreMaterial}
  scale.x={coreSize}
  scale.y={coreSize}
  scale.z={1}
  renderOrder={0}
  frustumCulled={false}
/>
