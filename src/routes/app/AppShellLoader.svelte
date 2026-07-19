<script lang="ts">
  import { onMount } from "svelte";
  import type { Component } from "svelte";
  import LoadingGate from "$lib/shared/components/loading/LoadingGate.svelte";

  let MainApp = $state<Component | null>(null);

  onMount(() => {
    (window as any).__tkaLoadProgress?.(84, "Resolving services...");
    import("$lib/shared/analytics/boot-profiler").then(({ bootProfiler }) =>
      bootProfiler.mark("shell:main-app-chunk")
    );
    import("$lib/shared/application/components/MainApplication.svelte").then(
      (mod) => {
        MainApp = mod.default;
        import("$lib/shared/analytics/boot-profiler").then(({ bootProfiler }) =>
          bootProfiler.end("shell:main-app-chunk")
        );
      }
    );
  });
</script>

{#if MainApp}
  <MainApp />
{:else}
  <LoadingGate />
{/if}

<!-- Magic-link sign-in confirm step. Self-gated (no-ops unless the URL
     carries a pending Firebase email-sign-in link), mounted here rather than
     MainApplication.svelte so it catches the link before MainApp finishes
     loading. See EmailLinkConfirmModal.svelte for why completion requires an
     explicit click. -->
{#await import("$lib/shared/auth/components/EmailLinkConfirmModal.svelte") then mod}
  <mod.default />
{/await}
