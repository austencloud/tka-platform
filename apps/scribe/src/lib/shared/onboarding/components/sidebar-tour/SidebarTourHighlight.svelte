<script lang="ts">
  /**
   * SidebarTourHighlight
   *
   * Subtle pulsing highlight ring around the current sidebar item.
   * Positioned absolutely based on target element's bounding rect.
   */

  interface Props {
    targetElement: HTMLElement | null;
    color: string;
  }

  const { targetElement, color }: Props = $props();

  let position = $state({ top: 0, left: 0, width: 0, height: 0 });

  $effect(() => {
    if (!targetElement) return;

    function updatePosition() {
      const rect = targetElement!.getBoundingClientRect();
      position = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    }

    updatePosition();

    // Update on scroll/resize
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  });
</script>

{#if targetElement}
  <div
    class="tour-highlight"
    style="
      top: {position.top}px;
      left: {position.left}px;
      width: {position.width}px;
      height: {position.height}px;
      --highlight-color: {color};
    "
    aria-hidden="true"
  >
    <div class="highlight-ring"></div>
    <div class="highlight-pulse"></div>
  </div>
{/if}

<style>
  .tour-highlight {
    position: fixed;
    pointer-events: none;
    z-index: 9998;
    border-radius: 8px;
  }

  .highlight-ring {
    position: absolute;
    inset: -3px;
    border: 2px solid var(--highlight-color, #3b82f6);
    border-radius: 10px;
    opacity: 0.8;
  }

  .highlight-pulse {
    position: absolute;
    inset: -6px;
    border: 2px solid var(--highlight-color, #3b82f6);
    border-radius: 12px;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.3;
      transform: scale(1);
    }
    50% {
      opacity: 0.1;
      transform: scale(1.02);
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .highlight-pulse {
      animation: none;
    }
  }
</style>
