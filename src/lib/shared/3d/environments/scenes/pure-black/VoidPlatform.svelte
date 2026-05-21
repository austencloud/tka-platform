<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    CircleGeometry,
    CylinderGeometry,
    TorusGeometry,
    MeshStandardMaterial,
    ShaderMaterial,
    Color,
    DoubleSide,
  } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import type { VoidPlatformConfig } from "../../domain/models/scene-configs";

  interface Props {
    config: VoidPlatformConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  // --- Cylinder body (nearly invisible dark volume) ---
  const bodyGeometry = $derived.by(() => {
    return new CylinderGeometry(config.radius, config.radius, config.height, 64);
  });

  const bodyMaterial = $derived.by(() => {
    return new MeshStandardMaterial({
      color: "#000000",
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
  });

  // --- Bottom edge glow ring (torus at base) ---
  const bottomRingGeometry = $derived.by(() => {
    // Thin torus at the platform radius — tube radius gives it visible thickness
    return new TorusGeometry(config.radius, 0.015, 8, 128);
  });

  const bottomRingMaterial = $derived.by(() => {
    return new MeshStandardMaterial({
      color: config.gridColor,
      emissive: config.gridColor,
      emissiveIntensity: config.glowIntensity * 1.5,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
  });

  // --- Top edge glow ring (torus at top rim) ---
  const topRingGeometry = $derived.by(() => {
    return new TorusGeometry(config.radius, 0.015, 8, 128);
  });

  const topRingMaterial = $derived.by(() => {
    return new MeshStandardMaterial({
      color: config.gridColor,
      emissive: config.gridColor,
      emissiveIntensity: config.glowIntensity * 1.2,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
  });

  // --- Vertical wireframe columns ---
  const COLUMN_COUNT = 8;
  const columnGeometry = $derived.by(() => {
    // Thin cylinder from bottom to top
    return new CylinderGeometry(0.008, 0.008, config.height, 6);
  });

  const columnMaterial = $derived.by(() => {
    return new MeshStandardMaterial({
      color: config.gridColor,
      emissive: config.gridColor,
      emissiveIntensity: config.glowIntensity * 0.8,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
  });

  // Pre-compute column positions around the circumference
  const columnPositions = $derived.by(() => {
    const positions: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < COLUMN_COUNT; i++) {
      const angle = (i / COLUMN_COUNT) * Math.PI * 2;
      positions.push({
        x: Math.cos(angle) * config.radius,
        z: Math.sin(angle) * config.radius,
      });
    }
    return positions;
  });

  const geometry = $derived.by(() => {
    return new CircleGeometry(config.radius, 128);
  });

  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uGridColor;
    uniform float uGlowIntensity;
    uniform float uGridDensity;
    varying vec2 vUv;

    void main() {
      // Center-relative coords: range [-1, 1]
      vec2 centered = (vUv - 0.5) * 2.0;
      float dist = length(centered);

      // Discard outside unit circle
      if (dist > 1.0) discard;

      // --- Grid parameters ---
      float ringCount = 8.0 * uGridDensity;
      float lineCount = 12.0 * uGridDensity;
      float lineWidth = 0.06;

      // --- Concentric rings ---
      // dist remapped to ring-space: 0..ringCount across radius
      float ringCoord = dist * ringCount;
      float ringFrac = abs(fract(ringCoord) - 0.5) * 2.0;
      float rings = 1.0 - smoothstep(0.0, lineWidth, ringFrac);

      // --- Radial lines ---
      float angle = atan(centered.y, centered.x);
      float radialCoord = angle * lineCount / 6.283185;
      float radialFrac = abs(fract(radialCoord) - 0.5) * 2.0;
      float radials = 1.0 - smoothstep(0.0, lineWidth, radialFrac);
      // Fade radials near center to avoid singularity
      radials *= smoothstep(0.0, 0.08, dist);

      float grid = max(rings, radials);

      // --- Edge fade ---
      float edgeFade = 1.0 - smoothstep(0.7, 1.0, dist);

      // --- Downstage brightness (+Z half = centered.y > 0 in UV space) ---
      // In circle geometry UV, +Z maps to +Y in UV after -PI/2 rotation,
      // so we use the raw centered.y as the downstage indicator.
      float downstageBias = 1.0 + smoothstep(-0.1, 0.5, centered.y) * 1.0;

      // --- Subtle time pulse ---
      float pulse = 0.85 + 0.15 * sin(uTime * 1.2);

      // --- Composite ---
      float brightness = grid * edgeFade * uGlowIntensity * downstageBias * pulse;
      vec3 color = uGridColor * brightness;

      // Glow falloff: soften edges of lines for bloom-like appearance
      float glowSpread = grid * edgeFade * uGlowIntensity * downstageBias * pulse * 0.3;
      color += uGridColor * glowSpread;

      float alpha = brightness + glowSpread;
      alpha = clamp(alpha, 0.0, 1.0);

      gl_FragColor = vec4(color, alpha);
    }
  `;

  const material = $derived.by(() => {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGridColor: { value: new Color(config.gridColor) },
        uGlowIntensity: { value: config.glowIntensity },
        uGridDensity: { value: config.gridDensity },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
  });

  $effect(() => {
    if (!material) return;
    material.uniforms.uGridColor!.value = new Color(config.gridColor);
    material.uniforms.uGlowIntensity!.value = config.glowIntensity;
    material.uniforms.uGridDensity!.value = config.gridDensity;
  });

  // Keep emissive materials in sync with config changes
  $effect(() => {
    const color = new Color(config.gridColor);
    bottomRingMaterial.color = color;
    bottomRingMaterial.emissive = color;
    bottomRingMaterial.emissiveIntensity = config.glowIntensity * 1.5;

    topRingMaterial.color = color;
    topRingMaterial.emissive = color;
    topRingMaterial.emissiveIntensity = config.glowIntensity * 1.2;

    columnMaterial.color = color;
    columnMaterial.emissive = color;
    columnMaterial.emissiveIntensity = config.glowIntensity * 0.8;
  });

  useTask((delta) => {
    if (!material) return;
    material.uniforms.uTime!.value += delta;
  });
</script>

{#if config.enabled}
  <!-- Nearly invisible cylinder body giving the platform depth -->
  <T.Mesh
    geometry={bodyGeometry}
    material={bodyMaterial}
    position.y={groundY + config.height / 2}
  />

  <!-- Grid shader top surface -->
  <T.Mesh
    {geometry}
    {material}
    rotation.x={-Math.PI / 2}
    position.y={groundY + config.height}
  />

  <!-- Glowing ring at the top rim -->
  <T.Mesh
    geometry={topRingGeometry}
    material={topRingMaterial}
    rotation.x={-Math.PI / 2}
    position.y={groundY + config.height}
  />

  <!-- Glowing ring at the bottom edge -->
  <T.Mesh
    geometry={bottomRingGeometry}
    material={bottomRingMaterial}
    rotation.x={-Math.PI / 2}
    position.y={groundY + 0.01}
  />

  <!-- Vertical wireframe columns around the circumference -->
  {#each columnPositions as pos}
    <T.Mesh
      geometry={columnGeometry}
      material={columnMaterial}
      position.x={pos.x}
      position.y={groundY + config.height / 2}
      position.z={pos.z}
    />
  {/each}
{/if}
