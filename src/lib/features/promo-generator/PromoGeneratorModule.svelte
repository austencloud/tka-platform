<script lang="ts">
  /**
   * Promo Generator Module
   *
   * Main entry point for the 3D device mockup promo video generator feature.
   * This module provides a full-featured UI for creating promotional videos
   * showcasing app screenshots on rotating 3D device models.
   */

  import PromoGenerator from "./components/PromoGenerator.svelte";

  // Default to the built-in iPhone 16 model
  const defaultModelPath = "/models/iphone-16.glb";
</script>

<div class="promo-generator-module">
  <header class="module-header">
    <h1>Promo Video Generator</h1>
    <p class="subtitle">
      Create stunning 3D device mockup videos for your app
    </p>
  </header>

  <PromoGenerator
    initialModelPath={defaultModelPath}
    width={1280}
    height={720}
  />

  <footer class="module-footer">
    <div class="tips">
      <h3>Tips</h3>
      <ul>
        <li>Upload a .glb model file or use the default iPhone 16</li>
        <li>Load a screenshot of your app to display on the device screen</li>
        <li>Choose an animation preset that fits your style</li>
        <li>Preview the animation before exporting</li>
        <li>Export as 1080p or 4K MP4 video at 60fps</li>
      </ul>
    </div>
  </footer>
</div>

<style>
  .promo-generator-module {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl, 32px);
    padding: var(--spacing-xl, 32px);
    min-height: 100vh;
    background: var(--theme-bg, #0f0f1a);
  }

  .module-header {
    text-align: center;
  }

  .module-header h1 {
    margin: 0;
    font-size: var(--font-size-2xl, 32px);
    font-weight: 700;
    color: var(--theme-text, #ffffff);
  }

  .subtitle {
    margin: var(--spacing-sm, 8px) 0 0;
    font-size: var(--font-size-md, 16px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
  }

  .module-footer {
    margin-top: auto;
  }

  .tips {
    padding: var(--spacing-lg, 24px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: var(--radius-lg, 12px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .tips h3 {
    margin: 0 0 var(--spacing-md, 16px);
    font-size: var(--font-size-md, 16px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .tips ul {
    margin: 0;
    padding-left: var(--spacing-lg, 24px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
  }

  .tips li {
    margin-bottom: var(--spacing-xs, 4px);
    font-size: var(--font-size-sm, 14px);
  }
</style>
