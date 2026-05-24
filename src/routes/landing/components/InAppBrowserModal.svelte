<!--
  InAppBrowserModal.svelte

  Lightweight modal for redirecting users from in-app browsers to Safari/Chrome.
  Used when Instagram, Facebook, TikTok, etc. browsers don't support PWA installation.
-->
<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { backOut } from "svelte/easing";

  interface Props {
    isOpen: boolean;
    platform: "ios" | "android" | "desktop";
    inAppBrowserName: string;
    onClose: () => void;
  }

  let {
    isOpen = $bindable(),
    platform,
    inAppBrowserName,
    onClose,
  }: Props = $props();

  let copied = $state(false);

  const targetBrowser = $derived(platform === "ios" ? "Safari" : "Chrome");

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText("https://tkaflowarts.com/create");
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = "https://tkaflowarts.com/create";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div class="modal-overlay" transition:fade={{ duration: 200 }}>
    <button class="modal-backdrop" onclick={onClose} aria-label="Close modal"
    ></button>

    <div
      class="modal-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      transition:fly={{ y: 100, duration: 400, easing: backOut }}
    >
      <div class="modal-header">
        <div class="browser-icon">
          {#if platform === "ios"}
            <i class="fab fa-safari" aria-hidden="true"></i>
          {:else}
            <i class="fab fa-chrome" aria-hidden="true"></i>
          {/if}
        </div>
        <h2 id="modal-title">Open in {targetBrowser}</h2>
        <p>
          {#if inAppBrowserName}
            {inAppBrowserName}'s browser doesn't support app installation.
          {:else}
            This browser doesn't support installation on {platform === "ios"
              ? "iOS"
              : "Android"}.
          {/if}
        </p>
      </div>

      <div class="modal-instructions">
        <div class="instruction-step">
          <div class="step-number">1</div>
          <p>Copy this link</p>
        </div>
        <div class="instruction-step">
          <div class="step-number">2</div>
          <p>Open <strong>{targetBrowser}</strong></p>
        </div>
        <div class="instruction-step">
          <div class="step-number">3</div>
          <p>Paste and visit</p>
        </div>
      </div>

      <button class="copy-btn" onclick={copyUrl}>
        {#if copied}
          <i class="fas fa-check" aria-hidden="true"></i>
          <span>Link Copied!</span>
        {:else}
          <i class="fas fa-copy" aria-hidden="true"></i>
          <span>Copy Link</span>
        {/if}
      </button>

      <div class="url-preview">
        <span>tkaflowarts.com/create</span>
      </div>

      <button class="dismiss-btn" onclick={onClose}> Continue anyway </button>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-priority);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    border: none;
    cursor: pointer;
  }

  .modal-card {
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

  .modal-header {
    text-align: center;
    margin-bottom: 28px;
  }

  .browser-icon {
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

  .modal-header h2 {
    margin: 0 0 12px;
    font-size: var(--font-size-2xl, 1.5rem);
    font-weight: 700;
    color: white;
  }

  .modal-header p {
    margin: 0;
    font-size: var(--font-size-sm, 0.875rem);
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.5;
  }

  .modal-instructions {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 24px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .instruction-step {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .step-number {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
  }

  .instruction-step p {
    margin: 0;
    font-size: var(--font-size-sm, 0.875rem);
    color: rgba(255, 255, 255, 0.9);
  }

  .instruction-step :global(strong) {
    color: #60a5fa;
  }

  .copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    padding: 16px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    border: none;
    border-radius: 14px;
    font-size: var(--font-size-base, 1rem);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
  }

  .copy-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 28px rgba(99, 102, 241, 0.4);
  }

  .url-preview {
    text-align: center;
    padding: 12px;
    margin-top: 8px;
  }

  .url-preview span {
    font-size: var(--font-size-sm, 0.875rem);
    color: rgba(255, 255, 255, 0.4);
    font-family: ui-monospace, monospace;
  }

  .dismiss-btn {
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    border: none;
    width: 100%;
    padding: 12px;
    font-size: var(--font-size-sm, 0.875rem);
    cursor: pointer;
    transition: color var(--duration-normal) ease;
  }

  .dismiss-btn:hover {
    color: rgba(255, 255, 255, 0.7);
  }

  @media (max-width: 380px) {
    .modal-card {
      padding: 28px 20px;
      border-radius: 20px;
    }

    .browser-icon {
      width: 64px;
      height: 64px;
      font-size: 32px;
    }

    .modal-header h2 {
      font-size: var(--font-size-xl, 1.25rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .copy-btn {
      transition: none;
    }
  }
</style>
