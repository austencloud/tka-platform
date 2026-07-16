<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

  const TITLE = "Club Notation for Flow Arts | The Kinetic Alphabet";
  const DESCRIPTION =
    "Write down club choreography with The Kinetic Alphabet. Clubs are gripped directly, so TKA's grid positions, letters, and turns all apply to a pair of clubs.";
</script>

<Seo title={TITLE} description={DESCRIPTION} canonical="https://tkaflowarts.com/notation/clubs" ogType="article">
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Club Notation for Flow Arts",
    "url": "https://tkaflowarts.com/notation/clubs",
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
      { "@type": "ListItem", "position": 3, "name": "Clubs", "item": "https://tkaflowarts.com/notation/clubs" }
    ]
  }
  <\/script>`}
</Seo>

<div class="editorial">
  <header class="editorial-header">
    <h1 class="page-title">Club Notation</h1>
    <p class="page-subtitle">Writing club choreography in The Kinetic Alphabet</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <h2 class="section-title">Clubs Speak TKA</h2>
    <div class="prose">
      <p>
        The Kinetic Alphabet writes choreography for dual-wielded props that you grip
        directly. A club in each hand qualifies. It points somewhere on the grid, it
        rotates on the way to the next position, and you control both. That is all TKA
        needs: every position, letter, and turn count in the system applies.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #f59e0b">
    <h2 class="section-title">From Juggling to the Grid</h2>
    <div class="prose">
      <p>
        Clubs carry juggling history with them, and so does TKA. Part of the system's
        lineage runs through siteswap, the numeric notation jugglers use to write down
        throw patterns. TKA borrows that instinct, writing movement as symbols you can
        read back, and applies it to props that stay in your hands. The full family tree
        is on the <a href="/roots">roots page</a>.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #ec4899">
    <h2 class="section-title">How Do You Write Down Club Choreography?</h2>
    <div class="prose">
      <p>
        One beat at a time. Pick a start position: alpha (hands at opposite points), beta
        (hands at the same point), or gamma (hands at a right angle). Each beat is one
        letter: a pictograph that records where each hand travels and how each club
        rotates on the way. The letters chain into a word, and the word is the sequence.
      </p>
      <p>
        Paper works. <a href="/composer">Flow Arts Composer</a> works faster: build the
        sequence beat by beat, watch it animate, and save it to your collection.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #06b6d4">
    <h2 class="section-title">Where to Start</h2>
    <div class="prose">
      <p>
        The <a href="/guide">guide</a> introduces the grid, the positions, and the
        letters. The <a href="/glossary">glossary</a> defines every term in the system.
        Between the two, nothing in a written sequence should stay mysterious for long.
      </p>
    </div>
  </section>

  <div class="cta-card">
    <h3>Ready to write your first club sequence?</h3>
    <p>Flow Arts Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>
