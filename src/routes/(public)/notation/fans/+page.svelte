<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import OpenChapter from "$lib/shared/landing/components/OpenChapter.svelte";
  import SequenceHeroDemo from "$lib/shared/landing/components/SequenceHeroDemo.svelte";
  import demoJson from "$lib/shared/landing/data/demo-sequence.json";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import "$lib/shared/landing/styles/public-editorial.css";

  const demoSequence = demoJson as unknown as SequenceData;

  const TITLE = "Fan Spinning Notation | The Kinetic Alphabet for Fans";
  const DESCRIPTION =
    "How The Kinetic Alphabet applies to fan spinning: the translation from staves, and folds, the plane-crossing move the notation honestly can't write down yet.";
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

  <section class="editorial-section has-duo" style="--accent: #22c55e">
    <h2 class="section-title">What Carries Over</h2>
    <div class="section-duo">
      <div class="duo-copy">
        <div class="prose">
          <p>
            Fans are single-ended props, so they translate the same way clubs do: pretend
            you're holding a staff with one end cut off and do everything exactly the
            same. A fan's orientation is the same concept as a staff's thumb orientation,
            and the flat face makes it easy to read at a glance. The grid positions, the
            letters, and the timing and direction system apply unchanged. The
            <a href="/notation/clubs">club page</a> explains the single-ended story in
            full, and the <a href="/glossary">glossary</a> defines every term.
          </p>
          <p>
            The player beside this is the same demo sequence every prop page uses, spun
            on fans.
          </p>
        </div>
      </div>
      <div class="duo-demo">
        <SequenceHeroDemo
          sequence={demoSequence}
          note="the demo sequence, on fans"
          bluePropType="fan"
          redPropType="fan"
        />
      </div>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #14b8a6">
    <h2 class="section-title">Folds: What the Notation Can't Write Yet</h2>
    <div class="prose">
      <p>
        Fans are planar props: the leaves form a plane, the way a triad's arms form a
        triangle plane. The notation currently assumes the prop's plane matches the plane
        it's being spun on. Fans break that assumption with folds. A fold doesn't travel
        through the two-dimensional space of the grid at all. It leaves the plane, moves
        through 3D space, and lands back on the same plane with your hand orientation
        switched from front to back.
      </p>
      <p>
        Hand orientation isn't a concept in The Kinetic Alphabet yet. Mapping the full
        hand orientation matrix into pictographs is a large missing piece, and folds are
        so fundamental to fans that this page has to say so plainly: there are ideas, they
        haven't been incorporated, and until they are, the notation captures less of fan
        spinning than fan spinners deserve.
      </p>
    </div>
  </section>

  <OpenChapter prop="Fans">
    <p>
      I trained double staves. Fans are not a language I fully speak when it comes to grip
      types, so I'm not going to fake a chapter on how the alphabet meets fan grips and
      pretend it's authoritative.
    </p>
    <p>
      What's proven: the translation rule, the letters, and the timing carry over, and the
      composer renders fans today. What's open: the fan grip language, the fold
      vocabulary, and the body mechanics unique to fans. If fans are the language you
      speak, this chapter is yours to write.
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
