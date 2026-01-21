<script lang="ts">
  /**
   * NotationShowcaseSection
   *
   * Shows the infinite spinner animation with pictograph notation.
   * Demonstrates that the movements have a written form.
   */
  import LandingAnimationDemo from "./LandingAnimationDemo.svelte";
</script>

<section class="notation-showcase" id="notation">
  <div class="container">
    <h2>Every Move Has a Symbol</h2>
    <p class="section-intro">
      Watch the notation update in real time as the sequence plays.
    </p>

    <div class="demo-wrapper">
      <LandingAnimationDemo />
    </div>
  </div>
</section>

<style>
  .notation-showcase {
    padding: 80px 24px 120px;
  }

  .container {
    max-width: 1200px;
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
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    max-width: 600px;
    margin: 0 auto 48px;
  }

  .demo-wrapper {
    display: flex;
    justify-content: center;
  }

  @media (max-width: 600px) {
    .notation-showcase {
      padding: 60px 16px 80px;
    }

    .section-intro {
      margin-bottom: 32px;
    }
  }
</style>
