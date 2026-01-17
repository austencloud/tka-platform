<!--
  IOSBrowserRedirect.svelte

  Handles when user is on iOS but NOT using Safari.
  iOS only allows PWA installation from Safari, so we need to redirect them.
-->
<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { backOut } from "svelte/easing";
  import type { Browser } from "../../services/contracts/IPlatformDetector";

  // Props
  let {
    currentBrowser,
    onDismiss,
  }: {
    currentBrowser: Browser;
    onDismiss: () => void;
  } = $props();

  // Get display name for current browser
  const browserNames: Record<Browser, string> = {
    chrome: "Chrome",
    safari: "Safari",
    edge: "Edge",
    firefox: "Firefox",
    samsung: "Samsung Internet",
    other: "your browser",
  };

  const browserName = $derived(browserNames[currentBrowser] || "your browser");

  // Copy URL to clipboard
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    }
  }

  let copied = $state(false);
</script>

<div class="redirect-overlay" transition:fade={{ duration: 200 }}>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={onDismiss} aria-hidden="true"></div>

  <div
    class="redirect-card"
    transition:fly={{ y: 100, duration: 400, easing: backOut }}
  >
    <!-- Safari icon and message -->
    <div class="card-header">
      <div class="safari-icon">
        <i class="fab fa-safari"></i>
      </div>
      <h2>Open in Safari</h2>
      <p>
        On iPhone and iPad, apps can only be installed from Safari.
        {browserName} doesn't support this feature.
      </p>
    </div>

    <!-- Simple instructions -->
    <div class="instructions">
      <div class="instruction-step">
        <div class="step-number">1</div>
        <p>Copy this link</p>
      </div>
      <div class="instruction-step">
        <div class="step-number">2</div>
        <p>Open <strong>Safari</strong></p>
      </div>
      <div class="instruction-step">
        <div class="step-number">3</div>
        <p>Paste and visit the page</p>
      </div>
    </div>

    <!-- Copy button -->
    <button class="copy-btn" onclick={copyUrl}>
      {#if copied}
        <i class="fas fa-check"></i>
        <span>Link Copied!</span>
      {:else}
        <i class="fas fa-copy"></i>
        <span>Copy Link</span>
      {/if}
    </button>

    <!-- URL preview -->
    <div class="url-preview">
      <span>tkascribe.com</span>
    </div>

    <!-- Dismiss -->
    <button class="dismiss-btn" onclick={onDismiss}>
      Continue in {browserName}
    </button>
  </div>
</div>

<style>
  .redirect-overlay {
    position: fixed;
    inset: 0;
    z-index: 100000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
  }

  .redirect-card {
    position: relative;
    width: 100%;
    max-width: 360px;
    background: linear-gradient(180deg, #1a1a2e 0%, #16162a 100%);
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 36px 28px;
    box-shadow:
      0 20px 60px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  }

  .card-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .safari-icon {
    width: 80px;
    height: 80px;
    margin: 0 auto 20px;
    border-radius: 20px;
    background: linear-gradient(135deg, #0066ff 0%, #00b4d8 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    color: white;
    box-shadow: 0 8px 24px rgba(0, 102, 255, 0.3);
  }

  .card-header h2 {
    margin: 0 0 12px;
    font-size: 26px;
    font-weight: 700;
    color: white;
  }

  .card-header p {
    margin: 0;
    font-size: 15px;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.5;
  }

  /* Instructions */
  .instructions {
    display: flex;
    flex-direction: column;
    gap: 18px;
    margin-bottom: 28px;
    padding: 24px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .instruction-step {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .step-number {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .instruction-step p {
    margin: 0;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.9);
  }

  .instruction-step :global(strong) {
    color: #60a5fa;
  }

  /* Copy button */
  .copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    padding: 18px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    border: none;
    border-radius: 14px;
    font-size: 17px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
  }

  .copy-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 28px rgba(99, 102, 241, 0.4);
  }

  .copy-btn:active {
    transform: translateY(0);
  }

  /* URL preview */
  .url-preview {
    text-align: center;
    padding: 14px;
    margin-top: 12px;
    margin-bottom: 8px;
  }

  .url-preview span {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.4);
    font-family: ui-monospace, monospace;
  }

  /* Dismiss */
  .dismiss-btn {
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    border: none;
    width: 100%;
    padding: 14px;
    font-size: 15px;
    cursor: pointer;
    transition: color var(--duration-normal) ease;
  }

  .dismiss-btn:hover {
    color: rgba(255, 255, 255, 0.7);
  }
</style>
