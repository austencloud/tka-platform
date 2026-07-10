<script lang="ts">
  import "$lib/shared/landing/styles/public-editorial.css";

  const DESCRIPTION =
    "Write it down, read it back, reproduce it later. A free guide to staff choreography you can read on paper.";
</script>

<svelte:head>
  <title>Learn Staff Choreography with The Kinetic Alphabet</title>
  <meta name="description" content={DESCRIPTION} />
  <link rel="canonical" href="https://tkaflowarts.com/learn/staff-spinning-choreography" />

  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://tkaflowarts.com/learn/staff-spinning-choreography" />
  <meta property="og:title" content="Learn Staff Choreography with The Kinetic Alphabet" />
  <meta property="og:description" content={DESCRIPTION} />
  <meta property="og:image" content="https://tkaflowarts.com/branding/og-image.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Learn Staff Choreography with The Kinetic Alphabet" />
  <meta name="twitter:description" content={DESCRIPTION} />
  <meta name="twitter:image" content="https://tkaflowarts.com/branding/og-image.png" />

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Learn Staff Choreography with The Kinetic Alphabet",
    "url": "https://tkaflowarts.com/learn/staff-spinning-choreography",
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
      { "@type": "ListItem", "position": 2, "name": "Learn", "item": "https://tkaflowarts.com/learn/staff-spinning-choreography" },
      { "@type": "ListItem", "position": 3, "name": "Staff Choreography", "item": "https://tkaflowarts.com/learn/staff-spinning-choreography" }
    ]
  }
  </script>`}
</svelte:head>

<div class="editorial">
  <header class="editorial-header">
    <h1 class="page-title">Learn Staff Choreography</h1>
    <p class="page-subtitle">Choreography you can write down</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <div class="prose">
      <p>
        Flow arts is young. Most spinners learn alone, develop their own vocabulary, and have
        a hard time collaborating with people who learned differently.
      </p>
      <p>
        When patterns are written down, choreographers can share and build on each other's
        work. You can also archive your own material and actually find it again months later.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #14b8a6">
    <h2 class="section-title">Why Staves</h2>
    <div class="prose">
      <p>
        TKA was built for double staves. Each staff has two visible ends: one is a consistent
        thumb reference, the other a consistent pinky reference. With proper technique those
        references never change, which is what keeps written choreography readable
        mid-sequence.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #ec4899">
    <h2 class="section-title">The Level System</h2>
    <div class="prose">
      <p>
        The level system starts simple and gets denser, so you set your own pace. A beginner
        at Level 1 works with 6 possible single-hand motions from any grid point. By Level 5,
        that number grows to 129.
      </p>
      <p>
        It tracks individual parts, which helps if you struggle with memory or executive
        function.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #f59e0b">
    <h2 class="section-title">Your First Session</h2>
    <div class="prose">
      <ol>
        <li><a href="/guide/level-1/positions-motions">Positions and motions</a></li>
        <li><a href="/guide/level-1/letters">Letters</a></li>
        <li><a href="/guide/level-1/words">Your first words</a></li>
      </ol>
      <p>
        If you care more about theatrical performance than technical patterns, that's fine.
        Learn the notation, then forget about it while you perform.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #06b6d4">
    <h2 class="section-title">Practice Tools</h2>
    <div class="prose">
      <ul>
        <li>The app animates any sequence at any speed. Free, no download required.</li>
        <li>
          <a href="/shop/choreography-cards">Choreo Cards</a> make practice physical.
        </li>
      </ul>
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
