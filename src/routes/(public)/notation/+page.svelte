<script lang="ts">
  import LightsToggleButton from "$lib/shared/ui/components/LightsToggleButton.svelte";
  import PositionTrioGrid from "$lib/shared/landing/components/PositionTrioGrid.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

  let positionLightsOn = $state(true);

  const DESCRIPTION =
    "The Kinetic Alphabet is a notation system for flow arts. Write it down, read it back, reproduce it later.";
</script>

<svelte:head>
  <title>Flow Arts Notation: The Kinetic Alphabet | Write Down Prop Choreography</title>
  <meta name="description" content={DESCRIPTION} />
  <link rel="canonical" href="https://tkaflowarts.com/notation" />

  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://tkaflowarts.com/notation" />
  <meta property="og:title" content="Flow Arts Notation: The Kinetic Alphabet" />
  <meta property="og:description" content={DESCRIPTION} />
  <meta property="og:image" content="https://tkaflowarts.com/branding/og-image.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Flow Arts Notation: The Kinetic Alphabet" />
  <meta name="twitter:description" content={DESCRIPTION} />
  <meta name="twitter:image" content="https://tkaflowarts.com/branding/og-image.png" />

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Flow Arts Notation: The Kinetic Alphabet",
    "url": "https://tkaflowarts.com/notation",
    "description": "${DESCRIPTION}",
    "inLanguage": "en-US",
    "author": { "@type": "Person", "name": "Austen Cloud", "url": "https://tkaflowarts.com/about" },
    "publisher": {
      "@type": "Organization",
      "name": "The Kinetic Alphabet",
      "url": "https://tkaflowarts.com/"
    },
    "about": {
      "@type": "Thing",
      "name": "The Kinetic Alphabet",
      "alternateName": ["TKA", "Flow Arts Notation"]
    }
  }
  </script>`}

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tkaflowarts.com/" },
      { "@type": "ListItem", "position": 2, "name": "Notation", "item": "https://tkaflowarts.com/notation" }
    ]
  }
  </script>`}
</svelte:head>

<div class="editorial">
  <header class="editorial-header">
    <h1 class="page-title">Flow Arts Notation</h1>
    <p class="page-subtitle">A notation system for flow arts</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <div class="prose">
      <p>
        TKA is a notation system for flow arts. Other people have documented patterns before,
        and that work matters. TKA tries to take it further.
      </p>
      <p>
        Right now, flow arts knowledge lives mostly in videos scattered across the internet.
        Sheet music tells musicians what to play. Scripts tell actors what to say. TKA does
        that for prop movement: write it down, read it back, reproduce it later.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #14b8a6">
    <div class="section-head">
      <h2 class="section-title">How It Works</h2>
      <LightsToggleButton
        lightsOn={positionLightsOn}
        onToggle={() => (positionLightsOn = !positionLightsOn)}
        size="small"
      />
    </div>
    <div class="prose">
      <p>
        Each step of movement gets a pictograph. It shows where your hands are and how they
        move on a grid. You can read it without memorizing terminology. Positions are simple:
        hands across from each other, at the same point, or at a right angle.
      </p>

      <PositionTrioGrid lightsOn={positionLightsOn} />

      <p>
        Pictographs also capture motion type, direction, and rotation. Letters are optional
        but handy when you need to talk about a specific step during rehearsal.
      </p>
      <p>
        A sequence of movements becomes a word. "CAKE" is not a metaphor. It is four specific
        steps of movement, each unambiguous, each reproducible.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #ec4899">
    <h2 class="section-title">TKA Isn't the First Attempt</h2>
    <div class="prose">
      <p>
        Several theoretical frameworks have emerged over the past two decades. The Vulcan Tech
        Gospel (VTG), developed by Noel Yee and Jordan Campbell in Oakland, CA, classifies
        timing and direction relationships between two spinning props. Charlie Cushing's
        9-Square Theory quantizes the space around the performer's body into a navigable grid.
        Cushing and Ben Drexler developed QFT Notation, a precise but highly technical formula
        for recording any movement.
      </p>
      <p>
        These systems are valuable and TKA builds on their ideas. Where they focus on
        classification and analysis, TKA focuses on a different problem: giving people a way
        to write movement down and share it. For comparison, a QFT formula looks like this:
        <code>a,b(h(+/-x+/-y+/-z)h')&#123;Class&#125;a',b'</code>. It is precise. TKA's
        equivalent is a pictograph you can draw on a napkin, or a word like "CAKE" you can
        text to a collaborator.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #f59e0b">
    <h2 class="section-title">It Works on Paper</h2>
    <div class="prose">
      <p>
        The system also works on paper. The pictographs are designed to be hand-drawn. The
        letters are single characters. A choreographer with a pen and a printed grid template
        can notate a sequence without any software.
      </p>
      <p>
        TKA uses symbols and pictures instead of English terminology, so it works across
        languages. It works on paper and on screen.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #06b6d4">
    <h2 class="section-title">Where to Start</h2>
    <div class="prose">
      <ul>
        <li>
          The free <a href="/guide/level-1">Level 1 guide</a> teaches positions, motions, and
          your first words.
        </li>
        <li>The app animates any sequence. Free, no download required.</li>
        <li><a href="/shop/choreography-cards">Choreo Cards</a> are the physical version.</li>
      </ul>
    </div>
  </section>

  <div class="cta-card">
    <h3>Ready to create?</h3>
    <p>TKA Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open TKA Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>

<style>
  .section-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  .section-head .section-title {
    margin-bottom: 1.1rem;
  }

  code {
    font-size: 0.85em;
    word-break: break-all;
  }
</style>
