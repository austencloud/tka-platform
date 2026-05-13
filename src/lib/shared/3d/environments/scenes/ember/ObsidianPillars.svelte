<script lang="ts">
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    Group,
    Mesh,
    CylinderGeometry,
    ConeGeometry,
    ShaderMaterial,
    DoubleSide,
    Color,
  } from "three";
  import type { ObsidianPillarsConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    config: ObsidianPillarsConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  function createPillarMaterial(
    baseColor: string,
    veinColor: string,
    veinIntensity: number,
    seed: number,
  ): ShaderMaterial {
    return new ShaderMaterial({
      side: DoubleSide,
      uniforms: {
        uBaseColor: { value: new Color(baseColor) },
        uVeinColor: { value: new Color(veinColor) },
        uVeinIntensity: { value: veinIntensity },
        uSeed: { value: seed },
      },
      vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec2 vUv;
        void main() {
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uBaseColor;
        uniform vec3 uVeinColor;
        uniform float uVeinIntensity;
        uniform float uSeed;
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p + uSeed, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          // Vertical vein pattern using position + UV
          vec2 veinUv = vec2(vUv.x * 8.0 + uSeed, vPosition.y * 3.0);
          float n1 = noise(veinUv * 2.0);
          float n2 = noise(veinUv * 4.0 + 50.0);
          float veinPattern = n1 * 0.6 + n2 * 0.4;

          // Thin bright veins
          float vein = smoothstep(0.55, 0.62, veinPattern);

          // Wider glow around veins
          float glow = smoothstep(0.45, 0.65, veinPattern) * 0.3;

          // Veins brighten toward base (heat from below)
          float heightFade = 1.0 - smoothstep(0.0, 0.8, vUv.y);
          float veinStrength = (vein + glow) * heightFade * uVeinIntensity;

          // Faceted crystal shading
          float facetShade = abs(dot(vNormal, vec3(0.3, 0.8, 0.4)));
          vec3 baseShaded = uBaseColor * (0.4 + facetShade * 0.6);

          vec3 finalColor = mix(baseShaded, uVeinColor * 2.0, veinStrength);

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });
  }

  interface PillarInstance {
    group: Group;
    material: ShaderMaterial;
  }

  function createPillar(
    height: number,
    baseColor: string,
    veinColor: string,
    veinIntensity: number,
    seed: number,
  ): PillarInstance {
    const group = new Group();
    const material = createPillarMaterial(baseColor, veinColor, veinIntensity, seed);

    // Main shaft — low-segment cylinder for faceted crystal look
    const shaftGeo = new CylinderGeometry(0.25, 0.35, height, 5, 1);
    const shaft = new Mesh(shaftGeo, material);
    shaft.position.y = height / 2;
    group.add(shaft);

    // Crystal tip — pointed cone
    const tipHeight = height * 0.3;
    const tipGeo = new ConeGeometry(0.28, tipHeight, 5);
    const tip = new Mesh(tipGeo, material);
    tip.position.y = height + tipHeight / 2 - 0.05;
    group.add(tip);

    // Secondary shard — smaller angled pillar growing from base
    if (height > 2.5) {
      const shardHeight = height * 0.45;
      const shardGeo = new CylinderGeometry(0.12, 0.18, shardHeight, 4, 1);
      const shard = new Mesh(shardGeo, material);
      shard.position.set(0.3, shardHeight / 2, 0.15);
      shard.rotation.z = -0.25;
      shard.rotation.x = 0.15;
      group.add(shard);

      const shardTipGeo = new ConeGeometry(0.14, shardHeight * 0.25, 4);
      const shardTip = new Mesh(shardTipGeo, material);
      shardTip.position.set(0.3, shardHeight + shardHeight * 0.125 - 0.03, 0.15);
      shardTip.rotation.z = -0.25;
      shardTip.rotation.x = 0.15;
      group.add(shardTip);
    }

    return { group, material };
  }

  const pillars = $derived.by(() => {
    if (!config.enabled) return [];
    const result: {
      instance: PillarInstance;
      x: number;
      z: number;
      scale: number;
      rotY: number;
    }[] = [];

    config.rings.forEach((ring, ringIndex) => {
      for (let i = 0; i < ring.count; i++) {
        const angleOffset = ringIndex * 0.6;
        const angle = (i / ring.count) * Math.PI * 2 + angleOffset;
        const seed = ringIndex * 100 + i;
        const radiusVariation =
          ring.radius + Math.sin(seed * 3.7) * ring.radiusJitter;
        const x = Math.cos(angle) * radiusVariation;
        const z = Math.sin(angle) * radiusVariation;
        const scale =
          ring.scaleBase +
          Math.abs(Math.sin(seed * 2.3) * ring.scaleVariation);
        const rotY = angle + Math.sin(seed * 1.7) * 0.5;
        const height =
          config.heightRange[0] +
          Math.abs(Math.sin(seed * 1.9)) *
            (config.heightRange[1] - config.heightRange[0]);

        const instance = createPillar(
          height,
          config.baseColor,
          config.veinColor,
          config.veinIntensity,
          seed,
        );
        result.push({ instance, x, z, scale, rotY });
      }
    });
    return result;
  });

  onDestroy(() => {
    for (const p of pillars) {
      p.instance.material.dispose();
    }
  });
</script>

{#if config.enabled}
  {#each pillars as pillar}
    <T
      is={pillar.instance.group}
      position.x={pillar.x}
      position.y={groundY}
      position.z={pillar.z}
      scale={pillar.scale}
      rotation.y={pillar.rotY}
    />
  {/each}
{/if}
