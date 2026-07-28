<script lang="ts">
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";

  let { data } = $props();

  const isSolo = $derived(data.meta?.payloadKind === "solo");
  const displayWord = $derived(
    data.meta?.word
      ? isSolo
        ? data.meta.word
        : simplifyRepeatedWord(data.meta.word)
      : null
  );

  const title = $derived(
    displayWord
      ? isSolo
        ? `${displayWord}: Solo Flow Choreography | The Kinetic Alphabet`
        : `${displayWord}: Flow Arts Sequence | The Kinetic Alphabet`
      : "Scanned Sequence | The Kinetic Alphabet"
  );
  const description = $derived(
    displayWord
      ? isSolo
        ? `${displayWord}${data.meta?.creator ? ` by ${data.meta.creator}` : ""}. Watch and practice this one-hand flow choreography.`
        : `"${displayWord}"${data.meta?.creator ? ` by ${data.meta.creator}` : ""}${data.meta?.deckName ? ` from the ${data.meta.deckName} deck` : ""}. Watch, practice, and remix this flow arts choreography sequence.`
      : "Watch and practice a flow arts choreography sequence."
  );
  const canonical = $derived(`https://tkaflowarts.com/q/${page.params.code}`);
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
    <meta
      property="og:image"
      content="https://tkaflowarts.com/og-default.png"
    />
    <meta name="twitter:card" content="summary_large_image" />
    <meta
      name="twitter:image"
      content="https://tkaflowarts.com/og-default.png"
    />
  {/if}
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
</svelte:head>

{#if browser}
  {#await import("./QScanPage.svelte") then { default: QScanPage }}
    <QScanPage {data} />
  {/await}
{/if}
