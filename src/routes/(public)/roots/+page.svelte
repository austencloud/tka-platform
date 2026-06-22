<script lang="ts">
  import { APP_DOMAIN } from "../../../config/domains";
  import SiteHeader from "$lib/shared/landing/components/SiteHeader.svelte";

  // In dev, back goes to /landing; in prod, back goes to /
  const backHref = "/";

  const externalLinks = {
    // VTG sources
    noelYeeVTG: "https://noelyee.com/instruction/vulcan-tech-gospel",
    drexVTG: "https://drexfactor.com/weirdscience/2015/11/25/vulcan_tech_gospel_vtg_explained",
    flowArtsInstituteVTG: "https://flowartsinstitute.com/tag/vulcan-tech-gospel/",
    // Siteswap sources
    siteswapTutorial: "https://www.juggle.org/siteswap-tutorial/",
    siteswapWiki: "https://en.wikipedia.org/wiki/Siteswap",
  };
</script>

<svelte:head>
  <title>The Roots of TKA | Standing on Shoulders</title>
  <meta
    name="description"
    content="TKA synthesizes juggling notation, music theory, and flow arts vocabulary into a visual notation system for dual wielded props. Learn about the influences behind The Kinetic Alphabet."
  />
  <meta
    name="keywords"
    content="flow arts theory, VTG, Vulcan Tech Gospel, Siteswap, juggling notation, music theory, flow arts notation, dual wielded props, TKA influences"
  />
</svelte:head>

<SiteHeader />

<div class="roots-page">
  <div class="roots-container">
    <!-- Header -->
    <header class="roots-header">
      <a href={backHref} class="back-link">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span>Back</span>
      </a>

      <div class="header-content">
        <h1>Standing on Shoulders</h1>
        <p class="subtitle">The influences behind <a href={backHref}>The Kinetic Alphabet</a></p>
      </div>
    </header>

    <!-- Intro -->
    <section class="intro-section">
      <p>
        The Kinetic Alphabet synthesizes ideas from three sources: <span class="emphasis">juggling notation, music theory, and flow arts vocabulary</span>.
      </p>
      <p>
        This page explains where the ideas came from and how they combined into something new.
      </p>
    </section>

    <!-- VTG Section -->
    <article class="content-section">
      <div class="section-header">
        <div class="icon-wrapper" style="--accent: #f59e0b;">
          <i class="fas fa-scroll" aria-hidden="true"></i>
        </div>
        <h2>Vulcan Tech Gospel (VTG)</h2>
      </div>

      <div class="section-content">
        <p>
          <strong>Vulcan Tech Gospel</strong> is an ambitious unified theory for poi movement. Created by
          <a href={externalLinks.noelYeeVTG} target="_blank" rel="noopener noreferrer">Noel Yee</a>
          and collaborators at the Vulcan Lofts in Oakland, CA, it established the vocabulary
          flow artists use to talk about movement:
        </p>

        <ul class="concept-list">
          <li><strong>Timing relationships</strong> - together time, split time</li>
          <li><strong>Direction relationships</strong> - same direction, opposite direction</li>
          <li><strong>Motion types</strong> - prospin, antispin</li>
          <li><strong>Plane orientation</strong> - wall plane, wheel plane, floor plane</li>
        </ul>

        <div class="external-links">
          <a href={externalLinks.noelYeeVTG} target="_blank" rel="noopener noreferrer" class="resource-link">
            <i class="fas fa-external-link-alt" aria-hidden="true"></i>
            Vulcan Tech Gospel - Noel Yee (creator)
          </a>
          <a href={externalLinks.drexVTG} target="_blank" rel="noopener noreferrer" class="resource-link">
            <i class="fas fa-external-link-alt" aria-hidden="true"></i>
            VTG Explained - DrexFactor
          </a>
          <a href={externalLinks.flowArtsInstituteVTG} target="_blank" rel="noopener noreferrer" class="resource-link">
            <i class="fas fa-external-link-alt" aria-hidden="true"></i>
            VTG Resources - Flow Arts Institute
          </a>
        </div>

        <p>
          TKA adopts VTG's vocabulary directly. When we say "pro" and "anti," we're speaking VTG.
          The timing and direction relationships that define TKA's letter types come from this foundation.
        </p>
      </div>
    </article>

    <!-- Siteswap Section -->
    <article class="content-section">
      <div class="section-header">
        <div class="icon-wrapper" style="--accent: #ec4899;">
          <i class="fas fa-circle-nodes" aria-hidden="true"></i>
        </div>
        <h2>Siteswap Notation</h2>
      </div>

      <div class="section-content">
        <p>
          <strong>Siteswap</strong> is a notation system for juggling. It represents sequences
          as strings of numbers, where each number describes one discrete action.
        </p>

        <div class="external-links">
          <a href={externalLinks.siteswapTutorial} target="_blank" rel="noopener noreferrer" class="resource-link">
            <i class="fas fa-external-link-alt" aria-hidden="true"></i>
            Siteswap Tutorial - Juggle.org
          </a>
          <a href={externalLinks.siteswapWiki} target="_blank" rel="noopener noreferrer" class="resource-link">
            <i class="fas fa-external-link-alt" aria-hidden="true"></i>
            Siteswap - Wikipedia
          </a>
        </div>

        <p>
          Siteswap showed that complex sequences could be broken into discrete units and
          documented with simple symbols. TKA applies this to flow arts - one pictograph per beat.
        </p>
      </div>
    </article>

    <!-- Music Theory Section -->
    <article class="content-section highlight">
      <div class="section-header">
        <div class="icon-wrapper" style="--accent: #6366f1;">
          <i class="fas fa-music" aria-hidden="true"></i>
        </div>
        <h2>Music Theory</h2>
      </div>

      <div class="section-content">
        <p>
          Music theory provided two core ideas: letters as symbolic representation and
          rhythmic structure.
        </p>

        <p>
          Sheet music documents what notes to play, not how to feel while playing them.
          Musicians figure out the execution. TKA works the same way - pictographs document
          what your hands and props are doing. You figure out the performance.
        </p>

        <p>
          Using letters (A-Z, Greek alphabet) as shorthand came directly from musical notation.
          During rehearsal, saying "A" is faster than describing the full movement.
        </p>
      </div>
    </article>

    <!-- Why This Matters -->
    <article class="content-section">
      <div class="section-header">
        <div class="icon-wrapper" style="--accent: #22c55e;">
          <i class="fas fa-bridge" aria-hidden="true"></i>
        </div>
        <h2>The Synthesis</h2>
      </div>

      <div class="section-content">
        <p>
          TKA combines these three influences:
        </p>

        <ul class="matters-list">
          <li>
            <strong>VTG</strong> - vocabulary for timing, direction, and motion types
          </li>
          <li>
            <strong>Siteswap</strong> - discrete unit documentation
          </li>
          <li>
            <strong>Music theory</strong> - letters and rhythmic structure
          </li>
        </ul>

        <p>
          The result is a visual notation system for static dual wielded props - staff, fans,
          buugeng, clubs, hoops, and anything you can hold two of.
        </p>
      </div>
    </article>

    <!-- CTA -->
    <footer class="roots-footer">
      <div class="cta-card">
        <h3>Browse TKA</h3>
        <p>See how these ideas come together in practice.</p>
        <a href="/create" class="cta-button">
          <span>Open TKA Composer</span>
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
        </a>
      </div>
    </footer>
  </div>

</div>

<style>
  .roots-page {
    position: relative;
    min-height: 100vh;
    padding-top: 64px; /* clear the fixed SiteHeader */
    background: linear-gradient(145deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
    color: #ffffff;
    overflow-x: hidden;
    font-family: system-ui, -apple-system, sans-serif;
    line-height: 1.7;
  }

  /* Container */
  .roots-container {
    position: relative;
    z-index: 1;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }

  /* Header */
  .roots-header {
    margin-bottom: 3rem;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: rgba(255, 255, 255, 0.6);
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 100px;
    margin-bottom: 2rem;
    transition: all 0.2s ease;
  }

  .back-link:hover {
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.05);
  }

  .header-content {
    text-align: center;
  }

  h1 {
    font-size: clamp(2.5rem, 6vw, 3.5rem);
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.7) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.2;
    padding-bottom: 0.1em;
  }

  .subtitle {
    font-size: 1.125rem;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
  }

  .subtitle a {
    color: #818cf8;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .subtitle a:hover {
    color: #ffffff;
  }

  /* Intro */
  .intro-section {
    max-width: 650px;
    margin: 0 auto 3rem;
    text-align: center;
  }

  .intro-section p {
    color: rgba(255, 255, 255, 0.6);
    font-size: 1.125rem;
    margin: 0 0 1rem 0;
  }

  .intro-section .emphasis {
    color: #ffffff;
    font-style: italic;
  }

  /* Content sections */
  .content-section {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 2rem;
    margin-bottom: 2rem;
    transition: all 0.25s ease;
  }

  .content-section:hover {
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }

  .content-section.highlight {
    background: color-mix(in srgb, #6366f1 12%, transparent);
    border-color: color-mix(in srgb, #6366f1 25%, transparent);
  }

  .content-section.highlight:hover {
    border-color: color-mix(in srgb, #6366f1 40%, transparent);
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: 12px;
    color: var(--accent);
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .content-section h2 {
    font-size: 1.375rem;
    font-weight: 600;
    margin: 0;
    color: #ffffff;
  }

  .section-content p {
    color: rgba(255, 255, 255, 0.6);
    margin: 0 0 1rem 0;
  }

  .section-content p:last-child {
    margin-bottom: 0;
  }

  .section-content a {
    color: #818cf8;
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s ease;
  }

  .section-content a:hover {
    border-bottom-color: #818cf8;
  }

  .section-content strong {
    color: #ffffff;
    font-weight: 600;
  }

  /* Lists */
  .concept-list,
  .matters-list {
    list-style: none;
    padding: 0;
    margin: 1.5rem 0;
  }

  .concept-list li,
  .matters-list li {
    position: relative;
    padding-left: 1.5rem;
    margin-bottom: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .concept-list li::before,
  .matters-list li::before {
    content: "→";
    position: absolute;
    left: 0;
    color: #818cf8;
    opacity: 0.6;
  }

  /* External links - modern card style */
  .external-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 1.5rem 0;
  }

  .resource-link {
    display: inline-flex;
    align-items: center;
    gap: 0.625rem;
    color: #ffffff;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    padding: 0.625rem 1rem;
    background: color-mix(in srgb, #6366f1 12%, transparent);
    border: 1px solid color-mix(in srgb, #6366f1 20%, transparent);
    border-radius: 100px;
    transition: all 0.2s ease;
  }

  .resource-link:hover {
    background: color-mix(in srgb, #6366f1 20%, transparent);
    border-color: color-mix(in srgb, #6366f1 40%, transparent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px color-mix(in srgb, #6366f1 15%, transparent);
  }

  .resource-link:active {
    transform: translateY(0);
  }

  .resource-link i {
    font-size: 0.75rem;
    color: #818cf8;
    transition: transform 0.2s ease;
  }

  .resource-link:hover i {
    transform: translateX(2px);
  }


  /* Footer CTA */
  .roots-footer {
    margin-top: 3rem;
  }

  .cta-card {
    text-align: center;
    padding: 3rem 2rem;
    background: color-mix(in srgb, #6366f1 15%, transparent);
    border: 1px solid color-mix(in srgb, #6366f1 30%, transparent);
    border-radius: 24px;
    transition: background 0.3s ease, border-color 0.3s ease;
  }

  .cta-card h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: #ffffff;
  }

  .cta-card p {
    color: rgba(255, 255, 255, 0.6);
    margin: 0 0 1.5rem 0;
  }

  .cta-button {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    background: #6366f1;
    color: #ffffff;
    text-decoration: none;
    padding: 1rem 2rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1.125rem;
    transition: all 0.2s ease;
  }

  .cta-button:hover {
    background: #818cf8;
    transform: translateY(-2px);
    box-shadow: 0 12px 32px color-mix(in srgb, #6366f1 40%, transparent);
  }

  .cta-button i {
    transition: transform 0.2s ease;
  }

  .cta-button:hover i {
    transform: translateX(4px);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .roots-container {
      padding: 1.5rem 1rem 3rem;
    }

    .content-section {
      padding: 1.5rem;
    }

    .section-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .cta-card {
      padding: 2rem 1.5rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .content-section,
    .back-link,
    .cta-button,
    .cta-card,
    .section-content a,
    .resource-link {
      transition: none;
    }

    .content-section:hover,
    .resource-link:hover,
    .resource-link:active,
    .cta-button:hover {
      transform: none;
    }

    .resource-link:hover i,
    .cta-button:hover i {
      transform: none;
    }
  }
</style>
