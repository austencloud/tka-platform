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

{#if !browser}
  <main class="sequence-document">
    <article class="sequence-card">
      <p class="product-name">Flow Arts Composer</p>
      <h1>{seo.heading}</h1>
      <p class="lede">{seo.description}</p>

      {#if data.meta.creator || data.meta.stepCount || data.meta.difficulty || data.meta.deckName}
        <dl>
          {#if data.meta.creator}
            <div>
              <dt>Submitted by</dt>
              <dd>{data.meta.creator}</dd>
            </div>
          {/if}
          {#if data.meta.stepCount}
            <div>
              <dt>Length</dt>
              <dd>{data.meta.stepCount} steps</dd>
            </div>
          {/if}
          {#if data.meta.difficulty}
            <div>
              <dt>Level</dt>
              <dd>{data.meta.difficulty}</dd>
            </div>
          {/if}
          {#if data.meta.deckName}
            <div>
              <dt>Released deck</dt>
              <dd>{data.meta.deckName}</dd>
            </div>
          {/if}
        </dl>
      {/if}

      <p class="route-note">
        JavaScript adds the interactive viewer. Build choreography in
        <a href="/composer">Flow Arts Composer</a>, or
        <a href="/browse/gallery">browse the public sequence gallery</a>.
      </p>
    </article>
  </main>
{:else}
  {#await import("./SequenceViewerPage.svelte") then { default: SequenceViewerPage }}
    <SequenceViewerPage {data} />
  {/await}
{/if}

<style>
  .sequence-document {
    box-sizing: border-box;
    display: grid;
    min-height: 100vh;
    min-height: 100dvh;
    place-items: center;
    padding: clamp(24px, 6vw, 72px);
    color: var(--theme-text, #f7f8fb);
  }

  .sequence-card {
    box-sizing: border-box;
    width: min(100%, 720px);
    padding: clamp(24px, 5vw, 48px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.16));
    border-radius: 24px;
    background: var(--theme-panel-bg, rgba(15, 20, 30, 0.92));
  }

  .product-name {
    margin: 0 0 12px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: clamp(2rem, 7vw, 4rem);
    line-height: 1;
  }

  .lede {
    max-width: 62ch;
    margin: 24px 0 0;
    font-size: clamp(1rem, 2.5vw, 1.2rem);
    line-height: 1.65;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 16px;
    margin: 32px 0 0;
  }

  dl div {
    padding: 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.16));
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
  }

  dt {
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  dd {
    margin: 8px 0 0;
    font-size: var(--font-size-min, 14px);
    line-height: 1.45;
  }

  .route-note {
    margin: 32px 0 0;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.75));
    font-size: var(--font-size-min, 14px);
    line-height: 1.6;
  }

  a {
    color: var(--theme-accent, #8ab4ff);
    text-underline-offset: 0.2em;
  }

  a:hover {
    text-decoration-thickness: 2px;
  }
</style>
