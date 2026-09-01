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
    <div class="section-duo">
      <div class="duo-copy">
        <div class="prose">
          <p>
            This page is short because the honest version is short. Fans are single-ended
            props, so they translate from staves the way clubs do: pretend one end of the
            staff got cut off and do everything else the same. A fan's orientation is the
            staff's thumb orientation, the flat face makes it easy to read at a glance,
            and every grid position, letter, and timing relationship applies unchanged.
            The full single-ended story lives on the <a href="/notation/clubs">club
            page</a>, and all of it holds for fans.
          </p>
        </div>
      </div>
      <div class="duo-demo">
        <SequenceHeroDemo
          sequence={demoSequence}
          note="the demo sequence, on fans"
          leftPropType="fan"
          rightPropType="fan"
        />
      </div>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #14b8a6">
    <div class="prose">
      <p>
        What fans have that no tubular prop has is a plane. The leaves form a fan plane
        the way a triad's arms form a triangle plane, and the notation currently assumes
        the prop's plane matches the plane it's being spun on. Folds break that
        assumption. A fold doesn't travel through the grid's two-dimensional space at
        all: it leaves the plane, passes through 3D space, and lands back where it
        started with your hand orientation switched from front to back. Hand orientation
        isn't a concept in The Kinetic Alphabet yet. Mapping the full hand orientation
        matrix into pictographs is on the drawing board, not in the system, and folds are
        so fundamental to fans that this page has to say so plainly: until that piece
        lands, the notation captures less of fan spinning than fan spinners deserve.
      </p>
    </div>
  </section>

  <OpenChapter prop="Fans">
    <p>
      The Kinetic Alphabet was developed on double staves. Fan grips are their own
      language, and secondhand fluency isn't enough to write a chapter people will
      train from.
    </p>
    <p>
      The translation rule, the letters, and the timing are proven, and the composer
      renders fans today. The grip vocabulary, the folds, and the body mechanics that
      belong to fans alone are open territory. If that territory is yours, claim it.
    </p>
  </OpenChapter>

  <div class="cta-card">
    <h3>Spin it yourself</h3>
    <p>Flow Arts Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>
