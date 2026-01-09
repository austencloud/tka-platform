<!--
  GeneratorHelpOverlay.svelte

  Simple backdrop overlay that dims everything except the generator panel.
  Shows instruction banner at top. Clicking the backdrop exits help mode.
-->
<script lang="ts">
  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  // Handle Escape key to close
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  // Handle backdrop click to exit help mode
  function handleBackdropClick() {
    onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Clickable backdrop that dims everything and exits on click -->
<div
  class="help-backdrop"
  onclick={handleBackdropClick}
  onkeydown={(e) => e.key === "Enter" && handleBackdropClick()}
  role="button"
  tabindex="0"
  aria-label="Exit help mode"
></div>

<!-- Instruction banner at top of viewport - tapping dismisses help mode -->
<button
  class="help-banner"
  onclick={handleBackdropClick}
  aria-label="Tap any setting to learn what it does. Tap here or press X to exit."
>
  <i class="fas fa-hand-pointer" aria-hidden="true"></i>
  <span>Tap any setting to learn what it does</span>
  <span class="close-hint">
    <i class="fas fa-times" aria-hidden="true"></i>
  </span>
</button>

<style>
  .help-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 200;
    cursor: pointer;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .help-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 16px;
    min-height: 48px;
    background: linear-gradient(
      180deg,
      rgba(30, 64, 175, 0.98) 0%,
      rgba(23, 37, 84, 0.98) 100%
    );
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    z-index: 250;
    animation: fadeIn 0.2s ease;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .help-banner:hover {
    background: linear-gradient(
      180deg,
      rgba(37, 78, 200, 0.98) 0%,
      rgba(30, 48, 100, 0.98) 100%
    );
  }

  .help-banner:active {
    background: linear-gradient(
      180deg,
      rgba(25, 55, 150, 0.98) 0%,
      rgba(18, 30, 70, 0.98) 100%
    );
  }

  .help-banner:focus-visible {
    outline: 3px solid rgba(255, 255, 255, 0.9);
    outline-offset: -3px;
  }

  .help-banner i {
    font-size: var(--font-size-lg, 18px);
  }

  .close-hint {
    position: absolute;
    right: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    transition: background 0.15s ease;
  }

  .close-hint:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .close-hint i {
    font-size: var(--font-size-min, 14px);
  }

  .help-backdrop:focus-visible {
    outline: 3px solid rgba(255, 255, 255, 0.9);
    outline-offset: -3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .help-backdrop,
    .help-banner {
      animation: none;
    }
  }
</style>
