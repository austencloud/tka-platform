<!--
SequenceDetailPanel - Adaptive detail view for sequences

Desktop (>= 768px): Side panel that slides in from right and pushes grid
Mobile (< 768px): Full-screen immersive view with swipe-up sheet (2026 UX)

Features:
- Smooth slide transitions with CSS width/height
- Immersive full-bleed media on mobile
- Swipe-up sheet for details
- Responsive width on desktop (35%, 320-500px)
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import SequenceDetailContent from "./SequenceDetailContent.svelte";
  import MobileSequenceDetailSheet from "./mobile/MobileSequenceDetailSheet.svelte";

  const {
    sequence = null,
    variations = [],
    variationIndex = 0,
    isOpen = false,
    onClose = () => {},
    onAction = () => {},
    onVariationSelect = () => {},
    viewMode = "desktop", // 'desktop' | 'mobile'
  } = $props<{
    sequence?: SequenceData | null;
    variations?: SequenceData[];
    variationIndex?: number;
    isOpen?: boolean;
    onClose?: () => void;
    onAction?: (action: string, sequence: SequenceData) => void;
    onVariationSelect?: (index: number, sequence: SequenceData) => void;
    viewMode?: "desktop" | "mobile";
  }>();

  // Handle backdrop click (mobile only)
  function handleBackdropClick(_event: MouseEvent) {
    if (viewMode === "mobile") {
      onClose();
    }
  }

  // Prevent content clicks from bubbling to backdrop
  function handleContentClick(event: MouseEvent) {
    event.stopPropagation();
  }

  // Handle ESC key
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && isOpen) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if viewMode === "mobile"}
  <!-- Mobile: Full-screen immersive view with swipe-up sheet -->
  {#if isOpen && sequence}
    <div class="mobile-fullscreen">
      <MobileSequenceDetailSheet {sequence} {onClose} {onAction} />
    </div>
  {/if}
{:else}
  <!-- Desktop: Side panel (always rendered, width animated) -->
  <aside
    class="detail-panel-desktop"
    class:open={isOpen && sequence}
    aria-label="Sequence details"
    aria-hidden={!isOpen}
  >
    {#if sequence}
      <SequenceDetailContent
        {sequence}
        {variations}
        {variationIndex}
        {onClose}
        {onAction}
        {onVariationSelect}
      />
    {/if}
  </aside>
{/if}

<style>
  /* ===== MOBILE FULLSCREEN ===== */
  .mobile-fullscreen {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: var(--theme-shadow);
  }

  /* ===== DESKTOP SIDE PANEL ===== */
  .detail-panel-desktop {
    width: 0;
    min-width: 0;
    max-width: 500px;
    height: 100%;
    background: var(--theme-panel-bg);
    border-left: 1px solid var(--theme-stroke-strong);
    overflow-y: hidden;
    overflow-x: hidden;
    flex-shrink: 0;
    box-shadow: -4px 0 20px var(--theme-shadow);
    transition:
      width 0.3s ease,
      min-width 0.3s ease,
      opacity 0.3s ease;
    opacity: 0;
    pointer-events: none;
  }

  .detail-panel-desktop.open {
    width: 35%;
    min-width: 320px;
    overflow-y: auto;
    opacity: 1;
    pointer-events: all;
  }

  /* Custom scrollbar for desktop panel */
  .detail-panel-desktop::-webkit-scrollbar {
    width: 8px;
  }

  .detail-panel-desktop::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .detail-panel-desktop::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 4px;
  }

  .detail-panel-desktop::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover);
  }

  /* Tablet adjustments for desktop panel */
  @media (min-width: 768px) and (max-width: 1024px) {
    .detail-panel-desktop {
      width: 40%;
      min-width: 280px;
      max-width: 400px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .detail-panel-desktop {
      transition: none;
    }
  }
</style>
