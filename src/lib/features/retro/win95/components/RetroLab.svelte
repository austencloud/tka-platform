<!--
  RetroLab - Development preview for TKA-OS components

  Provides a testing ground within the Lab module for previewing
  retro components during development.
-->
<script lang="ts">
  import RetroDesktop from "./shell/RetroDesktop.svelte";
  import RetroButton from "./primitives/RetroButton.svelte";
  import RetroProgressBar from "./primitives/RetroProgressBar.svelte";

  let showDesktop = $state(false);
  let progressValue = $state(42);
</script>

{#if showDesktop}
  <div class="desktop-preview">
    <div class="preview-controls">
      <button onclick={() => (showDesktop = false)}>Exit Preview</button>
    </div>
    <div class="desktop-container">
      <RetroDesktop />
    </div>
  </div>
{:else}
  <div class="lab-content">
    <h2>TKA-OS v1.0 - Development Lab</h2>

    <div class="lab-section">
      <h3>Quick Actions</h3>
      <div class="lab-actions">
        <button class="lab-btn" onclick={() => (showDesktop = true)}>
          Preview Desktop
        </button>
        <a class="lab-btn" href="/1995" target="_blank" rel="noopener">
          Open /1995 Route
        </a>
      </div>
    </div>

    <div class="lab-section">
      <h3>Component Samples</h3>

      <div class="sample-row retro-shell">
        <span class="sample-label">RetroButton:</span>
        <RetroButton label="OK" />
        <RetroButton label="Cancel" />
        <RetroButton label="Apply" isDefault />
      </div>

      <div class="sample-row retro-shell">
        <span class="sample-label">RetroProgressBar:</span>
        <div class="progress-demo">
          <RetroProgressBar value={progressValue} segmented />
          <input type="range" min="0" max="100" bind:value={progressValue} />
          <span>{progressValue}%</span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .lab-content {
    padding: 24px;
    color: var(--theme-text, #fff);
  }

  h2 {
    margin: 0 0 24px;
    font-size: 20px;
    font-weight: 600;
  }

  h3 {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 500;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
  }

  .lab-section {
    margin-bottom: 32px;
  }

  .lab-actions {
    display: flex;
    gap: 12px;
  }

  .lab-btn {
    padding: 8px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    color: var(--theme-text, #fff);
    cursor: pointer;
    text-decoration: none;
    font-size: 14px;
  }

  .lab-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .sample-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
  }

  .sample-label {
    min-width: 140px;
    font-size: 13px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .progress-demo {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .progress-demo input[type="range"] {
    width: 120px;
  }

  .desktop-preview {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .preview-controls {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10000;
  }

  .preview-controls button {
    padding: 4px 12px;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }

  .desktop-container {
    width: 100%;
    height: 100%;
    min-height: 600px;
  }
</style>
