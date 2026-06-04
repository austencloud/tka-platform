<script lang="ts">
import { getDeviceId } from "$lib/shared/auth/services/device-id-service";
  import { onMount } from "svelte";
  import { goto, replaceState } from "$app/navigation";
  import { getDeviceDetector } from "$lib/shared/device/get-device-detector";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import SequenceViewerOrchestrator from "./SequenceViewerOrchestrator.svelte";
  import {
    getSequenceOverlayState,
    closeSequenceOverlay,
    openSequenceOverlay,
  } from "../state/sequence-viewer-overlay-state.svelte";
  import ViewerSplitPane from "./ViewerSplitPane.svelte";
  import ViewerContentRail from "./ViewerContentRail.svelte";
  import ViewerModeBottomBar from "./ViewerModeBottomBar.svelte";
  import type { OrchestratorContext } from "./SequenceViewerOrchestrator.svelte";
  import type { ContentType } from "../state/viewer-state.svelte";
  import VideoGallery from "./VideoGallery.svelte";
  import ViewerOverflowMenu from "./ViewerOverflowMenu.svelte";
  import ExportVideoDrawer from "$lib/shared/animation-panel/components/AnimationPanel.svelte";
  import ExportImagePanel from "./ExportImagePanel.svelte";
  import VideoPreviewPanel from "./VideoPreviewPanel.svelte";
  import PracticeProgressIndicator from "./PracticeProgressIndicator.svelte";
  import Recording3DOverlay from "./Recording3DOverlay.svelte";
  import RecordSceneChrome from "./record-scene/RecordSceneChrome.svelte";
  import { getVideosForSequence } from "$lib/shared/video-collaboration/services/collaborative-video-manager";
  import { getClaudeCodeCopier } from "$lib/shared/browse/get-claude-code-copier";
  import { getShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
  import { isInlineEncoded } from "$lib/shared/navigation/services/sequence-encoder";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { hydrateSequence } from "$lib/shared/navigation/services/sequence-hydrator";
  import { getLoopDetector } from "$lib/shared/create/get-loop-detector";
  import type { DeviceDetector } from '$lib/shared/device/services/device-detector'
  import type { ResponsiveSettings } from "$lib/shared/device/domain/models/device-models";
  import DeleteConfirmDialog from "./DeleteConfirmDialog.svelte";
  import VideoPanel from "./video-panel/VideoPanel.svelte";
  import ChoreoCardContextMenuHost from "./choreo-card-context-menu/ChoreoCardContextMenuHost.svelte";
  import MotionVisibilityToggle from "./MotionVisibilityToggle.svelte";
  import {
    openSendSequenceSheet,
    buildSequenceSharePayload,
    buildThumbnailUrl,
  } from "$lib/shared/inbox/state/send-sequence-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { sanitizeFilename } from "$lib/shared/foundation/services/file-downloader";
  import { greekToAscii } from "$lib/shared/create/domain/spell-constants";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { sendToStickerLab } from "$lib/shared/sequence-viewer/services/send-to-sticker-lab";

  const overlay = getSequenceOverlayState();

  function handleSendTo() {
    const seq = overlay.sequence;
    if (!seq) return;
    const propType = seq.intendedProp?.bluePropType ?? settingsService.settings.bluePropType ?? "staff";
    const thumbnailUrl = buildThumbnailUrl(seq.word || seq.name, String(propType), false);
    openSendSequenceSheet(buildSequenceSharePayload({ ...seq, thumbnailUrl }));
  }

  function handleSendToStickerLab() {
    const seq = overlay.sequence;
    if (!seq) return;
    sendToStickerLab(seq);
  }

  let videoCount = $state(0);

  $effect(() => {
    const seq = overlay.sequence;
    if (!seq?.id || !authState.isAuthenticated) {
      videoCount = 0;
      return;
    }

    getVideosForSequence(seq.id).then((videos) => {
      videoCount = videos.length;
    }).catch(() => {
      videoCount = 0;
    });
  });

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

  let responsiveSettings = $state<ResponsiveSettings | null>(null);
  let isLandscape = $derived(responsiveSettings?.isLandscapeMobile ?? false);

  let drawerOpen = $state(false);

  let exportSidebarCollapsed = $state(false);

  function toggleExportSidebar() {
    exportSidebarCollapsed = !exportSidebarCollapsed;
  }

  $effect(() => {
    if (overlay.isOpen) {
      exportSidebarCollapsed = false;
    }
  });

  let copyClaudeFeedback = $state(false);

  async function handleCopyForClaude() {
    const seq = overlay.sequence;
    if (!seq) return;
    try {
      const copier = getClaudeCodeCopier();
      await copier.copyForClaude(seq);
      copyClaudeFeedback = true;
      setTimeout(() => { copyClaudeFeedback = false; }, 1500);
    } catch (error) {
      console.error("[SequenceViewerDrawerHost] Copy for Claude failed:", error);
    }
  }

  // Named rail/select handlers extracted from inline arrows so a later mobile
  // bottom bar can reuse the same routing. `ctx` is the orchestrator snippet
  // context (not script-scoped), so it is passed in at the call site.
  function selectSplitMode(ctx: OrchestratorContext) {
    ctx.viewerState.exitExport();
    // Side-by-side is hard-coded to 2D + Card on every width — the comparison
    // pairing bar was retired, so force the pairing here in case a different
    // one (e.g. 2D + 3D) was persisted before the bar went away.
    ctx.viewerState.setSplitConfig({ leftPane: 'animation', rightPane: 'card' });
    ctx.viewerState.setViewerMode('split');
    setTimeout(() => rerenderTrigger++, 280);
  }

  function selectViewerMode(ctx: OrchestratorContext, mode: ContentType) {
    if (mode === 'animation') {
      ctx.viewerState.enterExport('animation-export', 'animation');
    } else if (mode === 'animation-3d') {
      ctx.viewerState.enterExport('animation-export', 'animation-3d');
    } else if (mode === 'card') {
      ctx.viewerState.enterExport('image-export');
    } else if (mode === 'mandala') {
      ctx.viewerState.exitExport();
      ctx.viewerState.setViewerMode('mandala');
    }
  }


  let deleteConfirmOpen = $state(false);
  let isDeleting = $state(false);

  let rerenderTrigger = $state(0);
  let choreoCardMenuHost: ChoreoCardContextMenuHost | undefined = $state();

  $effect(() => {
    drawerOpen = overlay.isOpen;
  });

  function handlePopState(event: PopStateEvent) {
    if (overlay.isOpen) {
      closeSequenceOverlay();
    }
  }

  onMount(() => {
    let deviceCleanup: (() => void) | undefined;
    try {
      const deviceDetector: DeviceDetector = getDeviceDetector();
      responsiveSettings = deviceDetector.getResponsiveSettings();

      deviceCleanup = deviceDetector.onCapabilitiesChanged(() => {
        responsiveSettings = deviceDetector.getResponsiveSettings();
      });
    } catch (error) {
      console.warn("SequenceViewerDrawerHost: Failed to resolve DeviceDetector", error);
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      deviceCleanup?.();
      window.removeEventListener("popstate", handlePopState);
    };
  });

  let bootstrapAttempted = false;
  $effect(() => {
    const loading = authState.loading;
    if (loading || bootstrapAttempted) return;
    bootstrapAttempted = true;
    void bootstrapFromUrl();
  });

  async function bootstrapFromUrl() {
    if (typeof window === "undefined") return;
    const code = new URL(window.location.href).searchParams.get("v");
    if (!code || overlay.isOpen) return;
    let openedSuccessfully = false;
    try {
      const manager = getShortCodeManager();
      const resolved = await manager.resolveShortCode(code);
      if (!resolved) {
        stripInvalidV(code);
        return;
      }

      const { isGenuineScan } = await import("$lib/shared/qr/utils/scan-detection");
      if (
        !isInlineEncoded(code) &&
        typeof window !== "undefined" &&
        isGenuineScan(code)
      ) {
        manager.incrementScanCount(code).catch(() => {});
        manager.logScanEvent(code, {
          printId: new URL(window.location.href).searchParams.get("pid") || null,
          country: null,
          city: null,
          userAgent: navigator.userAgent,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          referrer: document.referrer || null,
          userId: null,
          deviceId: getDeviceId(),
        }).catch(() => {});
      }

      if (overlay.isOpen) return;
      const stillMatches = new URL(window.location.href).searchParams.get("v") === code;
      if (!stillMatches) return;

      const hydrated = await hydrateSequence(resolved, {
        loopDetector: getLoopDetector(),
      });

      if (overlay.isOpen) return;
      if (new URL(window.location.href).searchParams.get("v") !== code) return;

      openSequenceOverlay(hydrated, {
        fromUrl: true,
        shortCode: code,
        skipHistoryPush: true,
      });
      openedSuccessfully = true;
    } catch (error) {
      console.warn("[SequenceViewerDrawerHost] Failed to bootstrap from ?v= code:", error);
    } finally {
      if (!openedSuccessfully) stripInvalidV(code);
    }
  }

  function stripInvalidV(code: string) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("v") !== code) return;
    url.searchParams.delete("v");
    replaceState(url.pathname + url.search + url.hash, {});
  }

  function handleDismiss() {
    const path = overlay.dismissPath;
    const wasOpen = overlay.isOpen;
    const wasFromUrl = overlay.openedFromUrl;

    closeSequenceOverlay();

    if (path) {
      goto(path, { replaceState: true });
    } else if (wasOpen && !wasFromUrl) {
      window.history.back();
    }
  }

  function handleDrawerClose() {
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
      handPathMode={overlay.handPathMode}
      onClose={handleDismiss}
    >
      {#snippet children(ctx)}
        {@const isVideoExportActive = ctx.editingPane === "animation"}
        {@const isImageExportActive = ctx.editingPane === "image"}
        {@const isVideoUploadActive = ctx.editingPane === "video-upload"}
        {@const isAnyExportActive = ctx.editingPane !== null}
        {@const isRecordSceneActive = isVideoExportActive && ctx.renderMode === '3d' && !ctx.previewBlobUrl}
        {@const isSidebarExportActive = isAnyExportActive && !isRecordSceneActive}
        {@const showRail = !isMobileWidth}
        {#snippet overflowMenu(includeMotion: boolean)}
          <ViewerOverflowMenu
            variant="header"
            dropDown
            align={includeMotion ? 'left' : 'right'}
            isFavorite={ctx.isFavorite}
            onFavoriteToggle={() => ctx.invokeGatedAction("favorite", ctx.handleFavoriteToggle)}
            isSaved={ctx.isSaved}
            onSave={() => ctx.invokeGatedAction("save", ctx.handleSave)}
            onRemix={() => ctx.invokeGatedAction("remix", ctx.handleEdit)}
            onCopyData={authState.isAdmin ? handleCopyForClaude : undefined}
            copyDataFeedback={copyClaudeFeedback}
            onVideoUpload={ctx.isLoggedIn ? () => ctx.handleVideoUpload() : undefined}
            isPublished={ctx.isPublished}
            onPublish={ctx.isOwned && ctx.isSaved ? () => ctx.invokeGatedAction("publish", ctx.handlePublishAction) : undefined}
            onUnpublish={ctx.isOwned && ctx.isSaved ? ctx.handleUnpublishAction : undefined}
            onDeleteRequest={ctx.isOwned && ctx.isSaved ? () => (deleteConfirmOpen = true) : undefined}
            motionVisibility={includeMotion
              ? {
                  showBlue: ctx.viewerVisibility.blueMotion,
                  showRed: ctx.viewerVisibility.redMotion,
                  onToggleBlue: () => ctx.viewerVisibility.toggleBlue(),
                  onToggleRed: () => ctx.viewerVisibility.toggleRed(),
                }
              : undefined}
          />
        {/snippet}
        <div class="drawer-viewer-container" class:landscape={isLandscape}>
          <header class="drawer-header">
                <div class="drawer-header-left-actions">
                  {#if isMobileWidth}
                    {@render overflowMenu(true)}
                  {:else}
                    <button
                      type="button"
                      class="header-action-btn"
                      class:favorited={ctx.isFavorite}
                      onclick={() => ctx.invokeGatedAction("favorite", ctx.handleFavoriteToggle)}
                      aria-label={ctx.isFavorite ? "Remove from favorites" : "Add to favorites"}
                    >
                      <i class="fas fa-heart" aria-hidden="true"></i>
                    </button>

                    {#if !ctx.isSaved}
                      <button
                        type="button"
                        class="header-action-btn save"
                        onclick={() => ctx.invokeGatedAction("save", ctx.handleSave)}
                        aria-label="Save sequence"
                      >
                        <i class="fas fa-floppy-disk" aria-hidden="true"></i>
                      </button>
                    {/if}

                    <button
                      type="button"
                      class="header-action-btn remix"
                      onclick={() => ctx.invokeGatedAction("remix", ctx.handleEdit)}
                      aria-label="Remix"
                    >
                      <i class="fas fa-pen-to-square" aria-hidden="true"></i>
                    </button>

                    <span class="header-action-divider"></span>

                    <MotionVisibilityToggle />

                    {#if authState.isAdmin}
                      <button
                        type="button"
                        class="header-action-btn"
                        onclick={handleCopyForClaude}
                        aria-label="Copy sequence data for Claude"
                        title="Copy for Claude"
                      >
                        <i class="fas {copyClaudeFeedback ? 'fa-check' : 'fa-terminal'}" aria-hidden="true"></i>
                      </button>
                    {/if}
                  {/if}
                </div>

                <div class="drawer-header-title-group">
                  <div class="drawer-header-title">
                    {#if isAnyExportActive}
                      {isVideoExportActive ? (ctx.renderMode === '3d' ? "Record Scene" : "Download Animation") : isImageExportActive ? "Download Card" : "Upload Video"}
                    {:else}
                      Sequence Viewer
                    {/if}
                  </div>
                  {#if !isAnyExportActive && ctx.presentation && ctx.sequence?.creatorIntent?.propConfig && (ctx.sequence.creatorIntent.propConfig.bluePropType !== settingsService.settings.bluePropType || ctx.sequence.creatorIntent.propConfig.redPropType !== settingsService.settings.redPropType)}
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
                  {/if}
                </div>

                <div class="drawer-header-right-actions">
                  {#if isAnyExportActive && !isMobileWidth && !isRecordSceneActive}
                    <button
                      type="button"
                      class="header-action-btn"
                      class:active={!exportSidebarCollapsed}
                      onclick={toggleExportSidebar}
                      aria-label={exportSidebarCollapsed ? "Show export settings" : "Hide export settings"}
                      title={exportSidebarCollapsed ? "Show settings" : "Hide settings"}
                    >
                      <i class="fas fa-sliders" aria-hidden="true"></i>
                    </button>
                  {/if}

                  {#if !isMobileWidth}
                    {@render overflowMenu(false)}
                  {/if}

                  <button
                    type="button"
                    class="drawer-close-button"
                    onclick={handleDismiss}
                    aria-label="Close viewer"
                  >
                    <i class="fas fa-times" aria-hidden="true"></i>
                  </button>
                </div>
            </header>

          <div class="drawer-main">
            <div class="drawer-body-content">
              {#if ctx.hasSequence && ctx.effectiveSequence}
                <div
                  class="viewer-and-export"
                  class:export-active={isSidebarExportActive}
                  class:record-scene-active={isRecordSceneActive}
                  class:desktop={!isMobileWidth}
                  class:sidebar-collapsed={exportSidebarCollapsed}
                  class:has-rail={showRail}
                >
                  {#if showRail}
                    <ViewerContentRail
                      activeMode={ctx.viewerState.viewerMode}
                      webgl2Available={ctx.viewer3DState.webgl2Available}
                      onSelectSplit={() => selectSplitMode(ctx)}
                      onSelectMode={(mode) => selectViewerMode(ctx, mode)}
                    />
                  {/if}
                  {#if ctx.viewerState.viewerMode === 'videos' && !isSidebarExportActive}
                    <VideoGallery
                      sequence={overlay.sequence!}
                      isOwned={ctx.isOwned}
                      isLoggedIn={ctx.isLoggedIn}
                      onUpload={ctx.isLoggedIn ? () => ctx.handleVideoUpload() : undefined}
                    />
                  {:else}
                    <ViewerSplitPane
                      sequence={ctx.effectiveSequence}
                      renderMode={ctx.renderMode}
                      isExporting={ctx.isExporting}
                      bpm={ctx.bpmLocal}
                      onBpmChange={ctx.handleBpmChange}
                      playback={ctx.splitPanePlayback}
                      imageComposition={isImageExportActive
                        ? {
                            ...ctx.splitPaneImageComposition,
                            darkMode: ctx.exportOptions.imageDarkMode,
                            columnCount: ctx.exportOptions.imageColumnCount,
                            forceContain: true,
                          }
                        : ctx.splitPaneImageComposition}
                      propRendering={ctx.splitPanePropRendering}
                      layout={{
                        isFullscreen: ctx.isFullscreen,
                        fullscreenStackVertical: ctx.fullscreenStackVertical,
                        isMobile: isMobileWidth,
                        isLandscapeMobile: isLandscape,
                        focusedPane: ctx.viewerState.viewerMode !== 'split' ? (ctx.viewerState.viewerMode === 'card' ? 'image' : 'animation') : ctx.editingPane,
                        suppressCloseButton: ctx.viewerState.viewerMode !== 'split',
                      }}
                      onRenderProgress={ctx.onRenderProgress}
                      onFocusPane={ctx.enterEditMode}
                      onUnfocusPane={ctx.exitEditMode}
                      onStepClick={ctx.handleStepClick}
                      onCanvasReady={ctx.handleCanvasReady}
                      {rerenderTrigger}
                      onChoreoCardContextMenu={(x, y) => choreoCardMenuHost?.openContextMenu(x, y)}
                      onPlaybackToggle={ctx.handlePlaybackToggle}
                      onProgressBarSeek={ctx.handleProgressBarSeek}
                      onProgressBarScrubStart={ctx.handleProgressBarScrubStart}
                      onProgressBarScrubEnd={ctx.handleProgressBarScrubEnd}
                      playbackMode={ctx.playbackMode}
                      onPlaybackModeChange={ctx.handlePlaybackModeChange}
                      splitConfig={ctx.viewerState.viewerMode === 'split'
                        ? { leftPane: 'animation', rightPane: 'card' }
                        : (ctx.viewerState.viewerMode === 'card'
                        ? { ...ctx.viewerState.splitConfig, rightPane: 'card' }
                        : (ctx.viewerState.viewerMode !== 'split' && (ctx.viewerState.viewerMode === 'animation' || ctx.viewerState.viewerMode === 'animation-3d' || ctx.viewerState.viewerMode === 'mandala')
                          ? { ...ctx.viewerState.splitConfig, leftPane: ctx.viewerState.viewerMode }
                          : ctx.viewerState.splitConfig))}
                      isLoggedIn={ctx.isLoggedIn}
                      onVideoUpload={ctx.isLoggedIn ? () => ctx.handleVideoUpload() : undefined}
                    />
                  {/if}
                  {#if ctx.renderMode === '3d' && (ctx.countdownValue > 0 || ctx.isRecording3D || ctx.isExporting)}
                    <Recording3DOverlay
                      countdownValue={ctx.countdownValue}
                      isRecording={ctx.isRecording3D}
                      elapsed={ctx.recordingElapsed}
                      onStop={ctx.handleStopRecording}
                      exportProgress={ctx.exportProgress}
                      isExporting={ctx.isExporting}
                      onCancelExport={ctx.handleCancelExport}
                    />
                  {/if}
                  <ChoreoCardContextMenuHost
                    bind:this={choreoCardMenuHost}
                    onRerender={() => { rerenderTrigger++; }}
                    isExportMode={isImageExportActive}
                    exportOptions={ctx.exportOptions}
                    onSendTo={overlay.sequence ? handleSendTo : undefined}
                    onSendToStickerLab={overlay.sequence ? handleSendToStickerLab : undefined}
                    stepCount={overlay.sequence?.steps?.length ?? 0}
                  />
                  {#if isRecordSceneActive && ctx.effectiveSequence}
                    <RecordSceneChrome
                      isExporting={ctx.isExporting}
                      canvasReady={ctx.canvasReady}
                      onExport={ctx.handleExport}
                      choreography={ctx.viewer3DState.cameraChoreography}
                    />
                  {/if}
                  {#if isSidebarExportActive}
                    <div class="export-panel-container" class:sidebar={!isMobileWidth && (isVideoExportActive || isVideoUploadActive)}>
                      {#if isVideoExportActive}
                        {#if ctx.previewBlobUrl}
                          <VideoPreviewPanel
                            blobUrl={ctx.previewBlobUrl}
                            onDismiss={ctx.dismissPreview}
                            onRedownload={() => {
                              const seq = ctx.effectiveSequence;
                              const rawName =
                                seq?.displayName ||
                                seq?.intendedWord ||
                                seq?.word ||
                                "sequence";
                              const simplified = greekToAscii(
                                simplifyRepeatedWord(rawName)
                              );
                              const safeName =
                                sanitizeFilename(simplified) ||
                                "sequence";
                              const a = document.createElement("a");
                              a.href = ctx.previewBlobUrl!;
                              a.download = `${safeName}.mp4`;
                              a.click();
                            }}
                          />
                        {:else}
                          <ExportVideoDrawer
                            exportOptions={ctx.exportOptions}
                            isExporting={ctx.isExporting}
                            exportProgress={ctx.exportProgress}
                            canvasReady={ctx.canvasReady}
                            layout={isMobileWidth ? "bottom" : "sidebar"}
                            singlePlayDuration={ctx.singlePlayDuration}
                            isPlaying={ctx.isPlayingLocal}
                            bpm={ctx.bpmLocal}
                            renderMode={ctx.renderMode}
                            playbackMode={ctx.playbackMode}
                            selectedPropType={ctx.bluePropType}
                            onPropChange={ctx.handlePropTypeChange}
                            onPlaybackToggle={ctx.handlePlaybackToggle}
                            onPlaybackModeChange={ctx.handlePlaybackModeChange}
                            onBpmChange={ctx.handleBpmChange}
                            onExport={ctx.handleExport}
                            onCancel={ctx.handleCancelExport}
                          />
                        {/if}
                      {:else if isImageExportActive && !isMobileWidth}
                        <ExportImagePanel
                          exportOptions={ctx.exportOptions}
                          isExporting={ctx.isExporting}
                          stepCount={ctx.effectiveSequence?.steps?.length ?? 0}
                          layout="sidebar"
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
                {#if isMobileWidth && isImageExportActive && ctx.effectiveSequence}
                  <!-- Entrance/exit fly now lives on ControlDock's root
                       (shared by every dock); this wrapper only positions. -->
                  <div class="export-footer-overlay">
                    <ExportImagePanel
                      exportOptions={ctx.exportOptions}
                      isExporting={ctx.isExporting}
                      stepCount={ctx.effectiveSequence.steps?.length ?? 0}
                      layout="bottom"
                      onExport={ctx.handleExport}
                      onClose={ctx.exitEditMode}
                    />
                  </div>
                {/if}
              {/if}
            </div>
            {#if isMobileWidth && ctx.hasSequence && ctx.effectiveSequence}
              <ViewerModeBottomBar
                activeMode={ctx.viewerState.viewerMode}
                webgl2Available={ctx.viewer3DState.webgl2Available}
                onSelectSplit={() => selectSplitMode(ctx)}
                onSelectMode={(mode) => selectViewerMode(ctx, mode)}
              />
            {/if}
          </div>
          {#if ctx.practiceActive}
            <PracticeProgressIndicator
              progress={ctx.practiceState.progress}
              onStop={ctx.handlePracticeStop}
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
    padding: calc(env(safe-area-inset-top, 0px) + 2px) 12px 2px;
    min-height: var(--min-touch-target);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
    overflow: visible;
  }


  .drawer-header-title-group {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    pointer-events: none;
    overflow: visible;
  }

  .drawer-header-title {
    font-size: var(--font-size-base, 16px);
    font-weight: 600;
    line-height: 1.2;
    color: var(--theme-text, #ffffff);
    white-space: nowrap;
    pointer-events: none;
  }

  .drawer-close-button {
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
    font-size: 16px;
  }

  .drawer-close-button:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .drawer-close-button:focus-visible {
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
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

  .drawer-header-left-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .drawer-header-right-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
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

  .header-action-btn.active {
    color: var(--theme-accent, #6366f1);
  }

  .header-action-btn.favorited {
    color: var(--semantic-error, #ef4444);
  }

  .header-action-btn.save {
    color: #22c55e;
  }

  .header-action-btn.remix {
    color: #f59e0b;
  }

  .header-action-divider {
    width: 1px;
    height: 20px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin: 0 2px;
    flex-shrink: 0;
  }

  .header-action-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #f43f5e);
    outline-offset: 2px;
  }

  .drawer-main {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    position: relative;
  }


  .drawer-body-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .landscape .drawer-header {
    padding-top: 2px;
    padding-bottom: 2px;
    min-height: 32px;
    border-bottom: none;
  }

  .landscape .drawer-header-title-group {
    display: none;
  }


  .landscape .header-action-btn {
    min-width: 32px;
    min-height: 32px;
  }

  .viewer-and-export {
    --export-sidebar-width: 560px;
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .viewer-and-export:not(.desktop) {
    display: flex;
    flex-direction: column;
  }

  .viewer-and-export:not(.desktop) :global(.view-container) {
    flex: 1;
    min-height: 0;
  }

  .viewer-and-export.desktop {
    display: grid;
    grid-template-columns: 1fr 0px;
    grid-template-rows: minmax(0, 1fr);
    transition: grid-template-columns 250ms cubic-bezier(0.2, 0, 0, 1);
  }

  .viewer-and-export.desktop :global(.view-container) {
    position: relative;
    inset: auto;
  }

  .viewer-and-export.export-active.desktop {
    grid-template-columns: 1fr var(--export-sidebar-width);
  }

  .viewer-and-export.export-active.desktop.has-rail {
    grid-template-columns: auto 1fr var(--export-sidebar-width);
  }

  .viewer-and-export.export-active.desktop.sidebar-collapsed {
    grid-template-columns: 1fr 0px;
  }

  .viewer-and-export.export-active.desktop.has-rail.sidebar-collapsed {
    grid-template-columns: auto 1fr 0px;
  }

  .viewer-and-export.desktop.has-rail:not(.export-active) {
    grid-template-columns: auto 1fr;
  }


  .export-panel-container {
    overflow: hidden;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    isolation: isolate;
    min-width: 0;
  }

  @media (max-width: 767px) {
    .viewer-and-export.export-active {
      display: flex;
      flex-direction: column;
    }

    .export-panel-container {
      width: 100%;
      flex-shrink: 0;
      overflow: visible;
      border-left: none;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    }

    .viewer-and-export.export-active :global(.view-container) {
      position: relative;
      inset: auto;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
  }

  .export-footer-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 3;
  }


  @media (prefers-reduced-motion: reduce) {
    .viewer-and-export {
      transition: none;
    }
  }

  :global(.sequence-viewer-drawer) {
    --sheet-bg: var(--theme-panel-bg, #0a0a14) !important;
    --sheet-filter: none !important;
    --sheet-border-radius-top-left: 0px !important;
    --sheet-border-radius-top-right: 0px !important;
    border-top-left-radius: 0 !important;
    border-top-right-radius: 0 !important;
  }
</style>
