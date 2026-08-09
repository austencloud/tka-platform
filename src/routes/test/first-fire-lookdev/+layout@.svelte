<script lang="ts">
  import type { Snippet } from "svelte";
  import "../../../app.css";

  // Full-screen test harnesses must bypass the app shell. Otherwise the module
  // restorer treats /test/* as an invalid product route and rewrites the URL.
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
