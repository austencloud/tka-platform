<script lang="ts">
  import type { Snippet } from "svelte";
  import "../../../app.css";

  // The Forest review route owns a full-screen canvas and no account data.
  // Bypassing the product shell keeps cloud initialization from covering a
  // healthy scene during long material and asset verification passes.
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
