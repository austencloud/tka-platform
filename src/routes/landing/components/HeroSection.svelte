<script lang="ts">
  import LandingAnimationDemo from "./LandingAnimationDemo.svelte";
  import HeroInstallFlow from "./HeroInstallFlow.svelte";
</script>

<section class="hero">
  <div class="hero-bg">
    <div class="grid-lines"></div>
    <div class="glow glow-1"></div>
    <div class="glow glow-2"></div>
  </div>

  <div class="hero-content">
    <h1>The Kinetic Alphabet</h1>
    <p class="tagline">Digital Sheet Music for Flow Arts</p>
    <p class="subtitle">
      Create, animate, and share prop manipulation sequences with the first
      universal notation system for flow arts.
    </p>

    <HeroInstallFlow />

    <div class="hero-visual">
      <LandingAnimationDemo />
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
    padding: 80px 24px;
    overflow: hidden;
  }

  .hero-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .grid-lines {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 60px 60px;
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
    text-align: center;
    max-width: 800px;
  }


  .hero h1 {
    font-size: clamp(2.5rem, 8vw, 4.5rem);
    margin-bottom: 8px;
    background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.7) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .tagline {
    font-size: clamp(1.25rem, 3vw, 1.75rem);
    color: var(--theme-accent-strong, #818cf8);
    margin-bottom: 16px;
    font-weight: 500;
  }

  .subtitle {
    font-size: 1.125rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    max-width: 600px;
    margin: 0 auto 32px;
  }

  .hero-visual {
    margin-top: clamp(24px, 5vw, 48px);
  }

  @media (max-width: 768px) {
    .hero {
      padding: 60px 16px;
    }
  }
</style>
