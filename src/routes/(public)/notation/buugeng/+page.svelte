<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

  const TITLE = "Buugeng Notation for Flow Arts | The Kinetic Alphabet";
  const DESCRIPTION =
    "Write down buugeng choreography with The Kinetic Alphabet. Buugeng are gripped directly, so TKA's grid positions, letters, and turns all apply to a pair of S-staffs.";
</script>

<Seo title={TITLE} description={DESCRIPTION} canonical="https://tkaflowarts.com/notation/buugeng" ogType="article">
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Buugeng Notation for Flow Arts",
    "url": "https://tkaflowarts.com/notation/buugeng",
    "description": "${DESCRIPTION}",
    "inLanguage": "en-US",
    "author": { "@type": "Person", "name": "Austen Cloud", "url": "https://tkaflowarts.com/about" },
    "publisher": { "@type": "Organization", "name": "The Kinetic Alphabet", "url": "https://tkaflowarts.com/" }
  }
  <\/script>`}
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tkaflowarts.com/" },
      { "@type": "ListItem", "position": 2, "name": "Notation", "item": "https://tkaflowarts.com/notation" },
      { "@type": "ListItem", "position": 3, "name": "Buugeng", "item": "https://tkaflowarts.com/notation/buugeng" }
    ]
  }
  <\/script>`}
</Seo>

<div class="editorial">
  <header class="editorial-header">
    <h1 class="page-title">Buugeng Notation</h1>
    <p class="page-subtitle">Writing buugeng choreography in The Kinetic Alphabet</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <h2 class="section-title">Buugeng Speak TKA</h2>
    <div class="prose">
      <p>
        The Kinetic Alphabet writes choreography for dual-wielded props that you grip
        directly. Buugeng, the S-shaped staffs, qualify. Each one sits in your hand,
        points somewhere on the grid, and rotates under your control between positions.
        Every letter, position, and turn count in TKA applies.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #a855f7">
    <h2 class="section-title">Why Writing It Down Helps More Here</h2>
    <div class="prose">
      <p>
        A buugeng's silhouette shifts as it turns. That optical play is the whole appeal,
        and it is also why buugeng choreography is hard to reconstruct from memory or
        video alone. The notation does not care what the shape looks like mid-spin. It
        records what your hands are doing: which grid position, which rotation, how many
        turns. Read the word back and the illusion rebuilds itself.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #ec4899">
    <h2 class="section-title">How Do You Write Down Buugeng Choreography?</h2>
    <div class="prose">
      <p>
        The same way as any TKA sequence. Pick a start position: alpha (hands at opposite
        points), beta (hands at the same point), or gamma (hands at a right angle). Each
        beat is one letter: a pictograph recording where each hand goes and how each
        buugeng rotates on the way. Chain the letters into a word and the word is your
        choreography.
      </p>
      <p>
        <a href="/composer">Flow Arts Composer</a> builds and animates the sequence for
        you, beat by beat, and saves it to your collection.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #06b6d4">
    <h2 class="section-title">Where to Start</h2>
    <div class="prose">
      <p>
        The <a href="/guide">guide</a> teaches the grid, the positions, and the letters.
        The <a href="/glossary">glossary</a> defines every term. Start with either and
        the written sequences begin to read like sentences.
      </p>
    </div>
  </section>

  <div class="cta-card">
    <h3>Ready to write your first buugeng sequence?</h3>
    <p>Flow Arts Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>
