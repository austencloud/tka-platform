<script lang="ts">
  import { InAppBrowserDetector } from "../services/implementations/InAppBrowserDetector";

  const detector = new InAppBrowserDetector();

  let dismissed = $state(false);
  let copied = $state(false);

  const isInAppBrowser = detector.isInAppBrowser();
  const browserName = detector.getInAppBrowserName();
  const canOpenExternal = detector.canOpenInExternalBrowser();
  const externalUrl = detector.getOpenInBrowserUrl();
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  function handleOpenInBrowser() {
    if (canOpenExternal) {
      window.location.href = externalUrl;
    }
  }

  async function handleCopyUrl() {
    try {
      await navigator.clipboard.writeText(currentUrl);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const input = document.createElement("input");
      input.value = currentUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    }
  }

  function handleDismiss() {
    dismissed = true;
  }
</script>

{#if isInAppBrowser && !dismissed}
  <div class="in-app-browser-prompt" role="alertdialog" aria-labelledby="iab-title" aria-describedby="iab-desc">
    <div class="prompt-content">
      <button class="dismiss-button" onclick={handleDismiss} aria-label="Dismiss">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>

      <div class="icon-container">
        <i class="fas fa-external-link-alt" aria-hidden="true"></i>
      </div>

      <h2 id="iab-title">Open in Your Browser</h2>

      <p id="iab-desc">
        {browserName ? `${browserName}'s` : "This app's"} built-in browser has limited features.
        For the best experience with sign-in and all features, open this page in
        {#if detector.canOpenInExternalBrowser()}
          Chrome.
        {:else}
          Safari or Chrome.
        {/if}
      </p>

      <div class="actions">
        {#if canOpenExternal}
          <button class="primary-button" onclick={handleOpenInBrowser}>
            <i class="fab fa-chrome" aria-hidden="true"></i>
            Open in Chrome
          </button>
        {:else}
          <div class="ios-instructions">
            <p class="instruction-step">
              <span class="step-number">1</span>
              Tap the menu icon
              <i class="fas fa-ellipsis-h" aria-hidden="true"></i>
            </p>
            <p class="instruction-step">
              <span class="step-number">2</span>
              Select "Open in Safari" or "Open in Browser"
            </p>
          </div>
        {/if}

        <button class="secondary-button" onclick={handleCopyUrl}>
          <i class="fas fa-{copied ? 'check' : 'copy'}" aria-hidden="true"></i>
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>

      <button class="continue-anyway" onclick={handleDismiss}>
        Continue anyway (some features may not work)
      </button>
    </div>
  </div>
{/if}

<style>
  .in-app-browser-prompt {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(4px);
  }

  .prompt-content {
    position: relative;
    max-width: 360px;
    width: 100%;
    padding: 2rem 1.5rem;
    background: var(--theme-panel-bg, #1a1a2e);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    text-align: center;
  }

  .dismiss-button {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    border-radius: 50%;
    transition: background 0.15s;
  }

  .dismiss-button:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .icon-container {
    width: 64px;
    height: 64px;
    margin: 0 auto 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #4285f4, #34a853);
    border-radius: 50%;
    font-size: 1.5rem;
    color: white;
  }

  h2 {
    margin: 0 0 0.75rem;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  p {
    margin: 0 0 1.5rem;
    font-size: 0.9375rem;
    line-height: 1.5;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .primary-button,
  .secondary-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.875rem 1rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: transform 0.1s, opacity 0.15s;
  }

  .primary-button:active,
  .secondary-button:active {
    transform: scale(0.98);
  }

  .primary-button {
    background: linear-gradient(135deg, #4285f4, #34a853);
    color: white;
  }

  .primary-button:hover {
    opacity: 0.9;
  }

  .secondary-button {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #fff);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
  }

  .secondary-button:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .ios-instructions {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 0.5rem;
  }

  .instruction-step {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
    padding: 0.5rem 0;
    font-size: 0.875rem;
    color: var(--theme-text, #fff);
    text-align: left;
  }

  .instruction-step:first-child {
    padding-top: 0;
  }

  .instruction-step:last-child {
    padding-bottom: 0;
  }

  .instruction-step i {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .step-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: var(--theme-accent, #4285f4);
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    flex-shrink: 0;
  }

  .continue-anyway {
    margin-top: 1.25rem;
    padding: 0.5rem;
    background: transparent;
    border: none;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: 0.8125rem;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .continue-anyway:hover {
    color: var(--theme-text, rgba(255, 255, 255, 0.7));
  }
</style>
