<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import OpenChapter from "$lib/shared/landing/components/OpenChapter.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

  const TITLE = "Fan Spinning Notation | The Kinetic Alphabet for Fans";
  const DESCRIPTION =
    "How The Kinetic Alphabet applies to fan spinning: the positions, letters, and timing that carry over, what fans change, and the grip questions still waiting for an author.";
  const URL = "https://tkaflowarts.com/notation/fans";
</script>

<Seo title={TITLE} description={DESCRIPTION} canonical={URL} ogType="article">
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Fan Spinning Notation",
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
      { "@type": "ListItem", "position": 3, "name": "Fans", "item": "${URL}" }
    ]
  }
  </script>`}
</Seo>

<div class="editorial">
  <a class="back-link" href="/notation">← Flow Arts Notation</a>

  <header class="editorial-header">
    <h1 class="page-title">Fan Spinning Notation</h1>
    <p class="page-subtitle">The Kinetic Alphabet, applied to fans</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <h2 class="section-title">What Carries Over</h2>
    <div class="prose">
      <p>
        Fans are static props: gripped directly, with the performer in full control of
        orientation. That means the core of The Kinetic Alphabet applies. The nine grid
        positions, the letters, and the timing and direction system all describe fan
        choreography exactly the way they describe staff choreography. A sequence written
        as letters is prop-agnostic, and the animator in
        <a href="/composer">Flow Arts Composer</a>, TKA's choreography software, can
        render it with fans instead of staves.
      </p>
      <p>
        If a term is unfamiliar, the <a href="/glossary">glossary</a> defines all of them,
        and the <a href="/guide">guide</a> teaches the system from zero.
      </p>
      <!-- Animation-example slot: same demo sequence rendered with fans.
           Drops in when the per-prop demo component exists (see
           2026-07-16-per-prop-notation-pages-design.md, out of scope note). -->
    </div>
  </section>

  <section class="editorial-section" style="--accent: #14b8a6">
    <h2 class="section-title">What Fans Change</h2>
    <div class="prose">
      <p>
        A fan shows its orientation on a visible flat face, which makes it easy to read at
        a glance. What it lacks is the dual-end reference system that staves have: a staff
        gives you a consistent thumb end and a consistent pinky end at all times, while a
        fan gives you one reference, the head, and a grip. See
        <a href="/notation/staves">double staff notation</a> for why that dual reference is
        the system's foundation.
      </p>
      <p>
        That difference is not a footnote. Fan spinning has its own grip vocabulary and its
        own body mechanics, and mapping the alphabet onto them cleanly is real per-prop
        work that hasn't been done yet.
      </p>
    </div>
  </section>

  <OpenChapter prop="Fans">
    <p>
      I trained double staves. That's the prop I have authority to speak on. Fans are not a
      language I speak when it comes to grip types, so I'm not going to fake a chapter on
      how the alphabet meets fan grips and pretend it's authoritative.
    </p>
    <p>
      What's proven: the positions, letters, and timing carry over to any static prop, and
      the composer renders fans today. What's open: the fan grip language, and the body
      mechanics that are unique to fans. If fans are the language you speak, this chapter
      is yours to write.
    </p>
  </OpenChapter>

  <div class="cta-card">
    <h3>Try a sequence with fans</h3>
    <p>Flow Arts Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>
