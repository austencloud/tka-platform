<script lang="ts">
  import LightsToggleButton from "$lib/shared/ui/components/LightsToggleButton.svelte";
  import PositionTrioGrid from "$lib/shared/landing/components/PositionTrioGrid.svelte";
  import SequenceHeroDemo from "$lib/shared/landing/components/SequenceHeroDemo.svelte";
  import demoJson from "$lib/shared/landing/data/demo-sequence.json";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import "$lib/shared/landing/styles/public-editorial.css";

  const heroDemoSequence = demoJson as unknown as SequenceData;

  let positionLightsOn = $state(true);

  const DESCRIPTION =
    "The Kinetic Alphabet is a pictographic system that uses letters and pictures to represent flow arts sequences that can be read on a page like music notation.";
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
    <p class="page-subtitle">The Kinetic Alphabet</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <div class="section-head">
      <h2 class="section-title">What It Is</h2>
      <LightsToggleButton
        lightsOn={positionLightsOn}
        onToggle={() => (positionLightsOn = !positionLightsOn)}
        size="small"
      />
    </div>
    <div class="prose">
      <p>
        The Kinetic Alphabet is a system for constructing, recording, and memorizing
        choreography, so you can keep track of the sequences you build, share them with
        friends, and create performances that rely on synchronicity and choreographed
        elements rather than a free-flowing solo experience.
      </p>
      <p>
        Another way to say it: TKA is a pictographic system that uses letters and pictures
        to represent sequences that can be read on a page like music notation and
        communicated with speech, text, or drawings.
      </p>

      <PositionTrioGrid lightsOn={positionLightsOn} />

      <p>
        At its core, the Kinetic Alphabet is a way to write down what comes to your head
        when it comes to choreography grid work. It captures ideas that would otherwise be
        ephemeral and unnamable, and gives them distinct, clear names that can be repeated,
        spoken, and memorized, with a system of terminology underneath that maps out the
        building blocks and boundaries of the system.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #14b8a6">
    <h2 class="section-title">The Thirty-Second Demo</h2>
    <div class="prose">
      <p>
        The fastest explanation of TKA happens at a jam, on a phone. Look: you
        can construct a sequence by going boop, boop, boop, and there's your sequence. Play
        it back, and it's animated. Add effects and props. Then it gets cooler: you can
        generate sequences. Put in your name, generate your name as a sequence, play it
        back, and save it to your own collection.
      </p>

      <SequenceHeroDemo sequence={heroDemoSequence} note="the phone demo, minus the phone" />
    </div>
  </section>

  <section class="editorial-section" style="--accent: #ec4899">
    <h2 class="section-title">Built on VTG</h2>
    <div class="prose">
      <p>
        This was built on a foundation of what Vulcan Tech Gospel did before it. VTG holds
        the basis for this. TKA is the child of VTG in a way, and it pays respects by
        taking the framework further, not by claiming to be in a completely different
        ballpark. What TKA does has unique properties VTG cannot and would not ever cover.
        The full lineage, with sources, lives on the <a href="/roots">roots page</a>.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #f59e0b">
    <h2 class="section-title">It Started on Paper</h2>
    <div class="prose">
      <p>
        For the first couple of years there was no software. Sequences got written by hand
        or drawn in Adobe Illustrator. The point stands: if you were on a desert island,
        you could record sequences on a rock with a system like this. All you need is pen
        and paper. Two pens, ideally, so you can treat the pens as your spinning devices
        while you figure out the pattern. No internet, no phone, no prop required.
      </p>
      <!-- Image slot: hand-drawn archival TKA pages. Austen has photos of the
           originals above his desk; add when he provides them. -->
    </div>
  </section>

  <section class="editorial-section" style="--accent: #06b6d4">
    <h2 class="section-title">Where to Start</h2>
    <div class="prose">
      <p>
        Start with the <a href="/guide">guide</a>: it introduces all the concepts.
        Then the <a href="/shop/choreography-cards">cards</a>: accessible ways to use those
        concepts. Then <a href="/composer">Flow Arts Composer</a>, the software side of
        the system: everything else you
        might possibly ever want to do.
      </p>
      <p>
        Want a specific term? The <a href="/glossary">full lexicon</a> defines every position,
        letter type, motion, and piece of notation vocabulary.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #8b5cf6">
    <h2 class="section-title">Notation by Prop</h2>
    <div class="prose">
      <p>
        The alphabet is one system, and props meet it in two families. Dual-ended props
        like staves show two references at once, so distinctions collapse and patterns
        are easier to read. Single-ended props like clubs and fans show one, so the same
        math unfolds into more visible variety. Poi rely on momentum and reach a
        restricted subset. Each prop has its own page:
      </p>
    </div>
    <nav class="prop-links" aria-label="Notation by prop">
      <a class="prop-link" href="/notation/staves">Double Staves</a>
      <a class="prop-link" href="/notation/clubs">Clubs</a>
      <a class="prop-link" href="/notation/fans">Fans</a>
      <a class="prop-link" href="/notation/buugeng">Buugeng</a>
      <a class="prop-link" href="/notation/poi">Poi</a>
    </nav>
  </section>

  <div class="cta-card">
    <h3>Ready to create?</h3>
    <p>Flow Arts Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>

<style>
  /* Same pill treatment as the glossary's jump-nav chips (component-scoped
     there too) — a known editorial pattern, not a new primitive. */
  .prop-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-top: 1.2rem;
  }
  .prop-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0.5rem 1.15rem;
    font-size: 0.9rem;
    font-weight: 550;
    color: oklch(0.9 0.015 270);
    text-decoration: none;
    background: oklch(0.2 0.02 270 / 0.4);
    border: 1px solid oklch(0.45 0.04 270 / 0.2);
    border-radius: 999px;
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease;
  }
  .prop-link:hover,
  .prop-link:focus-visible {
    transform: translateY(-1px);
    background: oklch(0.26 0.03 275 / 0.5);
    border-color: oklch(0.6 0.12 275 / 0.5);
    outline: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .prop-link {
      transition: none;
    }
    .prop-link:hover,
    .prop-link:focus-visible {
      transform: none;
    }
  }

  .section-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  .section-head .section-title {
    margin-bottom: 1.1rem;
  }
</style>
