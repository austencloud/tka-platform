<script lang="ts">
  import EditorialNav from "$lib/shared/landing/components/EditorialNav.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

  const externalLinks = {
    // VTG sources
    noelYeeVTG: "https://noelyee.com/instruction/vulcan-tech-gospel",
    drexVTG: "https://drexfactor.com/weirdscience/2015/11/25/vulcan_tech_gospel_vtg_explained",
    flowArtsInstituteVTG: "https://flowartsinstitute.com/tag/vulcan-tech-gospel/",
    // Siteswap sources
    siteswapTutorial: "https://www.juggle.org/siteswap-tutorial/",
    siteswapWiki: "https://en.wikipedia.org/wiki/Siteswap",
  };

  const TITLE = "Roots of The Kinetic Alphabet | VTG, Siteswap & Music Theory";
  const DESCRIPTION =
    "TKA synthesizes juggling notation, music theory, and flow arts vocabulary into a visual notation system for dual wielded props. Learn about the influences behind The Kinetic Alphabet.";
</script>

<svelte:head>
  <title>{TITLE}</title>
  <meta name="description" content={DESCRIPTION} />
  <meta
    name="keywords"
    content="flow arts theory, VTG, Vulcan Tech Gospel, Siteswap, juggling notation, music theory, flow arts notation, dual wielded props, TKA influences"
  />
  <link rel="canonical" href="https://tkaflowarts.com/roots" />

  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://tkaflowarts.com/roots" />
  <meta property="og:title" content={TITLE} />
  <meta property="og:description" content={DESCRIPTION} />
  <meta property="og:image" content="https://tkaflowarts.com/branding/og-image.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={TITLE} />
  <meta name="twitter:description" content={DESCRIPTION} />
  <meta name="twitter:image" content="https://tkaflowarts.com/branding/og-image.png" />

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Roots of The Kinetic Alphabet",
    "url": "https://tkaflowarts.com/roots",
    "description": "${DESCRIPTION}",
    "inLanguage": "en-US",
    "author": { "@type": "Person", "name": "Austen Cloud", "url": "https://tkaflowarts.com/about" },
    "publisher": {
      "@type": "Organization",
      "name": "The Kinetic Alphabet",
      "url": "https://tkaflowarts.com/"
    }
  }
  </script>`}

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tkaflowarts.com/" },
      { "@type": "ListItem", "position": 2, "name": "Roots", "item": "https://tkaflowarts.com/roots" }
    ]
  }
  </script>`}
</svelte:head>

<EditorialNav />

<div class="editorial">
    <header class="editorial-header">
      <h1 class="page-title">Roots</h1>
      <p class="page-subtitle">What the Kinetic Alphabet is built on</p>
    </header>

    <div class="lede">
      <p>
        The Kinetic Alphabet synthesizes ideas from three sources:
        <span class="emphasis">juggling notation, music theory, and flow arts vocabulary</span>.
      </p>
      <p>This page explains where the ideas came from and how they combined into something new.</p>
    </div>

    <!-- VTG -->
    <section class="editorial-section" style="--accent: #f59e0b">
      <h2 class="section-title">Vulcan Tech Gospel (VTG)</h2>
      <div class="prose">
        <p>
          <strong>Vulcan Tech Gospel</strong> is one of the first unified theories for poi movement. Created by
          <a href={externalLinks.noelYeeVTG} target="_blank" rel="noopener noreferrer">Noel Yee</a>
          and collaborators at the Vulcan Lofts in Oakland, CA, it established much of the shared
          vocabulary flow artists use to talk about movement:
        </p>

        <ul class="bullet-list">
          <li><strong>Timing relationships</strong> - together time, split time, quarter time (added later by the community)</li>
          <li><strong>Direction relationships</strong> - same direction, opposite direction</li>
          <li><strong>Motion types</strong> - inspin (prospin), antispin</li>
          <li><strong>Plane orientation</strong> - wall plane, wheel plane, floor plane</li>
        </ul>

        <div class="resource-row">
          <a href={externalLinks.noelYeeVTG} target="_blank" rel="noopener noreferrer" class="resource-chip">
            <span>Vulcan Tech Gospel - Noel Yee (creator)</span>
            <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
          </a>
          <a href={externalLinks.drexVTG} target="_blank" rel="noopener noreferrer" class="resource-chip">
            <span>VTG Explained - DrexFactor</span>
            <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
          </a>
          <a href={externalLinks.flowArtsInstituteVTG} target="_blank" rel="noopener noreferrer" class="resource-chip">
            <span>VTG Resources - Flow Arts Institute</span>
            <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
          </a>
        </div>

        <p>
          TKA builds on VTG's vocabulary directly. The timing and direction relationships that
          define TKA's letter types come from this foundation.
        </p>
      </div>
    </section>

    <!-- Siteswap -->
    <section class="editorial-section" style="--accent: #ec4899">
      <h2 class="section-title">Siteswap Notation</h2>
      <div class="prose">
        <p>
          <strong>Siteswap</strong> is a notation system for juggling. It represents sequences as
          strings of numbers, where each number describes one discrete action.
        </p>

        <div class="resource-row">
          <a href={externalLinks.siteswapTutorial} target="_blank" rel="noopener noreferrer" class="resource-chip">
            <span>Siteswap Tutorial - Juggle.org</span>
            <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
          </a>
          <a href={externalLinks.siteswapWiki} target="_blank" rel="noopener noreferrer" class="resource-chip">
            <span>Siteswap - Wikipedia</span>
            <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
          </a>
        </div>

        <p>
          Siteswap showed that complex sequences could be broken into discrete units and documented
          with simple symbols. TKA applies this to flow arts - one pictograph per beat.
        </p>
      </div>
    </section>

    <!-- Music Theory (emphasis) -->
    <section class="editorial-section panel" style="--accent: #818cf8">
      <h2 class="section-title">Music Theory</h2>
      <div class="prose">
        <p>
          Music theory provided two core ideas: letters as symbolic representation and rhythmic
          structure.
        </p>
        <p>
          Sheet music documents what notes to play, not how to feel while playing them. Musicians
          figure out the execution. TKA works the same way - pictographs document what your hands and
          props are doing. You figure out the performance.
        </p>
        <p>
          Using letters (A-Z, Greek alphabet) as shorthand came directly from musical notation.
          During rehearsal, saying "A" is faster than describing the full movement.
        </p>
      </div>
    </section>

    <!-- Synthesis -->
    <section class="editorial-section" style="--accent: #22c55e">
      <h2 class="section-title">The Synthesis</h2>
      <div class="prose">
        <p>TKA combines these three influences:</p>

        <ul class="bullet-list">
          <li><strong>VTG</strong> - vocabulary for timing, direction, and motion types</li>
          <li><strong>Siteswap</strong> - discrete unit documentation</li>
          <li><strong>Music theory</strong> - letters and rhythmic structure</li>
        </ul>

        <p>
          The result is a visual notation system for static dual wielded props - staff, fans,
          buugeng, clubs, hoops, and anything you can hold two of.
        </p>
      </div>
    </section>

    <!-- CTA -->
    <div class="cta-card">
      <h3>See what the roots grew into</h3>
      <p>Flow Arts Composer turns this theory into something you can play with.</p>
      <a href="/composer" class="cta-button">
        <span>Explore Flow Arts Composer</span>
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </a>
    </div>
  </div>
