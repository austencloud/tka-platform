<script lang="ts">
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";

  let { data } = $props();

  const word = $derived(data.meta?.word ?? null);
  // Display words always go through the repeat-simplifier: a LOOP word like
  // "FΨFΨFΨFΨ" must read as "FΨ" in the title and SERP result, never expanded.
  // (simplified-word-display rule.) The raw `word` stays for the thumbnail key.
  const displayWord = $derived(word ? simplifyRepeatedWord(word) : null);
  const title = $derived(
    displayWord ? `${displayWord} — Flow Arts Sequence | The Kinetic Alphabet` : "Flow Arts Sequence | The Kinetic Alphabet"
  );
  const description = $derived(
    displayWord
      ? `Watch and practice "${displayWord}", a flow arts choreography sequence${data.meta?.creator ? ` by ${data.meta.creator}` : ""}${data.meta?.stepCount ? ` (${data.meta.stepCount} steps)` : ""} — animated notation, practice mode, and printable cards.`
      : "Watch and practice a flow arts choreography sequence with animated notation."
  );
  const canonical = $derived(`https://tkaflowarts.com/sequence/${page.params.id}`);
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="The Kinetic Alphabet" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  {#if data.meta?.thumbnailUrl}
    <meta property="og:image" content={data.meta.thumbnailUrl} />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content={data.meta.thumbnailUrl} />
  {:else}
    <meta name="twitter:card" content="summary" />
  {/if}
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
</svelte:head>

{#if browser}
  {#await import("./SequenceViewerPage.svelte") then { default: SequenceViewerPage }}
    <SequenceViewerPage {data} />
  {/await}
{/if}
