<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { T, useTask } from "@threlte/core";
  import {
    FirstFireFlameFieldRenderer,
    type FirstFireFlameAnchor,
  } from "./first-fire-flame-field";

  interface Props {
    anchors: readonly FirstFireFlameAnchor[];
  }

  const props: Props = $props();
  const renderer = new FirstFireFlameFieldRenderer(props.anchors);
  let motionScale = 1;
  let reducedMotionQuery: MediaQueryList | null = null;

  function syncMotionPreference(): void {
    motionScale = reducedMotionQuery?.matches ? 0.35 : 1;
  }

  onMount(() => {
    reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    syncMotionPreference();
    reducedMotionQuery.addEventListener("change", syncMotionPreference);
  });

  useTask((delta) => {
    renderer.update(delta, motionScale);
  });

  onDestroy(() => {
    reducedMotionQuery?.removeEventListener("change", syncMotionPreference);
    renderer.dispose();
  });
</script>

<T is={renderer.object3D} />
