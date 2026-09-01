<script lang="ts">
  import { T } from "@threlte/core";
  import { onDestroy, type Snippet } from "svelte";
  import type { Group } from "three";

  interface Props {
    performerIndex: number;
    register?: (performerIndex: number, object: Group) => () => void;
    children: Snippet;
  }

  let { performerIndex, register, children }: Props = $props();
  let root = $state<Group>();
  let unregister: (() => void) | null = null;

  $effect(() => {
    unregister?.();
    unregister = root && register ? register(performerIndex, root) : null;
  });

  onDestroy(() => unregister?.());
</script>

<T.Group
  bind:ref={root}
  userData={{ performerIndex, performerVisualPickTarget: true }}
>
  {@render children()}
</T.Group>
