<script lang="ts">
  import type { Snippet } from "svelte";
  import "../../../app.css";

  // This is a focused geospatial authoring surface, not a product module. The
  // reset keeps the app shell from interpreting /test/* as a Composer route.
  let { children } = $props<{ children: Snippet }>();

  $effect(() => {
    document.getElementById("app-loading")?.remove();
  });
</script>

<svelte:head>
  <title>Flow Fest Path Tracer</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{@render children()}
