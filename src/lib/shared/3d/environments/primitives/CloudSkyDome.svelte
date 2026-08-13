<script lang="ts">
  /**
   * CloudSkyDome
   *
   * One camera-centred cloud owner for every 3D environment. The field lives
   * on the sky rather than in the room, so walking never exposes a nearby
   * sphere or makes distant clouds slide against the horizon.
   */

  import { T, useTask, useThrelte } from "@threlte/core";
  import { onDestroy, untrack } from "svelte";
  import {
    BackSide,
    Color,
    DataTexture,
    LinearFilter,
    NoColorSpace,
    RepeatWrapping,
    RGBAFormat,
    ShaderMaterial,
    SphereGeometry,
    Vector2,
    Vector3,
    type Mesh,
  } from "three";
  import type { SkyCloudConfig } from "../domain/models/environment-models";
  import {
    prefersReducedMotion,
    resolveMotionScale,
  } from "./motion-preference";

  interface Props {
    config: SkyCloudConfig;
    radius?: number;
  }

  let { config, radius = 188 }: Props = $props();

  const geometry = untrack(() => new SphereGeometry(radius, 64, 36));
  const { camera } = useThrelte();
  let cloudMesh = $state<Mesh>();
  let elapsed = 0;

  function gridNoise(x: number, y: number, seed: number): number {
    const signal = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return signal - Math.floor(signal);
  }

  function periodicValueNoise(
    u: number,
    v: number,
    cellsX: number,
    cellsY: number,
    seed: number
  ): number {
    const gx = u * cellsX;
    const gy = v * cellsY;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = gx - x0;
    const ty = gy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const wrapX = (value: number) => ((value % cellsX) + cellsX) % cellsX;
    const wrapY = (value: number) => ((value % cellsY) + cellsY) % cellsY;

    const top =
      gridNoise(wrapX(x0), wrapY(y0), seed) * (1 - sx) +
      gridNoise(wrapX(x0 + 1), wrapY(y0), seed) * sx;
    const bottom =
      gridNoise(wrapX(x0), wrapY(y0 + 1), seed) * (1 - sx) +
      gridNoise(wrapX(x0 + 1), wrapY(y0 + 1), seed) * sx;
    return top * (1 - sy) + bottom * sy;
  }

  function fractalNoise(u: number, v: number, seed: number): number {
    const octaves = [
      [3, 2, 0.52],
      [6, 4, 0.26],
      [12, 8, 0.14],
      [24, 16, 0.08],
    ] as const;
    return octaves.reduce(
      (sum, [cellsX, cellsY, weight], index) =>
        sum +
        periodicValueNoise(u, v, cellsX, cellsY, seed + index * 13) * weight,
      0
    );
  }

  function createCloudNoiseTexture(): DataTexture {
    const width = 512;
    const height = 256;
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const u = x / width;
        const v = y / height;
        const offset = (y * width + x) * 4;
        data[offset] = Math.round(fractalNoise(u, v, 17) * 255);
        data[offset + 1] = Math.round(fractalNoise(u, v, 53) * 255);
        data[offset + 2] = Math.round(fractalNoise(u, v, 101) * 255);
        data[offset + 3] = 255;
      }
    }

    const texture = new DataTexture(data, width, height, RGBAFormat);
    texture.colorSpace = NoColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  const noiseTexture = untrack(createCloudNoiseTexture);

  const material = untrack(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uCoverage: { value: config.coverage },
          uDensity: { value: config.density },
          uOpacity: { value: config.opacity },
          uScale: { value: config.scale ?? 3.8 },
          uOffset: { value: new Vector2(...(config.offset ?? [0, 0])) },
          uHorizonFade: { value: config.horizonFade ?? -0.08 },
          uZenithFade: { value: config.zenithFade ?? 0.9 },
          uNoiseTexture: { value: noiseTexture },
          uSunDirection: {
            value: new Vector3(...config.sunDirection).normalize(),
          },
          uLitColor: { value: new Color(config.litColor) },
          uShadowColor: { value: new Color(config.shadowColor) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vSkyDirection;

          void main() {
            vSkyDirection = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uCoverage;
          uniform float uDensity;
          uniform float uOpacity;
          uniform float uScale;
          uniform vec2 uOffset;
          uniform float uHorizonFade;
          uniform float uZenithFade;
          uniform sampler2D uNoiseTexture;
          uniform vec3 uSunDirection;
          uniform vec3 uLitColor;
          uniform vec3 uShadowColor;
          varying vec3 vSkyDirection;

          void main() {
            vec3 skyDirection = normalize(vSkyDirection);
            vec2 skyUv = vec2(
              atan(skyDirection.z, skyDirection.x) / 6.2831853 + 0.5,
              asin(clamp(skyDirection.y, -1.0, 1.0)) / 3.14159265 + 0.5
            );

            vec2 drift = vec2(uTime * 0.007, uTime * 0.0025);
            vec4 broadNoise = texture2D(
              uNoiseTexture,
              skyUv * vec2(uScale * 0.42, uScale * 0.36) + uOffset + drift
            );
            vec4 detailNoise = texture2D(
              uNoiseTexture,
              skyUv * vec2(uScale * 0.92, uScale * 0.78)
                + uOffset * 0.73
                - drift * 0.63
            );
            float broad = broadNoise.r * 0.62 + broadNoise.g * 0.38;
            float detail = detailNoise.b * 0.6 + detailNoise.g * 0.4;
            float field = broad * 0.8 + detail * 0.2;

            float coverage = clamp(uCoverage, 0.0, 1.0);
            float threshold = mix(0.72, 0.36, coverage);
            float softness = mix(0.18, 0.075, clamp(uDensity, 0.0, 1.0));
            float body = smoothstep(threshold, threshold + softness, field);

            float horizonMask = smoothstep(
              uHorizonFade,
              uHorizonFade + 0.16,
              skyDirection.y
            );
            float zenithMask = 1.0 - smoothstep(
              uZenithFade,
              min(1.0, uZenithFade + 0.1),
              skyDirection.y
            );
            body *= horizonMask * zenithMask;

            float sunFacing = pow(
              max(dot(skyDirection, normalize(uSunDirection)), 0.0),
              3.2
            );
            float internalLight = smoothstep(threshold, threshold + 0.22, field);
            float lightMix = clamp(0.34 + sunFacing * 0.52 + internalLight * 0.14, 0.0, 1.0);
            vec3 color = mix(uShadowColor, uLitColor, lightMix);

            float brightEdge = body * (1.0 - internalLight) * sunFacing;
            color += uLitColor * brightEdge * 0.32;

            float alpha = body * uOpacity * mix(0.66, 1.0, internalLight);
            gl_FragColor = vec4(color, alpha);
          }
        `,
        side: BackSide,
        transparent: true,
        depthTest: true,
        depthWrite: false,
      })
  );

  $effect(() => {
    material.uniforms.uCoverage!.value = config.coverage;
    material.uniforms.uDensity!.value = config.density;
    material.uniforms.uOpacity!.value = config.opacity;
    material.uniforms.uScale!.value = config.scale ?? 3.8;
    material.uniforms.uOffset!.value.set(...(config.offset ?? [0, 0]));
    material.uniforms.uHorizonFade!.value = config.horizonFade ?? -0.08;
    material.uniforms.uZenithFade!.value = config.zenithFade ?? 0.9;
    material.uniforms
      .uSunDirection!.value.set(...config.sunDirection)
      .normalize();
    material.uniforms.uLitColor!.value.set(config.litColor);
    material.uniforms.uShadowColor!.value.set(config.shadowColor);
  });

  useTask((delta) => {
    if (cloudMesh && camera.current) {
      cloudMesh.position.copy(camera.current.position);
    }
    if (!config.enabled) return;

    const motionScale = resolveMotionScale(prefersReducedMotion());
    elapsed += delta * config.driftSpeed * motionScale;
    material.uniforms.uTime!.value = elapsed;
  });

  onDestroy(() => {
    geometry.dispose();
    material.dispose();
    noiseTexture.dispose();
  });
</script>

{#if config.enabled}
  <T.Mesh
    bind:ref={cloudMesh}
    {geometry}
    {material}
    renderOrder={-0.5}
    frustumCulled={false}
  />
{/if}
