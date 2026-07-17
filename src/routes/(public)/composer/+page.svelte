<script lang="ts">
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import SequenceHeroDemo from "$lib/shared/landing/components/SequenceHeroDemo.svelte";
  import ComposerGenerateDemo from "./_components/ComposerGenerateDemo.svelte";
  import demoJson from "$lib/shared/landing/data/demo-sequence.json";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import "$lib/shared/landing/styles/public-editorial.css";

  const heroDemoSequence = demoJson as unknown as SequenceData;

  const DESCRIPTION =
    "Flow Arts Composer is free flow arts software for building choreography in your browser. Construct sequences step by step, generate them from parameters, animate them, and share them. Supports staff, fans, clubs, hoops, buugeng, and more.";

  // The tunnel and play-with-it stacks are heavy canvas machinery — mount
  // each only when its section approaches the viewport.
  let tunnelActive = $state(false);
  let playWithItActive = $state(false);
  function activateWhenNear(activate: () => void) {
    return (node: HTMLElement) => {
      if (typeof IntersectionObserver === "undefined") {
        activate();
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            activate();
            io.disconnect();
          }
        },
        { rootMargin: "400px" }
      );
      io.observe(node);
      return { destroy: () => io.disconnect() };
    };
  }
  let choreoCardsActive = $state(false);
  let viewer3DActive = $state(false);
  const activateTunnelWhenNear = activateWhenNear(() => (tunnelActive = true));
  const activatePlayWithItWhenNear = activateWhenNear(() => (playWithItActive = true));
  const activateChoreoCardsWhenNear = activateWhenNear(() => (choreoCardsActive = true));
  const activate3DWhenNear = activateWhenNear(() => (viewer3DActive = true));


  const ROADMAP = [
    {
      label: "Community video repository",
      detail: "performances stored for generations instead of lost to the feed",
    },
    {
      label: "3D performance composing",
      detail: "build entire acts with virtual performers",
    },
    { label: "Camera practice overlay", detail: "spin in front of your camera, get feedback" },
    { label: "Higher levels", detail: "three of the system's nine levels are in the app so far" },
  ];
</script>

<svelte:head>
  <title>Flow Arts Composer | Free Flow Arts Software for Choreography</title>
  <meta name="description" content={DESCRIPTION} />
  <link rel="canonical" href="https://tkaflowarts.com/composer" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="The Kinetic Alphabet" />
  <meta property="og:url" content="https://tkaflowarts.com/composer" />
  <meta property="og:title" content="Flow Arts Composer | Free Flow Arts Software for Choreography" />
  <meta property="og:description" content={DESCRIPTION} />
  <meta property="og:image" content="https://tkaflowarts.com/branding/og-image.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Flow Arts Composer | Free Flow Arts Software for Choreography" />
  <meta name="twitter:description" content={DESCRIPTION} />
  <meta name="twitter:image" content="https://tkaflowarts.com/branding/og-image.png" />

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Flow Arts Composer",
    "alternateName": "The Kinetic Alphabet Composer",
    "description": "${DESCRIPTION}",
    "url": "https://tkaflowarts.com/composer",
    "applicationCategory": "EducationalApplication",
    "keywords": "flow arts software, flow arts choreography software, flow arts app",
    "operatingSystem": "Any (Web Browser)",
    "browserRequirements": "Requires JavaScript. Works on Chrome, Firefox, Safari, Edge.",
    "image": "https://tkaflowarts.com/branding/og-image.png",
    "screenshot": "https://tkaflowarts.com/branding/og-image.png",
    "inLanguage": "en-US",
    "featureList": [
      "Construct sequences step by step with only valid options presented",
      "Generate sequences from parameters",
      "Animate sequences in 2D with trails and effects",
      "Watch sequences in a 3D viewer with full scenes",
      "Organize saved sequences into collections",
      "Browse and share community sequences",
      "Multiply sequences into tunnels for 2, 4, or 8 performers",
      "Export images and video",
      "Practice modes and an interactive guide",
      "Supports staff, fan, hoop, buugeng, triad, club, sword, and more"
    ],
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    "author": {
      "@type": "Organization",
      "name": "The Kinetic Alphabet",
      "url": "https://tkaflowarts.com/"
    }
  }
  </script>`}

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "How to Create Flow Arts Choreography with Flow Arts Composer",
    "description": "Learn to create, animate, and share staff, clubs, fans, and hoop sequences using TKA notation.",
    "image": "https://tkaflowarts.com/branding/og-image.png",
    "totalTime": "PT10M",
    "tool": [
      {
        "@type": "HowToTool",
        "name": "Web browser (Chrome, Firefox, Safari, or Edge)"
      }
    ],
    "step": [
      {
        "@type": "HowToStep",
        "position": 1,
        "name": "Open Flow Arts Composer",
        "text": "Visit tkaflowarts.com/create to launch the free web application.",
        "url": "https://tkaflowarts.com/create"
      },
      {
        "@type": "HowToStep",
        "position": 2,
        "name": "Choose a creation mode",
        "text": "Choose how to build: by hand step-by-step, or let the app generate patterns for you."
      },
      {
        "@type": "HowToStep",
        "position": 3,
        "name": "Build your sequence",
        "text": "Add movements by selecting start positions, hand motions, and transitions. Each step is represented as a pictograph."
      },
      {
        "@type": "HowToStep",
        "position": 4,
        "name": "Animate and preview",
        "text": "Switch to the Animate module to watch your sequence come alive with 2D visualization and motion trails."
      },
      {
        "@type": "HowToStep",
        "position": 5,
        "name": "Export and share",
        "text": "Export your choreography as PNG, PDF, GIF, or video. Share links directly to Instagram."
      }
    ]
  }
  </script>`}

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tkaflowarts.com/" },
      { "@type": "ListItem", "position": 2, "name": "Composer", "item": "https://tkaflowarts.com/composer" }
    ]
  }
  </script>`}
</svelte:head>

<div class="editorial">
  <header class="editorial-header">
    <h1 class="page-title">Flow Arts Composer</h1>
    <p class="page-subtitle">
      Free flow arts software for choreography, built on <a href="/notation">The Kinetic Alphabet</a>
    </p>
  </header>

  <div class="lede">
    <p>
      Flow Arts Composer is free flow arts software for building choreography in your
      browser. Construct
      sequences step by step, generate them from parameters, watch them animate, and share
      them with other flow artists. It supports staff, fans, clubs, hoops, buugeng, and
      more, all built on The Kinetic Alphabet notation system.
    </p>
  </div>

  <SequenceHeroDemo
    sequence={heroDemoSequence}
    note="a rotated LOOP from the generator, animating live"
  />

  <div class="hero-ctas">
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
    <a href="/notation" class="cta-secondary">
      <span>See the notation</span>
    </a>
  </div>

  <section class="editorial-section" style="--accent: #6366f1">
    <span class="section-kicker">Construct</span>
    <h2 class="section-title">Build it step by step</h2>
    <div class="prose">
      <p>
        Pick a starting position and tap through the options. Each tap adds a step, and
        every step animates the moment you add it. You're never presented with an invalid
        option: the app tracks what's physically possible so you don't have to. You create,
        then approve or reject what you made.
      </p>
      <p>
        Before this existed, notating a sequence meant writing it out with red and blue
        pens and checking every transition by hand. Composer does the bookkeeping. You do
        the creating.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #ec4899">
    <span class="section-kicker">Generate</span>
    <h2 class="section-title">Or skip the building entirely</h2>
    <div class="prose">
      <p>
        Set your parameters, hit generate, and a valid sequence lands in front of you.
        Watch it animate, keep it if you like it, run it again if you don't. Every
        sequence draws its own mandala. Try it:
      </p>
    </div>
    <div class="breakout">
      <ComposerGenerateDemo />
    </div>
  </section>

  <section class="editorial-section" style="--accent: #14b8a6">
    <span class="section-kicker">Multiply</span>
    <h2 class="section-title">Unfold it into a tunnel</h2>
    <div class="prose">
      <p>
        Every sequence can unfold into a tunnel: the same choreography multiplied across
        two, four, or eight performers in a ring, with mirrors, echoes, and staggered
        canons on top. What starts as one pattern becomes a stage full of them. This is
        running live:
      </p>
    </div>
    <div class="breakout" use:activateTunnelWhenNear>
      <LazyMount
        loader={() => import("./_components/ComposerTunnelDemo.svelte")}
        active={tunnelActive}
      />
    </div>
  </section>

  <section class="editorial-section" style="--accent: #f59e0b">
    <span class="section-kicker">Learn</span>
    <h2 class="section-title">Absorb the language by osmosis</h2>
    <div class="prose">
      <p>
        Every pictograph in the app appears with its letter. Use Composer long enough and
        the alphabet sinks in the way your first language did: repeated exposure, not
        flashcards. You never have to memorize a single letter to use any of it.
      </p>
    </div>
    <div class="prose">
      <p>
        The Kinetic Alphabet maps the whole territory of grid-based prop movement, so your
        skills don't develop holes. The app splits that territory into levels. Work at
        level 1 if that's where you are, or push into the weirder corners as you climb.
      </p>
    </div>

    <div class="cards-block">
      <h3 class="cards-heading">The alphabet leaves the screen</h3>
      <div class="cards-fan" use:activateChoreoCardsWhenNear>
        <LazyMount
          loader={() => import("./_components/ComposerChoreoCardsDemo.svelte")}
          active={choreoCardsActive}
        />
      </div>
      <div class="prose">
        <p>
          Choreo Cards put a sequence on a physical card: the word, every step, the
          mandalas, and a QR that opens it in Composer with any prop at any speed. Shuffle a
          deck and the same osmosis happens away from the app, one card in your hand at a
          time. Every card the app builds can print, and the decks in the shop are already
          composed and ready to spin.
        </p>
      </div>
      <div class="hero-ctas">
        <a href="/shop/choreography-cards" class="cta-button">
          <span>See how Choreo Cards work</span>
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
        </a>
        <a href="/shop" class="cta-secondary">
          <span>Browse the decks</span>
        </a>
      </div>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #06b6d4">
    <span class="section-kicker">3D</span>
    <h2 class="section-title">Watch it performed in 3D</h2>
    <div class="prose">
      <p>
        Any sequence plays back in a full 3D scene: a performer spinning your choreography
        on a stage you can orbit. The one below is running live. Drag to look around, drop it
        into a different environment, or multiply it into a ring performing in unison. The 2D
        notation is the score. The 3D viewer is the performance.
      </p>
    </div>
    <div class="breakout" use:activate3DWhenNear>
      <LazyMount
        loader={() => import("./_components/Composer3DViewerDemo.svelte")}
        active={viewer3DActive}
      />
    </div>
    <div class="resource-row">
      <a href="/create" class="resource-chip" data-sveltekit-reload>Open a sequence in 3D</a>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #22c55e">
    <span class="section-kicker">Features</span>
    <h2 class="section-title">Also in the app today</h2>
    <div class="prose">
      <p>Every one of these is live in the app today.</p>
    </div>
    <div class="breakout">
      <div class="bento">
        <div class="bento-cell text-only">
          <div class="bento-text">
            <strong>Community gallery</strong>
            <span>real public sequences shared across the community, filterable by level</span>
          </div>
        </div>

        <div class="bento-cell text-only">
          <div class="bento-text">
            <strong>Image and video export</strong>
            <span>render any sequence as an image or a video, straight from the viewer</span>
          </div>
        </div>

        <div class="bento-cell text-only">
          <div class="bento-text">
            <strong>QR share links</strong>
            <span>every export carries a scan code that opens the sequence on any phone</span>
          </div>
        </div>

        <div class="bento-cell text-only">
          <div class="bento-text">
            <strong>Library</strong>
            <span>collections and smart collections for everything you save</span>
          </div>
        </div>

        <div class="bento-cell text-only">
          <div class="bento-text">
            <strong>Props</strong>
            <span>eleven supported: staff, fan, hoop, buugeng, triad, club, sword, double star, eight rings, guitar, quiad</span>
          </div>
        </div>

        <div class="bento-cell text-only">
          <div class="bento-text">
            <strong>Games</strong>
            <span>an arcade built from the alphabet, with best scores to chase</span>
          </div>
        </div>

        <div class="bento-cell text-only">
          <div class="bento-text">
            <strong>Practice modes</strong>
            <span>drill sequences step by step</span>
          </div>
        </div>

        <div class="bento-cell text-only">
          <div class="bento-text">
            <strong>Installable</strong>
            <span>works as an app on your phone, no app store</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #a3e635">
    <span class="section-kicker">Roadmap</span>
    <h2 class="section-title">Where it's headed</h2>
    <ul class="bullet-list">
      {#each ROADMAP as item}
        <li><strong>{item.label}</strong>: {item.detail}</li>
      {/each}
    </ul>
  </section>

  <section class="editorial-section" style="--accent: #8b5cf6">
    <span class="section-kicker">Foundation</span>
    <h2 class="section-title">Built on The Kinetic Alphabet</h2>
    <div class="prose">
      <p>
        The Kinetic Alphabet exists on paper. It existed before this app, and it works
        without it: two pens and a notebook are enough to record choreography. Composer is
        an instrument built for that language. And like any instrument, you don't have to
        read the music to play it. The app handles the letters. You handle the movement.
      </p>
    </div>
    <div class="resource-row">
      <a href="/notation" class="resource-chip">Read about the notation</a>
      <a href="/roots" class="resource-chip">Where it came from</a>
      <a href="/about" class="resource-chip">About the project</a>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #38bdf8">
    <span class="section-kicker">Try it</span>
    <h2 class="section-title">Play with it right here</h2>
    <div class="prose">
      <p>
        This is the app in miniature, running live. Swap effects, props, and tempo with
        the same controls the real thing gives you. The strip along the bottom is the
        sequence's notation, keeping time with the animation.
      </p>
    </div>
    <div class="breakout playwithit-slot" use:activatePlayWithItWhenNear>
      <LazyMount
        loader={() => import("../../landing/components/PlayWithItInner.svelte")}
        active={playWithItActive}
      />
    </div>
  </section>

  <div class="cta-card">
    <h3>Ready to compose?</h3>
    <p>Flow Arts Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>

<style>
  .hero-ctas {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.9rem;
    margin: 2.2rem 0 3.6rem;
  }

  /* Secondary action styled as a real button (clickables-look-like-buttons):
     same shape as .cta-button, quiet fill. */
  .cta-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 1.05rem;
    font-weight: 650;
    color: oklch(0.9 0.015 270);
    text-decoration: none;
    padding: 0.95rem 1.9rem;
    border-radius: 13px;
    background: oklch(0.3 0.04 270 / 0.18);
    border: 1px solid oklch(0.5 0.06 270 / 0.3);
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease;
  }
  .cta-secondary:hover {
    transform: translateY(-2px);
    background: oklch(0.34 0.05 270 / 0.26);
    border-color: oklch(0.6 0.08 270 / 0.5);
  }

  /* ── breakout band ──
     Prose keeps the 46rem editorial measure; visual bands escape it and
     center on the viewport, up to 66rem. min() with the viewport term keeps
     phones untouched (band == column width there). */
  .breakout {
    --breakout-width: min(66rem, calc(100vw - 2.2rem));
    width: var(--breakout-width);
    margin-inline: calc((100% - var(--breakout-width)) / 2);
    margin-block: 0.4rem 1.4rem;
  }

  /* Reserve the showcase's footprint before the lazy chunk mounts so the
     sections below don't jump (no-layout-shift). */
  .playwithit-slot {
    min-height: min(34rem, 80vh);
  }

  /* ── feature bento ──
     Uniform text cards, one per feature. The 3D section carries the visuals;
     these stay lean so nothing depends on a screenshot going stale. */
  .bento {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(17rem, 100%), 1fr));
    gap: 1rem;
  }
  .bento-cell {
    display: flex;
    flex-direction: column;
    border-radius: 16px;
    overflow: hidden;
    background: oklch(0.16 0.018 270 / 0.45);
    border: 1px solid oklch(0.4 0.04 270 / 0.14);
  }
  .bento-text {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.9rem 1.1rem 1.1rem;
    margin-top: auto;
  }
  .bento-cell.text-only .bento-text {
    justify-content: center;
    flex: 1;
    min-height: 6.5rem;
  }
  .bento-text strong {
    font-size: 1rem;
    font-weight: 650;
    color: oklch(0.92 0.02 270);
  }
  .bento-text span {
    font-size: 0.88rem;
    line-height: 1.5;
    color: oklch(0.68 0.015 270);
  }

  .cards-block {
    margin-top: 2rem;
  }
  .cards-heading {
    margin: 0 0 0.4rem;
    text-align: center;
    font-size: 1.15rem;
    font-weight: 650;
    color: oklch(0.92 0.02 270);
  }
  .cards-fan {
    margin: 0.4rem auto 1.4rem;
    max-width: 40rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .cta-secondary {
      transition: none;
    }
    .cta-secondary:hover {
      transform: none;
    }
  }
</style>
