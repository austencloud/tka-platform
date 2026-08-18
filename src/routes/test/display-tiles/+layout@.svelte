<script lang="ts">
  import type { Snippet } from "svelte";
  import "../../../app.css";

  // Full-screen lab harness. The product shell's module restorer treats
  // /test/* as an invalid product route and redirects it into Create, so this
  // route resets the layout chain the way /test/grip-lab does.
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
