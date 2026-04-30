<!--
  Mathematical Foundations Page
  Navigate to /test/math-foundations to browse the mathematical patterns in TKA
-->
<script lang="ts">
  import HeroSection from "$lib/features/math-foundations/components/HeroSection.svelte";
  import PositionGroupsSection from "$lib/features/math-foundations/components/PositionGroupsSection.svelte";
  import LetterTriadSection from "$lib/features/math-foundations/components/LetterTriadSection.svelte";
  import MotionTypesSection from "$lib/features/math-foundations/components/MotionTypesSection.svelte";

  // ITI container is ready synchronously - no module loading needed
  let servicesReady = $state(true);
</script>

<svelte:head>
  <title>Mathematical Foundations | The Kinetic Alphabet</title>
</svelte:head>

<div class="math-foundations-page">
  <HeroSection />
  <PositionGroupsSection />
  {#if servicesReady}
    <LetterTriadSection />
  {:else}
    <section class="loading-section">
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>Loading pictographs...</p>
      </div>
    </section>
  {/if}

  <MotionTypesSection />

  <section class="more-levels">
    <div class="container">
      <h2>More Levels to Browse</h2>
      <p class="intro">
        The pattern continues. As you learn more, you'll recognize it in:
      </p>

      <div class="levels-grid">
        <div class="level-card">
          <span class="number">4</span>
          <h3>LOOP Transformations</h3>
          <p>Mirror, Swap, and their combinations follow group theory structures.</p>
        </div>
        <div class="level-card">
          <span class="number">5</span>
          <h3>Type Classifications</h3>
          <p>Types 1-6 organized in meaningful pairs and triads.</p>
        </div>
        <div class="level-card">
          <span class="number">6</span>
          <h3>Grid Modes</h3>
          <p>Diamond and Box grids as opposing structures with hybrid possibilities.</p>
        </div>
      </div>

      <div class="footer-note">
        <p>
          Understanding this pattern makes TKA <strong>much easier to learn</strong>.
          You don't memorize - you recognize. Once you see the triad structure,
          you can predict the third element from knowing the first two.
        </p>
      </div>
    </div>
  </section>
</div>

<style>
  .math-foundations-page {
    min-height: 100vh;
    background: var(--theme-panel-bg, #0a0a0f);
    color: var(--theme-text, #fff);
  }

  .more-levels {
    padding: 80px 24px 120px;
  }

  .container {
    max-width: 1000px;
    margin: 0 auto;
  }

  h2 {
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    margin-bottom: 1rem;
    text-align: center;
    font-weight: 600;
    line-height: 1.2;
  }

  .intro {
    text-align: center;
    font-size: 1.125rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    max-width: 600px;
    margin: 0 auto 2.5rem;
    line-height: 1.6;
  }

  .levels-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-bottom: 3rem;
  }

  .level-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    padding: 24px;
    text-align: center;
    transition: all var(--duration-normal) ease;
  }

  .level-card:hover {
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }

  .number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 50%;
    font-size: 1.125rem;
    font-weight: 600;
    color: #a5b4fc;
    margin-bottom: 16px;
  }

  .level-card h3 {
    font-size: 1.125rem;
    margin-bottom: 8px;
    color: var(--theme-text, #fff);
  }

  .level-card p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.9375rem;
    line-height: 1.5;
    margin: 0;
  }

  .footer-note {
    background: linear-gradient(
      135deg,
      rgba(99, 102, 241, 0.08) 0%,
      rgba(20, 184, 166, 0.08) 100%
    );
    border: 1px solid rgba(99, 102, 241, 0.15);
    border-radius: 16px;
    padding: 28px;
    text-align: center;
  }

  .footer-note p {
    margin: 0;
    color: var(--theme-text, #fff);
    font-size: 1.0625rem;
    line-height: 1.7;
    max-width: 700px;
    margin: 0 auto;
  }

  @media (max-width: 768px) {
    .levels-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Loading State */
  .loading-section {
    padding: 80px 24px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation: none;
    }
  }
</style>
