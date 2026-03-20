<!--
  ViewerHeader.svelte

  Header bar for the sequence viewer modal.
  Handles both normal view mode and export mode headers.
-->
<script lang="ts">
  type ExportType = "animation" | "image" | "both";

  interface Props {
    isExportMode: boolean;
    exportType: ExportType | null;
    isFullscreen: boolean;
    isMobile: boolean;
    isLandscapeMobile?: boolean;
    darkMode: boolean;
    // Callbacks
    onClose: () => void;
    onExitExportMode: () => void;
    onBackToExportTypeSelection: () => void;
    onDarkModeToggle: () => void;
  }

  let {
    isExportMode,
    exportType,
    isFullscreen,
    isMobile,
    isLandscapeMobile = false,
    darkMode,
    onClose,
    onExitExportMode,
    onBackToExportTypeSelection,
    onDarkModeToggle,
  }: Props = $props();
</script>

{#if isExportMode}
  <!-- Export mode header -->
  <header class="details-header export-header" data-hidden={isFullscreen}>
    <div class="header-left">
      <button
        type="button"
        class="close-button"
        onclick={exportType ? onBackToExportTypeSelection : onExitExportMode}
        aria-label={exportType ? "Back to export options" : "Back to viewer"}
      >
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
      </button>
    </div>

    <div class="header-center">
      <h2 class="mode-title">
        {#if !exportType}
          Export
        {:else if exportType === "animation"}
          Download Animation
        {:else}
          Download Card
        {/if}
      </h2>
    </div>

    <div class="header-right">
      <!-- Spacer to balance layout -->
    </div>
  </header>
{:else}
  <!-- Normal viewer header -->
  <header
    class="details-header"
    class:mobile={isMobile}
    class:landscape={isLandscapeMobile}
    data-hidden={isFullscreen}
  >
    <!-- Mobile: Swipe handle indicator for swipe-to-dismiss -->
    {#if isMobile && !isLandscapeMobile}
      <div class="swipe-handle" aria-hidden="true"></div>
    {/if}

    <div class="header-left">
      <button
        type="button"
        class="close-button back"
        onclick={onClose}
        aria-label="Back"
      >
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        {#if !isMobile}
          <span>Back</span>
        {/if}
      </button>
    </div>

    {#if !isLandscapeMobile}
      <div class="header-center">
        <h2 class="sequence-title">Sequence Viewer</h2>
      </div>
    {/if}

    <div class="header-right">
      <!-- Spacer to balance layout -->
    </div>
  </header>
{/if}

<style>
  /* Header - CSS Grid for true center */
  .details-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
    transition:
      opacity var(--duration-normal, 200ms) var(--ease-out, ease-out),
      transform var(--duration-normal, 200ms) var(--ease-out, ease-out);
  }

  .details-header[data-hidden="true"] {
    opacity: 0;
    transform: translateY(-100%);
    pointer-events: none;
    position: absolute;
  }

  /* Swipe handle - visual affordance for swipe-to-dismiss */
  .swipe-handle {
    position: absolute;
    top: 6px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
  }

  /* Mobile header - minimal, with swipe affordance */
  .details-header.mobile {
    padding-top: 16px;
    touch-action: pan-y;
  }

  .details-header.mobile .sequence-title {
    max-width: 150px;
    font-size: var(--font-size-min, 14px);
  }

  .header-left {
    justify-self: start;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-right {
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-center {
    display: flex;
    justify-content: center;
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: var(--min-touch-target);
    height: var(--min-touch-target);
    padding: 0 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: 16px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .close-button span {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
  }

  .close-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
  }

  /* Sequence title in header */
  .sequence-title,
  .mode-title {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, white);
    text-align: center;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Landscape: compact overlay header */
  .details-header.landscape {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.6) 0%,
      rgba(0, 0, 0, 0.3) 60%,
      transparent 100%
    );
    border-bottom: none;
    padding: 6px 8px;
    grid-template-columns: auto 1fr auto;
    pointer-events: none;
  }

  .details-header.landscape .header-left,
  .details-header.landscape .header-right {
    pointer-events: auto;
  }

  .details-header.landscape .close-button {
    min-width: 40px;
    min-height: 40px;
    height: 40px;
    color: rgba(255, 255, 255, 0.8);
  }

  @media (prefers-reduced-motion: reduce) {
    .details-header,
    .close-button {
      transition: none !important;
    }
  }
</style>
