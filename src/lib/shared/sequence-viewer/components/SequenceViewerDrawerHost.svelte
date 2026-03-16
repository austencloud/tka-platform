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
  import ExportVideoDrawer from "./ExportVideoDrawer.svelte";
  import ExportImagePanel from "./ExportImagePanel.svelte";
  import VideoPreviewPanel from "./VideoPreviewPanel.svelte";
  import RampProgressIndicator from "./RampProgressIndicator.svelte";
  import ViewerSettingsModal from "./ViewerSettingsModal.svelte";
  import type { ActiveEffect } from "./ExportVideoDrawer.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  // Services
  import { container } from "$lib/shared/di";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import type { ResponsiveSettings } from "$lib/shared/device/domain/models/device-models";
  import DeleteConfirmDialog from "./DeleteConfirmDialog.svelte";
  import VideoPanel from "./video-panel/VideoPanel.svelte";
  import type { ICollaborativeVideoManager } from "$lib/shared/video-collaboration/services/contracts/ICollaborativeVideoManager";
  import ChoreoCardContextMenuHost from "./choreo-card-context-menu/ChoreoCardContextMenuHost.svelte";
  import {
    openSendSequenceSheet,
    buildSequenceSharePayload,
    buildThumbnailUrl,
  } from "$lib/shared/inbox/state/send-sequence-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";

  const overlay = getSequenceOverlayState();

  function handleSendTo() {
    const seq = overlay.sequence;
    if (!seq) return;
    const propType = seq.intendedProp?.bluePropType ?? settingsService.settings.bluePropType ?? "staff";
    const thumbnailUrl = buildThumbnailUrl(seq.word || seq.name, String(propType), false);
    openSendSequenceSheet(buildSequenceSharePayload({ ...seq, thumbnailUrl }));
  }

  // Video count for badge display on the Video button
  let videoCount = $state(0);

  $effect(() => {
    const seq = overlay.sequence;
    if (!seq?.id) {
      videoCount = 0;
      return;
    }

    const videoManager = container.items.collaborativeVideoManager as ICollaborativeVideoManager;
    videoManager.getVideosForSequence(seq.id).then((videos) => {
      videoCount = videos.length;
    }).catch(() => {
      videoCount = 0;
    });
  });

  // Width detection for responsive layout in split pane
  let isMobileWidth = $state(true);

  $effect(() => {
    if (typeof window !== "undefined") {
      const check = () => { isMobileWidth = window.innerWidth < 768; };
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
  let copyLinkFeedback = $state(false);

  function handleCopyLink() {
    const seq = overlay.sequence;
    if (!seq) return;
    const base = `${window.location.origin}/sequence/${seq.id}`;
    const params = new URLSearchParams();
    if (seq.word) params.set("word", seq.word);
    navigator.clipboard.writeText(params.size > 0 ? `${base}?${params}` : base).then(() => {
      copyLinkFeedback = true;
      setTimeout(() => { copyLinkFeedback = false; }, 1500);
    });
  }

  // Delete confirmation state
  let deleteConfirmOpen = $state(false);
  let isDeleting = $state(false);

  // ChoreoCard context menu
  let choreoCardMenuHost: ChoreoCardContextMenuHost | undefined = $state();

  // Animation visibility for video export effects
  const animationVisibility = getAnimationVisibilityManager();

  function getActiveEffects(): ActiveEffect[] {
    return [
      { id: "fire", label: "Fire", icon: "fas fa-fire", active: animationVisibility.getVisibility("fireEffect") },
      { id: "led", label: "LED", icon: "fas fa-lightbulb", active: animationVisibility.getVisibility("ledEffect") },
      { id: "trails", label: "Trails", icon: "fas fa-wind", active: animationVisibility.getTrailStyle() !== "off" },
      { id: "charcoal", label: "Charcoal", icon: "fas fa-smog", active: animationVisibility.isCharcoalEffectEnabled() },
    ];
  }

  /** Apply effect toggles from the export panel to the live animation preview */
  function handleExportEffectToggle(id: string, active: boolean) {
    switch (id) {
      case "fire":
        animationVisibility.setFireEffect(active);
        break;
      case "led":
        animationVisibility.setLedEffect(active);
        break;
      case "trails":
        animationVisibility.setTrailStyle(active ? "on" : "off");
        break;
      case "charcoal":
        animationVisibility.setCharcoalEffect(active);
        break;
    }
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
      viewingContext={overlay.viewingContext}
      onBack={handleDismiss}
    >
      {#snippet children(ctx)}
        {@const isVideoExportActive = ctx.editingPane === "animation"}
        {@const isImageExportActive = ctx.editingPane === "image"}
        {@const isVideoUploadActive = ctx.editingPane === "video-upload"}
        {@const isAnyExportActive = ctx.editingPane !== null}
        <div class="drawer-viewer-container" class:landscape={isLandscape}>
          <!-- Header — adapts between normal viewer and export mode -->
          <header class="drawer-header">
              {#if isAnyExportActive}
                <!-- Export mode: back arrow returns to viewer -->
                <button
                  type="button"
                  class="drawer-back-button"
                  onclick={ctx.exitEditMode}
                  aria-label="Back to viewer"
                >
                  <i class="fas fa-arrow-left" aria-hidden="true"></i>
                  <span class="drawer-back-label">Back</span>
                </button>

                <div class="drawer-header-title">
                  {isVideoExportActive ? "Export Animation" : isImageExportActive ? "Export Card" : "Upload Video"}
                </div>

                <div class="drawer-header-actions">
                  <!-- Spacer to balance grid layout -->
                </div>
              {:else}
                <!-- Normal viewer: dismiss + export/settings actions -->
                <button
                  type="button"
                  class="drawer-back-button"
                  onclick={handleDismiss}
                  aria-label="Back to {overlay.returnLabel}"
                >
                  <i class="fas fa-chevron-down" aria-hidden="true"></i>
                  <span class="drawer-back-label">{overlay.returnLabel}</span>
                </button>

                <div class="drawer-header-title-group">
                  <div class="drawer-header-title">Sequence Viewer</div>
                  {#if ctx.presentation && ctx.sequence?.creatorIntent?.propConfig && (ctx.sequence.creatorIntent.propConfig.bluePropType !== settingsService.settings.bluePropType || ctx.sequence.creatorIntent.propConfig.redPropType !== settingsService.settings.redPropType)}
                    <button
                      class="prop-toggle"
                      class:creator-active={ctx.presentation.source === "creator-intent"}
                      onclick={ctx.togglePropContext}
                      title={ctx.presentation.source === "creator-intent"
                        ? "Showing creator's props. Tap to use yours."
                        : "Showing your props. Tap to see creator's."}
                    >
                      <span class="toggle-label">Props:</span>
                      <span
                        class="toggle-option"
                        class:active={ctx.presentation.source === "creator-intent"}
                      >
                        Theirs
                      </span>
                      <span class="toggle-divider">|</span>
                      <span
                        class="toggle-option"
                        class:active={ctx.presentation.source === "viewer-settings"}
                      >
                        Mine
                      </span>
                    </button>
                  {:else}
                    <div class="export-hint">Tap either view to export it</div>
                  {/if}
                </div>

                <div class="drawer-header-actions">
                  <button
                    type="button"
                    class="header-action-btn lamp-btn"
                    class:lit={!ctx.imgDarkMode}
                    onclick={ctx.handleUnifiedDarkModeToggle}
                    aria-label={ctx.imgDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                    title={ctx.imgDarkMode ? "Light mode" : "Dark mode"}
                  >
                    <i class="fas fa-lightbulb" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    class="header-action-btn"
                    onclick={handleCopyLink}
                    aria-label="Copy link to sequence"
                    title="Copy link"
                  >
                    <i class="fas {copyLinkFeedback ? 'fa-check' : 'fa-link'}" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    class="header-action-btn"
                    onclick={() => (settingsModalOpen = true)}
                    aria-label="Settings"
                    title="Viewer settings"
                  >
                    <i class="fas fa-cog" aria-hidden="true"></i>
                  </button>
                </div>
              {/if}
            </header>

          <!-- Main area: body + footer side-by-side in landscape, stacked in portrait -->
          <div class="drawer-main">
            <!-- Content: single ViewerSplitPane reused across all modes -->
            <div class="drawer-body-content">
              {#if ctx.hasSequence && ctx.effectiveSequence}
                <div
                  class="viewer-and-export"
                  class:export-active={isAnyExportActive}
                  class:desktop={!isMobileWidth}
                >
                  <ViewerSplitPane
                    sequence={ctx.effectiveSequence}
                    playback={ctx.splitPanePlayback}
                    imageComposition={isImageExportActive
                      ? {
                          showWord: ctx.exportOptions.imageShowWord,
                          showStepNumbers: ctx.exportOptions.imageShowStepNumbers,
                          showDifficulty: ctx.exportOptions.imageShowDifficulty,
                          showStartPos: ctx.exportOptions.imageIncludeStartPosition,
                          showCreatorName: ctx.exportOptions.imageShowCreatorName,
                          showNotes: ctx.exportOptions.imageShowNotes,
                          darkMode: ctx.exportOptions.imageDarkMode,
                          columnCount: ctx.exportOptions.imageColumnCount != null
                            ? ctx.exportOptions.imageColumnCount + (ctx.exportOptions.imageIncludeStartPosition ? 1 : 0)
                            : null,
                          forceContain: true,
                          userName: ctx.splitPaneImageComposition.userName,
                        }
                      : ctx.splitPaneImageComposition}
                    propRendering={ctx.splitPanePropRendering}
                    layout={{
                      isFullscreen: ctx.isFullscreen,
                      fullscreenStackVertical: ctx.fullscreenStackVertical,
                      isMobile: isMobileWidth,
                      isLandscapeMobile: isLandscape,
                      focusedPane: ctx.editingPane,
                      suppressCloseButton: ctx.editingPane !== null,
                    }}
                    onRenderProgress={ctx.onRenderProgress}
                    onFocusPane={ctx.enterEditMode}
                    onUnfocusPane={ctx.exitEditMode}
                    onStepClick={ctx.handleStepClick}
                    onCanvasReady={ctx.handleCanvasReady}
                    onChoreoCardContextMenu={(x, y) => choreoCardMenuHost?.openContextMenu(x, y)}
                  />
                  <ChoreoCardContextMenuHost
                    bind:this={choreoCardMenuHost}
                    isExportMode={isImageExportActive}
                    exportOptions={ctx.exportOptions}
                    onSendTo={overlay.sequence ? handleSendTo : undefined}
                  />
                  {#if isAnyExportActive}
                    <div class="export-panel-container" class:sidebar={!isMobileWidth && (isVideoExportActive || isVideoUploadActive)}>
                      {#if isVideoExportActive}
                        {#if ctx.previewBlobUrl}
                          <VideoPreviewPanel
                            blobUrl={ctx.previewBlobUrl}
                            onDismiss={ctx.dismissPreview}
                            onRedownload={() => {
                              const a = document.createElement("a");
                              a.href = ctx.previewBlobUrl!;
                              a.download = `${ctx.effectiveSequence?.word || "sequence"}.mp4`;
                              a.click();
                            }}
                          />
                        {:else}
                          <ExportVideoDrawer
                            exportOptions={ctx.exportOptions}
                            viewerEffects={getActiveEffects()}
                            isExporting={ctx.isExporting}
                            exportProgress={ctx.exportProgress}
                            canvasReady={ctx.canvasReady}
                            layout={isMobileWidth ? "bottom" : "sidebar"}
                            singlePlayDuration={ctx.singlePlayDuration}
                            isPlaying={ctx.isPlayingLocal}
                            bpm={ctx.bpmLocal}
                            onPlaybackToggle={ctx.handlePlaybackToggle}
                            onBpmChange={ctx.handleBpmChange}
                            onExport={ctx.handleExport}
                            onCancel={ctx.handleCancelExport}
                            onEffectToggle={handleExportEffectToggle}
                          />
                        {/if}
                      {:else if isImageExportActive}
                        <ExportImagePanel
                          exportOptions={ctx.exportOptions}
                          isExporting={ctx.isExporting}
                          beatCount={ctx.effectiveSequence?.steps?.length ?? 0}
                          layout={isMobileWidth ? "bottom" : "sidebar"}
                          onExport={ctx.handleExport}
                          onClose={ctx.exitEditMode}
                        />
                      {:else if isVideoUploadActive && overlay.sequence}
                        <VideoPanel
                          sequence={overlay.sequence}
                          isOwned={ctx.isOwned}
                          bpm={ctx.bpmLocal}
                          onSaveFirst={async () => { await ctx.handleSave(); }}
                          onClose={ctx.exitEditMode}
                        />
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>

            <!-- Footer: collapses via CSS during export modes for smooth transition -->
            <div class="footer-collapse" class:collapsed={isAnyExportActive}>
              <ViewerFooter
                bpm={ctx.bpmLocal}
                isPlaying={ctx.isPlayingLocal}
                isLoggedIn={ctx.isLoggedIn}
                landscape={isLandscape}
                onBpmChange={ctx.handleBpmChange}
                onPlayPause={ctx.handlePlaybackToggle}
                onStepBack={ctx.stepFullBeatBackward}
                onStepForward={ctx.stepFullBeatForward}
                onStepHalfBack={ctx.stepHalfBeatBackward}
                onStepHalfForward={ctx.stepHalfBeatForward}
                onRestartToStart={ctx.restartToStart}
                onSave={ctx.handleSave}
                onEdit={ctx.handleEdit}
                onGetApp={ctx.handleGetApp}
                onExportVideo={() => ctx.enterEditMode('animation')}
                onExportImage={() => ctx.enterEditMode('image')}
                rampActive={ctx.rampActive}
                onRampStart={ctx.handleRampStart}
                onRampStop={ctx.handleRampStop}
                isOwned={ctx.isOwned}
                onVideoUpload={ctx.isLoggedIn ? () => ctx.handleVideoUpload() : undefined}
                onDeleteRequest={() => (deleteConfirmOpen = true)}
                bluePropType={ctx.bluePropType}
                redPropType={ctx.redPropType}
                onSetAsIntended={ctx.handleSetAsIntended}
                {videoCount}
              />
            </div>
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
    padding: calc(env(safe-area-inset-top, 0px) + 6px) 12px 6px;
    min-height: var(--min-touch-target);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
    overflow: visible;
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
    min-height: var(--min-touch-target);
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

  .drawer-header-title-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    pointer-events: none;
    overflow: visible;
    min-width: 0;
  }

  .drawer-header-title {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    white-space: nowrap;
  }

  /* Standalone title (export mode) centers itself when not in a title group */
  .drawer-header-title:only-child {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .export-hint {
    font-size: var(--font-size-xs, 11px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-weight: 400;
    white-space: nowrap;
  }

  .prop-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 14px;
    padding: 3px 12px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition: border-color 0.15s;
    line-height: 1.4;
    pointer-events: auto;
  }

  .prop-toggle:hover {
    border-color: var(--theme-accent, #6366f1);
  }

  .toggle-label {
    opacity: 0.4;
    font-weight: 400;
  }

  .toggle-option {
    transition: color 0.15s, opacity 0.15s;
    opacity: 0.5;
  }

  .toggle-option.active {
    color: var(--theme-accent, #6366f1);
    opacity: 1;
    font-weight: 600;
  }

  .toggle-divider {
    opacity: 0.3;
    font-size: 10px;
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
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
  }

  /* Lightbulb toggle — unlit (dark mode active) */
  .lamp-btn {
    transition: background 150ms ease, color 150ms ease, box-shadow 150ms ease;
  }

  /* Lit state — light mode active, bulb glows */
  .lamp-btn.lit {
    color: #ffd966;
    background: linear-gradient(145deg, rgba(255, 220, 100, 0.2), rgba(255, 180, 50, 0.1));
    box-shadow: 0 0 12px rgba(255, 200, 80, 0.25);
  }

  .lamp-btn.lit i {
    filter: drop-shadow(0 0 4px rgba(255, 200, 80, 0.7));
  }

  .lamp-btn.lit:hover {
    background: linear-gradient(145deg, rgba(255, 220, 100, 0.3), rgba(255, 180, 50, 0.2));
    box-shadow: 0 0 16px rgba(255, 200, 80, 0.35);
  }

  /* Main area wraps body + footer in a flex column.
     Body fills remaining space; footer is a normal flex child at the bottom. */
  .drawer-main {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* Landscape: footer is a side column, collapses horizontally */
  .landscape .footer-collapse {
    grid-template-rows: 1fr;
    grid-template-columns: 1fr;
    transition: grid-template-columns 250ms cubic-bezier(0.2, 0, 0, 1),
                opacity 250ms cubic-bezier(0.2, 0, 0, 1);
  }

  .landscape .footer-collapse.collapsed {
    grid-template-columns: 0fr;
    grid-template-rows: 1fr;
    opacity: 0;
    pointer-events: none;
  }

  .drawer-body-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Landscape: compact header — icon-only back button, no title, minimal height */
  .landscape .drawer-header {
    padding-top: 2px;
    padding-bottom: 2px;
    min-height: 32px;
    border-bottom: none;
  }

  .landscape .drawer-header-title-group {
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

  /* Viewer + export panel container.
     The split pane fills this via width/height: 100%; export panel overlays the right side.
     This prevents the parent from resizing when the export panel appears. */
  .viewer-and-export {
    --export-sidebar-width: 320px;
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* Export panel — absolute overlay so it doesn't steal width from split pane */
  .export-panel-container {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: var(--export-sidebar-width);
    z-index: 20;
    overflow: hidden;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    isolation: isolate;
  }

  @media (max-width: 767px) {
    /* Mobile: export panel is inline in the flex layout, not absolute */
    .viewer-and-export.export-active {
      display: flex;
      flex-direction: column;
    }

    .export-panel-container {
      position: relative;
      top: auto;
      right: auto;
      bottom: auto;
      left: auto;
      width: 100%;
      flex-shrink: 0;
      overflow: visible;
      border-left: none;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }

    /* When in mobile export mode, make ViewerSplitPane participate in the flex
       flow instead of being absolute-positioned. This ensures the export controls
       bar stays visible below the scrollable card area. Without this, the
       absolute-positioned split pane fills the entire parent and the export
       panel gets pushed offscreen by the tall choreo card. */
    .viewer-and-export.export-active :global(.view-container) {
      position: relative;
      inset: auto;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
  }

  /* Footer — uses CSS grid row collapse for smooth height animation.
     grid-template-rows: 1fr → 0fr smoothly collapses the footer to zero height
     while the flex body above grows to fill the freed space. */
  .footer-collapse {
    display: grid;
    grid-template-rows: 1fr;
    transition: grid-template-rows 250ms cubic-bezier(0.2, 0, 0, 1),
                opacity 250ms cubic-bezier(0.2, 0, 0, 1);
  }

  .footer-collapse > :global(*) {
    overflow: hidden;
  }

  .footer-collapse.collapsed {
    grid-template-rows: 0fr;
    opacity: 0;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .lamp-btn {
      transition: none;
    }
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
