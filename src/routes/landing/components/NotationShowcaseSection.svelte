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
    <h2>Notation in motion</h2>

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
    font-size: clamp(1.5rem, 4vw, 2rem);
    margin-bottom: 32px;
    text-align: center;
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
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
