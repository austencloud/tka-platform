<script lang="ts">
  import type { Snippet } from "svelte";
  import "../../../app.css";

  // The Autumn review route owns a full-screen canvas and no account data.
  // Keeping product boot outside this boundary prevents cloud initialization
  // from covering a scene that has already passed its renderer-ready gate.
  let { children } = $props<{ children: Snippet }>();

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
