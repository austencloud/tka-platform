<script lang="ts">
  import "$lib/shared/landing/styles/public-editorial.css";

  const DESCRIPTION =
    "Sequence poi moves in a written notation: write it down, read it back, reproduce it later.";
</script>

<svelte:head>
  <title>Poi Choreography with The Kinetic Alphabet</title>
  <meta name="description" content={DESCRIPTION} />
  <link rel="canonical" href="https://tkaflowarts.com/learn/poi-choreography" />

  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://tkaflowarts.com/learn/poi-choreography" />
  <meta property="og:title" content="Poi Choreography with The Kinetic Alphabet" />
  <meta property="og:description" content={DESCRIPTION} />
  <meta property="og:image" content="https://tkaflowarts.com/branding/og-image.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Poi Choreography with The Kinetic Alphabet" />
  <meta name="twitter:description" content={DESCRIPTION} />
  <meta name="twitter:image" content="https://tkaflowarts.com/branding/og-image.png" />

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Poi Choreography with The Kinetic Alphabet",
    "url": "https://tkaflowarts.com/learn/poi-choreography",
    "description": "${DESCRIPTION}",
    "inLanguage": "en-US",
    "author": { "@type": "Person", "name": "Austen Cloud", "url": "https://tkaflowarts.com/about" },
    "publisher": {
      "@type": "Organization",
      "name": "The Kinetic Alphabet",
      "url": "https://tkaflowarts.com/"
    }
  }
  </script>`}

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tkaflowarts.com/" },
      { "@type": "ListItem", "position": 2, "name": "Learn", "item": "https://tkaflowarts.com/learn/poi-choreography" },
      { "@type": "ListItem", "position": 3, "name": "Poi Choreography", "item": "https://tkaflowarts.com/learn/poi-choreography" }
    ]
  }
  </script>`}
</svelte:head>

<div class="editorial">
  <header class="editorial-header">
    <h1 class="page-title">Poi Choreography</h1>
    <p class="page-subtitle">Write poi sequences down</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <div class="prose">
      <p>
        Right now, flow arts knowledge lives mostly in videos scattered across the internet.
        Sheet music tells musicians what to play. Scripts tell actors what to say. TKA does
        that for prop movement: write it down, read it back, reproduce it later.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #14b8a6">
    <h2 class="section-title">How Poi Fits TKA</h2>
    <div class="prose">
      <p>
        TKA describes where your hands are and how they move between grid points. That layer
        applies to poi as a subset of the full system, which was designed around double
        staves. If you spin both, the notation transfers directly.
      </p>
      <p>
        A teacher in Portland can send a notated sequence to a student in Berlin. The student
        reads the pictographs and reproduces the movement.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #f59e0b">
    <h2 class="section-title">Start Here</h2>
    <div class="prose">
      <ol>
        <li><a href="/guide/level-1/positions-motions">Positions and motions</a></li>
        <li><a href="/guide/level-1/letters">Letters</a></li>
        <li><a href="/guide/level-1/words">Your first words</a></li>
      </ol>
      <p>
        Spinning staves too? Read
        <a href="/learn/staff-spinning-choreography">the staff choreography page</a>. Staves
        are what the system was designed around.
      </p>
    </div>
  </section>

  <div class="cta-card">
    <h3>Ready to create?</h3>
    <p>TKA Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open TKA Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>
