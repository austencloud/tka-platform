<script lang="ts">
  import { browser } from "$app/environment";
  import "$lib/shared/landing/styles/public-editorial.css";

  const DESCRIPTION =
    "Choreo Cards: the newest technology in flow arts notation. Each card holds a sequence. Scan the QR code, visualize it with any prop at any speed, and save it to your catalog.";

  const decks = [
    {
      name: "LOOP Deck",
      href: "/shop/loop-deck",
      blurb: "Looping sequences that end where they start.",
    },
    {
      name: "T&D Trilogy",
      href: "/shop/tnd-trilogy",
      blurb: "Three decks organized by timing and direction.",
    },
  ];

  const frontLegend = [
    { n: 1, text: "The sequence's word, spelled in TKA letters." },
    { n: 2, text: "The start position: where the sequence starts and ends." },
    { n: 3, text: "The sequence itself, step by step, as pictographs." },
    {
      n: 4,
      text: "The mandalas that show in blue and red what the sequence looks like when performed.",
    },
    {
      n: 5,
      text: "The QR code. Scan it to immediately visualize this sequence with any prop at any speed, save it to your personal catalog, and open practice mode.",
    },
  ];

  const backLegend = [
    {
      n: 6,
      text: "Top left: the turn pattern. How many extra rotations the sequence carries, and whether there's a pattern in that too.",
    },
    {
      n: 7,
      text: "Top right: the reversal pattern. A simple glyph showing whether the props alternate spin direction over the course of the pattern.",
    },
    {
      n: 8,
      text: "Center: a combination of the two mandalas, plus the difficulty level (the Kinetic Alphabet is built into clear tiers of difficulty) and the LOOP type, rotated being the most common and most understandable one.",
    },
    {
      n: 9,
      text: "Bottom left: the start position, which shows you where the sequence starts and ends, and the prop that sequence is using on that card.",
    },
    { n: 10, text: "Bottom right: the number of steps in the sequence." },
  ];
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

  <div class="pair">
    <section class="editorial-section" style="--accent: #22c55e">
      <div class="prose">
        <p>
          Each card holds a sequence. Scan the QR code and it takes you to a page where you
          can immediately visualize that sequence with any prop at any speed, save it to
          your own personal catalog so you can keep track of all of your sequences, and
          open a practice mode that lets you learn the sequence at your own pace.
        </p>
      </div>
    </section>

    <section class="editorial-section" style="--accent: #14b8a6">
      <h2 class="section-title">Every Deck Is Different</h2>
      <div class="prose">
        <p>
          Every deck is algorithmically generated, a unique configuration of cards, many of
          which may have never been seen before. It's like opening a pack of Pokémon or
          Magic cards: you don't know what you're going to get, and you get a variety pack
          of different levels. You're not buying the same thing the person next to you
          bought.
        </p>
      </div>
      <div class="deck-links">
        {#each decks as deck}
          <a class="deck-link" href={deck.href}>
            <span class="deck-name">{deck.name}</span>
            <span class="deck-blurb">{deck.blurb}</span>
            <span class="deck-arrow"><i class="fas fa-arrow-right" aria-hidden="true"></i></span>
          </a>
        {/each}
      </div>
    </section>
  </div>

  <section class="editorial-section anatomy-section" style="--accent: #ec4899">
    <h2 class="section-title">What's on the Card</h2>

    {#if browser}
      {#await import("$lib/features/store/components/CardAnatomy.svelte") then { default: CardAnatomy }}
        <CardAnatomy />
      {/await}
    {/if}

    <div class="legend">
      <div class="legend-col">
        <h3 class="legend-title">Front</h3>
        <ol class="legend-list">
          {#each frontLegend as item}
            <li>
              <span class="legend-badge">{item.n}</span>
              <span>{item.text}</span>
            </li>
          {/each}
        </ol>
      </div>
      <div class="legend-col">
        <h3 class="legend-title">Back</h3>
        <ol class="legend-list">
          {#each backLegend as item}
            <li>
              <span class="legend-badge">{item.n}</span>
              <span>{item.text}</span>
            </li>
          {/each}
        </ol>
      </div>
    </div>
  </section>

  <div class="pair">
    <section class="editorial-section" style="--accent: #f59e0b">
      <h2 class="section-title">Built on VTG</h2>
      <div class="prose">
        <p>
          This was built on a foundation of what Vulcan Tech Gospel did before it. VTG
          holds the basis for this. TKA is the child of VTG in a way, and we pay respects
          to it by taking it further. What TKA does has unique properties VTG cannot and
          would not ever cover.
        </p>
      </div>
    </section>

    <section class="editorial-section" style="--accent: #06b6d4">
      <h2 class="section-title">New to Notation?</h2>
      <div class="prose">
        <p>
          Start with the free <a href="/guide/level-1">Level 1 guide</a>, or read
          <a href="/notation">what flow arts notation is</a>.
        </p>
      </div>
    </section>
  </div>
</div>

<style>
  /* Desktop uses the width: widen the editorial column and pair sections
     side by side. Mobile keeps the single readable column. */
  @media (min-width: 1100px) {
    .editorial.wide {
      max-width: 76rem;
    }
    .pair {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2.5rem;
      align-items: start;
    }
    .legend {
      grid-template-columns: 1fr 1fr;
    }
  }

  .anatomy-section {
    margin-top: 2rem;
  }

  .legend {
    display: grid;
    gap: 1.5rem;
    margin-top: 1.75rem;
  }

  .legend-title {
    font-size: 0.85rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: oklch(0.65 0.02 270);
    margin: 0 0 0.75rem;
  }

  .legend-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .legend-list li {
    display: flex;
    gap: 0.7rem;
    align-items: flex-start;
    color: oklch(0.85 0.01 270);
    line-height: 1.55;
  }

  .legend-badge {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    color: #0b0b14;
    background: #fbbf24;
    margin-top: 0.1rem;
  }

  .deck-links {
    display: grid;
    gap: 0.85rem;
    margin-top: 1.25rem;
  }
  .deck-link {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "name arrow"
      "blurb arrow";
    align-items: center;
    column-gap: 1rem;
    padding: 1rem 1.25rem;
    min-height: 44px;
    border-radius: 12px;
    border: 1px solid oklch(0.4 0.04 270 / 0.25);
    background: oklch(0.2 0.03 270 / 0.45);
    text-decoration: none;
    transition:
      border-color 0.2s ease,
      background 0.2s ease;
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
