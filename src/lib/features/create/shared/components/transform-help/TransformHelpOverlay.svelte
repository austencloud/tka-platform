<!--
  TransformHelpOverlay.svelte

  Semi-transparent overlay shown when help mode is active (selecting).
  Displays instruction text while keeping transform buttons clickable.
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
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Overlay covers the viewport but allows clicks through to transform buttons -->
<div class="help-overlay" role="presentation">
  <!-- Instruction banner at top -->
  <div class="instruction-banner">
    <div class="instruction-content">
      <i class="fas fa-hand-pointer" aria-hidden="true"></i>
      <span>Tap a transform to learn how it works</span>
    </div>
    <button
      class="close-btn"
      onclick={onClose}
      aria-label="Exit help mode"
    >
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </div>

  <!-- Click-to-close area (backdrop) -->
  <button
    class="backdrop-close"
    onclick={onClose}
    aria-label="Exit help mode"
  ></button>
</div>

<style>
  .help-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    pointer-events: none;
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

  .instruction-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: linear-gradient(
      180deg,
      rgba(59, 130, 246, 0.95) 0%,
      rgba(37, 99, 235, 0.95) 100%
    );
    color: white;
    z-index: 101;
    pointer-events: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .instruction-content {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--font-size-base, 14px);
    font-weight: 500;
  }

  .instruction-content i {
    font-size: var(--font-size-lg, 18px);
    animation: point-pulse 1.5s ease-in-out infinite;
  }

  @keyframes point-pulse {
    0%,
    100% {
      transform: translateX(0);
    }
    50% {
      transform: translateX(4px);
    }
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    cursor: pointer;
    font-size: var(--font-size-base, 14px);
    transition: background 0.15s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .close-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* Invisible backdrop for click-to-close */
  .backdrop-close {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    border: none;
    cursor: pointer;
    pointer-events: auto;
    z-index: 99;
  }

  @media (prefers-reduced-motion: reduce) {
    .help-overlay,
    .instruction-content i {
      animation: none;
    }
  }
</style>
