<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

  const TITLE = "Poi Notation and TKA: What Works | The Kinetic Alphabet";
  const DESCRIPTION =
    "Can you write poi choreography in The Kinetic Alphabet? Many sequences, yes. All of them, no. Here is exactly where poi fits, what works today, and what is planned.";
</script>

<Seo title={TITLE} description={DESCRIPTION} canonical="https://tkaflowarts.com/notation/poi" ogType="article">
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Poi Notation and TKA: What Works",
    "url": "https://tkaflowarts.com/notation/poi",
    "description": "${DESCRIPTION}",
    "inLanguage": "en-US",
    "author": { "@type": "Person", "name": "Austen Cloud", "url": "https://tkaflowarts.com/about" },
    "publisher": { "@type": "Organization", "name": "The Kinetic Alphabet", "url": "https://tkaflowarts.com/" }
  }
  <\/script>`}
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tkaflowarts.com/" },
      { "@type": "ListItem", "position": 2, "name": "Notation", "item": "https://tkaflowarts.com/notation" },
      { "@type": "ListItem", "position": 3, "name": "Poi", "item": "https://tkaflowarts.com/notation/poi" }
    ]
  }
  <\/script>`}
</Seo>

<div class="editorial">
  <header class="editorial-header">
    <h1 class="page-title">Poi Notation</h1>
    <p class="page-subtitle">Where poi fits in The Kinetic Alphabet, honestly</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <h2 class="section-title">The Honest Answer</h2>
    <div class="prose">
      <p>
        Can you write poi choreography in The Kinetic Alphabet? Many sequences, yes. All
        of them, no. Poi can perform a real subset of TKA, and pretending otherwise would
        be marketing. This page says exactly where the line is.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #a855f7">
    <h2 class="section-title">Why Poi Is Different</h2>
    <div class="prose">
      <p>
        TKA is a radial system: every orientation is measured from the prop to your
        center, not relative to the ground. A staff is gripped directly, so gravity does
        not constrain which way it points. You decide.
      </p>
      <p>
        Poi are momentum-based. The head hangs from a tether, and its path answers to
        swing and gravity as much as to your hand. Some written TKA movements assume a
        control over orientation that a tethered head does not give you. Those are the
        sequences poi cannot perform as written.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #ec4899">
    <h2 class="section-title">What Works Today</h2>
    <div class="prose">
      <p>
        A large share of TKA sequences translate to poi directly, and the notation reads
        the same: start position, one letter per beat, letters chaining into a word. If
        you spin poi, you can use the <a href="/guide">guide</a>, the
        <a href="/glossary">glossary</a>, and <a href="/composer">Flow Arts Composer</a>
        today, and most of what you build will be spinnable.
      </p>
      <p>
        If you are choosing a first prop for learning the system itself, double staves
        are the canonical choice, and the
        <a href="/learn/staff-spinning-choreography">staff page</a> explains why.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #f59e0b">
    <h2 class="section-title">Poi Lab Is Planned, Not Built</h2>
    <div class="prose">
      <p>
        A dedicated Poi Lab, a tool that identifies the poi-legal subset of TKA sequence
        by sequence, is planned. It is not built yet, and this page will say so until it
        is. No release date promises.
      </p>
    </div>
  </section>

  <div class="cta-card">
    <h3>Spin poi? Try the composer anyway.</h3>
    <p>Most of what you build will translate. Flow Arts Composer is free to use.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>
