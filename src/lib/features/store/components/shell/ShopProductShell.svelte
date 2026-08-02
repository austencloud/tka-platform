<!-- src/lib/features/store/components/shell/ShopProductShell.svelte -->
<!--
  The chrome every shop product page shares.

  Five purchase pages grew in parallel and each hand-rolled the same shell: page
  root, back link, title, price line, checkout error, assurance list, loading and
  error states, and (twice, byte for byte) a pinned mobile checkout bar. Four of
  them agreed on a content width, one used a wider one, one used a narrower one,
  and the back links disagreed about where "back" goes. Every one of those is
  now owned here, so a fix lands on all of them at once and a new product page
  cannot drift.

  Host pages stay thin: they bring their data and their genuinely
  product-specific regions (the preview stage, the dials, the how-it-works
  explainer, the spec list) through snippets. Deltas go through props — never
  through a forked copy of this markup. Same contract as SequenceViewerShell.
-->
<script module lang="ts">
  /** One line of the reassurance list under the buy button. */
  export interface ShopAssurance {
    /** FontAwesome class, e.g. "fas fa-box-open". */
    readonly icon: string;
    readonly text: string;
  }

  /** The pinned mobile buy bar. Opt in by passing this; leave it off and the
   *  dock never mounts. */
  export interface ShopDock {
    readonly label: string;
    readonly price: string;
    readonly ctaLabel: string;
    readonly disabled?: boolean;
    readonly onclick: () => void;
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Product } from "../../domain/models/product";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { LoopConfig } from "../../domain/loop-config";
  import type { ShopListing } from "../../analytics/shop-funnel";
  import type { CatalogEntry } from "../../domain/catalog-listings";
  import type { PurchaseState } from "../../domain/purchase-state";
  import ShopPurchaseCta from "./ShopPurchaseCta.svelte";
  import ShopCheckoutDock from "./ShopCheckoutDock.svelte";
  import ShopCrossSellRail from "./ShopCrossSellRail.svelte";

  interface Props {
    // ── catalog context strip ──
    /** Where "back" goes. The catalog, unless a page is a sub-variant of
     *  another product (the Deck Architect returns to the LOOP deck). */
    backHref?: string;
    backLabel?: string;
    /** Trailing breadcrumb: which family of the line this product belongs to. */
    family?: string;

    // ── hero band ──
    eyebrow?: string;
    title: string;
    tagline?: string;
    /** The preview stage: fan, mockup, book cover. Sized by the shell so the
     *  page doesn't reflow while the art renders. */
    media?: Snippet;
    /** Reserved height of the media stage. Pages whose art is a different shape
     *  override it; the default suits a card fan. */
    mediaHeight?: string;

    // ── configurator + buy cluster ──
    /** Dials, volume pickers, prop pickers — whatever this product configures.
     *  Sits above the buy cluster inside the info column. */
    configurator?: Snippet;
    /** Formatted price for the buy cluster. */
    price?: string;
    /** Price-adjacent note (the preorder price-swap warning). */
    priceNote?: Snippet;
    /** The product the default CTA buys. Omit only when passing `cta`. */
    product?: Product;
    propType?: PropType;
    loopConfig?: LoopConfig;
    listing?: ShopListing;
    ctaMode?: "buy" | "add";
    /** Override the resolved purchase state (harnesses, admin previews). */
    purchaseState?: PurchaseState;
    /** Replace the whole CTA cluster. Rare — a page with two buy paths. */
    cta?: Snippet;
    checkoutError?: string | null;
    assurances?: readonly ShopAssurance[];

    // ── sections below the fold ──
    /** Card anatomy, the scannable QR, how a deck is used. */
    howItWorks?: Snippet;
    /** Specs, contents, everything a buyer checks before committing. */
    details?: Snippet;

    // ── cross-sell ──
    crossSell?: readonly CatalogEntry[];
    crossSellTitle?: string;

    // ── mobile dock ──
    dock?: ShopDock | null;

    // ── page states ──
    loading?: boolean;
    loadingLabel?: string;
    error?: string | null;
  }

  let {
    backHref = "/shop",
    backLabel = "Shop",
    family,
    eyebrow,
    title,
    tagline,
    media,
    mediaHeight = "clamp(20rem, 26vw, 30rem)",
    configurator,
    price,
    priceNote,
    product,
    propType,
    loopConfig,
    listing = "sku",
    ctaMode = "buy",
    purchaseState,
    cta,
    checkoutError = null,
    assurances = [],
    howItWorks,
    details,
    crossSell = [],
    crossSellTitle,
    dock = null,
    loading = false,
    loadingLabel = "Loading...",
    error = null,
  }: Props = $props();

  // The pinned mobile bar exists for one situation only: a narrow screen where
  // the real buy cluster has scrolled away. Watching the cluster itself (rather
  // than a scroll offset) means it stays correct no matter how tall a page's
  // configurator grows.
  let buyRailEl = $state<HTMLElement | null>(null);
  let buyRailInView = $state(false);
  $effect(() => {
    if (!buyRailEl) return;
    const observer = new IntersectionObserver(
      (entries) => {
        buyRailInView = entries[0]?.isIntersecting ?? false;
      },
      { threshold: 0.2 }
    );
    observer.observe(buyRailEl);
    return () => observer.disconnect();
  });

  let viewportWidth = $state(0);
  const narrow = $derived(viewportWidth > 0 && viewportWidth < 720);
  const dockVisible = $derived(Boolean(dock) && narrow && !buyRailInView && !loading && !error);
</script>

<svelte:window bind:innerWidth={viewportWidth} />

<div class="shop-product-shell" class:docked={dockVisible}>
  <main class="shell-band">
    <nav class="context-strip" aria-label="Shop navigation">
      <a class="back-button" href={backHref}>
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        {backLabel}
      </a>
      {#if family}
        <span class="crumb-sep" aria-hidden="true">/</span>
        <span class="crumb">{family}</span>
      {/if}
    </nav>

    {#if error}
      <p class="state error">{error}</p>
    {:else if loading}
      <p class="state loading">{loadingLabel}</p>
    {:else}
      <section class="hero">
        <div class="hero-media" style:--media-h={mediaHeight}>
          {@render media?.()}
        </div>

        <div class="hero-info">
          {#if eyebrow}<span class="eyebrow">{eyebrow}</span>{/if}
          <h1>{title}</h1>
          {#if tagline}<p class="tagline">{tagline}</p>{/if}

          {#if configurator}
            <div class="configurator">{@render configurator()}</div>
          {/if}

          <div class="buy-rail" bind:this={buyRailEl}>
            {#if price}<p class="price">{price}</p>{/if}
            {@render priceNote?.()}

            {#if cta}
              {@render cta()}
            {:else if product}
              <ShopPurchaseCta
                {product}
                {propType}
                {loopConfig}
                {listing}
                mode={ctaMode}
                state={purchaseState}
              />
            {/if}

            {#if checkoutError}
              <p class="checkout-error" role="alert">{checkoutError}</p>
            {/if}

            {#if assurances.length > 0}
              <ul class="assurance">
                {#each assurances as line (line.text)}
                  <li><i class={line.icon} aria-hidden="true"></i> {line.text}</li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      </section>

      {#if howItWorks}
        <section class="shell-section">{@render howItWorks()}</section>
      {/if}

      {#if details}
        <section class="shell-section">{@render details()}</section>
      {/if}

      {#if crossSell.length > 0}
        <ShopCrossSellRail entries={crossSell} title={crossSellTitle} />
      {/if}
    {/if}
  </main>
</div>

{#if dockVisible && dock}
  <ShopCheckoutDock
    label={dock.label}
    price={dock.price}
    ctaLabel={dock.ctaLabel}
    disabled={dock.disabled ?? false}
    onclick={dock.onclick}
  />
{/if}

<style>
  .shop-product-shell {
    min-height: 100vh;
    /* px, not rem: this clears the fixed-height SiteHeader, which does not ramp. */
    padding-top: 64px;
    background: transparent; /* the cosmic BackgroundHost shows through */
    color: var(--theme-text, #ffffff);
  }
  /* Keep the last section clear of the pinned bar. */
  .shop-product-shell.docked {
    padding-bottom: 5.5rem;
  }

  /* The one content band for every /shop route: floor 1720px, fluid, ceiling
     2600px. Shared with SiteHeader, SiteFooter and every other public shell, so
     a product page lines up with the chrome around it at any width. */
  .shell-band {
    max-width: var(--shell-w, min(1720px, 92vw));
    margin: 0 auto;
    padding: 1.75rem 1.5rem 2.75rem;
    display: flex;
    flex-direction: column;
    gap: clamp(2.5rem, 4vw, 4.5rem);
  }

  /* ---------- context strip ---------- */
  .context-strip {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0 1.125rem;
    border-radius: 999px;
    border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.15));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
    text-decoration: none;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    transition: background 0.2s, border-color 0.2s;
  }
  .back-button:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-border-strong, rgba(255, 255, 255, 0.3));
  }
  .back-button:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  .crumb-sep {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.35));
  }
  .crumb {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ---------- hero band ---------- */
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: clamp(1.75rem, 4vw, 3.5rem);
    align-items: start;
  }

  /* One column once the two would each be too narrow to read. */
  @media (max-width: 54rem) {
    .hero {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  /* Wide screens: the stage grows to the info column's height and centres its
     art, instead of leaving a pool of dead space beneath it. */
  @media (min-width: 1400px) {
    .hero {
      align-items: stretch;
    }
    .hero-media {
      display: grid;
      align-content: center;
    }
  }

  .hero-media {
    min-height: var(--media-h, clamp(20rem, 26vw, 30rem));
    display: grid;
    place-items: center;
    border-radius: 1.25rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    padding: clamp(1rem, 2.5vw, 2rem);
    background: radial-gradient(
      circle at 50% 38%,
      rgba(255, 255, 255, 0.05),
      rgba(255, 255, 255, 0.015)
    );
  }

  .hero-info {
    display: flex;
    flex-direction: column;
    gap: 1.125rem;
    min-width: 0;
  }

  .eyebrow {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #b8a6ff;
  }

  h1 {
    /* Brand Fraunces wonky italic — the same page-title voice as every other
       public page (token set by MarketingChrome, which /shop lives under). */
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-style: italic;
    font-weight: 700;
    font-variation-settings: "opsz" 144, "wght" 700, "SOFT" 0, "WONK" 1;
    font-size: clamp(1.8rem, 3vw, 2.4rem);
    margin: 0;
    letter-spacing: -0.015em;
  }

  .tagline {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    line-height: 1.6;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
  }

  .configurator {
    display: flex;
    flex-direction: column;
    gap: 1.125rem;
  }

  .buy-rail {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .price {
    margin: 0;
    font-size: 2rem;
    font-weight: 800;
    color: var(--theme-accent, #60a5fa);
    font-variant-numeric: tabular-nums;
  }

  .checkout-error {
    margin: 0;
    text-align: center;
    font-size: var(--font-size-sm, 14px);
    color: var(--semantic-error, #ef4444);
  }

  .assurance {
    list-style: none;
    margin: 0.25rem 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }
  .assurance li {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
  }
  .assurance li i {
    color: #8b6cff;
    flex: 0 0 auto;
  }

  /* ---------- host sections ---------- */
  .shell-section {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* ---------- load / failure ---------- */
  .state {
    margin: 0;
    text-align: center;
    padding: 3rem;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }
  .state.error {
    color: var(--semantic-error, #ef4444);
  }

  @media (prefers-reduced-motion: reduce) {
    .back-button {
      transition: none;
    }
  }
</style>
