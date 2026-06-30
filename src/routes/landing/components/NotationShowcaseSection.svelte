<script lang="ts">
  /**
   * NotationShowcaseSection
   *
   * The live animation demo with notation alongside it.
   * Framed educationally, not as a feature pitch.
   */
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import LazyLandingDemo from "./LazyLandingDemo.svelte";

  interface Props {
    onPropTypeChange?: (propType: PropType) => void;
  }

  let { onPropTypeChange }: Props = $props();
</script>

<section class="notation-showcase" id="notation">
  <div class="container">
    <p class="section-label">A TKA sequence playing back</p>
    <h2>The notation animates</h2>

    <div class="demo-wrapper">
      <LazyLandingDemo {onPropTypeChange} />
    </div>

    <p class="demo-caption">
      The pictographs on the right are the score. The figure on the left is the
      performance. Every step, every position, every transition, written and
      readable.
    </p>
  </div>
</section>

<style>
  .notation-showcase {
    padding: 80px 24px 100px;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .section-label {
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--theme-accent, #6366f1);
    margin-bottom: 8px;
    font-weight: 600;
  }

  h2 {
    font-family: var(--landing-heading-font, "Instrument Serif", Georgia, serif);
    font-size: clamp(1.5rem, 4vw, 2.2rem);
    margin-bottom: 36px;
    text-align: center;
    font-weight: 400;
    color: var(--theme-text, #fff);
  }

  .demo-wrapper {
    display: flex;
    justify-content: center;
  }

  .demo-caption {
    text-align: center;
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    max-width: 540px;
    margin: 32px auto 0;
    line-height: 1.7;
  }

  @media (max-width: 600px) {
    .notation-showcase {
      padding: 60px 16px 72px;
    }

    .demo-caption {
      max-width: 100%;
    }
  }
</style>
