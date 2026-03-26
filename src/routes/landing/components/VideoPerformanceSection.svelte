<script lang="ts">
  /**
   * VideoPerformanceSection
   *
   * Real performers playing real sequences. Positioned after the animation
   * demo so visitors see: notation → animation → real humans.
   * Not social proof. Just: this is what it looks like in practice.
   */
  import VideoShowcaseSection from "./VideoShowcaseSection.svelte";
</script>

<section class="performances" id="videos">
  <div class="container">
    <p class="section-label">In practice</p>
    <h2>Real performances</h2>
    <div class="video-wrapper">
      <VideoShowcaseSection compact />
    </div>
    <p class="video-caption">
      Sequences performed with staves, fans, and clubs.
    </p>
  </div>
</section>

<style>
  .performances {
    padding: 80px 24px 100px;
  }

  .container {
    max-width: 500px;
    margin: 0 auto;
    text-align: center;
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--theme-accent, #6366f1);
    margin-bottom: 8px;
    font-weight: 600;
  }

  h2 {
    font-family: "Instrument Serif", Georgia, serif;
    font-size: clamp(1.5rem, 4vw, 2.2rem);
    font-weight: 400;
    margin-bottom: 32px;
    color: var(--theme-text, #fff);
  }

  .video-wrapper {
    max-width: 360px;
    margin: 0 auto;
  }

  .video-caption {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    margin-top: 16px;
    font-style: italic;
  }

  @media (max-width: 600px) {
    .performances {
      padding: 60px 16px 72px;
    }

    .video-wrapper {
      max-width: 100%;
    }
  }
</style>
