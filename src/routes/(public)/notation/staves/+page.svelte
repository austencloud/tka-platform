<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import SequenceHeroDemo from "$lib/shared/landing/components/SequenceHeroDemo.svelte";
  import demoJson from "$lib/shared/landing/data/demo-sequence.json";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import "$lib/shared/landing/styles/public-editorial.css";

  const demoSequence = demoJson as unknown as SequenceData;

  const TITLE = "Double Staff Notation | The Kinetic Alphabet for Staves";
  const DESCRIPTION =
    "How The Kinetic Alphabet notates double staff spinning: why the system started on staves, the isolation and antispin collapse, and why fewer visual combinations make it the fastest prop to learn on.";
  const URL = "https://tkaflowarts.com/notation/staves";
</script>

<Seo title={TITLE} description={DESCRIPTION} canonical={URL} ogType="article">
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Double Staff Notation",
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
      { "@type": "ListItem", "position": 3, "name": "Staves", "item": "${URL}" }
    ]
  }
  </script>`}
</Seo>

<div class="editorial">
  <a class="back-link" href="/notation">← Flow Arts Notation</a>

  <header class="editorial-header">
    <h1 class="page-title">Double Staff Notation</h1>
    <p class="page-subtitle">The prop The Kinetic Alphabet was built for</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <div class="prose">
      <p>
        Before the software existed, The Kinetic Alphabet was made with pens. Pens are
        essentially double staves you can hold in one hand, so for the first couple of
        years the whole system lived on paper: draw a little grid, spend a long time
        building a sequence with a red pen and a blue pen, then draw the arrows in the
        same two colors. When a sequence worked, it got a page. That's the entire origin
        story. Not a whiteboard, not an app. Two pens.
      </p>
      <p>
        Staves stuck because staves are geometry. A staff is a straight line, or a
        combination of lines if you count the thumb end, so it's easy to draw and it
        stays out of the arrows' way, which is why staff pictographs read so clean. Put
        two staves next to each other and they form one extra-long straight line. Easy to
        visualize. Easy to remember.
      </p>
    </div>
  </section>

  <section class="editorial-section has-duo" style="--accent: #14b8a6">
    <div class="section-duo">
      <div class="duo-copy">
        <div class="prose">
          <p>
            The deeper reason the system starts on staves takes a minute to see, and it
            starts with the fact that each staff has two visible ends, a thumb end and a
            pinky end. Hold a staff with the thumb end at center and perform an
            isolation. While the thumb end isolates, the pinky end performs an extension.
            One motion, both shapes at once. Try the same move with a club and you have
            to pick, because a club only has one end that can do a thing at a time,
            which is why club spinners have two moves, an isolation and an extension,
            that look completely different despite identical underlying geometry. On a
            staff they collapse into one thing. Antispin folds the same way: the
            vertical-flower and horizontal-flower variants that VTG names for one-ended
            props are always both covered on a staff. The
            <a href="/notation/clubs">club page</a> walks the other side of this story.
          </p>
          <p>
            The collapse runs all the way down. A fan or a club visibly points in one of
            eight directions, all the information on display. A staff radiating from
            center makes those eight orientations look like four, and since orientation
            never changes which letter a pictograph is, patterns get easier to tell apart
            and the concepts get easier to absorb. Single-ended props show more and
            explore the wider complexity range. Staves show less.
          </p>
          <p>That's the whole trick. Less to look at, faster to learn.</p>
        </div>
      </div>
      <div class="duo-demo">
        <SequenceHeroDemo sequence={demoSequence} note="the demo sequence, on staves" />
      </div>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #8b5cf6">
    <div class="prose">
      <p>
        One admission, because it's true and I'd rather say it than have you discover it:
        the staff pedagogy is strict on purpose. No finger spinning, no grip changes. You
        keep your thumb and pinky references by using the negative space above and below
        the shoulder, and by turning your body to pass into the plane behind you. Other
        props require finger spinning and grip changes, and the system recognizes and
        allows that. The strictness belongs to how we teach staves, and even there it's a
        scaffold, not a law. Once you've absorbed the math of how orientations change
        well enough to spot the turn value in any pictograph, the strictness stops
        mattering and it becomes about what the prop can effectively do under its own
        limitations.
      </p>
      <p>
        When you're ready to actually learn, <a href="/learn/staff-spinning-choreography">learn
        staff choreography</a> walks from your first isolation to written sequences, the
        <a href="/guide">guide</a> introduces every concept in order, the
        <a href="/guide/codex">Double Staff Codex</a> collects the pictographs
        themselves, and the <a href="/glossary">glossary</a> defines every term I've used
        here.
      </p>
    </div>
  </section>

  <div class="cta-card">
    <h3>Write your first sequence</h3>
    <p>Flow Arts Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>
