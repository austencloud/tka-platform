<script lang="ts">
  import type { Snippet } from "svelte";
  import "../../../app.css";
  import "../../../styles/tka-font.css";

  // Full-screen lab harness, same layout-chain reset as /test/display-tiles:
  // the product shell's module restorer treats /test/* as an invalid product
  // route, so this route escapes it with a bare root layout.
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
