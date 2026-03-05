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
  - Landscape mode: footer moves to side column, header compacts
-->
<script lang="ts">
  import { onMount } from "svelte";
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
  import ExportVideoDrawer from "./ExportVideoDrawer.svelte";
  import ExportFooter from "./ExportFooter.svelte";
  import RampProgressIndicator from "./RampProgressIndicator.svelte";
  import ViewerSettingsModal from "./ViewerSettingsModal.svelte";
  import type { ActiveEffect } from "./ExportVideoDrawer.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  // Services
  import { container } from "$lib/shared/di";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import type { ResponsiveSettings } from "$lib/shared/device/domain/models/device-models";
  import type { IClaudeCodeCopier } from "$lib/features/browse/sequences/display/services/contracts/IClaudeCodeCopier";
  import CopyForAIButton from "$lib/shared/foundation/ui/CopyForAIButton.svelte";
  import DeleteConfirmDialog from "./DeleteConfirmDialog.svelte";

  const overlay = getSequenceOverlayState();

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

  // Landscape detection via DeviceDetector (single source of truth)
  let responsiveSettings = $state<ResponsiveSettings | null>(null);
  let isLandscape = $derived(responsiveSettings?.isLandscapeMobile ?? false);

  // Track drawer open state for binding
  let drawerOpen = $state(false);

  // Settings modal state
  let settingsModalOpen = $state(false);

  // Delete confirmation state
  let deleteConfirmOpen = $state(false);
  let isDeleting = $state(false);

  // Animation visibility for video export effects
  const animationVisibility = getAnimationVisibilityManager();

  function getActiveEffects(): ActiveEffect[] {
    const effects: ActiveEffect[] = [];
    if (animationVisibility.getVisibility("fireEffect")) {
      effects.push({ id: "fire", label: "Fire", icon: "fas fa-fire", active: true });
    }
    if (animationVisibility.getVisibility("ledEffect")) {
      effects.push({ id: "led", label: "LED", icon: "fas fa-lightbulb", active: true });
    }
    if (animationVisibility.getTrailStyle() !== "off") {
      effects.push({ id: "trails", label: "Trails", icon: "fas fa-wind", active: true });
    }
    if (animationVisibility.getVisibility("fireUseCharcoal")) {
      effects.push({ id: "charcoal", label: "Charcoal", icon: "fas fa-smog", active: true });
    }
    return effects;
  }

  // Copy for AI
  let claudeCopier = $state<IClaudeCodeCopier | null>(null);

  function getCopyDataForClaude(): Promise<string> {
    if (!claudeCopier || !overlay.sequence) return Promise.resolve("");
    return claudeCopier.generatePrompt(overlay.sequence);
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
    // Landscape detection via DeviceDetector
    let deviceCleanup: (() => void) | undefined;
    try {
      const deviceDetector: IDeviceDetector = container.items.deviceDetector;
      responsiveSettings = deviceDetector.getResponsiveSettings();

      deviceCleanup = deviceDetector.onCapabilitiesChanged(() => {
        responsiveSettings = deviceDetector.getResponsiveSettings();
      });
    } catch (error) {
      console.warn("SequenceViewerDrawerHost: Failed to resolve DeviceDetector", error);
    }

    // Resolve copy-for-AI service
    try {
      claudeCopier = container.items.claudeCodeCopier;
    } catch {
      // Non-fatal — button just won't appear
    }

    // Popstate (back button) listener
    window.addEventListener("popstate", handlePopState);

    return () => {
      deviceCleanup?.();
      window.removeEventListener("popstate", handlePopState);
    };
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
        <div class="drawer-viewer-container" class:landscape={isLandscape}>
          <!-- Header (compact in landscape) -->
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
                  {#if claudeCopier}
                    <CopyForAIButton
                      getData={getCopyDataForClaude}
                      variant="icon-only"
                      size="md"
                      ariaLabel="Copy sequence data for AI"
                    />
                  {/if}
                  <button
                    type="button"
                    class="header-action-btn"
                    onclick={() => (settingsModalOpen = true)}
                    aria-label="Settings"
                    title="Viewer settings"
                  >
                    <i class="fas fa-cog" aria-hidden="true"></i>
                  </button>
                {/if}
              </div>
            </header>

          <!-- Main area: body + footer side-by-side in landscape, stacked in portrait -->
          <div class="drawer-main">
            <!-- Content -->
            <div class="drawer-body-content">
              {#if ctx.hasSequence && ctx.effectiveSequence}
                {#if ctx.isExportMode && ctx.exportType === "animation"}
                  <!-- Video export: side-by-side on desktop, overlay on mobile -->
                  <div class="export-video-layout" class:desktop={!isMobileWidth}>
                    <ViewerSplitPane
                      sequence={ctx.effectiveSequence}
                      playback={ctx.splitPanePlayback}
                      imageComposition={ctx.splitPaneImageComposition}
                      propRendering={ctx.splitPanePropRendering}
                      layout={{ isFullscreen: false, fullscreenStackVertical: false, isMobile: isMobileWidth, isLandscapeMobile: isLandscape, focusedPane: 'animation' }}
                      onRenderProgress={ctx.onRenderProgress}
                      onFocusPane={ctx.enterEditMode}
                      onUnfocusPane={ctx.exitEditMode}
                      onStepClick={ctx.handleStepClick}
                      onCanvasReady={ctx.handleCanvasReady}
                    />
                    <ExportVideoDrawer
                      exportOptions={ctx.exportOptions}
                      viewerEffects={getActiveEffects()}
                      isExporting={ctx.isExporting}
                      canvasReady={ctx.canvasReady}
                      layout={isMobileWidth ? "bottom" : "sidebar"}
                      onExport={ctx.handleExport}
                      onClose={ctx.exitExportMode}
                    />
                  </div>
                {:else if ctx.isExportMode}
                  <!-- Image export or type selection -->
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
                    playback={ctx.splitPanePlayback}
                    imageComposition={ctx.splitPaneImageComposition}
                    propRendering={ctx.splitPanePropRendering}
                    layout={{ isFullscreen: ctx.isFullscreen, fullscreenStackVertical: ctx.fullscreenStackVertical, isMobile: isMobileWidth, isLandscapeMobile: isLandscape, focusedPane: ctx.editingPane }}
                    onRenderProgress={ctx.onRenderProgress}
                    onFocusPane={ctx.enterEditMode}
                    onUnfocusPane={ctx.exitEditMode}
                    onStepClick={ctx.handleStepClick}
                    onCanvasReady={ctx.handleCanvasReady}
                  />
                {/if}
              {/if}
            </div>

            <!-- Footer (becomes side column in landscape) -->
            {#if ctx.isExportMode && ctx.exportType !== "animation" && ctx.exportType !== null}
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
                landscape={isLandscape}
                playbackOnly={ctx.isExportMode && ctx.exportType === "animation"}
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
                onEdit={ctx.handleEditInConstructor}
                onCompose={() => ctx.handleOpenInCompose()}
                onShare={ctx.handleShare}
                onGetApp={ctx.handleGetApp}
                rampActive={ctx.rampActive}
                onRampStart={ctx.handleRampStart}
                onRampStop={ctx.handleRampStop}
                onConnect={ctx.handleSyncToggle}
                isOwned={ctx.isOwned}
                onDeleteRequest={() => (deleteConfirmOpen = true)}
              />
            {/if}
          </div>
          {#if ctx.rampActive}
            <RampProgressIndicator
              progress={ctx.rampState.progress}
              onStop={ctx.handleRampStop}
              variant="floating"
            />
          {/if}

          {#if deleteConfirmOpen}
            <DeleteConfirmDialog
              word={overlay.sequence?.word}
              {isDeleting}
              positioning="absolute"
              onConfirm={async () => {
                isDeleting = true;
                try {
                  await ctx.handleDelete();
                } finally {
                  deleteConfirmOpen = false;
                  isDeleting = false;
                }
              }}
              onCancel={() => (deleteConfirmOpen = false)}
            />
          {/if}
        </div>
      {/snippet}
    </SequenceViewerOrchestrator>
  {/if}
</Drawer>

<!-- Settings modal - rendered outside the viewer drawer so position:fixed works -->
<ViewerSettingsModal
  bind:open={settingsModalOpen}
  onClose={() => (settingsModalOpen = false)}
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

  /* Main area wraps body + footer. Column in portrait, row in landscape. */
  .drawer-main {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .landscape .drawer-main {
    flex-direction: row;
  }

  .drawer-body-content {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  /* Landscape: compact header — icon-only back button, no title, minimal height */
  .landscape .drawer-header {
    padding-top: 2px;
    padding-bottom: 2px;
    min-height: 32px;
    border-bottom: none;
  }

  .landscape .drawer-header-title {
    display: none;
  }

  .landscape .drawer-back-label {
    display: none;
  }

  .landscape .drawer-back-button {
    min-height: 32px;
    padding: 0 8px;
  }

  .landscape .header-action-btn {
    min-width: 32px;
    min-height: 32px;
  }

  /* Video export layout: animation preview + settings panel */
  .export-video-layout {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Desktop: side-by-side (animation left, settings right) */
  .export-video-layout.desktop {
    flex-direction: row;
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
