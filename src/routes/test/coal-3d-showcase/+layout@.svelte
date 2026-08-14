<script lang="ts">
  import type { Snippet } from "svelte";
  import "../../../app.css";

  // This is a full-screen review harness. The product shell's module restorer
  // treats /test/* as an invalid product route and redirects it into Create.
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
