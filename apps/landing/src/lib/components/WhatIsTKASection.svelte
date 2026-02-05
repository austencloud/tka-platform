<!--
  WhatIsTKASection.svelte (Landing - standalone)

  Asymmetric two-column: animation demo (left) + explanation (right).
  Opposite layout from hero for visual variety.
  Absorbs the animation demo from the deleted NotationShowcaseSection.
-->
<script lang="ts">
  import LandingAnimationDemo from "./LandingAnimationDemo.svelte";

  const APP_DOMAIN = "https://tkascribe.com";
</script>

<section class="what-is" id="what">
  <div class="container">
    <div class="two-col">
      <div class="demo-side">
        <LandingAnimationDemo />
      </div>
      <div class="text-side">
        <h2>Sheet music for spinners</h2>
        <p class="body-copy">
          Musicians have notation. Dancers have Laban. Flow arts has TKA.
          Each pictograph captures one beat: where your hands are, how your
          props rotate, which direction they travel. String beats into words.
          Words become choreography you can read, share, and teach without video.
        </p>
      </div>
    </div>

    <div class="learn-more">
      <a href={`${APP_DOMAIN}/about`} class="link-card">
        <strong>About TKA</strong>
        <span>Learn how the system works</span>
      </a>
      <a href={`${APP_DOMAIN}/roots`} class="link-card">
        <strong>Roots</strong>
        <span>History and notation fundamentals</span>
      </a>
    </div>
  </div>
</section>

<style>
  .what-is {
    padding: 120px 24px;
  }

  .container {
    max-width: 1100px;
    margin: 0 auto;
  }

  .two-col {
    display: flex;
    align-items: center;
    gap: clamp(40px, 6vw, 80px);
    margin-bottom: 64px;
  }

  .demo-side {
    flex: 0 0 auto;
    width: clamp(280px, 38vw, 440px);
  }

  .text-side {
    flex: 1;
    min-width: 0;
  }

  h2 {
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    margin-bottom: 20px;
    font-weight: 600;
    line-height: 1.2;
  }

  .body-copy {
    font-size: clamp(1rem, 1.5vw, 1.125rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    line-height: 1.75;
  }

  .learn-more {
    display: flex;
    justify-content: center;
    gap: 24px;
    flex-wrap: wrap;
  }

  .link-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 20px 32px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.2s ease, background 0.2s ease;
    min-width: 200px;
    text-align: center;
  }

  .link-card:hover {
    border-color: var(--theme-accent, #6366f1);
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.06));
  }

  .link-card strong {
    font-size: 1.125rem;
    color: var(--theme-text, #ffffff);
  }

  .link-card span {
    font-size: 0.875rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  @media (max-width: 900px) {
    .two-col {
      flex-direction: column;
      gap: 40px;
    }

    .demo-side {
      width: 100%;
      max-width: 400px;
    }

    .text-side {
      text-align: center;
    }
  }

  @media (max-width: 480px) {
    .what-is {
      padding: 80px 16px;
    }

    .learn-more {
      flex-direction: column;
      align-items: center;
    }

    .link-card {
      width: 100%;
      max-width: 280px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .link-card {
      transition: none;
    }
  }
</style>
