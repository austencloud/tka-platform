<script lang="ts">
  import "$lib/shared/landing/styles/public-editorial.css";

  const DESCRIPTION =
    "Each card is a sequence. Scan the QR code. Watch it animate. Learn it with your body.";

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
</script>

<svelte:head>
  <title>Choreo Cards: Choreography You Can Hold, Scan, and Learn | TKA Shop</title>
  <meta name="description" content={DESCRIPTION} />
  <link rel="canonical" href="https://tkaflowarts.com/shop/choreography-cards" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://tkaflowarts.com/shop/choreography-cards" />
  <meta property="og:title" content="Choreo Cards: Choreography You Can Hold, Scan, and Learn" />
  <meta property="og:description" content={DESCRIPTION} />
  <meta property="og:image" content="https://tkaflowarts.com/branding/og-image.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Choreo Cards: Choreography You Can Hold, Scan, and Learn" />
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

<div class="editorial">
  <header class="editorial-header">
    <h1 class="page-title">Choreo Cards</h1>
    <p class="page-subtitle">Choreography you can hold, scan, and learn</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <div class="prose">
      <p>
        I built TKA because I wanted to write down what my hands were doing. A letter for
        every movement a staff can make. Letters combined into sequences. Sequences became
        cards.
      </p>
      <p>
        The app is free at tkaflowarts.com. The cards are the physical version. Shuffle
        through them at a festival, hand one to a friend, spread them across a table and
        study the patterns.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #14b8a6">
    <h2 class="section-title">The Decks</h2>
    <div class="prose">
      <p>
        Each deck contains every possible sequence for its configuration. The complete
        mathematical space. Not a curated selection.
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

  <section class="editorial-section" style="--accent: #ec4899">
    <h2 class="section-title">How the Cards Work</h2>
    <div class="prose">
      <p>Each card is a sequence. Scan the QR code. Watch it animate. Learn it with your body.</p>
      <p>
        Poker size, 2.5 x 3.5 inches. Front: the sequence as pictographs. Back: a mandala
        generated from the sequence itself.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #f59e0b">
    <h2 class="section-title">Built on VTG</h2>
    <div class="prose">
      <p>
        TKA was built on the foundation of Vulcan Tech Gospel (VTG), created by Noel Yee and
        spinners at the Vulcan Lofts in Oakland. VTG gave flow arts its first shared language
        for timing and direction. TKA takes that foundation and adds a combined notation:
        both hands described together in a single letter. The VTG categories are still here,
        built into every card as a classification layer.
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

<style>
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
