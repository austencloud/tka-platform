<!--
  ViewerHeader.svelte

  Header component for the sequence details modal.
  Handles both normal viewer mode and export mode headers.
-->
<script lang="ts">
  import LightsToggleButton from "$lib/shared/ui/components/LightsToggleButton.svelte";
  import SyncToggleButton from "$lib/shared/ui/components/SyncToggleButton.svelte";
  import MultiPerformerButton from "$lib/shared/ui/components/MultiPerformerButton.svelte";
  import ExpandButton from "$lib/shared/ui/components/ExpandButton.svelte";

  interface Props {
    /** Whether in export mode */
    isExportMode: boolean;
    /** View mode for export header title */
    viewMode: "animation" | "image" | "split";
    /** Sequence word for mobile title */
    sequenceWord?: string;
    /** Whether on mobile device */
    isMobile: boolean;
    /** Whether in fullscreen mode (hides header) */
    isFullscreen: boolean;
    /** Dark mode toggle state */
    darkMode: boolean;
    /** Sync button states */
    isSyncSearching: boolean;
    isSyncConnected: boolean;
    isSyncToggling: boolean;
    /** Swipe state for mobile dismiss */
    isSwiping?: boolean;
    swipeY?: number;
    /** Event handlers */
    onClose: () => void;
    onExitExportMode: () => void;
    onSyncToggle: () => void;
    onOpenInCompose: () => void;
    onDarkModeToggle: () => void;
    onEnterFullscreen: () => void;
    onTouchStart?: (e: TouchEvent) => void;
    onTouchMove?: (e: TouchEvent) => void;
    onTouchEnd?: () => void;
  }

  let {
    isExportMode,
    viewMode,
    sequenceWord = "Viewer",
    isMobile,
    isFullscreen,
    darkMode,
    isSyncSearching,
    isSyncConnected,
    isSyncToggling,
    isSwiping = false,
    swipeY = 0,
    onClose,
    onExitExportMode,
    onSyncToggle,
    onOpenInCompose,
    onDarkModeToggle,
    onEnterFullscreen,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }: Props = $props();
</script>

{#if isExportMode}
  <!-- Export mode header -->
  <header class="details-header export-header" data-hidden={isFullscreen}>
    <div class="header-left">
      <button
        type="button"
        class="close-button"
        onclick={onExitExportMode}
        aria-label="Back to viewer"
      >
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
      </button>
    </div>

    <div class="header-center">
      <h2 class="mode-title">
        Export {viewMode === "image" ? "Image" : "Video"}
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
    data-hidden={isFullscreen}
    ontouchstart={onTouchStart}
    ontouchmove={onTouchMove}
    ontouchend={onTouchEnd}
    style={isSwiping ? `transform: translateY(${swipeY}px); opacity: ${1 - swipeY / 200}` : undefined}
  >
    <!-- Mobile: Swipe handle indicator -->
    {#if isMobile}
      <div class="swipe-handle" aria-hidden="true"></div>
    {/if}

    <div class="header-left">
      {#if !isMobile}
        <!-- Desktop: Full set of controls -->
        <SyncToggleButton
          isSearching={isSyncSearching}
          isConnected={isSyncConnected}
          isToggling={isSyncToggling}
          onToggle={onSyncToggle}
          disabled={isSyncToggling}
          size="small"
        />
        <MultiPerformerButton
          onclick={onOpenInCompose}
          size="small"
        />
      {/if}
      <LightsToggleButton
        lightsOn={!darkMode}
        onToggle={onDarkModeToggle}
        size="small"
      />
      {#if !isMobile}
        <!-- Desktop only: Fullscreen button -->
        <ExpandButton
          isExpanded={isFullscreen}
          onclick={onEnterFullscreen}
          size="small"
        />
      {/if}
    </div>

    <div class="header-center">
      <h2 class="sequence-title">{isMobile ? sequenceWord : 'Sequence Viewer'}</h2>
    </div>

    <div class="header-right">
      <button
        type="button"
        class="close-button"
        onclick={onClose}
        aria-label="Close"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  </header>
{/if}

<style>
  /* Header layout - CSS Grid for true center */
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
    pointer-events: none;
    transform: translateY(-100%);
  }

  /* Mobile: Compact header with swipe handle */
  .details-header.mobile {
    padding: 8px 12px;
  }

  .swipe-handle {
    position: absolute;
    top: 6px;
    left: 50%;
    transform: translateX(-50%);
    width: 36px;
    height: 4px;
    background: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
    border-radius: 2px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-self: start;
  }

  .header-center {
    justify-self: center;
    text-align: center;
  }

  .header-right {
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sequence-title,
  .mode-title {
    font-size: var(--font-size-md, 16px);
    font-weight: 500;
    color: var(--theme-text, #fff);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #fff);
    cursor: pointer;
    transition: background-color var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .close-button:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.12));
  }

  .close-button:active {
    background: var(--theme-card-bg-active, rgba(255, 255, 255, 0.16));
  }

  /* Export header styling */
  .export-header {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  /* Responsive adjustments */
  @media (max-width: 767px) {
    .details-header {
      padding: 10px 12px;
    }

    .sequence-title,
    .mode-title {
      font-size: var(--font-size-sm, 14px);
      max-width: 150px;
    }

    .close-button {
      width: 32px;
      height: 32px;
    }
  }
</style>
