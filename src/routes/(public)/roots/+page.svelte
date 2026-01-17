<script lang="ts">
  import { onMount } from "svelte";
  import { APP_DOMAIN } from "../../../config/domains";
  import BackgroundCanvas from "$lib/shared/background/shared/components/BackgroundCanvas.svelte";
  import { BackgroundType } from "$lib/shared/background/shared/domain/enums/background-enums";
  import { ANIMATED_BACKGROUNDS } from "$lib/shared/background/shared/config/animated-backgrounds";
  import { applyThemeForBackground } from "$lib/shared/settings/utils/background-theme-calculator";

  // Use shared animated backgrounds config
  const backgrounds = ANIMATED_BACKGROUNDS;

  let currentBgIndex = $state(0);
  let currentBackground = $derived(backgrounds[currentBgIndex]?.type ?? BackgroundType.NIGHT_SKY);
  let currentIcon = $derived(backgrounds[currentBgIndex]?.icon ?? "fa-moon");
  let currentLabel = $derived(backgrounds[currentBgIndex]?.label ?? "Night Sky");

  function cycleBackground() {
    currentBgIndex = (currentBgIndex + 1) % backgrounds.length;
    applyThemeForBackground(backgrounds[currentBgIndex]!.type);
  }

  onMount(() => {
    applyThemeForBackground(currentBackground);
  });

  // In dev, back goes to /landing; in prod, back goes to /
  const backHref = import.meta.env.DEV ? "/landing" : "/";

  const externalLinks = {
    // VTG sources
    noelYeeVTG: "https://noelyee.com/instruction/vulcan-tech-gospel",
    drexVTG: "https://drexfactor.com/weirdscience/2015/11/25/vulcan_tech_gospel_vtg_explained",
    flowArtsInstituteVTG: "https://flowartsinstitute.com/tag/vulcan-tech-gospel/",
    // CAPs sources
    drexCAPs: "https://drexfactor.com/reference/math_caps",
    drexMath: "https://drexfactor.com/weirdscience/2014/05/06/mathematical_approach_classifying_poi_patterns_introduction_and_basics",
    homeOfPoi: "https://www.homeofpoi.com/us/lessons/teach/POI/Poi-terminology/Poi-terminology",
    // Notation reference
    labanotation: "https://www.britannica.com/art/labanotation",
  };
</script>

<svelte:head>
  <title>The Roots of TKA | Standing on Shoulders</title>
  <meta
    name="description"
    content="TKA builds on decades of flow arts theory. Learn about Vulcan Tech Gospel (VTG), Continuous Assembly Patterns (CAPs), and how LOOPs evolved from these foundations."
  />
  <meta
    name="keywords"
    content="flow arts theory, VTG, Vulcan Tech Gospel, CAPs, Continuous Assembly Patterns, poi theory, tech poi, Drex, flow arts notation history, LOOPs"
  />
</svelte:head>

<div class="roots-page">
  <!-- Animated Background -->
  <BackgroundCanvas backgroundType={currentBackground} quality="medium" />

  <div class="roots-container">
    <!-- Header -->
    <header class="roots-header">
      <a href={backHref} class="back-link">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span>Back</span>
      </a>

      <div class="header-content">
        <h1>Standing on Shoulders</h1>
        <p class="subtitle">The roots of <a href={backHref}>The Kinetic Alphabet</a> and its place in flow arts theory</p>
      </div>
    </header>

    <!-- Intro -->
    <section class="intro-section">
      <p>
        The Kinetic Alphabet grows from decades of work by flow artists
        who wrestled with the same question: <span class="emphasis">how do we write this down?</span>
      </p>
      <p>
        This page acknowledges the people and systems that came before,
        explains where TKA diverges, and makes the case for why those differences matter.
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
          <strong>Vulcan Tech Gospel</strong> is the most ambitious attempt to create a
          unified theory for poi movement. Created by
          <a href={externalLinks.noelYeeVTG} target="_blank" rel="noopener noreferrer">Noel Yee</a>
          and collaborators at the Vulcan Lofts in Oakland, CA, it established foundational
          concepts that TKA still uses today:
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
          TKA adopts much of VTG's vocabulary directly. When we say "pro" and "anti,"
          we're speaking VTG. The timing and direction relationships that define
          TKA's letter types come from this foundation.
        </p>

        <h3>What VTG didn't solve</h3>

        <p>
          VTG provides vocabulary and classification, but not a notation system.
          What's the difference?
        </p>

        <p>
          A <strong>notation system</strong> (like
          <a href={externalLinks.labanotation} target="_blank" rel="noopener noreferrer">Labanotation</a>
          for dance or sheet music for musicians) lets you write down a specific sequence
          that someone else can read and reproduce. It records movements in a written form
          with standardized symbols for timing, direction, and body position.
        </p>

        <p>
          VTG gives you the words to describe and categorize patterns.
          TKA gives you the symbols to write them down.
        </p>
      </div>
    </article>

    <!-- CAPs Section -->
    <article class="content-section">
      <div class="section-header">
        <div class="icon-wrapper" style="--accent: #ec4899;">
          <i class="fas fa-circle-nodes" aria-hidden="true"></i>
        </div>
        <h2>Continuous Assembly Patterns (CAPs)</h2>
      </div>

      <div class="section-content">
        <p>
          <strong>CAPs</strong> - Continuous Assembly Patterns - were coined by
          <strong>Damien (Zaltymbunk)</strong> around Burning Man 2007 and later formalized
          mathematically by <strong>Ben Drexler (Drex)</strong> in his extensive documentation.
        </p>

        <p>
          The core idea: take fractional pieces of poi moves and assemble them into
          repeating patterns. The classic C-CAP is 180° of extension followed by
          180° of antispin - creating that kidney-bean shape many spinners recognize.
        </p>

        <div class="external-links">
          <a href={externalLinks.drexCAPs} target="_blank" rel="noopener noreferrer" class="resource-link">
            <i class="fas fa-external-link-alt" aria-hidden="true"></i>
            The Math of CAPs - DrexFactor
          </a>
          <a href={externalLinks.drexMath} target="_blank" rel="noopener noreferrer" class="resource-link">
            <i class="fas fa-external-link-alt" aria-hidden="true"></i>
            A Mathematical Approach to Classifying Poi Patterns - DrexFactor
          </a>
          <a href={externalLinks.homeOfPoi} target="_blank" rel="noopener noreferrer" class="resource-link">
            <i class="fas fa-external-link-alt" aria-hidden="true"></i>
            Poi Terminology - Home of Poi
          </a>
        </div>

        <p>
          Drex's mathematical notation uses <strong>Theta</strong> (rotation frequencies) and
          <strong>Rho</strong> (arm/poi radii) to describe patterns precisely. It's rigorous,
          elegant, and captures the two-circle model of poi spinning beautifully.
        </p>

        <h3>What CAPs didn't solve</h3>

        <p>
          CAPs are fundamentally poi-specific. The two-circle model (shoulder to hand to poi tip)
          doesn't translate cleanly to staff, fans, buugeng, or other props. CAPs also describe
          existing patterns rather than generate new ones. They're analytical, not generative.
        </p>
      </div>
    </article>

    <!-- LOOPs Section -->
    <article class="content-section highlight">
      <div class="section-header">
        <div class="icon-wrapper" style="--accent: #6366f1;">
          <i class="fas fa-infinity" aria-hidden="true"></i>
        </div>
        <h2>LOOPs: A Different Approach</h2>
      </div>

      <div class="section-content">
        <p>
          <strong>LOOPs</strong> - Linked Orbital Offset Patterns - take a different path.
          Instead of circle math, LOOPs use <strong>grid transformations</strong>.
        </p>

        <p>
          The idea: start with any sequence and apply geometric operations to generate
          variations that flow seamlessly back to the beginning.
        </p>

        <div class="comparison-table">
          <div class="comparison-row header">
            <div class="comparison-cell"></div>
            <div class="comparison-cell">CAPs</div>
            <div class="comparison-cell">LOOPs</div>
          </div>
          <div class="comparison-row">
            <div class="comparison-cell label">Foundation</div>
            <div class="comparison-cell">Two-circle model (poi)</div>
            <div class="comparison-cell">Grid positions (any prop)</div>
          </div>
          <div class="comparison-row">
            <div class="comparison-cell label">Approach</div>
            <div class="comparison-cell">Combine fractional moves</div>
            <div class="comparison-cell">Transform entire beats</div>
          </div>
          <div class="comparison-row">
            <div class="comparison-cell label">Props</div>
            <div class="comparison-cell">Poi-specific</div>
            <div class="comparison-cell">Staff, fans, buugeng, etc.</div>
          </div>
          <div class="comparison-row">
            <div class="comparison-cell label">Purpose</div>
            <div class="comparison-cell">Describe patterns</div>
            <div class="comparison-cell">Generate patterns</div>
          </div>
          <div class="comparison-row">
            <div class="comparison-cell label">Combinations</div>
            <div class="comparison-cell">Limited</div>
            <div class="comparison-cell">4 components → 13+ types</div>
          </div>
        </div>

        <h3>The Four LOOP Components</h3>

        <ul class="loop-components">
          <li>
            <strong style="color: #36c3ff;">Rotated</strong> -
            Rotate positions 90° or 180° around the grid center
          </li>
          <li>
            <strong style="color: #6F2DA8;">Mirrored</strong> -
            Flip left-to-right, like a mirror image
          </li>
          <li>
            <strong style="color: #26e600;">Swapped</strong> -
            Exchange which hand does what
          </li>
          <li>
            <strong style="color: #eb7d00;">Inverted</strong> -
            Transform motions to their opposites (pro ↔ anti)
          </li>
        </ul>

        <p>
          These four operations can be combined freely. Rotated + Swapped.
          Mirrored + Inverted. All four together. Each combination produces
          sequences with different characteristics, all seamlessly loopable.
        </p>

        <p>
          This is where TKA becomes <strong>generative</strong> - not just documenting
          what you know, but showing you patterns you've never tried.
        </p>
      </div>
    </article>

    <!-- Why This Matters -->
    <article class="content-section">
      <div class="section-header">
        <div class="icon-wrapper" style="--accent: #22c55e;">
          <i class="fas fa-bridge" aria-hidden="true"></i>
        </div>
        <h2>Why This Matters</h2>
      </div>

      <div class="section-content">
        <p>
          TKA isn't trying to replace VTG or CAPs. They solve different problems.
        </p>

        <ul class="matters-list">
          <li>
            <strong>VTG</strong> gives us vocabulary to talk about movement.
          </li>
          <li>
            <strong>CAPs</strong> give poi spinners a mathematical framework for understanding pattern structure.
          </li>
          <li>
            <strong>TKA</strong> gives everyone a way to write it down - and
            <strong>LOOPs</strong> give everyone a way to discover new patterns algorithmically.
          </li>
        </ul>

        <p>
          The notation is open. The concepts are documented. We're not competing
          with the work that came before - we're building the next layer on top of it.
        </p>
      </div>
    </article>

    <!-- Acknowledgments -->
    <article class="content-section acknowledgments">
      <div class="section-header">
        <div class="icon-wrapper" style="--accent: #8b5cf6;">
          <i class="fas fa-heart" aria-hidden="true"></i>
        </div>
        <h2>Acknowledgments</h2>
      </div>

      <div class="section-content">
        <p>TKA exists because others did the hard work first:</p>

        <ul class="thanks-list">
          <li>
            <strong>Ben Drexler (Drex)</strong> - For the mathematical rigor of CAPs documentation
            and years of tech poi education through DrexFactor.
          </li>
          <li>
            <strong>Damien (Zaltymbunk)</strong> - For coining CAPs and contributing the
            foundational math.
          </li>
          <li>
            <strong>The VTG contributors</strong> - For establishing the vocabulary we all
            use to discuss timing, direction, and motion types.
          </li>
          <li>
            <strong>Home of Poi community</strong> - For being the place where these
            ideas were debated, refined, and preserved.
          </li>
          <li>
            <strong>Every flow artist</strong> who taught, documented, or shared what they learned.
          </li>
        </ul>

        <p class="closing">
          If you're one of these people and you have thoughts, critiques, or want to
          collaborate - reach out. TKA is meant to serve the community, and that
          means being open to feedback from those who laid the groundwork.
        </p>
      </div>
    </article>

    <!-- CTA -->
    <footer class="roots-footer">
      <div class="cta-card">
        <h3>Explore TKA</h3>
        <p>See how these ideas come together in practice.</p>
        <a href={APP_DOMAIN} class="cta-button">
          <span>Open TKA Scribe</span>
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
        </a>
      </div>
    </footer>
  </div>

  <!-- Theme Toggle Button -->
  <button
    class="theme-toggle"
    onclick={cycleBackground}
    title="Change theme: {currentLabel}"
    aria-label="Change background theme"
  >
    <i class="fas {currentIcon}" aria-hidden="true"></i>
  </button>
</div>

<style>
  .roots-page {
    position: relative;
    min-height: 100vh;
    color: var(--theme-text, #ffffff);
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
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 100px;
    margin-bottom: 2rem;
    transition: all 0.2s ease;
  }

  .back-link:hover {
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.05));
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
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .subtitle a {
    color: var(--theme-accent-strong, #818cf8);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .subtitle a:hover {
    color: var(--theme-text, #ffffff);
  }

  /* Intro */
  .intro-section {
    max-width: 650px;
    margin: 0 auto 3rem;
    text-align: center;
  }

  .intro-section p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 1.125rem;
    margin: 0 0 1rem 0;
  }

  .intro-section .emphasis {
    color: var(--theme-text, #ffffff);
    font-style: italic;
  }

  /* Content sections */
  .content-section {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    padding: 2rem;
    margin-bottom: 2rem;
    transition: all 0.25s ease;
  }

  .content-section:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    transform: translateY(-2px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }

  .content-section.highlight {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 12%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
  }

  .content-section.highlight:hover {
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
  }

  .content-section.acknowledgments {
    background: linear-gradient(
      135deg,
      rgba(139, 92, 246, 0.08) 0%,
      rgba(139, 92, 246, 0.02) 100%
    );
    border-color: rgba(139, 92, 246, 0.25);
  }

  .content-section.acknowledgments:hover {
    border-color: rgba(139, 92, 246, 0.4);
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
    color: var(--theme-text, #ffffff);
  }

  .content-section h3 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 2rem 0 1rem 0;
    color: var(--theme-text, #ffffff);
  }

  .section-content p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0 0 1rem 0;
  }

  .section-content p:last-child {
    margin-bottom: 0;
  }

  .section-content a {
    color: var(--theme-accent-strong, #818cf8);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s ease;
  }

  .section-content a:hover {
    border-bottom-color: var(--theme-accent-strong, #818cf8);
  }

  .section-content strong {
    color: var(--theme-text, #ffffff);
    font-weight: 600;
  }

  /* Lists */
  .concept-list,
  .loop-components,
  .matters-list,
  .thanks-list {
    list-style: none;
    padding: 0;
    margin: 1.5rem 0;
  }

  .concept-list li,
  .loop-components li,
  .matters-list li,
  .thanks-list li {
    position: relative;
    padding-left: 1.5rem;
    margin-bottom: 0.75rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .concept-list li::before,
  .loop-components li::before,
  .matters-list li::before,
  .thanks-list li::before {
    content: "→";
    position: absolute;
    left: 0;
    color: var(--theme-accent-strong, #818cf8);
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
    color: var(--theme-text, #ffffff);
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    padding: 0.625rem 1rem;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
    border-radius: 100px;
    transition: all 0.2s ease;
  }

  .resource-link:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
  }

  .resource-link:active {
    transform: translateY(0);
  }

  .resource-link i {
    font-size: 0.75rem;
    color: var(--theme-accent-strong, #818cf8);
    transition: transform 0.2s ease;
  }

  .resource-link:hover i {
    transform: translateX(2px);
  }

  /* Comparison table */
  .comparison-table {
    margin: 1.5rem 0;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    overflow: hidden;
  }

  .comparison-row {
    display: grid;
    grid-template-columns: 120px 1fr 1fr;
  }

  .comparison-row.header {
    background: rgba(255, 255, 255, 0.05);
  }

  .comparison-row:not(:last-child) {
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .comparison-cell {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .comparison-cell:not(:last-child) {
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .comparison-cell.label {
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    background: rgba(255, 255, 255, 0.02);
  }

  .comparison-row.header .comparison-cell {
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    text-align: center;
  }

  .comparison-row.header .comparison-cell:first-child {
    text-align: left;
  }

  /* Closing */
  .closing {
    font-style: italic;
    margin-top: 1.5rem;
  }

  /* Footer CTA */
  .roots-footer {
    margin-top: 3rem;
  }

  .cta-card {
    text-align: center;
    padding: 3rem 2rem;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent, #6366f1) 30%, transparent);
    border-radius: 24px;
    transition: background 0.3s ease, border-color 0.3s ease;
  }

  .cta-card h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: var(--theme-text, #ffffff);
  }

  .cta-card p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0 0 1.5rem 0;
  }

  .cta-button {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    background: var(--theme-accent, #6366f1);
    color: #ffffff;
    text-decoration: none;
    padding: 1rem 2rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1.125rem;
    transition: all 0.2s ease;
  }

  .cta-button:hover {
    background: var(--theme-accent-strong, #818cf8);
    transform: translateY(-2px);
    box-shadow: 0 12px 32px color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
  }

  .cta-button i {
    transition: transform 0.2s ease;
  }

  .cta-button:hover i {
    transform: translateX(4px);
  }

  /* Theme Toggle Button */
  .theme-toggle {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 100;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--theme-accent-strong, #818cf8) 15%, rgba(0, 0, 0, 0.5));
    border: 1px solid color-mix(in srgb, var(--theme-accent-strong, #818cf8) 25%, transparent);
    border-radius: 50%;
    color: var(--theme-accent-strong, #818cf8);
    font-size: 1.125rem;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .theme-toggle:hover {
    background: color-mix(in srgb, var(--theme-accent-strong, #818cf8) 25%, rgba(0, 0, 0, 0.6));
    border-color: color-mix(in srgb, var(--theme-accent-strong, #818cf8) 40%, transparent);
    transform: scale(1.05);
  }

  .theme-toggle:active {
    transform: scale(0.95);
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

    .comparison-row {
      grid-template-columns: 100px 1fr 1fr;
    }

    .comparison-cell {
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
    }

    .cta-card {
      padding: 2rem 1.5rem;
    }

    .theme-toggle {
      bottom: 16px;
      right: 16px;
      width: 44px;
      height: 44px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .content-section,
    .back-link,
    .theme-toggle,
    .cta-button,
    .cta-card,
    .section-content a,
    .resource-link {
      transition: none;
    }

    .content-section:hover,
    .resource-link:hover,
    .resource-link:active,
    .cta-button:hover,
    .theme-toggle:hover {
      transform: none;
    }

    .resource-link:hover i,
    .cta-button:hover i {
      transform: none;
    }
  }
</style>
