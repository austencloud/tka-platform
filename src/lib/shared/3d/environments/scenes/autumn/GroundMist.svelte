<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    InstancedMesh,
    PlaneGeometry,
    MeshStandardMaterial,
    Object3D,
    Color,
    DoubleSide,
  } from "three";
  import { onDestroy } from "svelte";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    count?: number;
    area?: number;
    color?: string;
    opacity?: number;
    speed?: number;
  }

  let {
    count = 25,
    area = 30,
    color = "#c8b8a0",
    opacity = 0.06,
    speed = 0.15,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  const geometry = new PlaneGeometry(3, 3);
  const material = new MeshStandardMaterial({
    color: new Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    side: DoubleSide,
    roughness: 1,
  });

  const dummy = new Object3D();

  function hash(s: number): number {
    const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  interface MistPatch {
    x: number;
    y: number;
    z: number;
    vx: number;
    vz: number;
    scale: number;
    phase: number;
  }

  const patches: MistPatch[] = Array.from({ length: count }, (_, i) => ({
    x: (hash(i * 3.1 + 7) - 0.5) * area,
    y: groundY + 0.05 + hash(i * 5.3 + 13) * 0.35,
    z: (hash(i * 7.7 + 19) - 0.5) * area,
    vx: (hash(i * 11.3 + 29) - 0.5) * 2,
    vz: (hash(i * 13.7 + 37) - 0.5) * 2,
    scale: 1.5 + hash(i * 17.1 + 43) * 2.5,
    phase: hash(i * 19.3 + 53) * Math.PI * 2,
  }));

  let mesh = $state<InstancedMesh | null>(null);

  $effect(() => {
    const inst = new InstancedMesh(geometry, material, count);
    for (let i = 0; i < count; i++) {
      const p = patches[i]!;
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.x = -Math.PI / 2;
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    mesh = inst;

    return () => {
      inst.dispose();
    };
  });

  let elapsed = 0;

  useTask((delta) => {
    if (!mesh) return;
    elapsed += delta;

    const halfArea = area / 2;

    for (let i = 0; i < count; i++) {
      const p = patches[i]!;
      p.x += p.vx * delta * speed;
      p.z += p.vz * delta * speed;
      p.y = groundY + 0.1 + Math.sin(elapsed + p.phase) * 0.08;

      // Wrap around area bounds
      if (p.x > halfArea) p.x -= area;
      if (p.x < -halfArea) p.x += area;
      if (p.z > halfArea) p.z -= area;
      if (p.z < -halfArea) p.z += area;

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.x = -Math.PI / 2;
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  onDestroy(() => {
    geometry.dispose();
    material.dispose();
  });
</script>

{#if mesh}
  <T is={mesh} />
{/if}
