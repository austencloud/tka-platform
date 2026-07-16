<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

  const TITLE = "Fan Notation for Flow Arts | The Kinetic Alphabet";
  const DESCRIPTION =
    "Write down fan choreography with The Kinetic Alphabet. Fans are gripped directly, so every grid position, letter, and turn in TKA notation applies to a pair of fans.";
</script>

<Seo title={TITLE} description={DESCRIPTION} canonical="https://tkaflowarts.com/notation/fans" ogType="article">
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Fan Notation for Flow Arts",
    "url": "https://tkaflowarts.com/notation/fans",
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
      { "@type": "ListItem", "position": 3, "name": "Fans", "item": "https://tkaflowarts.com/notation/fans" }
    ]
  }
  <\/script>`}
</Seo>

<div class="editorial">
  <header class="editorial-header">
    <h1 class="page-title">Fan Notation</h1>
    <p class="page-subtitle">Writing fan choreography in The Kinetic Alphabet</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <h2 class="section-title">Fans Speak TKA</h2>
    <div class="prose">
      <p>
        The Kinetic Alphabet writes choreography for dual-wielded props that you grip
        directly. Fans qualify. Every position on the grid, every letter, and every turn
        count that works for staves works for a pair of fans.
      </p>
      <p>
        A fan makes its orientation easy to read: the flat face shows you which way it
        points. That visibility is one reason fans are a popular prop to bring to TKA
        after staves.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #14b8a6">
    <h2 class="section-title">What Changes from Staves</h2>
    <div class="prose">
      <p>
        TKA was designed around double staves. Each staff has two visible ends: one is
        your thumb reference, the other your pinky reference, and with proper technique
        those references never change. A fan does not have that dual-end landmark. You
        track its orientation by the face instead.
      </p>
      <p>
        That is the whole difference. The letters do not change. The grid does not
        change. Only the landmark you watch changes. If you want the full story of why
        staves are the canonical prop, it lives on the
        <a href="/notation">notation page</a>.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #ec4899">
    <h2 class="section-title">How Do You Write Down Fan Choreography?</h2>
    <div class="prose">
      <p>
        The same way you write any TKA sequence. Pick a start position: alpha (hands at
        opposite points), beta (hands at the same point), or gamma (hands at a right
        angle). Each beat is one letter: a pictograph that records where each hand goes
        and how each fan rotates on the way. String the letters together and the word is
        your choreography.
      </p>
      <p>
        You can do this on paper. Or let
        <a href="/composer">Flow Arts Composer</a> do the drawing: build the sequence
        beat by beat, play it back animated, and save it to your collection.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #06b6d4">
    <h2 class="section-title">Where to Start</h2>
    <div class="prose">
      <p>
        Start with the <a href="/guide">guide</a> to learn the grid, the positions, and
        the letters. The <a href="/glossary">glossary</a> defines every term you will
        run into. When a word confuses you, look it up there.
      </p>
    </div>
  </section>

  <div class="cta-card">
    <h3>Ready to write your first fan sequence?</h3>
    <p>Flow Arts Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>
