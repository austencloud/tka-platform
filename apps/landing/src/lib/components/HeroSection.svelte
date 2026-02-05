<!--
  HeroSection.svelte (Landing - standalone)

  Hero with text left, video player right.
  Video is the larger element. No glassmorphism panel.
-->
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
    <div class="hero-text-side">
      <h1>The Kinetic Alphabet</h1>
      <p class="tagline">Notation for flow arts.</p>
      <HeroInstallFlow />
    </div>

    <div class="hero-video-side">
      <div class="video-glow"></div>
      <VideoShowcaseSection compact />
    </div>
  </div>
</section>

<style>
  .hero {
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 24px;
    overflow: hidden;
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
    background: #6366f1;
    top: -200px;
    right: -200px;
  }

  .glow-2 {
    width: 400px;
    height: 400px;
    background: #818cf8;
    bottom: -100px;
    left: -100px;
  }

  .hero-content {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(40px, 6vw, 96px);
    max-width: 1200px;
    width: 100%;
  }

  .hero-text-side {
    flex: 0 1 420px;
    display: flex;
    flex-direction: column;
  }

  .hero h1 {
    font-size: clamp(2.25rem, 5vw, 3.5rem);
    margin-bottom: 12px;
    background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.7) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.15;
  }

  .tagline {
    font-size: clamp(1.125rem, 2.5vw, 1.5rem);
    color: #818cf8;
    margin-bottom: 40px;
    font-weight: 500;
  }

  .hero-video-side {
    flex: 0 0 auto;
    width: clamp(300px, 40vw, 480px);
    position: relative;
  }

  .video-glow {
    position: absolute;
    inset: -20px;
    background: radial-gradient(
      ellipse at center,
      rgba(99, 102, 241, 0.15) 0%,
      transparent 70%
    );
    border-radius: 24px;
    pointer-events: none;
    z-index: -1;
  }

  @media (max-width: 900px) {
    .hero {
      padding: 80px 16px 40px;
    }

    .hero-content {
      flex-direction: column;
      gap: 40px;
    }

    .hero-text-side {
      align-items: center;
      text-align: center;
      flex: none;
      width: 100%;
    }

    .hero-video-side {
      width: 100%;
      max-width: 400px;
    }
  }

  @media (max-width: 480px) {
    .hero {
      padding: 60px 16px 32px;
      min-height: auto;
    }

    .tagline {
      margin-bottom: 32px;
    }
  }
</style>
