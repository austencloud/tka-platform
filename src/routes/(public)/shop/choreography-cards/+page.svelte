<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import type { CoverCard } from "$lib/features/store/domain/models/product";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

  // Real baked card fronts, one fan per deck line (variety proof under
  // "Every Deck Is Different"). Loaded client-side only; prerendered HTML
  // stays lean. Same selection logic as the shop grid tiles: LOOP fans one
  // card per flavor (a varied hand), T&D fans its element families.
  let loopCards = $state<CoverCard[]>([]);
  let tndCards = $state<CoverCard[]>([]);

  onMount(async () => {
    try {
      const { loadActiveProducts } = await import(
        "$lib/features/store/services/product-loader"
      );
      const products = await loadActiveProducts();
      const loopSkus = products.filter((p) => p.listing === "loop-deck");
      const tndSkus = products.filter((p) => p.listing === "tnd-trilogy");
      const perFlavor = loopSkus
        .map((p) => p.coverCards?.[0])
        .filter((c): c is CoverCard => c != null);
      loopCards = perFlavor.length >= 4 ? perFlavor : (loopSkus[0]?.coverCards ?? perFlavor);
      tndCards = tndSkus[0]?.coverCards ?? [];
    } catch (error) {
      console.warn("[choreo-cards] deck fan load failed; tiles stay text-only", error);
    }
  });

  const DESCRIPTION =
    "Choreo Cards: the newest technology in flow arts notation. Each card holds a sequence. Scan the QR code, visualize it with any prop at any speed, and save it to your catalog.";

  const decks = [
    {
      id: "loop",
      name: "LOOP Deck",
      href: "/shop/loop-deck",
      blurb: "Looping sequences that end where they start.",
    },
    {
      id: "tnd",
      name: "T&D Trilogy",
      href: "/shop/tnd-trilogy",
      blurb: "Three decks organized by timing and direction.",
    },
  ];

  const frontLegend = [
    { id: "word", term: "The word", text: "The sequence's word, spelled in TKA letters." },
    {
      id: "start",
      term: "Start",
      text: "The start position: where the sequence starts and ends.",
    },
    { id: "steps", term: "The steps", text: "The sequence itself, step by step, as pictographs." },
    {
      id: "mandalas",
      term: "Mandalas",
      text: "The mandalas that show in blue and red what the sequence looks like when performed.",
    },
    {
      id: "qr",
      term: "QR code",
      text: "Scan it to immediately visualize this sequence with any prop at any speed, save it to your personal catalog, and open practice mode.",
    },
  ];

  const backLegend = [
    {
      id: "turn",
      term: "Turn pattern",
      text: "How many extra rotations the sequence carries, and whether there's a pattern in that too.",
    },
    {
      id: "reversal",
      term: "Reversal pattern",
      text: "A simple glyph showing whether the props alternate spin direction over the course of the pattern.",
    },
    {
      id: "mandala",
      term: "Combined mandala",
      text: "A combination of the two mandalas. The purple represents where they overlap.",
    },
    {
      id: "looptype",
      term: "LOOP type",
      text: "The LOOP type of the sequence.",
    },
    {
      id: "difficulty",
      term: "Difficulty",
      text: "The difficulty level. The Kinetic Alphabet is built into clear tiers of difficulty.",
    },
    {
      id: "startpos",
      term: "Start position",
      text: "Shows you where the sequence starts and ends, and the prop that sequence is using on that card.",
    },
    { id: "stepcount", term: "Step count", text: "The number of steps in the sequence." },
  ];

  let highlight = $state<string | null>(null);

  function toggle(id: string) {
    highlight = highlight === id ? null : id;
  }

  // Desktop = the three-column front|cards|back diagram (hover-driven). Mobile
  // (<1100px) = one card with a Front/Back toggle, a detail slot, and a chip
  // row, so the card and its explanation always share the screen. Default true
  // so the prerendered HTML carries the full diagram for SEO; hydrate corrects.
  let isDesktop = $state(true);
  onMount(() => {
    const mq = window.matchMedia("(min-width: 1100px)");
    const update = () => (isDesktop = mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  });

  // Mobile single-face toggle + detail lookup.
  let face = $state<"front" | "back">("front");
  function switchFace(f: "front" | "back") {
    face = f;
    highlight = null;
  }
  const legendById = $derived(
    new Map([...frontLegend, ...backLegend].map((i) => [i.id, i]))
  );
  const detail = $derived(highlight ? legendById.get(highlight) : null);
  const faceLegend = $derived(face === "front" ? frontLegend : backLegend);
</script>

<svelte:head>
  <title>Choreo Cards: The Newest Technology in Flow Arts Notation | TKA Shop</title>
  <meta name="description" content={DESCRIPTION} />
  <link rel="canonical" href="https://tkaflowarts.com/shop/choreography-cards" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://tkaflowarts.com/shop/choreography-cards" />
  <meta property="og:title" content="Choreo Cards: The Newest Technology in Flow Arts Notation" />
  <meta property="og:description" content={DESCRIPTION} />
  <meta property="og:image" content="https://tkaflowarts.com/branding/og-image.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Choreo Cards: The Newest Technology in Flow Arts Notation" />
  <meta name="twitter:description" content={DESCRIPTION} />
  <meta name="twitter:image" content="https://tkaflowarts.com/branding/og-image.png" />

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Choreo Cards: Choreography Card Decks for Flow Arts",
    "url": "https://tkaflowarts.com/shop/choreography-cards",
    "description": "${DESCRIPTION}",
    "inLanguage": "en-US",
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "LOOP Deck", "url": "https://tkaflowarts.com/shop/loop-deck" },
        { "@type": "ListItem", "position": 2, "name": "T&D Trilogy", "url": "https://tkaflowarts.com/shop/tnd-trilogy" }
      ]
    }
  }
  </script>`}

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tkaflowarts.com/" },
      { "@type": "ListItem", "position": 2, "name": "Shop", "item": "https://tkaflowarts.com/shop" },
      { "@type": "ListItem", "position": 3, "name": "Choreography Cards", "item": "https://tkaflowarts.com/shop/choreography-cards" }
    ]
  }
  </script>`}
</svelte:head>

<div class="editorial wide">
  <header class="editorial-header">
    <h1 class="page-title">Choreo Cards</h1>
    <p class="page-subtitle">The newest technology in flow arts notation</p>
  </header>

  <div class="lede">
    <p>
      Each card holds a sequence. Scan the QR code and it takes you to a page where you
      can immediately visualize that sequence with any prop at any speed, save it to
      your own personal catalog so you can keep track of all of your sequences, and
      open a practice mode that lets you learn the sequence at your own pace.
    </p>
  </div>

  <section class="editorial-section anatomy-section" style="--accent: #ec4899">
    <span class="section-kicker">Anatomy</span>
    <h2 class="section-title">What's on the Card</h2>
    <p class="anatomy-hint">Tap or point at any part of the card, or any row in the list. Its match lights up.</p>

    {#if isDesktop}
      <!-- Desktop: front labels | cards | back labels, hover-driven. -->
      <div class="anatomy-layout" class:dimming={highlight !== null}>
        <div class="legend-col front">
          <h3 class="legend-title">Front</h3>
          <div class="legend-list" role="list">
            {#each frontLegend as item}
              <button
                type="button"
                class="legend-row"
                class:active={highlight === item.id}
                onpointerenter={(e) => e.pointerType === "mouse" && (highlight = item.id)}
                onpointerleave={(e) => e.pointerType === "mouse" && (highlight = null)}
                onclick={() => toggle(item.id)}
              >
                <span class="legend-term">{item.term}</span>
                <span class="legend-text">{item.text}</span>
              </button>
            {/each}
          </div>
        </div>

        <div class="cards-slot">
          {#if browser}
            {#await import("$lib/features/store/components/CardAnatomy.svelte") then { default: CardAnatomy }}
              <CardAnatomy {highlight} onhighlight={(id) => (highlight = id)} />
            {/await}
          {/if}
        </div>

        <div class="legend-col back">
          <h3 class="legend-title">Back</h3>
          <div class="legend-list" role="list">
            {#each backLegend as item}
              <button
                type="button"
                class="legend-row"
                class:active={highlight === item.id}
                onpointerenter={(e) => e.pointerType === "mouse" && (highlight = item.id)}
                onpointerleave={(e) => e.pointerType === "mouse" && (highlight = null)}
                onclick={() => toggle(item.id)}
              >
                <span class="legend-term">{item.term}</span>
                <span class="legend-text">{item.text}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>
    {:else}
      <!-- Mobile: one card + a Front/Back toggle, its detail directly beneath,
           and a chip row — card and text always on screen together. -->
      <div class="mobile-anatomy">
        <div class="face-toggle">
          <SegmentedControl
            options={[
              { value: "front", label: "Front" },
              { value: "back", label: "Back" },
            ]}
            value={face}
            onchange={switchFace}
            color="accent"
          />
        </div>

        <div class="cards-slot">
          {#if browser}
            {#await import("$lib/features/store/components/CardAnatomy.svelte") then { default: CardAnatomy }}
              <CardAnatomy {highlight} {face} onhighlight={(id) => (highlight = id)} />
            {/await}
          {/if}
        </div>

        <div class="detail-slot" aria-live="polite">
          {#if detail}
            <span class="detail-term">{detail.term}</span>
            <span class="detail-text">{detail.text}</span>
          {:else}
            <span class="detail-prompt">Tap a part of the card, or a chip below, to learn what it is.</span>
          {/if}
        </div>

        <div class="chip-row" role="list">
          {#each faceLegend as item}
            <button
              type="button"
              class="part-chip"
              class:active={highlight === item.id}
              aria-pressed={highlight === item.id}
              onclick={() => toggle(item.id)}
            >
              {item.term}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <p class="qr-live">
      That QR code is live. Scan it with your phone and this card's sequence opens.
    </p>
  </section>

  <section class="editorial-section narrow" style="--accent: #14b8a6">
    <span class="section-kicker">The decks</span>
    <h2 class="section-title">Two Ways to Buy</h2>
    <div class="prose">
      <p>
        The LOOP Deck is algorithmically generated: a unique configuration of cards, many
        of which may have never been seen before. It's like opening a pack of Pokémon or
        Magic cards. You don't know what you're going to get, you get a variety pack of
        different levels, and you're not buying the same thing the person next to you
        bought.
      </p>
      <p>
        The T&D Trilogy is the opposite: a curated set, organized by timing and direction,
        the same in every copy so you can learn and reference it deliberately.
      </p>
    </div>
    <div class="deck-links">
      {#each decks as deck}
        {@const cards = deck.id === "loop" ? loopCards : tndCards}
        <a class="deck-link" href={deck.href}>
          {#if browser && cards.length}
            {#await import("$lib/features/store/components/DeckFanCover.svelte") then { default: DeckFanCover }}
              <div class="deck-fan-box">
                <DeckFanCover
                  cards={cards}
                  deckName={deck.name}
                  cardWidth={92}
                  maxCards={5}
                  exactCount={deck.id === "tnd" ? Math.min(6, cards.length) : undefined}
                />
              </div>
            {/await}
          {/if}
          <span class="deck-name">{deck.name}</span>
          <span class="deck-blurb">{deck.blurb}</span>
          <span class="deck-arrow"><i class="fas fa-arrow-right" aria-hidden="true"></i></span>
        </a>
      {/each}
    </div>
  </section>

  <section class="editorial-section narrow" style="--accent: #06b6d4">
    <span class="section-kicker">Getting started</span>
    <h2 class="section-title">New to Notation?</h2>
    <div class="prose">
      <p>
        Start with the free <a href="/learn/guide">Level 1 guide</a>, or read
        <a href="/notation">what flow arts notation is</a>.
      </p>
    </div>
  </section>

  <div class="cta-card narrow">
    <h3>Ready to create?</h3>
    <p>TKA Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open TKA Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>

<style>
  /* One rhythm: prose stays at reading width, only the anatomy diagram
     goes wide. */
  .narrow {
    max-width: 46rem;
    margin-inline: auto;
  }

  @media (min-width: 1100px) {
    .editorial.wide {
      max-width: 76rem;
    }
    /* Anatomy diagram: front labels | cards | back labels. The section
       breaks out of the editorial column and the label columns center
       against the cards, so neither side towers over the other. */
    .anatomy-layout {
      grid-template-columns: minmax(0, 1fr) minmax(0, 2.3fr) minmax(0, 1fr);
      gap: clamp(1.5rem, 2.5vw, 3.25rem);
      align-items: center;
      width: min(100vw - 4rem, 110rem);
      margin-inline: calc((100% - min(100vw - 4rem, 110rem)) / 2);
    }
    .cards-slot {
      order: 0;
    }
    /* Left labels read toward the card they describe. */
    .legend-col.front {
      text-align: right;
    }
    .legend-col.front .legend-row {
      align-items: flex-end;
    }
  }

  .anatomy-section {
    margin-top: 2rem;
  }
  /* The diagram is centered and full-width; its header centers with it. */
  .anatomy-section > :global(.section-kicker),
  .anatomy-section > .section-title,
  .anatomy-section > .anatomy-hint {
    text-align: center;
  }

  .anatomy-hint {
    color: oklch(0.6 0.02 270);
    font-size: 0.9rem;
    margin: -0.4rem 0 1.5rem;
  }

  .qr-live {
    text-align: center;
    color: oklch(0.72 0.012 270);
    font-size: 0.95rem;
    margin: 2rem 0 0;
  }

  .anatomy-layout {
    display: grid;
    gap: 1.75rem;
  }

  /* ---------- mobile single-card layout ---------- */
  .mobile-anatomy {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
    max-width: 30rem;
    margin-inline: auto;
  }

  .face-toggle {
    width: 100%;
    max-width: 18rem;
    margin-inline: auto;
  }

  /* Detail directly under the card. Reserved height so a longer description
     never shoves the chips (no-layout-shift): sized to the wordiest entry. */
  .detail-slot {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-height: 7.5rem;
    padding: 0.9rem 1rem;
    border-radius: 12px;
    border: 1px solid oklch(0.4 0.04 270 / 0.25);
    background: oklch(0.2 0.03 270 / 0.4);
  }
  .detail-term {
    font-weight: 700;
    font-size: 1rem;
    color: oklch(0.95 0.01 270);
  }
  .detail-text {
    font-size: 0.92rem;
    line-height: 1.55;
    color: oklch(0.78 0.015 270);
  }
  .detail-prompt {
    font-size: 0.92rem;
    line-height: 1.55;
    color: oklch(0.62 0.02 270);
    font-style: italic;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
  }
  .part-chip {
    min-height: 44px;
    padding: 0.5rem 0.9rem;
    border-radius: 999px;
    border: 1px solid oklch(0.42 0.04 270 / 0.35);
    background: oklch(0.24 0.03 270 / 0.5);
    color: oklch(0.9 0.01 270);
    font: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 140ms ease, border-color 140ms ease, box-shadow 180ms ease;
  }
  .part-chip.active {
    border-color: color-mix(in oklch, var(--accent, #ec4899) 55%, transparent);
    background: oklch(0.32 0.04 270 / 0.6);
    box-shadow: 0 0 20px color-mix(in oklch, var(--accent, #ec4899) 20%, transparent);
  }
  .part-chip:focus-visible {
    outline: 2px solid oklch(0.7 0.1 275 / 0.7);
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .part-chip {
      transition: none;
    }
  }

  .legend-title {
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: oklch(0.6 0.02 270);
    margin: 0 0 0.6rem;
  }

  .legend-list {
    display: flex;
    flex-direction: column;
  }

  .legend-row {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    align-items: flex-start;
    text-align: left;
    width: 100%;
    min-height: 44px;
    padding: 0.6rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font: inherit;
    transition:
      background 140ms ease,
      opacity 180ms ease,
      box-shadow 180ms ease;
  }
  .legend-row:hover,
  .legend-row:focus-visible,
  .legend-row.active {
    background: oklch(0.3 0.03 270 / 0.22);
  }
  /* Focused pair lights up; every other row steps back. */
  .legend-row.active {
    background: oklch(0.33 0.04 270 / 0.45);
    box-shadow:
      0 0 0 1px color-mix(in oklch, var(--accent, #ec4899) 40%, transparent),
      0 0 22px color-mix(in oklch, var(--accent, #ec4899) 16%, transparent);
  }
  .anatomy-layout.dimming .legend-row:not(.active) {
    opacity: 0.35;
  }
  .anatomy-layout.dimming .legend-title {
    opacity: 0.5;
    transition: opacity 180ms ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .legend-row,
    .anatomy-layout.dimming .legend-title {
      transition: none;
    }
  }
  .legend-row:focus-visible {
    outline: 2px solid oklch(0.7 0.1 275 / 0.7);
    outline-offset: 2px;
  }

  .legend-term {
    font-weight: 650;
    font-size: 0.92rem;
    color: oklch(0.93 0.01 270);
  }

  .legend-text {
    font-size: 0.88rem;
    line-height: 1.5;
    color: oklch(0.72 0.012 270);
  }

  .deck-links {
    display: grid;
    gap: 0.85rem;
    margin-top: 1.25rem;
  }
  @media (min-width: 640px) {
    .deck-links {
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }
    /* The tiles carry card fans now; give the row more shoulder room than
       the reading column so the fans render at a legible size. */
    .deck-links {
      width: min(100%, 58rem);
      margin-inline: auto;
    }
  }
  @media (min-width: 1100px) {
    .deck-links {
      width: 58rem;
      margin-left: calc((46rem - 58rem) / 2);
    }
  }
  .deck-link {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "fan fan"
      "name arrow"
      "blurb arrow";
    align-items: center;
    column-gap: 1rem;
    padding: 1rem 1.25rem 1.1rem;
    min-height: 44px;
    border-radius: 12px;
    border: 1px solid oklch(0.4 0.04 270 / 0.25);
    background: oklch(0.2 0.03 270 / 0.45);
    text-decoration: none;
    transition:
      border-color 0.2s ease,
      background 0.2s ease;
  }
  .deck-fan-box {
    grid-area: fan;
    margin-bottom: 0.5rem;
  }
  .deck-link:hover {
    border-color: var(--accent, #14b8a6);
    background: oklch(0.24 0.03 270 / 0.55);
  }
  .deck-name {
    grid-area: name;
    font-weight: 700;
    color: oklch(0.92 0.01 270);
  }
  .deck-blurb {
    grid-area: blurb;
    font-size: 0.85rem;
    color: oklch(0.65 0.02 270);
  }
  .deck-arrow {
    grid-area: arrow;
    color: var(--accent, #14b8a6);
  }
</style>
