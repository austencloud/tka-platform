<!--
  Sandbox harness for the unified Codex tab. Renders the PRODUCTION component
  (learn/codex/components/CodexExplorer) full-viewport so refinements here land
  in the real learn Codex tab too — one source of truth, no drift.
-->
<script lang="ts">
  import CodexExplorer from "$lib/features/learn/codex/components/CodexExplorer.svelte";
</script>

<svelte:head><title>Codex — sandbox</title></svelte:head>

<div class="frame">
  <CodexExplorer />
</div>

<style>
  .frame {
    height: 100vh;
    background: var(--theme-panel-bg, #12121c);
  }
</style>
