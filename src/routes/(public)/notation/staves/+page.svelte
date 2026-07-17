<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

  const TITLE = "Double Staff Notation | The Kinetic Alphabet for Staves";
  const DESCRIPTION =
    "How The Kinetic Alphabet notates double staff spinning: the thumb and pinky reference system, the technique that preserves it, and exactly what the notation writes down.";
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
    <h2 class="section-title">The Canonical Prop</h2>
    <div class="prose">
      <p>
        The Kinetic Alphabet was built for double staves. When it was first made it was
        called the Double Staff Alphabet. Staves are simple straight lines, so they're easy
        to draw on a page, and a staff looks the same in a pictograph whether its
        orientation is in or out. Single-ended props don't have that property. Every
        pictograph in the system renders cleanly because the prop underneath it is a staff.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #14b8a6">
    <h2 class="section-title">The Thumb and Pinky References</h2>
    <div class="prose">
      <p>
        Each staff has two visible ends. One end is your consistent thumb reference, the
        other is your consistent pinky reference. With proper technique, these references
        never have to change. That dual-end landmark system is the foundation of the entire
        orientation framework: you always know which way the prop is pointing because you
        can see both ends and their relationship to your grip.
      </p>
      <p>
        Fans show their orientation on a visible flat face, and clubs have a clear handle
        end, but neither gives you two consistent references at once. Staves do. That's why
        the system starts here.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #ec4899">
    <h2 class="section-title">The Technique That Keeps Them</h2>
    <div class="prose">
      <p>Two techniques keep the thumb and pinky references consistent through every movement:</p>
      <ol>
        <li>
          Negative space above and below the shoulder: using the open space around your body
          to transition the prop without regripping.
        </li>
        <li>
          Body turns: rotating your body to pass the prop into the plane behind you,
          accomplishing moves that would otherwise force a grip change.
        </li>
      </ol>
      <p>
        These aren't optional refinements. They're how the movements are executed while the
        orientation reference system stays intact.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #f59e0b">
    <h2 class="section-title">What the Notation Writes Down</h2>
    <div class="prose">
      <p>
        The parameter space is precise and finite: nine grid locations (eight around the
        perimeter plus center), eight orientations measured from your center point rather
        than from the ground, and rotation in increments down to 45 degrees. Each beat gets
        one letter that captures both hands at once.
      </p>
      <p>
        Just as important is what it does not enumerate: grip changes, body movement,
        behind-the-back passes, tosses, or contact rolling. TKA is for dual-wielded props.
        Contact staff, balancing and rolling a staff on the body, is a different art and
        not part of the system. Every term used here is defined in the
        <a href="/glossary">glossary</a>.
      </p>
      <!-- Animation-example slot: same demo sequence rendered with staves.
           Drops in when the per-prop demo component exists (see
           2026-07-16-per-prop-notation-pages-design.md, out of scope note). -->
    </div>
  </section>

  <section class="editorial-section" style="--accent: #06b6d4">
    <h2 class="section-title">Go Deeper</h2>
    <div class="prose">
      <p>
        Ready to actually learn? <a href="/learn/staff-spinning-choreography">Learn staff
        choreography</a> walks the path from your first isolation to written sequences. The
        <a href="/guide">guide</a> introduces every concept in order, and the
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
