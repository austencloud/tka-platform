<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import OpenChapter from "$lib/shared/landing/components/OpenChapter.svelte";
  import SequenceHeroDemo from "$lib/shared/landing/components/SequenceHeroDemo.svelte";
  import demoJson from "$lib/shared/landing/data/demo-sequence.json";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import "$lib/shared/landing/styles/public-editorial.css";

  const demoSequence = demoJson as unknown as SequenceData;

  const TITLE = "Buugeng Notation | The Kinetic Alphabet for Buugeng";
  const DESCRIPTION =
    "How The Kinetic Alphabet applies to buugeng: dual-ended like staves, so the notation carries over directly, with finger spinning welcomed where the staff pedagogy is strict.";
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
    <p class="page-subtitle">Dual-ended, like staves</p>
  </header>

  <section class="editorial-section has-duo" style="--accent: #22c55e">
    <h2 class="section-title">Buugeng Work Like Staves</h2>
    <div class="section-duo">
      <div class="duo-copy">
        <div class="prose">
          <p>
            Buugeng have two ends, which puts them in the staff family alongside props
            like eight rings and double contact ball. That matters because the dual-ended
            properties that make staves the system's home apply to buugeng directly: the
            isolation and antispin collapse, the two visible references, the whole
            notation. The <a href="/notation/staves">staff page</a> explains those
            properties; everything there transfers. The grid positions, the letters, and
            the timing and direction system apply unchanged.
          </p>
          <p>
            The player beside this is the same demo sequence every prop page uses, spun
            on buugeng.
          </p>
        </div>
      </div>
      <div class="duo-demo">
        <SequenceHeroDemo
          sequence={demoSequence}
          note="the demo sequence, on buugeng"
          bluePropType="buugeng"
          redPropType="buugeng"
        />
      </div>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #14b8a6">
    <h2 class="section-title">Big, Curved, and Finger-Spun</h2>
    <div class="prose">
      <p>
        Buugeng are large, and sometimes strange and unwieldy, because they curve around.
        Finger spinning with buugeng is well established and a lot of people do it. Plenty
        of Kinetic Alphabet patterns might be hard to finger spin, but definitely not
        impossible. It's not my forte, so I'll say it plainly: if you spin buugeng, feel
        free to finger spin to your heart's desire.
      </p>
      <p>
        The strict thumb-orientation discipline belongs to how we teach staves. It's a
        scaffold. Once you've absorbed the math of how orientations change well enough to
        spot the turn value in any pictograph, the strictness stops mattering, and it
        becomes about what the prop can effectively do under its own limitations.
      </p>
    </div>
  </section>

  <OpenChapter prop="Buugeng">
    <p>
      I trained double staves. The buugeng grip vocabulary, the finger spinning technique,
      and the way the curves change body mechanics are a language of their own, and I
      won't pretend to write that chapter with authority I don't have.
    </p>
    <p>
      What's proven: buugeng are dual-ended, so the notation carries over directly, and
      the composer renders buugeng today. What's open: the grip and finger spinning
      language unique to buugeng. If buugeng are your language, this chapter is yours to
      write.
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
