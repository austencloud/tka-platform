<script lang="ts">
  import type { Snippet } from "svelte";
  import GuideShell from "../_components/GuideShell.svelte";
  import { setActiveSectionContext } from "../level-1/_data/guide-data-context";

  let { children }: { children: Snippet } = $props();

  let activeSectionId = $state("");

  setActiveSectionContext((id: string) => {
    activeSectionId = id;
  });
</script>

<svelte:head>
  <!-- Preconnects serve the fonts guide.css @imports (Cormorant/Tangerine).
       The Playfair stylesheet that used to load here was never referenced by
       any level-2 rule (guide.css applies Inter/Cormorant) - removed. -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
</svelte:head>

<GuideShell bind:activeSectionId>
  {@render children()}
</GuideShell>
