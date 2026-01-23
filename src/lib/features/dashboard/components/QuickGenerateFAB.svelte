<!--
  QuickGenerateFAB

  Floating action button for quick sequence generation.
  Opens a bottom sheet or navigates to generator with preset options.
-->
<script lang="ts">
  interface Props {
    onClick?: () => void;
  }

  const { onClick }: Props = $props();

  function handleClick() {
    onClick?.();
  }
</script>

<button
  class="quick-generate-fab"
  onclick={handleClick}
  type="button"
  aria-label="Generate new sequence"
>
  <i class="fas fa-magic" aria-hidden="true"></i>
</button>

<style>
  .quick-generate-fab {
    position: fixed;
    bottom: calc(var(--nav-height, 56px) + 16px);
    right: 16px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: none;
    background: linear-gradient(
      135deg,
      var(--theme-accent) 0%,
      color-mix(in srgb, var(--theme-accent) 80%, black) 100%
    );
    color: white;
    font-size: 22px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.3),
      0 2px 4px rgba(0, 0, 0, 0.2);
    transition: all var(--duration-fast, 150ms) ease;
    z-index: 100;
  }

  .quick-generate-fab:hover {
    transform: scale(1.05);
    box-shadow:
      0 6px 16px rgba(0, 0, 0, 0.35),
      0 4px 8px rgba(0, 0, 0, 0.25);
  }

  .quick-generate-fab:active {
    transform: scale(0.95);
  }

  .quick-generate-fab:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* When bottom nav is hidden on desktop */
  @media (min-width: 1024px) {
    .quick-generate-fab {
      bottom: 24px;
      right: 24px;
    }
  }

  /* Ensure touch target on mobile */
  @media (max-width: 480px) {
    .quick-generate-fab {
      right: 12px;
      bottom: calc(var(--nav-height, 56px) + 12px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .quick-generate-fab {
      transition: none;
    }
  }
</style>
