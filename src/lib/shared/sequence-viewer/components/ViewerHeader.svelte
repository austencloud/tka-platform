<!--
  ViewerHeader.svelte

  Header bar for the sequence viewer modal.
  Handles both normal view mode and export mode headers.
-->
<script lang="ts">
  import SyncToggleButton from "$lib/shared/ui/components/SyncToggleButton.svelte";
  import MultiPerformerButton from "$lib/shared/ui/components/MultiPerformerButton.svelte";
  import LightsToggleButton from "$lib/shared/ui/components/LightsToggleButton.svelte";
  import ExpandButton from "$lib/shared/ui/components/ExpandButton.svelte";

  type ExportType = "animation" | "image" | "both";

  interface Props {
    isExportMode: boolean;
    exportType: ExportType | null;
    isFullscreen: boolean;
    isMobile: boolean;
    darkMode: boolean;
    // Sync state
    isSyncActive: boolean;
    isSyncConnected: boolean;
    isSyncToggling: boolean;
    // Callbacks
    onClose: () => void;
    onExitExportMode: () => void;
    onBackToExportTypeSelection: () => void;
    onSyncToggle: () => void;
    onOpenInCompose: () => void;
    onDarkModeToggle: () => void;
    onEnterFullscreen: () => void;
  }

  let {
    isExportMode,
    exportType,
    isFullscreen,
    isMobile,
    darkMode,
    isSyncActive,
    isSyncConnected,
    isSyncToggling,
    onClose,
    onExitExportMode,
    onBackToExportTypeSelection,
    onSyncToggle,
    onOpenInCompose,
    onDarkModeToggle,
    onEnterFullscreen,
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
  <!-- Normal viewer header -->
  <header
    class="details-header"
    class:mobile={isMobile}
    data-hidden={isFullscreen}
  >
    <!-- Mobile: Swipe handle indicator for swipe-to-dismiss -->
    {#if isMobile}
      <div class="swipe-handle" aria-hidden="true"></div>
    {/if}

    <div class="header-left">
      {#if !isMobile}
        <!-- Desktop: Full set of controls -->
        <SyncToggleButton
          isSearching={isSyncActive && !isSyncConnected}
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
        <!-- Desktop: Quick light/dark toggle + fullscreen -->
        <LightsToggleButton
          lightsOn={!darkMode}
          onToggle={onDarkModeToggle}
          size="small"
        />
        <ExpandButton
          isExpanded={isFullscreen}
          onclick={onEnterFullscreen}
          size="small"
        />
      {/if}
      <!-- Mobile: No header buttons - settings moved to morphing footer -->
    </div>

    <div class="header-center">
      <h2 class="sequence-title">Sequence Viewer</h2>
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
  }

  .header-center {
    display: flex;
    justify-content: center;
  }

  .close-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
    font-size: 18px;
    cursor: pointer;
    transition: all 0.15s ease;
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

  @media (prefers-reduced-motion: reduce) {
    .details-header,
    .close-button {
      transition: none !important;
    }
  }
</style>
