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
    <div class="section-duo">
      <div class="duo-copy">
        <div class="prose">
          <p>
            Good news: this is the shortest prop page, because buugeng have two ends, and
            that single fact does most of the work. Everything on the
            <a href="/notation/staves">staff page</a> transfers whole. The isolation and
            antispin collapse, the two visible references, the grid, the letters, the
            timing. Eight rings and double contact ball sit in the same dual-ended family
            and inherit the same way.
          </p>
          <p>
            Two things are worth saying anyway. Buugeng are large, and sometimes strange
            and unwieldy, because they curve around. And finger spinning with buugeng is
            well established. A lot of Kinetic Alphabet patterns might be hard to finger
            spin. Definitely not impossible. It's not my forte, so I'll just say it: feel
            free to finger spin to your heart's desire. The strict thumb-orientation
            discipline belongs to how we teach staves, and once you can read the turn
            value off any pictograph it stops mattering even there.
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

  <OpenChapter prop="Buugeng">
    <p>
      What this page doesn't cover is the part buugeng artists care most about: the grip
      vocabulary, the finger spinning technique, the way the curves change body
      mechanics. I trained double staves, and that chapter needs someone who trained
      these.
    </p>
    <p>If buugeng are your language, come write it.</p>
  </OpenChapter>

  <div class="cta-card">
    <h3>Take it to your buugeng</h3>
    <p>Flow Arts Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>
