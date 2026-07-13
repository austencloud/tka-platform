<script lang="ts">
  import EditorialNav from "$lib/shared/landing/components/EditorialNav.svelte";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import ComposerHeroDemo from "./_components/ComposerHeroDemo.svelte";
  import ComposerConstructDemo from "./_components/ComposerConstructDemo.svelte";
  import ComposerGenerateDemo from "./_components/ComposerGenerateDemo.svelte";
  import GuidePictograph from "../guide/level-1/_components/GuidePictograph.svelte";
  import { DEMO_LETTER_BEATS } from "./_data/demo-beats";
  import "$lib/shared/landing/styles/public-editorial.css";

  const DESCRIPTION =
    "Flow Arts Composer is a free web app for building flow arts choreography. Construct sequences beat by beat, generate them from parameters, animate them, and share them. Supports staff, fans, clubs, hoops, buugeng, and more.";

  // The tunnel stack is heavy canvas machinery — mount it only when the
  // section approaches the viewport.
  let tunnelActive = $state(false);
  function activateTunnelWhenNear(node: HTMLElement) {
    if (typeof IntersectionObserver === "undefined") {
      tunnelActive = true;
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          tunnelActive = true;
          io.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    io.observe(node);
    return { destroy: () => io.disconnect() };
  }

  const TODAY = [
    { label: "Library", detail: "collections and smart collections for everything you save" },
    { label: "Community gallery", detail: "browse and share public sequences" },
    { label: "Image and video export", detail: "with effects, ready for wherever you post" },
    { label: "Practice modes", detail: "drill sequences step by step" },
    { label: "Word games", detail: "an arcade built from the alphabet" },
    { label: "QR share links", detail: "hand a sequence to anyone via tka.run" },
    { label: "Installable", detail: "works as an app on your phone, no app store" },
    {
      label: "11 props",
      detail: "staff, fan, hoop, buugeng, triad, club, sword, double star, eight rings, guitar, quiad",
    },
  ];

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
  <title>Flow Arts Composer | Choreography App for Staff, Fans, Clubs & More</title>
  <meta name="description" content={DESCRIPTION} />
  <link rel="canonical" href="https://tkaflowarts.com/composer" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://tkaflowarts.com/composer" />
  <meta property="og:title" content="Flow Arts Composer | Choreography App for Flow Arts" />
  <meta property="og:description" content={DESCRIPTION} />
  <meta property="og:image" content="https://tkaflowarts.com/branding/og-image.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Flow Arts Composer | Choreography App for Flow Arts" />
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
    "operatingSystem": "Any (Web Browser)",
    "browserRequirements": "Requires JavaScript. Works on Chrome, Firefox, Safari, Edge.",
    "image": "https://tkaflowarts.com/branding/og-image.png",
    "screenshot": "https://tkaflowarts.com/branding/og-image.png",
    "inLanguage": "en-US",
    "featureList": [
      "Construct sequences beat by beat with only valid options presented",
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
        "text": "Add movements by selecting start positions, hand motions, and transitions. Each beat is represented as a pictograph."
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

<EditorialNav />

<div class="editorial">
  <header class="editorial-header">
    <h1 class="page-title">Flow Arts Composer</h1>
    <p class="page-subtitle">
      The choreography app built on <a href="/notation">The Kinetic Alphabet</a>
    </p>
  </header>

  <div class="lede">
    <p>
      Flow Arts Composer is a free web app for building flow arts choreography. Construct
      sequences beat by beat, generate them from parameters, watch them animate, and share
      them with other flow artists. It supports staff, fans, clubs, hoops, buugeng, and
      more, all built on The Kinetic Alphabet notation system.
    </p>
  </div>

  <ComposerHeroDemo />

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
    <h2 class="section-title">Build it beat by beat</h2>
    <div class="prose">
      <p>
        Pick a starting position and tap through the options. Each tap adds a beat, and
        every beat animates the moment you add it. You're never presented with an invalid
        option: the app tracks what's physically possible so you don't have to. You create,
        then approve or reject what you made.
      </p>
    </div>
    <div class="breakout">
      <ComposerConstructDemo />
    </div>
    <div class="prose">
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
    <div class="letter-row">
      {#each DEMO_LETTER_BEATS as beat}
        <div class="letter-cell">
          <GuidePictograph data={beat} size="md" bordered />
          <span class="tka-font letter-label">{beat.letter}</span>
        </div>
      {/each}
    </div>
    <div class="prose">
      <p>
        The Kinetic Alphabet maps the whole territory of grid-based prop movement, so your
        skills don't develop holes. The app splits that territory into levels. Work at
        level 1 if that's where you are, or push into the weirder corners as you climb.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #06b6d4">
    <span class="section-kicker">3D</span>
    <h2 class="section-title">Watch it performed in 3D</h2>
    <div class="prose">
      <p>
        Any sequence plays back in a full 3D scene: a performer spinning your choreography
        on a stage you can orbit, with environments to choose from and effects on the prop
        tips. The 2D notation is the score. The 3D viewer is the performance.
      </p>
    </div>
    <div class="breakout">
      <figure class="viewer3d-figure">
        <img
          src="/marketing/viewer-3d.webp"
          alt="Flow Arts Composer's 3D viewer: a performer mid-sequence on a 3D stage"
          width="1200"
          height="675"
          loading="lazy"
        />
      </figure>
    </div>
    <div class="resource-row">
      <a href="/create" class="resource-chip" data-sveltekit-reload>Open a sequence in 3D</a>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #22c55e">
    <span class="section-kicker">Features</span>
    <h2 class="section-title">Also in the app today</h2>
    <ul class="bullet-list">
      {#each TODAY as item}
        <li><strong>{item.label}</strong>: {item.detail}</li>
      {/each}
    </ul>
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

  .letter-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1.1rem;
    margin: 1.6rem 0;
  }
  .letter-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.45rem;
  }
  .letter-label {
    font-size: 1.25rem;
    color: oklch(0.9 0.02 270);
  }

  .viewer3d-figure {
    margin: 0;
  }
  .viewer3d-figure img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 18px;
    border: 1px solid oklch(0.4 0.04 270 / 0.18);
    background: oklch(0.16 0.018 270 / 0.45);
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
