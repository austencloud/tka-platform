<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import OpenChapter from "$lib/shared/landing/components/OpenChapter.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

  const TITLE = "Buugeng Notation | The Kinetic Alphabet for Buugeng";
  const DESCRIPTION =
    "How The Kinetic Alphabet applies to buugeng: the positions, letters, and timing that carry over, what the S-shaped prop changes, and the open per-prop questions.";
  const URL = "https://tkaflowarts.com/notation/buugeng";
</script>

<Seo title={TITLE} description={DESCRIPTION} canonical={URL} ogType="article">
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Buugeng Notation",
    "url": "${URL}",
    "description": "${DESCRIPTION}",
    "inLanguage": "en-US",
    "author": { "@type": "Person", "name": "Austen Cloud", "url": "https://tkaflowarts.com/about" },
    "publisher": { "@type": "Organization", "name": "The Kinetic Alphabet", "url": "https://tkaflowarts.com/" }
  }
  </script>`}
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tkaflowarts.com/" },
      { "@type": "ListItem", "position": 2, "name": "Notation", "item": "https://tkaflowarts.com/notation" },
      { "@type": "ListItem", "position": 3, "name": "Buugeng", "item": "${URL}" }
    ]
  }
  </script>`}
</Seo>

<div class="editorial">
  <a class="back-link" href="/notation">← Flow Arts Notation</a>

  <header class="editorial-header">
    <h1 class="page-title">Buugeng Notation</h1>
    <p class="page-subtitle">The Kinetic Alphabet, applied to buugeng</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <h2 class="section-title">What Carries Over</h2>
    <div class="prose">
      <p>
        Buugeng are static props: gripped directly, with orientation fully under the
        performer's control. The core of The Kinetic Alphabet applies. The nine grid
        positions, the letters, and the timing and direction system describe buugeng
        choreography the same way they describe staff choreography, and
        <a href="/composer">Flow Arts Composer</a> can render a written sequence with
        buugeng.
      </p>
      <p>
        Every term is defined in the <a href="/glossary">glossary</a>, and the
        <a href="/guide">guide</a> teaches the system from the beginning.
      </p>
      <!-- Animation-example slot: same demo sequence rendered with buugeng.
           Drops in when the per-prop demo component exists (see
           2026-07-16-per-prop-notation-pages-design.md, out of scope note). -->
    </div>
  </section>

  <section class="editorial-section" style="--accent: #14b8a6">
    <h2 class="section-title">What Buugeng Change</h2>
    <div class="prose">
      <p>
        Buugeng are closer to staves than fans or clubs are: like a staff, a buugeng has
        two ends. But the prop is an asymmetric S-curve rather than a straight line, the
        two halves can nest together, and much of the art form lives in the optical
        illusions that shape creates. A straight-line pictograph reads a buugeng's position
        and orientation correctly, and it deliberately says nothing about the illusion
        layer, which is exactly the part buugeng artists care most about.
      </p>
      <p>
        How the alphabet should meet buugeng grip changes and the illusion vocabulary is
        open per-prop territory.
      </p>
    </div>
  </section>

  <OpenChapter prop="Buugeng">
    <p>
      I trained double staves. Buugeng grips and the illusion tradition are their own
      language, and I won't pretend to write its chapter with authority I don't have.
    </p>
    <p>
      What's proven: the positions, letters, and timing carry over to any static prop, and
      the composer renders buugeng today. What's open: the buugeng grip language, the
      nesting vocabulary, and how notation should relate to the illusion layer. If buugeng
      are your language, this chapter is yours to write.
    </p>
  </OpenChapter>

  <div class="cta-card">
    <h3>Try a sequence with buugeng</h3>
    <p>Flow Arts Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>
