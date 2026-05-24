<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    SphereGeometry,
    ShaderMaterial,
    Color,
    AdditiveBlending,
  } from "three";
  import type { FireWispsConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    config: FireWispsConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  const wispGeo = new SphereGeometry(0.15, 16, 12);

  interface WispState {
    baseX: number;
    baseY: number;
    baseZ: number;
    x: number;
    y: number;
    z: number;
    prevPositions: { x: number; y: number; z: number }[];
    phase: number;
    driftPhase: number;
    colorIndex: number;
    currentIntensity: number;
    scale: number;
  }

  let wisps = $state<WispState[]>([]);

  $effect(() => {
    if (!config.enabled) {
      wisps = [];
      return;
    }
    wisps = Array.from({ length: config.count }, (_, i) => {
      const angle = (i / config.count) * Math.PI * 2 + i * 0.7;
      const radius =
        config.spawnRadius * (0.4 + Math.sin(i * 2.7) * 0.3);
      const baseX = Math.cos(angle) * radius;
      const baseZ = Math.sin(angle) * radius;
      const baseY =
        config.heightRange[0] +
        ((i + 0.5) / config.count) *
          (config.heightRange[1] - config.heightRange[0]);
      const startPos = { x: baseX, y: baseY, z: baseZ };
      return {
        baseX,
        baseY,
        baseZ,
        x: baseX,
        y: baseY,
        z: baseZ,
        prevPositions: [
          { ...startPos },
          { ...startPos },
          { ...startPos },
        ],
        phase: i * 1.3,
        driftPhase: i * 2.7,
        colorIndex: i % config.colors.length,
        currentIntensity: config.lightIntensity,
        scale: 0.8 + Math.sin(i * 3.1) * 0.4,
      };
    });
  });

  const vertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mvPos.xyz);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColor;
    uniform float uIntensity;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      float fresnel = 1.0 - abs(dot(vNormal, vViewDir));
      float rim = pow(fresnel, 2.0) * 1.5;
      float core = pow(1.0 - fresnel, 3.0) * 2.0;
      float glow = rim + core;
      vec3 color = uColor * glow * uIntensity;
      float alpha = clamp(glow * 0.8, 0.0, 1.0);
      gl_FragColor = vec4(color, alpha);
    }
  `;

  let materials = $state<ShaderMaterial[]>([]);

  $effect(() => {
    const mats = config.colors.map((c) => {
      const color = new Color(c);
      return new ShaderMaterial({
        uniforms: {
          uColor: { value: color },
          uIntensity: { value: 3.0 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
    });
    materials = mats;
    return () => mats.forEach((m) => m.dispose());
  });

  onDestroy(() => wispGeo.dispose());

  const trailScales = [0.6, 0.35, 0.15];

  useTask((delta) => {
    if (!config.enabled || wisps.length === 0) return;

    const t = performance.now() * 0.001;

    for (let i = 0; i < wisps.length; i++) {
      const w = wisps[i]!;

      // Shift trail positions
      for (let ti = w.prevPositions.length - 1; ti > 0; ti--) {
        w.prevPositions[ti] = { ...w.prevPositions[ti - 1]! };
      }
      w.prevPositions[0] = { x: w.x, y: w.y, z: w.z };

      // Update drift phase
      w.driftPhase += delta * config.driftSpeed;

      // Figure-8 drift pattern
      w.x =
        w.baseX +
        Math.sin(w.driftPhase * 0.7 + w.phase) * 2.0 +
        Math.cos(w.driftPhase * 0.3 + w.phase * 1.5) * 0.8;
      w.y =
        w.baseY +
        Math.sin(w.driftPhase * 0.4 + w.phase * 1.3) * 0.8;
      w.z =
        w.baseZ +
        Math.cos(w.driftPhase * 0.5 + w.phase * 0.8) * 2.0 +
        Math.sin(w.driftPhase * 0.25 + w.phase * 1.7) * 0.6;

      // Pulsing intensity -- organic rhythm
      const pulse =
        0.5 +
        0.3 * Math.sin(t * config.pulseSpeed * Math.PI * 2 + w.phase) +
        0.2 * Math.sin(t * config.pulseSpeed * 1.7 + w.phase * 2.3);
      w.currentIntensity = config.lightIntensity * pulse;
      w.scale = (0.8 + Math.sin(i * 3.1) * 0.4) * (0.7 + pulse * 0.5);
    }
  });
</script>

{#if config.enabled}
  {#each wisps as wisp}
    <T.Group
      position.x={wisp.x}
      position.y={groundY + wisp.y}
      position.z={wisp.z}
    >
      <T.Mesh
        geometry={wispGeo}
        material={materials[wisp.colorIndex]}
        scale={wisp.scale}
      />
      <T.PointLight
        color={config.colors[wisp.colorIndex]}
        intensity={wisp.currentIntensity}
        distance={config.lightDistance}
        decay={2}
      />
    </T.Group>
    {#each wisp.prevPositions as trail, ti}
      <T.Mesh
        geometry={wispGeo}
        material={materials[wisp.colorIndex]}
        position.x={trail.x}
        position.y={groundY + trail.y}
        position.z={trail.z}
        scale={wisp.scale * (trailScales[ti] ?? 0.15)}
      />
    {/each}
  {/each}
{/if}
