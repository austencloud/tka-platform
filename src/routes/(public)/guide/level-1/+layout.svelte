<script lang="ts">
  import type { Snippet } from "svelte";
  import GuideShell from "../_components/GuideShell.svelte";
  import { setActiveSectionContext } from "./_data/guide-data-context";

  let { children }: { children: Snippet } = $props();

  let activeSectionId = $state("");

  setActiveSectionContext((id: string) => {
    activeSectionId = id;
  });
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300..800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<GuideShell bind:activeSectionId>
  {@render children()}
</GuideShell>
