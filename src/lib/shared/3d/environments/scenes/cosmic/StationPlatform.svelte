<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    CylinderGeometry,
    ShaderMaterial,
    MeshStandardMaterial,
    Color,
    DoubleSide,
  } from "three";
  import type { PlatformConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";
  import AudienceSeating from "./AudienceSeating.svelte";

  interface Props {
    config: PlatformConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const mainGeometry = $derived.by(() => {
    const segments =
      config.shape === "hexagon" ? 6 : config.shape === "octagon" ? 8 : 64;
    return new CylinderGeometry(
      config.radius,
      config.radius,
      config.height,
      segments
    );
  });

  const borderGeometry = $derived.by(() => {
    const segments =
      config.shape === "hexagon" ? 6 : config.shape === "octagon" ? 8 : 64;
    return new CylinderGeometry(
      config.radius + 0.15,
      config.radius + 0.15,
      config.height * 0.4,
      segments
    );
  });

  const borderMaterial = $derived.by(() => {
    return new MeshStandardMaterial({
      color: new Color(config.baseColor).multiplyScalar(1.3),
      metalness: config.metallic,
      roughness: config.roughness,
      emissive: new Color(config.emissiveColor),
      emissiveIntensity: config.emissiveIntensity * 0.4,
    });
  });

  const vertexShader = /* glsl */ `
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
      vPosition = position;
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uBaseColor;
    uniform vec3 uEmissiveColor;
    uniform float uEmissiveIntensity;
    uniform float uEdgeGlowWidth;
    uniform float uRadius;
    uniform float uHeight;
    uniform float uMetallic;
    uniform float uRoughness;
    uniform float uPulse;
    uniform float uGridDensity;
    uniform float uGridIntensity;

    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;

    float hexGrid(vec2 p, float scale) {
      vec2 q = vec2(p.x * 2.0 * 0.5773503, p.y + p.x * 0.5773503);
      vec2 pi = floor(q);
      vec2 pf = fract(q);

      float v = mod(pi.x + pi.y, 3.0);

      float ca = step(1.0, v);
      float cb = step(2.0, v);

      vec2 ma = step(pf.xy, pf.yx);

      float e = dot(ma, 1.0 - pf.yx + ca * (pf.x + pf.y - 1.0) + cb * (pf.yx - 2.0 * pf.xy));

      float lineWidth = 0.06;
      return 1.0 - smoothstep(0.0, lineWidth, abs(e - 0.5) * 2.0);
    }

    void main() {
      float distFromCenter = length(vPosition.xz) / uRadius;
      float edgeFactor = smoothstep(1.0 - uEdgeGlowWidth, 1.0, distFromCenter);

      float topFace = step(0.49, vNormal.y);
      float sideFace = 1.0 - abs(vNormal.y);

      float pulse = 1.0 + sin(uPulse) * 0.15;
      float glow = (edgeFactor * topFace + sideFace * 0.6) * uEmissiveIntensity * pulse;

      float grid = 0.0;
      if (uGridDensity > 0.0 && topFace > 0.5) {
        grid = hexGrid(vPosition.xz * uGridDensity, uGridDensity);
        grid *= uGridIntensity * pulse;
        grid *= (1.0 - smoothstep(0.85, 1.0, distFromCenter));
      }

      vec3 base = uBaseColor * (0.3 + uMetallic * 0.7);
      vec3 emissive = uEmissiveColor * (glow + grid);

      gl_FragColor = vec4(base + emissive, 1.0);
    }
  `;

  let pulseTime = 0;

  const material = $derived.by(() => {
    return new ShaderMaterial({
      uniforms: {
        uBaseColor: { value: new Color(config.baseColor) },
        uEmissiveColor: { value: new Color(config.emissiveColor) },
        uEmissiveIntensity: { value: config.emissiveIntensity },
        uEdgeGlowWidth: { value: config.edgeGlowWidth },
        uRadius: { value: config.radius },
        uHeight: { value: config.height },
        uMetallic: { value: config.metallic },
        uRoughness: { value: config.roughness },
        uPulse: { value: 0 },
        uGridDensity: { value: config.gridDensity },
        uGridIntensity: { value: config.gridIntensity },
      },
      vertexShader,
      fragmentShader,
      side: DoubleSide,
    });
  });

  useTask((delta) => {
    if (!material || config.pulseSpeed === 0) return;
    pulseTime += delta * config.pulseSpeed * Math.PI * 2;
    material.uniforms.uPulse!.value = pulseTime;
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uBaseColor!.value = new Color(config.baseColor);
    material.uniforms.uEmissiveColor!.value = new Color(config.emissiveColor);
    material.uniforms.uEmissiveIntensity!.value = config.emissiveIntensity;
    material.uniforms.uEdgeGlowWidth!.value = config.edgeGlowWidth;
    material.uniforms.uRadius!.value = config.radius;
    material.uniforms.uHeight!.value = config.height;
    material.uniforms.uMetallic!.value = config.metallic;
    material.uniforms.uRoughness!.value = config.roughness;
    material.uniforms.uGridDensity!.value = config.gridDensity;
    material.uniforms.uGridIntensity!.value = config.gridIntensity;
  });

  const accentLights = $derived.by(() => {
    if (config.accentLightCount <= 0) return [];
    const lights: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < config.accentLightCount; i++) {
      const angle = (i / config.accentLightCount) * Math.PI * 2;
      lights.push({
        x: Math.cos(angle) * (config.radius + 0.1),
        z: Math.sin(angle) * (config.radius + 0.1),
      });
    }
    return lights;
  });
</script>

{#if config.enabled}
  <!-- Main platform surface -->
  <T.Mesh
    geometry={mainGeometry}
    {material}
    position.y={groundY + config.height / 2}
  />

  <!-- Decorative border ring below the edge -->
  <T.Mesh
    geometry={borderGeometry}
    material={borderMaterial}
    position.y={groundY + config.height * 0.2}
  />

  <!-- Accent lights around the edge -->
  {#each accentLights as light}
    <T.PointLight
      color={config.emissiveColor}
      intensity={config.accentLightIntensity}
      distance={config.accentLightDistance}
      decay={2}
      position.x={light.x}
      position.y={groundY + config.height + 0.05}
      position.z={light.z}
    />
    <!-- Small emissive dot at each light position -->
    <T.Mesh
      position.x={light.x}
      position.y={groundY + config.height + 0.02}
      position.z={light.z}
    >
      <T.SphereGeometry args={[0.04, 8, 8]} />
      <T.MeshStandardMaterial
        color={config.emissiveColor}
        emissive={config.emissiveColor}
        emissiveIntensity={2}
      />
    </T.Mesh>
  {/each}

  <!-- Audience seating -->
  {#if config.seatingEnabled}
    <AudienceSeating
      rows={config.seatingRows}
      accentColor={config.seatingAccentColor || config.emissiveColor}
      groundY={groundY}
    />
  {/if}
{/if}
