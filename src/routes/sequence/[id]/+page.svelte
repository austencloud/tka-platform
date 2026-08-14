<script lang="ts">
  import { browser } from "$app/environment";
  import Seo from "$lib/shared/components/Seo.svelte";

  let { data } = $props();

  const seo = $derived(data.seo);
  const sequenceJsonLd = $derived(
    seo.jsonLd ? JSON.stringify(seo.jsonLd).replace(/</g, "\\u003c") : null
  );
</script>

<Seo
  title={seo.title}
  description={seo.description}
  canonical={seo.canonical}
  ogImage={seo.ogImage}
  ogImageAlt={seo.ogImageAlt}
  noindex={!seo.indexable}
>
  {#if sequenceJsonLd}
    {@html `<script type="application/ld+json">${sequenceJsonLd}</script>`}
  {/if}
</Seo>

{#if browser}
  {#await import("./SequenceViewerPage.svelte") then { default: SequenceViewerPage }}
    <SequenceViewerPage {data} />
  {/await}
{/if}
