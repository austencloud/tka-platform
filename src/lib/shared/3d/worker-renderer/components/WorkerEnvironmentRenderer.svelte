<script lang="ts">
  import { onMount } from "svelte";
  import type {
    WorkerEnvironmentKey,
    WorkerPerformerSnapshot,
  } from "../domain/worker-renderer-protocol";
  import {
    WorkerEnvironmentRenderer,
    type WorkerSceneSwitchSnapshot,
  } from "../services/worker-environment-renderer";

  interface Props {
    environment: WorkerEnvironmentKey;
    performers?: readonly WorkerPerformerSnapshot[];
    onSnapshot?: (snapshot: WorkerSceneSwitchSnapshot) => void;
  }

  let { environment, performers = [], onSnapshot }: Props = $props();
  let container: HTMLDivElement;
  let renderer: WorkerEnvironmentRenderer | null = null;

  onMount(() => {
    renderer = new WorkerEnvironmentRenderer({
      container,
      onSnapshot,
    });
    renderer.setPerformers($state.snapshot(performers));
    renderer.switchTo(environment);
    return () => {
      renderer?.dispose();
      renderer = null;
    };
  });

  $effect(() => {
    const selected = environment;
    renderer?.switchTo(selected);
  });

  $effect(() => {
    renderer?.setPerformers($state.snapshot(performers));
  });
</script>

<div class="worker-environment-renderer" bind:this={container}></div>

<style>
  .worker-environment-renderer {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #05050a;
    contain: strict;
  }

  :global(.worker-environment-renderer__canvas) {
    display: block;
  }
</style>
