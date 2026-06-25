<script lang="ts">
  /**
   * Shared FAQ for the public site (landing + /about). Renders a collapsible
   * accordion from the canonical FAQ_ITEMS, and, when `emitSchema`, the
   * matching FAQPage JSON-LD from the SAME array, so the visible content and the
   * structured data can never drift.
   *
   * `variant`: "section" is the full-bleed landing treatment (its own centered
   * container + generous padding); "card" is the boxed panel used inside the
   * already-constrained /about container.
   */
  import { FAQ_ITEMS, faqPageJsonLd, type FaqItem } from "../faq/faq-items";

  let {
    items = FAQ_ITEMS,
    heading = "Frequently Asked Questions",
    emitSchema = false,
    variant = "section",
  }: {
    items?: FaqItem[];
    heading?: string;
    emitSchema?: boolean;
    variant?: "section" | "card";
  } = $props();

  const schema = $derived(emitSchema ? faqPageJsonLd(items) : null);
</script>

<svelte:head>
  {#if schema}
    {@html `<script type="application/ld+json">${schema}</script>`}
  {/if}
</svelte:head>

<section class="faq {variant}" id="faq" aria-labelledby="faq-heading">
  <div class="container">
    <h2 id="faq-heading">{heading}</h2>
    <div class="faq-list">
      {#each items as faq}
        <details class="faq-item">
          <summary>{faq.question}</summary>
          <p>{faq.answer}</p>
        </details>
      {/each}
    </div>
  </div>
</section>

<style>
  .faq.section {
    padding: clamp(80px, 12vw, 120px) 24px;
  }
  .faq.card {
    margin-top: 4rem;
  }

  .container {
    max-width: 760px;
    margin: 0 auto;
  }
  .faq.card .container {
    max-width: none;
  }

  h2 {
    margin: 0 0 2rem;
    text-align: center;
    font-weight: 700;
    line-height: 1.2;
    color: #ffffff;
    font-size: clamp(1.5rem, 4vw, 2rem);
  }
  .faq.section h2 {
    font-size: clamp(2rem, 5vw, 3rem);
  }

  /* The card variant wraps the whole block in a panel to match /about's cards. */
  .faq.card {
    padding: 2rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
  }
  .faq.card h2 {
    margin-bottom: 1.5rem;
  }

  .faq-list {
    margin: 0 auto;
  }

  .faq-item {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    margin-bottom: 12px;
    overflow: hidden;
  }
  /* Inside the card panel the items sit on the panel, so drop their own fill. */
  .faq.card .faq-item {
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0;
    margin-bottom: 0;
  }
  .faq.card .faq-item:last-child {
    border-bottom: none;
  }

  .faq-item summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 20px 24px;
    cursor: pointer;
    font-weight: 500;
    font-size: 1rem;
    color: #ffffff;
    list-style: none;
    transition: background var(--duration-normal, 0.2s) ease;
  }
  .faq.card .faq-item summary {
    padding: 1.25rem 0;
  }

  .faq-item summary:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
  }
  .faq.card .faq-item summary:hover {
    background: transparent;
    color: #ffffff;
  }

  .faq-item summary::-webkit-details-marker {
    display: none;
  }
  .faq-item summary::after {
    content: "+";
    flex-shrink: 0;
    font-size: 1.5rem;
    font-weight: 300;
    color: var(--theme-accent-strong, #818cf8);
    transition: transform var(--duration-normal, 0.2s) ease;
  }
  .faq-item[open] summary::after {
    content: "−";
  }

  .faq-item p {
    margin: 0;
    padding: 0 24px 20px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: 0.95rem;
    line-height: 1.6;
  }
  .faq.card .faq-item p {
    padding: 0 0 1.25rem;
  }

  @media (max-width: 600px) {
    .faq.section {
      padding: 64px 20px;
    }
    .faq-item summary {
      padding: 16px 20px;
    }
    .faq:not(.card) .faq-item p {
      padding: 0 20px 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .faq-item summary,
    .faq-item summary::after {
      transition: none;
    }
  }
</style>
