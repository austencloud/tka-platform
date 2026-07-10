<script lang="ts">
  import { browser } from "$app/environment";
  import { page } from "$app/state";

  let { data } = $props();

  const title = $derived(
    data.meta?.word ? `${data.meta.word} — Flow Arts Sequence | The Kinetic Alphabet` : "Scanned Sequence | The Kinetic Alphabet"
  );
  const description = $derived(
    data.meta?.word
      ? `"${data.meta.word}"${data.meta?.creator ? ` by ${data.meta.creator}` : ""}${data.meta?.deckName ? ` from the ${data.meta.deckName} deck` : ""} — watch, practice, and remix this flow arts choreography sequence.`
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
    <meta name="twitter:card" content="summary" />
  {/if}
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
</svelte:head>

{#if browser}
  {#await import("./QScanPage.svelte") then { default: QScanPage }}
    <QScanPage {data} />
  {/await}
{/if}
