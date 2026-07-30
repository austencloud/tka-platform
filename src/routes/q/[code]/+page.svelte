<script lang="ts">
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import ScanCardBootstrap from "./ScanCardBootstrap.svelte";

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

  let QScanPageComponent: typeof import("./QScanPage.svelte").default | null =
    $state(null);
  let viewerReady = $state(false);
  let bootstrapRetired = $state(false);
  let viewerLoadPromise: Promise<void> | null = null;

  function loadViewer(): Promise<void> {
    if (viewerLoadPromise) return viewerLoadPromise;
    viewerLoadPromise = import("./QScanPage.svelte").then(
      ({ default: component }) => {
        QScanPageComponent = component;
      }
    );
    return viewerLoadPromise;
  }

  function handleBootstrapStable(): void {
    void loadViewer();
  }

  function handleViewerReady(): void {
    viewerReady = true;
    setTimeout(() => {
      bootstrapRetired = true;
    }, 220);
  }

  $effect(() => {
    if (browser && !data.scanCard) {
      void loadViewer();
    }
  });
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

<main class="scan-route">
  {#if data.scanCard && !bootstrapRetired}
    <div
      class="bootstrap-layer"
      class:retired={viewerReady}
      aria-hidden={viewerReady}
    >
      <ScanCardBootstrap
        card={data.scanCard}
        displayWord={displayWord ?? data.scanCard.word}
        onStable={handleBootstrapStable}
      />
    </div>
  {/if}

  {#if browser && QScanPageComponent}
    <div
      class="viewer-layer"
      class:ready={viewerReady || !data.scanCard}
      aria-hidden={data.scanCard && !viewerReady}
      inert={data.scanCard && !viewerReady ? true : undefined}
    >
      <QScanPageComponent {data} onViewerReady={handleViewerReady} />
    </div>
  {:else if !data.scanCard}
    <div class="fallback-loader" aria-label="Loading sequence">
      <span></span><span></span><span></span>
    </div>
  {/if}
</main>

<style>
  .scan-route,
  .bootstrap-layer,
  .viewer-layer {
    position: fixed;
    inset: 0;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .scan-route {
    background: #0f0f1a;
  }

  .bootstrap-layer,
  .viewer-layer {
    transition: opacity 180ms ease;
  }

  .bootstrap-layer {
    z-index: 1;
    opacity: 1;
  }

  .bootstrap-layer.retired {
    opacity: 0;
    pointer-events: none;
  }

  .viewer-layer {
    z-index: 2;
    opacity: 0;
    pointer-events: none;
  }

  .viewer-layer.ready {
    opacity: 1;
    pointer-events: auto;
  }

  .fallback-loader {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #0f0f1a;
  }

  .fallback-loader span {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #0891b2;
    animation: fallback-pulse 1.2s ease-in-out infinite;
  }

  .fallback-loader span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .fallback-loader span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes fallback-pulse {
    0%,
    100% {
      opacity: 0.3;
      transform: scale(0.8);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bootstrap-layer,
    .viewer-layer {
      transition: none;
    }

    .fallback-loader span {
      animation: none;
    }
  }
</style>
