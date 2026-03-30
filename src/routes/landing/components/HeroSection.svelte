<script lang="ts">
  import HeroInstallFlow from "./HeroInstallFlow.svelte";
  import VideoShowcaseSection from "./VideoShowcaseSection.svelte";
</script>

<section class="hero">
  <div class="hero-bg">
    <div class="glow glow-1"></div>
    <div class="glow glow-2"></div>
  </div>

  <div class="hero-content">
    <!-- Left side: Title, tagline, and install -->
    <div class="hero-text-side">
      <div class="hero-text-panel">
        <h1>The Kinetic Alphabet</h1>
        <p class="tagline">Create, record, and share flow arts choreography</p>
      </div>
      <HeroInstallFlow />
    </div>

    <!-- Right side: Video showcase -->
    <div class="hero-video-side">
      <VideoShowcaseSection compact />
    </div>
  </div>
</section>

<style>
  .hero {
    position: relative;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 24px;
    overflow: hidden;
    box-sizing: border-box;
  }

  .hero-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .glow {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    opacity: 0.35;
  }

  .glow-1 {
    width: 600px;
    height: 600px;
    background: var(--theme-accent, #6366f1);
    top: -200px;
    right: -200px;
  }

  .glow-2 {
    width: 400px;
    height: 400px;
    background: var(--theme-accent-strong, #818cf8);
    bottom: -100px;
    left: -100px;
  }

  .hero-content {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(32px, 5vw, 80px);
    max-width: 1200px;
    width: 100%;
  }

  .hero-text-side {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 500px;
  }

  .hero-text-panel {
    background: var(--theme-panel-bg, rgba(10, 10, 15, 0.7));
    backdrop-filter: blur(12px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 24px;
    padding: 40px 48px;
    margin-bottom: 32px;
  }

  .hero h1 {
    font-size: clamp(2rem, 5vw, 3.5rem);
    margin-bottom: 8px;
    background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.7) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .tagline {
    font-size: clamp(1rem, 2.5vw, 1.5rem);
    color: var(--theme-accent-strong, #818cf8);
    margin-bottom: 0;
    font-weight: 500;
  }

  .hero-video-side {
    flex: 0 1 auto;
    width: clamp(280px, 35vw, 400px);
    max-height: calc(100vh - 140px);
    overflow: hidden;
  }

  /* Tablet and below - stack vertically */
  @media (max-width: 900px) {
    .hero {
      padding: 80px 16px 40px;
    }

    .hero-content {
      flex-direction: column;
      gap: 32px;
    }

    .hero-text-side {
      max-width: 100%;
    }

    .hero-text-panel {
      padding: 32px 24px;
      border-radius: 20px;
    }

    .hero-video-side {
      width: 100%;
      max-width: 360px;
    }
  }

  /* Mobile - tighter spacing */
  @media (max-width: 480px) {
    .hero {
      padding: 60px 16px 32px;
      height: auto;
      min-height: 100vh;
    }

    .hero-text-panel {
      padding: 24px 20px;
      margin-bottom: 24px;
    }
  }
</style>
