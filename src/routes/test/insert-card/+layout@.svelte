<script lang="ts">
  import type { Snippet } from "svelte";
  import "../../../app.css";

  // Layout reset: this harness renders bare print canvases and must not mount
  // the app shell, which would route /test/* into a product module.
  let { children } = $props<{ children: Snippet }>();

  // app.html ships a boot splash that the app shell removes once it mounts.
  // Skipping the shell means nothing removes it, so it covers the harness.
  $effect(() => {
    document.getElementById("app-loading")?.remove();
  });
</script>

<svelte:head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{@render children()}
