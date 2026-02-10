<!--
  SequenceViewerDrawerHost.svelte

  Hosts the mobile sequence viewer as a drawer overlay.
  Lives in MainApplication.svelte outside the auth gate so external links
  (QR codes, shared URLs) work for both authenticated and unauthenticated users.
  When a sequence is opened on mobile, this drawer slides up from the bottom,
  covering whatever is loading behind it (Browse gallery, landing page, etc.).

  Features:
  - Full-height bottom drawer
  - Back button / popstate closes drawer
  - Swipe-to-dismiss via Drawer component
  - All viewer functionality via SequenceViewerOrchestrator
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import SequenceViewerOrchestrator from "./SequenceViewerOrchestrator.svelte";
  import {
    getSequenceOverlayState,
    closeSequenceOverlay,
  } from "../state/sequence-viewer-overlay-state.svelte";
  // Components
  import ViewerSplitPane from "./ViewerSplitPane.svelte";
  import ViewerFooter from "./ViewerFooter.svelte";
  import ExportModeContent from "./ExportModeContent.svelte";
  import ExportFooter from "./ExportFooter.svelte";
  import RampProgressIndicator from "./RampProgressIndicator.svelte";
  import ViewerSettingsPopover from "./ViewerSettingsPopover.svelte";
  import PropSelectorDrawer from "./PropSelectorDrawer.svelte";

  const overlay = getSequenceOverlayState();

  // TODO: Add full settings panel with visibility toggles
  // For now, the gear toggles dark mode (same as before)

  // Width detection for responsive layout in split pane
  let isMobileWidth = $state(true);

  $effect(() => {
    if (typeof window !== "undefined") {
      const check = () => { isMobileWidth = window.innerWidth < 600; };
      check();
      window.addEventListener("resize", check);
      return () => window.removeEventListener("resize", check);
    }
    return undefined;
  });

  // Track drawer open state for binding
  let drawerOpen = $state(false);

  // Settings popover state
  let settingsOpen = $state(false);

  // Prop selector drawer state
  let propDrawerOpen = $state(false);

  function handleOpenPropSelector() {
    propDrawerOpen = true;
  }

  // Sync overlay state to drawer state
  $effect(() => {
    drawerOpen = overlay.isOpen;
  });

  // ============================================================================
  // POPSTATE (BACK BUTTON)
  // ============================================================================

  function handlePopState(event: PopStateEvent) {
    // If the drawer is open and user pressed back, close it
    if (overlay.isOpen) {
      closeSequenceOverlay();
    }
  }

  onMount(() => {
    window.addEventListener("popstate", handlePopState);
  });

  onDestroy(() => {
    window.removeEventListener("popstate", handlePopState);
  });

  // ============================================================================
  // DISMISS
  // ============================================================================

  function handleDismiss() {
    // Read state BEFORE closing (closeSequenceOverlay clears it)
    const path = overlay.dismissPath;
    const wasOpen = overlay.isOpen;

    closeSequenceOverlay();

    if (path) {
      // External link: navigate to app destination instead of going back
      goto(path, { replaceState: true });
    } else if (wasOpen) {
      // In-app: go back in history to remove the entry we pushed when opening
      window.history.back();
    }
  }

  function handleDrawerClose() {
    // Called by Drawer when it closes (backdrop click, escape, swipe)
    handleDismiss();
  }
</script>

<Drawer
  bind:isOpen={drawerOpen}
  placement="bottom"
  snapPoints={["100%"]}
  onclose={handleDrawerClose}
  showHandle={false}
  ariaLabel="Sequence Viewer"
  class="sequence-viewer-drawer"
>
  {#if overlay.sequence}
    <SequenceViewerOrchestrator
      sequence={overlay.sequence}
      isMobile={isMobileWidth}
      initialBpm={overlay.initialBpm}
      initialStep={overlay.initialStep}
      onBack={handleDismiss}
    >
      {#snippet children(ctx)}
        <div class="drawer-viewer-container">
          <!-- Header (simplified for drawer - just back button and title) -->
          <header class="drawer-header">
              <button
                type="button"
                class="drawer-back-button"
                onclick={handleDismiss}
                aria-label="Back to {overlay.returnLabel}"
              >
                <i class="fas fa-chevron-down" aria-hidden="true"></i>
                <span class="drawer-back-label">{overlay.returnLabel}</span>
              </button>

              <div class="drawer-header-title">Sequence Viewer</div>

              <div class="drawer-header-actions">
                {#if !ctx.isExportMode}
                  <button
                    type="button"
                    class="header-action-btn"
                    onclick={() => (settingsOpen = true)}
                    aria-label="Settings"
                    title="Viewer settings"
                  >
                    <i class="fas fa-cog" aria-hidden="true"></i>
                  </button>
                {/if}
              </div>

              <ViewerSettingsPopover
                open={settingsOpen}
                darkMode={ctx.imgDarkMode}
                onDarkModeToggle={ctx.handleUnifiedDarkModeToggle}
                onClose={() => (settingsOpen = false)}
                onOpenPropSelector={handleOpenPropSelector}
              />
            </header>

          <!-- Main content -->
          <div class="drawer-body-content">
            {#if ctx.hasSequence && ctx.effectiveSequence}
              {#if ctx.isExportMode}
                <ExportModeContent
                  sequence={ctx.effectiveSequence}
                  exportType={ctx.exportType}
                  exportOptions={ctx.exportOptions}
                  animationState={ctx.modalAnimationState}
                  animationLoading={ctx.animationLoading}
                  currentStep={ctx.currentStepLocal}
                  currentLetter={ctx.currentLetter}
                  currentStepData={ctx.currentStepData}
                  userName={ctx.userName}
                  bluePropType={ctx.bluePropType}
                  redPropType={ctx.redPropType}
                  catDogModeEnabled={ctx.catDogModeEnabled}
                  onSelectType={ctx.selectExportType}
                  onCanvasReady={ctx.handleCanvasReady}
                />
              {:else}
                <ViewerSplitPane
                  sequence={ctx.effectiveSequence}
                  animationState={ctx.modalAnimationState}
                  animationLoading={ctx.animationLoading}
                  currentStep={ctx.currentStepLocal}
                  isPlaying={ctx.isPlayingLocal}
                  currentLetter={ctx.currentLetter}
                  currentStepData={ctx.currentStepData}
                  highlightedStepIndex={ctx.highlightedStepIndex}
                  imgShowWord={ctx.imgShowWord}
                  imgShowDifficulty={ctx.imgShowDifficulty}
                  imgShowStartPos={ctx.imgShowStartPos}
                  imgShowCreatorName={ctx.imgShowCreatorName}
                  imgShowNotes={ctx.imgShowNotes}
                  imgDarkMode={ctx.imgDarkMode}
                  imgColumnCount={ctx.imgColumnCount}
                  userName={ctx.userName}
                  bluePropType={ctx.bluePropType}
                  redPropType={ctx.redPropType}
                  catDogModeEnabled={ctx.catDogModeEnabled}
                  isFullscreen={ctx.isFullscreen}
                  fullscreenStackVertical={ctx.fullscreenStackVertical}
                  isMobile={isMobileWidth}
                  focusedPane={ctx.editingPane}
                  onFocusPane={ctx.enterEditMode}
                  onUnfocusPane={ctx.exitEditMode}
                  onStepClick={ctx.handleStepClick}
                  onCanvasReady={ctx.handleCanvasReady}
                />
              {/if}
            {/if}
          </div>

          <!-- Footer -->
          {#if ctx.isExportMode}
            <ExportFooter
              exportType={ctx.exportType}
              isExporting={ctx.isExporting}
              exportProgress={ctx.exportProgress}
              exportError={ctx.exportError}
              isFullscreen={false}
              onExport={ctx.handleExport}
              onCancel={ctx.handleCancelExport}
              onRetry={ctx.handleRetryExport}
            />
          {:else}
            <ViewerFooter
              bpm={ctx.bpmLocal}
              isPlaying={ctx.isPlayingLocal}
              isLoggedIn={ctx.isLoggedIn}
              isSyncToggling={ctx.isSyncToggling}
              isSyncActive={ctx.isSyncActive}
              isSyncConnected={ctx.isSyncConnected}
              onBpmChange={ctx.handleBpmChange}
              onPlayPause={ctx.handlePlaybackToggle}
              onStepBack={ctx.stepFullBeatBackward}
              onStepForward={ctx.stepFullBeatForward}
              onStepHalfBack={ctx.stepHalfBeatBackward}
              onStepHalfForward={ctx.stepHalfBeatForward}
              onSave={ctx.handleSave}
              onCompose={() => ctx.handleOpenInCompose()}
              onShare={ctx.handleShare}
              onExport={ctx.enterExportMode}
              onGetApp={ctx.handleGetApp}
              rampActive={ctx.rampActive}
              onRampStart={ctx.handleRampStart}
              onRampStop={ctx.handleRampStop}
              onConnect={ctx.handleSyncToggle}
            />
          {/if}
          {#if ctx.rampActive}
            <RampProgressIndicator
              progress={ctx.rampState.progress}
              onStop={ctx.handleRampStop}
              variant="floating"
            />
          {/if}
        </div>
      {/snippet}
    </SequenceViewerOrchestrator>
  {/if}
</Drawer>

<!-- Prop selector drawer - rendered outside the viewer drawer so position:fixed works -->
<PropSelectorDrawer
  bind:isOpen={propDrawerOpen}
  onClose={() => (propDrawerOpen = false)}
/>

<style>
  .drawer-viewer-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--theme-panel-bg, #0a0a14);
  }

  .drawer-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px;
    min-height: 48px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .drawer-back-button {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--theme-accent, #f43f5e);
    font-size: 14px;
    cursor: pointer;
    padding: 0 10px 0 12px;
    min-height: 48px;
    border-radius: 8px;
    transition: background 150ms ease;
  }

  .drawer-back-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .drawer-back-button:focus-visible {
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
  }

  .drawer-back-button i {
    font-size: 11px;
    flex-shrink: 0;
  }

  .drawer-back-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    white-space: nowrap;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .drawer-header-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    white-space: nowrap;
    pointer-events: none;
  }

  .drawer-header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .header-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 48px;
    min-height: 48px;
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
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
  }

  .drawer-body-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  /* Override Drawer defaults for full-screen sequence viewer */
  :global(.sequence-viewer-drawer) {
    --sheet-bg: var(--theme-panel-bg, #0a0a14) !important;
    --sheet-filter: none !important;
    /* Remove border radius since this drawer fills the viewport */
    --sheet-border-radius-top-left: 0px !important;
    --sheet-border-radius-top-right: 0px !important;
    border-top-left-radius: 0 !important;
    border-top-right-radius: 0 !important;
  }
</style>
