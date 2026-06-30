<script lang="ts">
import { getDeviceId } from "$lib/shared/auth/services/device-id-service";
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
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
  import PracticeBar from "./PracticeBar.svelte";
  import PracticeSetupBar from "./PracticeSetupBar.svelte";
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
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { sendToStickerLab } from "$lib/shared/sequence-viewer/services/send-to-sticker-lab";

  const overlay = getSequenceOverlayState();

  // Reduced-motion gate for the practice/scene transitions below.
  let prefersReducedMotion = $state(false);
  onMount(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion = mq.matches;
    const onReduceChange = () => (prefersReducedMotion = mq.matches);
    mq.addEventListener("change", onReduceChange);
    return () => mq.removeEventListener("change", onReduceChange);
  });

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

  // Available width of the viewer body. Measured (bind:clientWidth) so this works
  // when the viewer is embedded in a constrained container, not just full-window.
  // Seeded from the window so the first paint doesn't flash the wrong layout.
  let bodyWidth = $state(typeof window !== "undefined" ? window.innerWidth : 0);

  // Every desktop export (card AND the 2D/3D animation download) puts its settings in
  // a fixed-width sidebar column beside the content rail and the preview. The preview
  // is the hero, so it must NEVER be narrower than the settings sidebar — otherwise
  // the controls dominate a sliver of a preview. Below the width where rail + a hero
  // at least sidebar-wide + the sidebar all fit, the export falls back to the compact
  // bottom dock with the preview as the hero (same layout phones get).
  const EXPORT_SIDEBAR_WIDTH = 560; // keep in sync with --export-sidebar-width in CSS
  const HERO_MIN_WIDTH = 600;       // sidebar 560 + 40px so the preview is clearly larger

  // Rail width is user-persisted (ViewerContentRail's RAIL_WIDTH_KEY), so a dragged-
  // wider rail raises the bar correctly instead of silently re-crushing the preview.
  function exportSidebarMinWidth(): number {
    let rail = 180; // ViewerContentRail DEFAULT_WIDTH
    try {
      const raw = localStorage.getItem("tka-viewer-rail-width");
      if (raw) { const n = parseInt(raw, 10); if (n >= 72 && n <= 300) rail = n; }
    } catch { /* ignore */ }
    return rail + EXPORT_SIDEBAR_WIDTH + HERO_MIN_WIDTH;
  }

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
    } else if (mode === 'tunnel') {
      ctx.viewerState.exitExport();
      ctx.viewerState.setViewerMode('tunnel');
    }
  }

  // QR play badge (Card mode): switch to the 2D animation view and start
  // playback. handlePlaybackToggle is a toggle, so read isPlayingLocal at click
  // time and only start when paused — never pauses an already-running anim.
  function playFromQr(ctx: OrchestratorContext) {
    const wasPlaying = ctx.isPlayingLocal;
    selectViewerMode(ctx, 'animation');
    if (!wasPlaying) ctx.handlePlaybackToggle();
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
        <!-- Every sidebar export (card + the 2D/3D animation download) needs enough
             width for the 560px settings sidebar to sit beside a usable preview + rail.
             When the viewer is narrower than that (embedded, split, small window), drive
             the whole export view into the mobile layout: preview hero on top, settings
             in the bottom dock, modes in the bottom bar. RecordSceneChrome (3D record)
             is its own full-bleed UI and is excluded via isRecordSceneActive. -->
        {@const cardExportNarrow = isImageExportActive && !isMobileWidth && bodyWidth < exportSidebarMinWidth()}
        {@const videoExportNarrow = isVideoExportActive && !isRecordSceneActive && !isMobileWidth && bodyWidth < exportSidebarMinWidth()}
        {@const effectiveMobile = isMobileWidth || cardExportNarrow || videoExportNarrow}
        {@const showRail = !effectiveMobile}
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
                  <!-- Both action sets stay mounted and crossfade so entering
                       practice doesn't flash buttons in/out. inert removes the
                       hidden layer from focus + pointer + a11y. -->
                  <div class="left-actions-layer practice" class:active={ctx.practiceActive} inert={!ctx.practiceActive}>
                    <button
                      type="button"
                      class="header-action-btn practice-exit"
                      onclick={ctx.exitPracticeMode}
                      aria-label="Exit practice mode"
                    >
                      <i class="fas fa-arrow-left" aria-hidden="true"></i>
                      <span>Exit Practice</span>
                    </button>
                  </div>

                  <div class="left-actions-layer normal" class:active={!ctx.practiceActive} inert={ctx.practiceActive}>
                    {#if isMobileWidth}
                      <button
                        type="button"
                        class="header-action-btn practice"
                        onclick={() => ctx.enterPracticeMode()}
                        aria-label="Practice"
                      >
                        <i class="fas fa-signal" aria-hidden="true"></i>
                        <span>Practice</span>
                      </button>
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

                      <button
                        type="button"
                        class="header-action-btn practice"
                        onclick={() => ctx.enterPracticeMode()}
                        aria-label="Practice"
                      >
                        <i class="fas fa-signal" aria-hidden="true"></i>
                        <span>Practice</span>
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
                </div>

                <div class="drawer-header-title-group">
                  <div class="drawer-header-title">
                    {#key `${isAnyExportActive}|${ctx.practiceActive}|${isVideoExportActive}|${isImageExportActive}|${ctx.renderMode}`}
                      <span
                        class="drawer-header-title-text"
                        in:fade|local={{ duration: prefersReducedMotion ? 0 : 150 }}
                      >
                        {#if isAnyExportActive}
                          {isVideoExportActive ? (ctx.renderMode === '3d' ? "Record Scene" : "Download Animation") : isImageExportActive ? "Download Card" : "Upload Video"}
                        {:else if ctx.practiceActive}
                          Practice Mode
                        {:else}
                          Sequence Viewer
                        {/if}
                      </span>
                    {/key}
                  </div>
                </div>

                <div class="drawer-header-right-actions">
                  <!-- Card export settings can't be collapsed on desktop — they're
                       required to configure the download. Only Download Animation
                       keeps the hide/show toggle. -->
                  {#if isAnyExportActive && !effectiveMobile && !isRecordSceneActive && !isImageExportActive}
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

                  {#if !isMobileWidth && !ctx.practiceActive}
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
            <div class="drawer-body-content" bind:clientWidth={bodyWidth}>
              {#if ctx.hasSequence && ctx.effectiveSequence}
                <div
                  class="viewer-and-export"
                  class:export-active={isSidebarExportActive}
                  class:record-scene-active={isRecordSceneActive}
                  class:desktop={!effectiveMobile}
                  class:sidebar-collapsed={exportSidebarCollapsed && !isImageExportActive}
                  class:has-rail={showRail}
                >
                  {#if showRail}
                    <div class="viewer-rail-wrap" class:collapsed={ctx.practiceActive}>
                      <ViewerContentRail
                        activeMode={ctx.viewerState.viewerMode}
                        webgl2Available={ctx.viewer3DState.webgl2Available}
                        onSelectSplit={() => selectSplitMode(ctx)}
                        onSelectMode={(mode) => selectViewerMode(ctx, mode)}
                      />
                    </div>
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
                        isMobile: effectiveMobile,
                        isLandscapeMobile: isLandscape,
                        focusedPane: ctx.viewerState.viewerMode !== 'split' ? (ctx.viewerState.viewerMode === 'card' ? 'image' : 'animation') : ctx.editingPane,
                        suppressCloseButton: ctx.viewerState.viewerMode !== 'split',
                      }}
                      onRenderProgress={ctx.onRenderProgress}
                      onFocusPane={ctx.enterEditMode}
                      onUnfocusPane={ctx.exitEditMode}
                      onStepClick={ctx.handleStepClick}
                      onQrPlayClick={ctx.practiceActive ? undefined : () => playFromQr(ctx)}
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
                        : (ctx.viewerState.viewerMode === 'animation' || ctx.viewerState.viewerMode === 'animation-3d' || ctx.viewerState.viewerMode === 'mandala' || ctx.viewerState.viewerMode === 'tunnel'
                          ? { ...ctx.viewerState.splitConfig, leftPane: ctx.viewerState.viewerMode }
                          : ctx.viewerState.splitConfig))}
                      isLoggedIn={ctx.isLoggedIn}
                      onVideoUpload={ctx.isLoggedIn ? () => ctx.handleVideoUpload() : undefined}
                      onArtExport={ctx.handleArtExport}
                      practiceActive={ctx.practiceActive}
                      practiceRunning={ctx.practiceRunning}
                      practiceCountdown={ctx.practiceCountdown}
                      practiceCellSize={ctx.practiceViewPrefs.cellSize}
                      practiceCanvasFraction={0.5}
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
                    <div class="export-panel-container" class:sidebar={!effectiveMobile && (isVideoExportActive || isVideoUploadActive)}>
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
                              const simplified =
                                simplifyRepeatedWord(rawName);
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
                            layout={effectiveMobile ? "bottom" : "sidebar"}
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
                      {:else if isImageExportActive && !effectiveMobile}
                        <!-- No onClose on desktop: the card export settings are
                             required to configure the download and must stay put.
                             Leave the Download Card mode via the content rail. -->
                        <ExportImagePanel
                          exportOptions={ctx.exportOptions}
                          isExporting={ctx.isExporting}
                          stepCount={ctx.effectiveSequence?.steps?.length ?? 0}
                          layout="sidebar"
                          onExport={ctx.handleExport}
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
                {#if effectiveMobile && isImageExportActive && ctx.effectiveSequence}
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
            {#if effectiveMobile && ctx.hasSequence && ctx.effectiveSequence && !ctx.practiceActive}
              <div transition:fade={{ duration: prefersReducedMotion ? 0 : 180 }}>
                <ViewerModeBottomBar
                  activeMode={ctx.viewerState.viewerMode}
                  webgl2Available={ctx.viewer3DState.webgl2Available}
                  onSelectSplit={() => selectSplitMode(ctx)}
                  onSelectMode={(mode) => selectViewerMode(ctx, mode)}
                />
              </div>
            {/if}
          </div>
          {#if ctx.hasSequence}
            <!-- Bottom workstation: stays mounted, a flow child that PUSHES the
                 content up (so the bottom rows stay visible). Height toggles in
                 one reflow at the slide's near edge; the visible motion is a
                 composited translateY → 60fps even while the animator runs.
                 Parked (height 0) + inert when not practicing. -->
            <div
              class="practice-bar-rise"
              class:reserved={ctx.practiceActive}
              class:up={ctx.practiceActive}
              inert={!ctx.practiceActive}
            >
              <!-- Bottom-bar conveyor: setup config (setup phase) ↔ running cockpit
                   (running phase). Config slides out left as the cockpit slides in
                   from the right on Start. Cockpit is the flow child so it defines
                   the bar's height; config overlays it. -->
              <div class="bar-pane config" class:active={!ctx.practiceRunning} inert={ctx.practiceRunning}>
                <PracticeSetupBar
                  config={ctx.practiceState.userConfig}
                  onSetConfig={ctx.handlePracticeSetConfig}
                  onStart={ctx.handlePracticeStart}
                />
              </div>
              <div class="bar-pane cockpit" class:active={ctx.practiceRunning} inert={!ctx.practiceRunning}>
                <PracticeBar
                  progress={ctx.practiceState.progress}
                  bpm={ctx.bpmLocal}
                  isPlaying={ctx.isPlayingLocal}
                  onBpmChange={ctx.handleBpmChange}
                  onPlayPause={ctx.handlePlaybackToggle}
                  onStepLevel={ctx.handlePracticeStepLevel}
                  onToggleHold={ctx.handlePracticeToggleHold}
                  onStop={ctx.handlePracticeStop}
                  metronomeOn={ctx.metronomeEnabled}
                  onToggleMetronome={ctx.handleToggleMetronome}
                />
              </div>
            </div>
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
    /* One shared clock so the rail-out and bar-up choreograph in lockstep. */
    --ws-dur: 300ms;
    --ws-ease: cubic-bezier(0.2, 0, 0, 1);
    position: relative;
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

  .drawer-header-left-actions {
    position: relative;
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
    color: var(--semantic-success, #22c55e);
  }

  .header-action-btn.remix {
    color: var(--semantic-warning, #f59e0b);
  }

  /* Practice entry — labeled accent CTA. Tinted accent fill (no border, like
     .practice-exit) so it stands out from the utility icon buttons. */
  .header-action-btn.practice {
    gap: 8px;
    padding: 0 16px;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-accent, #a78bfa);
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 18%, transparent);
  }
  .header-action-btn.practice:hover {
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 30%, transparent);
    color: #fff;
  }

  .header-action-btn.practice-exit {
    gap: 8px;
    padding: 0 16px;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: #fff;
    background: var(--semantic-error, #ef4444);
  }

  .header-action-btn.practice-exit:hover {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 85%, white);
    color: #fff;
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

  /* Rail stays mounted; on practice enter it fades + nudges out (composited) AND
     its width animates 320→0 over --ws-dur on the same shared clock. The width is
     what reclaims layout space, so animating it (not snapping it) lets the split-
     view — and the canvas column inside it — GLIDE into the freed space as one
     continuous motion. Snapping max-width to 0 instantly is what jolted the canvas
     ("sidebar vanishes → canvas jumps"); animating it removes the snap at the
     source, so no JS FLIP is needed on the canvas side. */
  .viewer-rail-wrap {
    display: flex;
    min-height: 0;
    overflow: hidden;
    max-width: 320px;
    will-change: opacity, transform, max-width;
    transition:
      opacity var(--ws-dur) var(--ws-ease),
      transform var(--ws-dur) var(--ws-ease),
      max-width var(--ws-dur) var(--ws-ease);
  }
  .viewer-rail-wrap.collapsed {
    opacity: 0;
    transform: translateX(-12px);
    max-width: 0;
    pointer-events: none;
  }

  /* Bottom workstation: a flow child so it PUSHES the content up (bottom rows
     stay visible — not an overlay). The row's height animates 0↔auto on the same
     --ws-dur clock as the rail collapse (interpolate-size enables the auto
     keyword), so the canvas glides into its practice height in step with the
     horizontal rail glide — one diagonal motion, no vertical snap. The cockpit
     itself rides in on a composited transform/opacity for 60fps. Height settles
     at practice ENTER (setup), so Start/Stop never re-run this — they only slide
     the cockpit via transform. */
  .practice-bar-rise {
    position: relative; /* anchors the absolute config bar-pane */
    flex-shrink: 0;
    overflow: hidden;
    height: 0;
    transform: translateX(110%);
    opacity: 0;
    will-change: transform, opacity, height;
    /* Scoped to this element ONLY (it's an inherited property — set on a shared
       ancestor it leaks the height:auto animation into the whole viewer subtree
       and collapsed the right preview card). Enables the row's 0↔auto glide. */
    interpolate-size: allow-keywords;
    transition:
      transform var(--ws-dur) var(--ws-ease),
      opacity var(--ws-dur) var(--ws-ease),
      height var(--ws-dur) var(--ws-ease);
  }
  /* Entering practice (setup OR running) reserves the bar's row, growing it from
     0 over --ws-dur so the canvas resize is a glide, not a step. */
  .practice-bar-rise.reserved {
    height: auto;
  }
  /* Practice active: the bar slides in from the right + fades in, carrying the
     setup config. Composited transform/opacity → 60fps. (Start swaps config→
     cockpit via the inner conveyor; the bar itself stays put.) */
  .practice-bar-rise.reserved.up {
    transform: translateX(0);
    opacity: 1;
  }

  /* Inner conveyor: config (setup) ↔ cockpit (running). Cockpit is the flow child
     so it defines the bar's auto height; config is an absolute overlay. Both slide
     on the shared clock — config exits left, cockpit enters right on Start. */
  .bar-pane {
    transition: transform var(--ws-dur) var(--ws-ease);
    will-change: transform;
  }
  .bar-pane.config {
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
  }
  .bar-pane.config.active {
    transform: translateX(0);
  }
  .bar-pane.cockpit {
    position: relative;
    transform: translateX(100%);
  }
  .bar-pane.cockpit.active {
    transform: translateX(0);
  }
  @media (prefers-reduced-motion: reduce) {
    .bar-pane { transition: none; }
  }

  /* Header action layers crossfade on practice toggle — both stay mounted so
     buttons don't flash in/out. inert handles focus/pointer/a11y on the hidden
     layer; the inactive layer is taken out of flow so the container sizes to
     the active set. */
  .left-actions-layer {
    display: flex;
    align-items: center;
    gap: 4px;
    transition: opacity 180ms ease;
  }
  .left-actions-layer:not(.active) {
    position: absolute;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    opacity: 0;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .drawer-viewer-container { --ws-dur: 0ms; }
    .viewer-rail-wrap,
    .left-actions-layer,
    .practice-bar-rise { transition: none; }
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

  /* Stacked export layout — phones AND desktop widths too narrow for the 560px
     sidebar. The settings dock sits UNDER a full-width hero preview instead of
     beside it. Keyed off :not(.desktop) (toggled by effectiveMobile) rather than a
     viewport media query, so the same correct stacking applies at, say, 1200px when
     the rail + sidebar + preview wouldn't fit. */
  .viewer-and-export:not(.desktop) .export-panel-container {
    width: 100%;
    flex-shrink: 0;
    overflow: visible;
    border-left: none;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .viewer-and-export:not(.desktop).export-active :global(.view-container) {
    position: relative;
    inset: auto;
    flex: 1;
    min-height: 0;
    overflow: hidden;
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

  /* Routed through the Drawer.css --sheet-* API; the direct border-top-*-radius
     overrides are redundant (the radius vars already drive those corners). */
  :global(.sequence-viewer-drawer) {
    --sheet-bg: var(--theme-panel-bg, #0a0a14);
    --sheet-filter: none;
    --sheet-border-radius-top-left: 0px;
    --sheet-border-radius-top-right: 0px;
  }
</style>
