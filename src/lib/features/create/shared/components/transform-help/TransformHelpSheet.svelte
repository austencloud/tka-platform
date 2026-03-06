<!--
  TransformHelpSheet.svelte

  Single pictograph with toggleable transform effects.
  - Desktop: All 4 transforms visible with descriptions
  - Mobile: Accordion with Mirror expanded by default
-->
<script lang="ts">
  import { transformHelpContent } from "../../domain/transforms/transform-help-content";
  import { getRandomPictograph } from "../../domain/transforms/pictograph-example-loader";
  import {
    applyMirror,
    applyRotate,
    applySwap,
    applyRewind,
  } from "../../domain/transforms/transform-functions";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import PictographDisplay from "./PictographDisplay.svelte";
  import TransformDescriptionPanel from "./TransformDescriptionPanel.svelte";

  interface Props {
    show: boolean;
    onClose: () => void;
  }

  let { show, onClose }: Props = $props();

  // Focus management refs
  let sheetElement: HTMLDivElement | null = $state(null);
  let previouslyFocusedElement: HTMLElement | null = null;

  // Handle Escape key
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
    // Focus trap: Tab and Shift+Tab stay within modal
    if (event.key === "Tab" && sheetElement) {
      const focusableElements = sheetElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  }

  // Focus management when modal opens/closes
  $effect(() => {
    if (show) {
      previouslyFocusedElement = document.activeElement as HTMLElement;
      // Focus the close button after render
      requestAnimationFrame(() => {
        const closeBtn =
          sheetElement?.querySelector<HTMLButtonElement>(".help-close");
        closeBtn?.focus();
      });
    } else if (previouslyFocusedElement) {
      previouslyFocusedElement.focus();
      previouslyFocusedElement = null;
    }
  });

  // Single pictograph state
  let currentPictograph = $state<PictographData | null>(null);
  let isLoading = $state(true);

  // Track which transform is expanded on mobile
  let expandedTransformId = $state<"mirror" | "rotate" | "swap" | "rewind">(
    "mirror"
  );

  // Layout detection: desktop (side panel) vs mobile (bottom sheet)
  let viewportWidth = $state(window.innerWidth);
  let isDesktopLayout = $derived(viewportWidth >= 1024);

  // Listen to window resize for responsive layout changes
  $effect(() => {
    const handleResize = () => {
      viewportWidth = window.innerWidth;
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  });

  // Load initial pictograph when sheet opens
  $effect(() => {
    if (show && isLoading) {
      loadPictograph();
    }
  });

  async function loadPictograph() {
    isLoading = true;
    currentPictograph = await getRandomPictograph();
    isLoading = false;
  }

  // Apply transform to current pictograph
  function applyTransform(transformId: string) {
    if (!currentPictograph) return;

    switch (transformId) {
      case "mirror":
        currentPictograph = applyMirror(currentPictograph);
        break;
      case "swap":
        currentPictograph = applySwap(currentPictograph);
        break;
      case "rewind":
        currentPictograph = applyRewind(currentPictograph);
        break;
    }
  }

  function applyRotateTransform(direction: "cw" | "ccw") {
    if (!currentPictograph) return;
    currentPictograph = applyRotate(currentPictograph, direction);
  }

  // Shuffle to new pictograph (keeps transforms applied)
  async function handleShuffle() {
    isLoading = true;
    currentPictograph = await getRandomPictograph();
    isLoading = false;
  }
</script>

{#if show}
  <div
    class="help-overlay"
    role="button"
    tabindex="0"
    aria-label="Close transform help"
    onclick={onClose}
    onkeydown={handleKeydown}
  >
    <div
      class="help-sheet"
      bind:this={sheetElement}
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transform-help-title"
      tabindex="-1"
    >
      <div class="help-header">
        <h3 id="transform-help-title">Transform Actions</h3>
        <button
          class="help-close"
          onclick={onClose}
          aria-label="Close transform help"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
      <div class="help-content">
        <PictographDisplay
          pictograph={currentPictograph}
          {isLoading}
          onShuffle={handleShuffle}
        />
        <TransformDescriptionPanel
          {expandedTransformId}
          {isDesktopLayout}
          onToggleExpand={(id: "mirror" | "rotate" | "swap" | "rewind") =>
            (expandedTransformId = id)}
          onApplyTransform={applyTransform}
          onApplyRotate={applyRotateTransform}
        />
      </div>
    </div>
  </div>
{/if}

<style>
  /* ===== OVERLAY ===== */
  .help-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: flex-end; /* Mobile: bottom sheet */
    justify-content: center;
    animation: fadeIn var(--duration-normal) ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* ===== SHEET (Mobile: Bottom Sheet) ===== */
  .help-sheet {
    width: 100%;
    max-width: 500px;
    max-height: 85vh;
    background: linear-gradient(
      180deg,
      rgba(30, 34, 53, 0.98) 0%,
      rgba(20, 24, 40, 0.98) 100%
    );
    border-radius: 20px 20px 0 0; /* Mobile: rounded top only */
    display: flex;
    flex-direction: column;
    animation: slideUp var(--duration-emphasis) cubic-bezier(0.32, 0.72, 0, 1);
    box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.4);
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  /* ===== DESKTOP: Centered Modal ===== */
  @media (min-width: 768px) {
    .help-overlay {
      align-items: center; /* Desktop: vertically centered */
    }

    .help-sheet {
      width: 90%;
      max-width: 1200px;
      max-height: 85vh;
      border-radius: 16px; /* Rounded all corners */
      animation: scaleIn var(--duration-normal) cubic-bezier(0.32, 0.72, 0, 1);
      box-shadow:
        0 24px 80px rgba(0, 0, 0, 0.5),
        0 8px 24px var(--theme-shadow),
        0 0 0 1px rgba(255, 255, 255, 0.1);
    }

    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  }

  /* ===== HEADER ===== */
  .help-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--theme-stroke);
    flex-shrink: 0;
  }

  .help-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .help-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target); /* WCAG AAA touch target */
    height: var(--min-touch-target);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: var(--font-size-base);
    transition: all var(--duration-fast) ease;
  }

  .help-close:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .help-close:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* ===== CONTENT ===== */
  .help-content {
    padding: 16px 20px 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
    flex: 1;
  }

  /* Desktop: Vertical layout with pictograph on top, transforms filling height below */
  @media (min-width: 768px) {
    .help-content {
      flex-direction: column;
      gap: 24px;
      padding: 24px;
      align-items: center;
      overflow: visible;
    }
  }

  /* ===== ACCESSIBILITY ===== */
  @media (prefers-reduced-motion: reduce) {
    .help-overlay,
    .help-sheet {
      animation: none;
    }
  }
</style>
