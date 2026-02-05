<!--
  FeaturesSection.svelte (Landing - standalone)

  Alternating icon-left / icon-right rows on desktop.
  Stacks vertically on mobile. Visual variety from the
  two-column sections above and below.
-->
<script lang="ts">
  import { FEATURES } from "$lib/landing-content";
</script>

<section class="features" id="features">
  <div class="container">
    <h2>What you can do</h2>
    <p class="section-intro">
      TKA Scribe is free. Works in any browser.
    </p>

    <div class="feature-rows">
      {#each FEATURES as feature, i}
        <div class="feature-row" class:reverse={i % 2 === 1} style="--accent: {feature.color}">
          <div class="feature-icon-area">
            <span class="feature-icon">{feature.icon}</span>
          </div>
          <div class="feature-text">
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .features {
    padding: 120px 24px;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
  }

  h2 {
    font-size: clamp(2rem, 5vw, 3rem);
    margin-bottom: 1rem;
    text-align: center;
    font-weight: 600;
    line-height: 1.2;
  }

  .section-intro {
    text-align: center;
    font-size: 1.125rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    max-width: 700px;
    margin: 0 auto 4rem;
  }

  .feature-rows {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .feature-row {
    display: flex;
    align-items: center;
    gap: 32px;
    padding: 28px 32px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    transition: border-color 0.2s ease;
  }

  .feature-row:hover {
    border-color: var(--accent);
  }

  .feature-row.reverse {
    flex-direction: row-reverse;
  }

  .feature-icon-area {
    flex: 0 0 auto;
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 16px;
  }

  .feature-icon {
    font-size: 2rem;
  }

  .feature-text {
    flex: 1;
    min-width: 0;
  }

  .feature-row.reverse .feature-text {
    text-align: right;
  }

  .feature-text h3 {
    font-size: 1.25rem;
    margin-bottom: 4px;
    color: var(--accent);
  }

  .feature-text p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.9375rem;
    margin: 0;
  }

  @media (max-width: 600px) {
    .features {
      padding: 80px 16px;
    }

    .feature-row,
    .feature-row.reverse {
      flex-direction: row;
      gap: 20px;
      padding: 20px;
    }

    .feature-row.reverse .feature-text {
      text-align: left;
    }

    .feature-icon-area {
      width: 52px;
      height: 52px;
      border-radius: 12px;
    }

    .feature-icon {
      font-size: 1.5rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .feature-row {
      transition: none;
    }
  }
</style>
