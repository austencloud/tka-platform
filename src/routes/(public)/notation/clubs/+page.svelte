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

  <section class="editorial-section has-duo" style="--accent: #22c55e">
    <div class="section-duo">
      <div class="duo-copy">
        <div class="prose">
          <p>
            First, what this page is not about: toss juggling. This is
            dual-wielded club spinning, one club in each hand, gripped the whole
            time. Held that way, clubs are the base prop of the single-ended
            family. They're the easiest prop to explain the single-ended story
            with, and they're the core of Vulcan Tech Gospel, the framework The
            Kinetic Alphabet is built on. The lineage lives on the <a
              href="/notation">notation page</a
            >.
          </p>
          <p>
            Translating the alphabet from staves to clubs takes one sentence.
            Pretend you're holding a staff whose other end is invisible, or got
            cut off, and do everything exactly the way you would with the staff.
            A club's orientation is the staff's thumb orientation, and the rest
            follows: same grid, same letters, same timing, as the player beside
            this shows.
          </p>
        </div>
      </div>
      <div class="duo-demo">
        <SequenceHeroDemo
          sequence={demoSequence}
          note="the demo sequence, on clubs"
          leftPropType="club"
          rightPropType="club"
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
            The two mandalas trace the identical sequence. In the staff render,
            both ends of each prop leave a path. In the club render, one does.
            Half the pattern is gone, and that missing half is where the
            single-ended vocabulary comes from. On a staff, an isolation and an
            extension are one motion, the thumb end isolating while the pinky
            end extends. A club can only do one at a time, so club spinners know
            them as two moves that look nothing alike despite identical
            underlying geometry. Antispin splits too: a club's antispin reads as
            a vertical or a horizontal flower depending on its orientation
            through the pattern, which is exactly what VTG's vertical antispin
            and horizontal antispin name. On a staff those distinctions fold
            away. The
            <a href="/notation/staves">staff page</a> tells that side.
          </p>
        </div>
      </div>
      <div class="duo-demo">
        <MandalaContrast
          sequence={demoSequence}
          note="same sequence, both staff ends vs a club's single end"
        />
      </div>
    </div>
  </section>

  <OpenChapter prop="Clubs">
    <p>
      The geometry above is solid ground. Club grip technique is not: the
      alphabet grew up on double staves, and clubs ask for finger spinning and
      grip changes the staff pedagogy deliberately avoids.
    </p>
    <p>
      That vocabulary deserves an author who lives in it. If clubs are your
      language, this chapter is yours to write.
    </p>
  </OpenChapter>

  <div class="cta-card">
    <h3>Try it with clubs</h3>
    <p>Flow Arts Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>
