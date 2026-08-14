<script lang="ts">
  import type { Snippet } from "svelte";
  import "../../../app.css";

  let { children } = $props<{ children: Snippet }>();

  // This reset layout skips the product shell, so it owns removal of the boot
  // splash that the shell normally clears after initialization.
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
