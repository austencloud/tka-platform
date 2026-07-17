<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import OpenChapter from "$lib/shared/landing/components/OpenChapter.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

  const TITLE = "Club Spinning Notation | The Kinetic Alphabet for Clubs";
  const DESCRIPTION =
    "How The Kinetic Alphabet applies to club spinning: what carries over from the staff-built system, what clubs change, and the per-prop questions still open.";
  const URL = "https://tkaflowarts.com/notation/clubs";
</script>

<Seo title={TITLE} description={DESCRIPTION} canonical={URL} ogType="article">
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Club Spinning Notation",
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
      { "@type": "ListItem", "position": 3, "name": "Clubs", "item": "${URL}" }
    ]
  }
  </script>`}
</Seo>

<div class="editorial">
  <a class="back-link" href="/notation">← Flow Arts Notation</a>

  <header class="editorial-header">
    <h1 class="page-title">Club Spinning Notation</h1>
    <p class="page-subtitle">The Kinetic Alphabet, applied to clubs</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <h2 class="section-title">What Carries Over</h2>
    <div class="prose">
      <p>
        This page is about dual-wielded club spinning, one club in each hand, not toss
        juggling. Held that way, clubs are static props: gripped directly, orientation
        fully under your control. So the core of The Kinetic Alphabet applies as written.
        The nine grid positions, the letters, and the timing and direction system describe
        club choreography the same way they describe staff choreography, and
        <a href="/composer">Flow Arts Composer</a> can render a sequence with clubs.
      </p>
      <p>
        New to the system? Start with the <a href="/guide">guide</a>, and keep the
        <a href="/glossary">glossary</a> nearby.
      </p>
      <!-- Animation-example slot: same demo sequence rendered with clubs.
           Drops in when the per-prop demo component exists (see
           2026-07-16-per-prop-notation-pages-design.md, out of scope note). -->
    </div>
  </section>

  <section class="editorial-section" style="--accent: #14b8a6">
    <h2 class="section-title">What Clubs Change</h2>
    <div class="prose">
      <p>
        A club has one reference end, the body, and a handle you grip. That is a real
        departure from the staff's dual-end system, where a consistent thumb reference and
        a consistent pinky reference are both visible at all times.
        <a href="/notation/staves">Double staff notation</a> explains why those two
        references are the foundation everything else stands on.
      </p>
      <p>
        Club spinning also carries its own grip tradition and its own body mechanics.
        Mapping the alphabet onto that vocabulary, honestly and precisely, is per-prop work
        that still needs its practitioner.
      </p>
    </div>
  </section>

  <OpenChapter prop="Clubs">
    <p>
      I trained double staves, and that's where my authority ends. Club grips are their own
      language, and I'm not going to write an authoritative chapter in a language I don't
      speak.
    </p>
    <p>
      What's proven: the positions, letters, and timing carry over to any static prop, and
      the composer renders clubs today. What's open: the club grip language and the body
      mechanics unique to clubs. If clubs are your language, this chapter is yours to
      write.
    </p>
  </OpenChapter>

  <div class="cta-card">
    <h3>Try a sequence with clubs</h3>
    <p>Flow Arts Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>
