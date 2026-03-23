<script lang="ts">
  import { onMount } from "svelte";
  import type { Component } from "svelte";
  import LoadingGate from "$lib/shared/components/loading/LoadingGate.svelte";

  let MainApp = $state<Component | null>(null);

  onMount(() => {
    (window as any).__tkaLoadProgress?.(84, "Resolving services...");
    import("$lib/shared/application/components/MainApplication.svelte").then(
      (mod) => {
        MainApp = mod.default;
      }
    );
  });
</script>

{#if MainApp}
  <MainApp />
{:else}
  <LoadingGate />
{/if}
