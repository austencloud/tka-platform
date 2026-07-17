<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

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
    <h2 class="section-title">It Started with Pens</h2>
    <div class="prose">
      <p>
        Before the software existed, The Kinetic Alphabet was made with pens. Pens are
        essentially double staves you can hold in one hand. The routine was: draw little
        grids on paper, spend a long time building a sequence with a red pen and a blue
        pen, then draw the corresponding arrows in the same two colors. The system's whole
        visual language grew out of that.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #14b8a6">
    <h2 class="section-title">Staves Are Geometry</h2>
    <div class="prose">
      <p>
        A staff is a straight line, or a combination of lines if you count the thumb end.
        That makes it easy to draw, and it stays out of the arrows' way, which is why
        staff pictographs read so clean. Each staff has two visible ends, a thumb end and
        a pinky end. Put two staves next to each other and they form one extra-long
        straight line: easy to visualize, easy to remember.
      </p>
      <!-- Animation-example slot: same demo sequence rendered with staves.
           Drops in when the per-prop demo component exists (see
           2026-07-16-per-prop-notation-pages-design.md, out of scope note). -->
    </div>
  </section>

  <section class="editorial-section" style="--accent: #ec4899">
    <h2 class="section-title">The Collapse</h2>
    <div class="prose">
      <p>
        Here's the biggest difference between a dual-ended prop and a single-ended one.
        Hold a staff with the thumb end at center and perform an isolation: while the
        thumb end isolates, the pinky end performs an extension. One motion, both shapes
        at once. Do the same move with a club and you have to pick, because a club only
        has one end that can do a thing at a time. So the club world has two moves, an
        isolation and an extension, that look completely different despite having the
        same underlying mathematical geometry. On a staff they collapse into one.
      </p>
      <p>
        The same collapse happens with antispin. A club's antispin forms a vertical or a
        horizontal flower depending on its orientation through the pattern, which is
        where the VTG terms vertical antispin and horizontal antispin come from. A staff
        has both ends covered at once, so the distinction folds away. The
        <a href="/notation/clubs">club page</a> walks the other side of this story.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #f59e0b">
    <h2 class="section-title">Eight Orientations That Read as Four</h2>
    <div class="prose">
      <p>
        A fan or a club visibly points in one of eight directions. All the information is
        on display. A staff is a straight line radiating from center, so those eight
        orientations visually reduce to four, even though all eight exist underneath. And
        since orientation never changes which letter a pictograph is, the reduced visual
        complexity makes patterns easier to tell apart and the concepts easier to absorb.
      </p>
      <p>
        To be clear about what that means: single-ended props display more information
        and explore a wider complexity range. Staves show less, and that's exactly what
        makes them the fastest prop to learn the system on. Every term used here is
        defined in the <a href="/glossary">glossary</a>.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #8b5cf6">
    <h2 class="section-title">A Strict Pedagogy, On Purpose</h2>
    <div class="prose">
      <p>
        The staff pedagogy is deliberately strict: no finger spinning, no grip changes.
        You keep your thumb and pinky references by using the negative space above and
        below the shoulder, and by turning your body to pass into the plane behind you.
        Other props require finger spinning and grip changes, and the system recognizes
        and allows that. The strictness belongs to how we teach staves.
      </p>
      <p>
        It's a scaffold, not a law. Once you've absorbed the math of how orientations
        change well enough to spot the turn value in any pictograph, the strictness stops
        mattering. From there it's just about what the prop can effectively do under its
        own limitations.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #06b6d4">
    <h2 class="section-title">Go Deeper</h2>
    <div class="prose">
      <p>
        Ready to actually learn? <a href="/learn/staff-spinning-choreography">Learn staff
        choreography</a> walks the path from your first isolation to written sequences.
        The <a href="/guide">guide</a> introduces every concept in order, and the
        <a href="/guide/codex">Double Staff Codex</a> collects the pictographs themselves.
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
