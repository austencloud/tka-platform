<!--
  RouteViewerHeader.svelte

  Header bar for the /sequence/[id] route.
  Similar to ViewerHeader but with route-aware back navigation instead of modal close.
-->
<script lang="ts">
  type ExportType = "animation" | "image" | "both";

  interface Props {
    isExportMode: boolean;
    exportType: ExportType | null;
    isFullscreen: boolean;
    isMobile: boolean;
    darkMode: boolean;
    returnLabel: string;
    // Callbacks
    onBack: () => void;
    onExitExportMode: () => void;
    onBackToExportTypeSelection: () => void;
    onDarkModeToggle: () => void;
    /** Callback to open the settings modal */
    onSettingsOpen?: () => void;
    /** Callback to enter animation export mode */
    onShareAnimation?: () => void;
    /** Callback to enter image export mode */
    onShareImage?: () => void;
  }

  let {
    isExportMode,
    exportType,
    isFullscreen,
    isMobile,
    darkMode,
    returnLabel,
    onBack,
    onExitExportMode,
    onBackToExportTypeSelection,
    onDarkModeToggle,
    onSettingsOpen,
    onShareAnimation,
    onShareImage,
  }: Props = $props();
</script>

{#if isExportMode}
  <!-- Export mode header -->
  <header class="route-header export-header" data-hidden={isFullscreen}>
    <div class="header-left">
      <button
        type="button"
        class="back-button"
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
          Export Video
        {:else}
          Export Image
        {/if}
      </h2>
    </div>

    <div class="header-right">
      <!-- Spacer to balance layout -->
    </div>
  </header>
{:else}
  <!-- Normal viewer header with back navigation -->
  <header
    class="route-header"
    class:mobile={isMobile}
    data-hidden={isFullscreen}
  >
    <!-- Mobile: Swipe handle indicator for swipe-to-dismiss -->
    {#if isMobile}
      <div class="swipe-handle" aria-hidden="true"></div>
    {/if}

    <div class="header-left">
      <button
        type="button"
        class="back-button"
        onclick={onBack}
        aria-label={`Back to ${returnLabel}`}
      >
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        {#if !isMobile}
          <span class="back-label">{returnLabel}</span>
        {/if}
      </button>
    </div>

    <div class="header-center">
      <h2 class="sequence-title">Sequence Viewer</h2>
    </div>

    <div class="header-right">
      {#if onShareAnimation}
        <button
          type="button"
          class="header-action-btn"
          onclick={() => onShareAnimation?.()}
          aria-label="Export animation as video"
          title="Export video"
        >
          <i class="fas fa-video" aria-hidden="true"></i>
        </button>
      {/if}
      {#if onShareImage}
        <button
          type="button"
          class="header-action-btn"
          onclick={() => onShareImage?.()}
          aria-label="Export as image"
          title="Export image"
        >
          <i class="fas fa-image" aria-hidden="true"></i>
        </button>
      {/if}
      <button
        type="button"
        class="header-action-btn"
        onclick={() => onSettingsOpen?.()}
        aria-label="Settings"
        title="Viewer settings"
      >
        <i class="fas fa-cog" aria-hidden="true"></i>
      </button>
    </div>
  </header>
{/if}

<style>
  /* Header - CSS Grid for true center */
  .route-header {
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

  .route-header[data-hidden="true"] {
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
  .route-header.mobile {
    padding-top: 16px;
    touch-action: pan-y;
  }

  .route-header.mobile .sequence-title {
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

  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
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

  .back-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, white);
  }

  .back-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .back-label {
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
  }

  .header-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target);
    min-height: var(--min-touch-target);
    background: none;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    border-radius: 8px;
    transition: background 150ms ease, color 150ms ease;
  }

  .header-action-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
  }

  .header-action-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
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

  @media (prefers-reduced-motion: reduce) {
    .route-header,
    .back-button {
      transition: none !important;
    }
  }
</style>
