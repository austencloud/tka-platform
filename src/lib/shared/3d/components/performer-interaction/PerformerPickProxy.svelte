<script lang="ts">
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import type { Mesh } from "three";

  interface Props {
    performerIndex: number;
    position: { x: number; z: number };
    groundY: number;
    register: (object: Mesh) => () => void;
  }

  let { performerIndex, position, groundY, register }: Props = $props();
  let proxy = $state<Mesh>();
  let unregister: (() => void) | null = null;

  $effect(() => {
    if (!proxy) return;
    unregister?.();
    unregister = register(proxy);
  });

  onDestroy(() => unregister?.());
</script>

<T.Mesh
  bind:ref={proxy}
  position={[position.x, groundY + 0.9, position.z]}
  userData={{ performerIndex, performerPickTarget: true }}
  visible={true}
>
  <T.CapsuleGeometry args={[0.5, 0.8, 4, 12]} />
  <T.MeshBasicMaterial
    transparent
    opacity={0}
    depthWrite={false}
    colorWrite={false}
  />
</T.Mesh>
