<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import OpenChapter from "$lib/shared/landing/components/OpenChapter.svelte";
  import SequenceHeroDemo from "$lib/shared/landing/components/SequenceHeroDemo.svelte";
  import MandalaContrast from "$lib/shared/landing/components/MandalaContrast.svelte";
  import demoJson from "$lib/shared/landing/data/demo-sequence.json";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import "$lib/shared/landing/styles/public-editorial.css";

  const demoSequence = demoJson as unknown as SequenceData;

  const TITLE = "Club Spinning Notation | The Kinetic Alphabet for Clubs";
  const DESCRIPTION =
    "How The Kinetic Alphabet applies to club spinning: the one-sentence translation rule from staves, why one end splits isolation from extension, and the grip questions still open.";
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
    <p class="page-subtitle">The base single-ended prop</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <h2 class="section-title">Why Clubs Anchor the Single-Ended Story</h2>
    <div class="prose">
      <p>
        This page is about dual-wielded club spinning, one club in each hand, not toss
        juggling. Props split into two families: dual-ended props like staves, where both
        ends are visible references, and single-ended props, where there's one. Clubs are
        the base prop of the single-ended family. They're the easiest prop to explain the
        single-ended story with, and they're the core of Vulcan Tech Gospel, the notation
        framework TKA is built on. The lineage lives on the <a href="/roots">roots
        page</a>.
      </p>
    </div>
  </section>

  <section class="editorial-section has-duo" style="--accent: #14b8a6">
    <h2 class="section-title">The Translation Rule</h2>
    <div class="section-duo">
      <div class="duo-copy">
        <div class="prose">
          <p>
            Translating The Kinetic Alphabet from staves to clubs takes one sentence:
            pretend you're holding a staff and one end of it is invisible, or got cut off,
            and do everything exactly the way you would with the staff. A club's
            orientation is the same concept as a staff's thumb orientation. The grid
            positions, the letters, and the timing and direction system apply unchanged.
          </p>
          <p>
            The player beside this proves it: the same demo sequence every prop page
            uses, spun on clubs, letter for letter.
          </p>
        </div>
      </div>
      <div class="duo-demo">
        <SequenceHeroDemo
          sequence={demoSequence}
          note="the demo sequence, on clubs"
          bluePropType="club"
          redPropType="club"
        />
      </div>
    </div>
  </section>

  <section class="editorial-section has-duo" style="--accent: #ec4899">
    <h2 class="section-title">One End, Two Moves</h2>
    <div class="section-duo flip">
      <div class="duo-copy">
        <div class="prose">
          <p>
            On a staff, an isolation and an extension are one motion: the thumb end
            isolates while the pinky end extends. A club can only do one of those at a
            time, so the club world has two distinct moves, an isolation and an
            extension, that look completely different despite having the same underlying
            mathematical geometry.
          </p>
          <p>
            Antispin splits the same way. A club's antispin reads as a vertical flower or
            a horizontal flower depending on its orientation through the pattern, which
            is exactly what the VTG terms vertical antispin and horizontal antispin name.
            On a staff those variants collapse, because both ends are always covered. The
            <a href="/notation/staves">staff page</a> tells that side of the story.
          </p>
          <p>
            The mandalas beside this trace the same sequence twice. With staves, both
            ends of each prop leave a path. With clubs, only one end does, and half the
            pattern disappears.
          </p>
        </div>
      </div>
      <div class="duo-demo">
        <MandalaContrast
          sequence={demoSequence}
          note="one sequence, traced by both ends of a staff and the single end of a club"
        />
      </div>
    </div>
  </section>

  <OpenChapter prop="Clubs">
    <p>
      I trained double staves, and the geometry above is solid ground. Club grip technique
      is not. Clubs ask for finger spinning and grip changes the staff pedagogy
      deliberately avoids, and that vocabulary deserves an author who actually lives in
      it.
    </p>
    <p>
      What's proven: the translation rule, the letters, and the timing all carry over, and
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
