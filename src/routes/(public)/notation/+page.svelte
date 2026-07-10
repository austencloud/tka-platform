<script lang="ts">
  import LightsToggleButton from "$lib/shared/ui/components/LightsToggleButton.svelte";
  import PositionTrioGrid from "$lib/shared/landing/components/PositionTrioGrid.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

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
    <h2 class="section-title">How I Show People</h2>
    <div class="prose">
      <p>
        When someone asks me what TKA is at a jam, I usually just open my phone. Look: you
        can construct a sequence by going boop, boop, boop, and there's your sequence. Play
        it back, and it's animated. Add effects and props. Then it gets cooler: you can
        generate sequences. Put in your name, generate your name as a sequence, play it
        back, and save it to your own collection.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #ec4899">
    <h2 class="section-title">Built on VTG</h2>
    <div class="prose">
      <p>
        This was built on a foundation of what Vulcan Tech Gospel did before it. VTG holds
        the basis for this. TKA is the child of VTG in a way, and we pay respects to it by
        taking it further, not by claiming what we're doing is in a completely different
        ballpark. What TKA does has unique properties VTG cannot and would not ever cover.
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
        Start with the <a href="/guide/level-1">guide</a>: it introduces all the concepts.
        Then the <a href="/shop/choreography-cards">cards</a>: accessible ways to use those
        concepts. Then the app: everything else you might possibly ever want to do.
      </p>
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
</style>
