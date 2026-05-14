<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    ConeGeometry,
    MeshPhysicalMaterial,
    Color,
    Group,
    Mesh,
  } from "three";
  import type { LunarCrystalsConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    config: LunarCrystalsConfig;
  }

  let { config }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);

  // Seeded deterministic pseudo-random using a simple LCG
  function makeRng(seed: number) {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  interface ShardData {
    geometry: ConeGeometry;
    material: MeshPhysicalMaterial;
    mesh: Mesh;
    offsetX: number;
    offsetZ: number;
    rotX: number;
    rotZ: number;
  }

  interface ClusterData {
    group: Group;
    shards: ShardData[];
    x: number;
    z: number;
    baseHeight: number;
  }

  const clusters = $derived.by(() => {
    if (!config.enabled) return [];

    const rng = makeRng(42);
    const crystalColor = new Color(config.color);
    const glowCol = new Color(config.glowColor);
    const result: ClusterData[] = [];

    for (let i = 0; i < config.clusterCount; i++) {
      const angle = (i / config.clusterCount) * Math.PI * 2 + rng() * 0.4 - 0.2;
      const radiusJitter = (rng() - 0.5) * 0.8;
      const cx = Math.cos(angle) * (config.ringRadius + radiusJitter);
      const cz = Math.sin(angle) * (config.ringRadius + radiusJitter);

      const shardCount = 2 + Math.floor(rng() * 3); // 2–4 shards
      const group = new Group();
      const shards: ShardData[] = [];

      for (let j = 0; j < shardCount; j++) {
        const [minH, maxH] = config.heightRange;
        const height = minH + rng() * (maxH - minH);
        const radiusTop = 0.01 + rng() * 0.04; // near-zero for pointed tip
        const radiusBottom = 0.06 + rng() * 0.1;

        const geometry = new ConeGeometry(radiusBottom, height, 6, 1, false, rng() * Math.PI * 2);

        const material = new MeshPhysicalMaterial({
          color: crystalColor,
          emissive: glowCol,
          emissiveIntensity: 0,
          transmission: 0.85,
          thickness: 0.4,
          roughness: 0.05,
          metalness: 0.0,
          ior: 1.45,
          transparent: true,
          opacity: config.opacity,
          envMapIntensity: 1.5,
        });

        const mesh = new Mesh(geometry, material);

        const offsetX = (rng() - 0.5) * 0.35;
        const offsetZ = (rng() - 0.5) * 0.35;
        const rotX = (rng() - 0.5) * 0.4;
        const rotZ = (rng() - 0.5) * 0.4;

        mesh.position.set(offsetX, height / 2, offsetZ);
        mesh.rotation.x = rotX;
        mesh.rotation.z = rotZ;

        group.add(mesh);
        shards.push({ geometry, material, mesh, offsetX, offsetZ, rotX, rotZ });
      }

      result.push({ group, shards, x: cx, z: cz, baseHeight: 0 });
    }

    return result;
  });

  let time = $state(0);

  useTask((delta) => {
    if (!config.enabled || clusters.length === 0) return;
    time += delta;

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i]!;
      // Each cluster pulses at a slightly different phase
      const phase = (i / config.clusterCount) * Math.PI * 2;
      const pulse = (Math.sin(time * 1.8 + phase) * 0.5 + 0.5) * config.glowIntensity;

      for (const shard of cluster.shards) {
        shard.material.emissiveIntensity = pulse;
      }
    }
  });

  onDestroy(() => {
    for (const cluster of clusters) {
      for (const shard of cluster.shards) {
        shard.geometry.dispose();
        shard.material.dispose();
      }
    }
  });
</script>

{#if config.enabled}
  {#each clusters as cluster, i}
    <T
      is={cluster.group}
      position.x={cluster.x}
      position.y={groundY}
      position.z={cluster.z}
    />
    <!-- Per-cluster point light for ambient glow -->
    <T.PointLight
      position.x={cluster.x}
      position.y={groundY + config.heightRange[1] * 0.6}
      position.z={cluster.z}
      color={config.glowColor}
      intensity={config.glowIntensity * 2}
      distance={3.5}
      decay={2}
    />
  {/each}
{/if}
