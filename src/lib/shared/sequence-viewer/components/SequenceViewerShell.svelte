<!--
  SequenceViewerShell.svelte

  THE sequence-viewer chrome: header (actions + title-menu trigger + close),
  content rail / bottom bar, split pane body, export sidebars/docks, practice
  workstation, delete dialog. Extracted verbatim from SequenceViewerDrawerHost
  so every host renders the IDENTICAL viewer — the app drawer (inside Drawer)
  and the /q scan page (full-bleed route) both mount this one component.

  Host deltas are props, not forks:
  - onClose: drawer dismiss vs scan navigate-to-app
  - onRemix: scan overrides with its guest-friendly composer handoff
  - openAppHref: scan adds an "Open TKA" item to the title menu
  - exportOverrides: scan routes Download through its gated page pipeline
  - startInSplit: scan force-resets persisted viewer mode to the split first
    impression

  Do NOT rebuild scan-specific header/body variants — extend this shell.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { fade, slide, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { goto } from "$app/navigation";
  import ViewerSplitPane from "./ViewerSplitPane.svelte";
  import ViewerContentRail from "./ViewerContentRail.svelte";
  import ViewerModeBottomBar from "./ViewerModeBottomBar.svelte";
  import { dockTrayState } from "./ControlDock.svelte";
  import type { OrchestratorContext } from "./SequenceViewerOrchestrator.svelte";
  import type { ContentType } from "../state/viewer-state.svelte";
  import VideoGallery from "./VideoGallery.svelte";
  import ViewerOverflowMenu from "./ViewerOverflowMenu.svelte";
  import { buildHeaderActions } from "../services/viewer-actions";
  import ExportVideoDrawer from "$lib/shared/animation-panel/components/AnimationPanel.svelte";
  import ExportImagePanel from "./ExportImagePanel.svelte";
  import VideoPreviewPanel from "./VideoPreviewPanel.svelte";
  import PracticeBar from "./PracticeBar.svelte";
  import PracticeSetupBar from "./PracticeSetupBar.svelte";
  import Recording3DOverlay from "./Recording3DOverlay.svelte";
  import RecordSceneChrome from "./record-scene/RecordSceneChrome.svelte";
  import { getClaudeCodeCopier } from "$lib/shared/browse/get-claude-code-copier";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { getDeviceDetector } from "$lib/shared/device/get-device-detector";
  import type { DeviceDetector } from "$lib/shared/device/services/device-detector";
  import type { ResponsiveSettings } from "$lib/shared/device/domain/models/device-models";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { VideoExportProgress } from "$lib/shared/compose/domain/video-export-types";
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

  /** Host-owned export pipeline (the scan page's gated share-sheet flow).
      Absent → the orchestrator's own ctx.handleExport pipeline (the app). */
  interface ExportOverrides {
    onVideoExport: () => void;
    onCardExport: () => void;
    videoBusy: boolean;
    videoProgress: VideoExportProgress | null;
    cardBusy: boolean;
    /** AnimationPanel's inline progress; hosts with their own takeover pass false. */
    showInlineProgress?: boolean;
  }

  interface Props {
    ctx: OrchestratorContext;
    sequence: SequenceData;
    isMobile: boolean;
    onClose: () => void;
    /** Override the header/menu Remix action (scan: composer handoff + ?sheet=auth). */
    onRemix?: () => void;
    /** Adds an "Open TKA" item to the title menu (scan funnel exit). */
    openAppHref?: string;
    /** One-shot reset to the split view on mount (scan first impression). */
    startInSplit?: boolean;
    exportOverrides?: ExportOverrides;
  }

  let {
    ctx,
    sequence,
    isMobile,
    onClose,
    onRemix,
    openAppHref,
    startInSplit = false,
    exportOverrides,
  }: Props = $props();

  // Reduced-motion gate for the practice/scene transitions below.
  let prefersReducedMotion = $state(false);
  onMount(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion = mq.matches;
    const onReduceChange = () => (prefersReducedMotion = mq.matches);
    mq.addEventListener("change", onReduceChange);
    return () => mq.removeEventListener("change", onReduceChange);
  });

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

  let responsiveSettings = $state<ResponsiveSettings | null>(null);
  let isLandscape = $derived(responsiveSettings?.isLandscapeMobile ?? false);

  onMount(() => {
    let deviceCleanup: (() => void) | undefined;
    try {
      const deviceDetector: DeviceDetector = getDeviceDetector();
      responsiveSettings = deviceDetector.getResponsiveSettings();

      deviceCleanup = deviceDetector.onCapabilitiesChanged(() => {
        responsiveSettings = deviceDetector.getResponsiveSettings();
      });
    } catch (error) {
      console.warn("SequenceViewerShell: Failed to resolve DeviceDetector", error);
    }
    return () => deviceCleanup?.();
  });

  let exportSidebarCollapsed = $state(false);

  function toggleExportSidebar() {
    exportSidebarCollapsed = !exportSidebarCollapsed;
  }

  // Fresh sequence → expanded settings (mirrors the drawer's reset-on-open).
  $effect(() => {
    void sequence;
    exportSidebarCollapsed = false;
  });

  let copyClaudeFeedback = $state(false);

  async function handleCopyForClaude() {
    if (!sequence) return;
    try {
      const copier = getClaudeCodeCopier();
      await copier.copyForClaude(sequence);
      copyClaudeFeedback = true;
      setTimeout(() => { copyClaudeFeedback = false; }, 1500);
    } catch (error) {
      console.error("[SequenceViewerShell] Copy for Claude failed:", error);
    }
  }

  function handleSendTo() {
    if (!sequence) return;
    const propType = sequence.intendedProp?.bluePropType ?? settingsService.settings.bluePropType ?? "staff";
    const thumbnailUrl = buildThumbnailUrl(sequence.word || sequence.name, String(propType), false);
    openSendSequenceSheet(buildSequenceSharePayload({ ...sequence, thumbnailUrl }));
  }

  function handleSendToStickerLab() {
    if (!sequence) return;
    sendToStickerLab(sequence);
  }

  // Named rail/select handlers shared by the rail and the mobile bottom bar.
  function selectSplitMode(c: OrchestratorContext) {
    c.viewerState.exitExport();
    // Side-by-side is hard-coded to 2D + Card on every width — the comparison
    // pairing bar was retired, so force the pairing here in case a different
    // one (e.g. 2D + 3D) was persisted before the bar went away.
    c.viewerState.setSplitConfig({ leftPane: 'animation', rightPane: 'card' });
    c.viewerState.setViewerMode('split');
    // NOTE: do NOT force a rerenderTrigger++ here. The ChoreoCard's render
    // $effect already reacts to the pane's prop changes via the cache-aware
    // renderAllCells (in-place swap on a cache hit). rerenderTrigger++ routes to
    // forceRerenderAllCells, which DELETES the caches and blanks every cell to a
    // spinner — that was the whole-grid "flash" seen when switching views.
  }

  function selectViewerMode(c: OrchestratorContext, mode: ContentType) {
    if (mode === 'animation') {
      c.viewerState.enterExport('animation-export', 'animation');
    } else if (mode === 'animation-3d') {
      c.viewerState.enterExport('animation-export', 'animation-3d');
    } else if (mode === 'card') {
      c.viewerState.enterExport('image-export');
    } else if (mode === 'mandala') {
      c.viewerState.exitExport();
      c.viewerState.setViewerMode('mandala');
    } else if (mode === 'tunnel') {
      c.viewerState.exitExport();
      c.viewerState.setViewerMode('tunnel');
    }
  }

  // QR play badge (Card mode): switch to the 2D animation view and start
  // playback. handlePlaybackToggle is a toggle, so read isPlayingLocal at click
  // time and only start when paused — never pauses an already-running anim.
  function playFromQr(c: OrchestratorContext) {
    const wasPlaying = c.isPlayingLocal;
    selectViewerMode(c, 'animation');
    if (!wasPlaying) c.handlePlaybackToggle();
  }

  // viewerState persists across the whole origin (tka-viewer-mode /
  // exportContext), so a scanner whose localStorage holds a stale app-viewer
  // export context would land mid-export instead of on the split first
  // impression. One-shot reset when the scan host mounts.
  onMount(() => {
    if (startInSplit) queueMicrotask(() => selectSplitMode(ctx));
  });

  let deleteConfirmOpen = $state(false);
  let isDeleting = $state(false);

  let rerenderTrigger = $state(0);
  let choreoCardMenuHost: ChoreoCardContextMenuHost | undefined = $state();

  // ── Derived view flags (were {@const} in the drawer's snippet body) ──
  const isVideoExportActive = $derived(ctx.editingPane === "animation");
  const isImageExportActive = $derived(ctx.editingPane === "image");
  const isVideoUploadActive = $derived(ctx.editingPane === "video-upload");
  const isAnyExportActive = $derived(ctx.editingPane !== null);
  const isRecordSceneActive = $derived(isVideoExportActive && ctx.renderMode === '3d' && !ctx.previewBlobUrl);
  const isSidebarExportActive = $derived(isAnyExportActive && !isRecordSceneActive);
  // Every sidebar export (card + the 2D/3D animation download) needs enough
  // width for the 560px settings sidebar to sit beside a usable preview + rail.
  // When the viewer is narrower than that (embedded, split, small window), drive
  // the whole export view into the mobile layout: preview hero on top, settings
  // in the bottom dock, modes in the bottom bar. RecordSceneChrome (3D record)
  // is its own full-bleed UI and is excluded via isRecordSceneActive.
  const cardExportNarrow = $derived(isImageExportActive && !isMobile && bodyWidth < exportSidebarMinWidth());
  const videoExportNarrow = $derived(isVideoExportActive && !isRecordSceneActive && !isMobile && bodyWidth < exportSidebarMinWidth());
  const effectiveMobile = $derived(isMobile || cardExportNarrow || videoExportNarrow);
  const showRail = $derived(!effectiveMobile);
  const headerActions = $derived(buildHeaderActions(ctx, "full", { onDeleteRequest: () => (deleteConfirmOpen = true) }));

  // ── Export routing: host override (scan gated pipeline) or the orchestrator ──
  const videoBusy = $derived(exportOverrides?.videoBusy ?? ctx.isExporting);
  const videoProgress = $derived(exportOverrides?.videoProgress ?? ctx.exportProgress);
  const cardBusy = $derived(exportOverrides?.cardBusy ?? ctx.isExporting);
  const showInlineProgress = $derived(exportOverrides?.showInlineProgress ?? true);
  function handleVideoExport() {
    if (exportOverrides) exportOverrides.onVideoExport();
    else ctx.handleExport();
  }
  function handleCardExport() {
    if (exportOverrides) exportOverrides.onCardExport();
    else ctx.handleExport();
  }
  function handleRemix() {
    if (onRemix) onRemix();
    else ctx.invokeGatedAction("remix", ctx.handleEdit);
  }
  function handleOpenApp() {
    if (openAppHref) void goto(openAppHref);
  }
</script>

{#snippet titleTrigger({ isOpen, hasMenu }: { isOpen: boolean; hasMenu: boolean })}
  <span class="drawer-header-title">
    {#key `${isAnyExportActive}|${isVideoExportActive}|${isImageExportActive}|${ctx.renderMode}`}
      <span
        class="drawer-header-title-text"
        in:fade|local={{ duration: prefersReducedMotion ? 0 : 150 }}
      >
        {#if isAnyExportActive}
          {isVideoExportActive ? (ctx.renderMode === '3d' ? "Record Scene" : "Download Animation") : isImageExportActive ? "Download Card" : "Upload Video"}
        {:else}
          Sequence Viewer
        {/if}
      </span>
    {/key}
  </span>
  {#if hasMenu}
    <i class="fas fa-chevron-down drawer-title-caret" class:open={isOpen} aria-hidden="true"></i>
  {/if}
{/snippet}

{#snippet overflowMenu(includeMotion: boolean)}
  <ViewerOverflowMenu
    variant="header"
    dropDown
    align="center"
    trigger={titleTrigger}
    isFavorite={headerActions.isFavorite}
    onFavoriteToggle={headerActions.onFavoriteToggle}
    isSaved={headerActions.isSaved}
    onSave={headerActions.onSave}
    onRemix={onRemix ?? headerActions.onRemix}
    onCopyData={authState.isAdmin ? handleCopyForClaude : undefined}
    copyDataFeedback={copyClaudeFeedback}
    onVideoUpload={headerActions.onVideoUpload}
    isPublished={headerActions.isPublished}
    onPublish={headerActions.onPublish}
    onUnpublish={headerActions.onUnpublish}
    onDeleteRequest={headerActions.onDeleteRequest}
    onOpenApp={openAppHref ? handleOpenApp : undefined}
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

<div class="drawer-viewer-container" class:landscape={isLandscape} class:practice-mobile={isMobile && ctx.practiceActive}>
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
            {#if isMobile}
              <!-- Icon-only on mobile: a labeled pill hugs the centered
                   title trigger. Desktop keeps the label (room to spare). -->
              <button
                type="button"
                class="header-action-btn practice icon-only"
                onclick={() => ctx.enterPracticeMode()}
                aria-label="Practice"
              >
                <i class="fas fa-dumbbell" aria-hidden="true"></i>
              </button>
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
                onclick={handleRemix}
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
                <i class="fas fa-dumbbell" aria-hidden="true"></i>
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
          {#if ctx.practiceActive}
            <div class="drawer-header-title">
              <span class="drawer-header-title-text">Practice Mode</span>
            </div>
          {:else}
            <!-- The centered title IS the overflow-menu trigger: title +
                 chevron opens the actions menu below the header. -->
            {@render overflowMenu(isMobile)}
          {/if}
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

          <button
            type="button"
            class="drawer-close-button"
            onclick={onClose}
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
              {sequence}
              isOwned={ctx.isOwned}
              isLoggedIn={ctx.isLoggedIn}
              onUpload={ctx.isLoggedIn ? () => ctx.handleVideoUpload() : undefined}
            />
          {:else}
            <ViewerSplitPane
              sequence={ctx.effectiveSequence}
              renderMode={ctx.renderMode}
              isExporting={videoBusy}
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
              practiceMirrorEnabled={ctx.mirrorEnabled}
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
            onSendTo={handleSendTo}
            onSendToStickerLab={handleSendToStickerLab}
            stepCount={sequence?.steps?.length ?? 0}
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
                    isExporting={videoBusy}
                    exportProgress={videoProgress}
                    canvasReady={ctx.canvasReady}
                    layout={effectiveMobile ? "bottom" : "sidebar"}
                    singlePlayDuration={ctx.singlePlayDuration}
                    isPlaying={ctx.isPlayingLocal}
                    bpm={ctx.bpmLocal}
                    renderMode={ctx.renderMode}
                    playbackMode={ctx.playbackMode}
                    selectedPropType={ctx.bluePropType}
                    showInlineExportProgress={showInlineProgress}
                    onPropChange={ctx.handlePropTypeChange}
                    onPlaybackToggle={ctx.handlePlaybackToggle}
                    onPlaybackModeChange={ctx.handlePlaybackModeChange}
                    onBpmChange={ctx.handleBpmChange}
                    onExport={handleVideoExport}
                    onCancel={ctx.handleCancelExport}
                  />
                {/if}
              {:else if isImageExportActive && !effectiveMobile}
                <!-- No onClose on desktop: the card export settings are
                     required to configure the download and must stay put.
                     Leave the Download Card mode via the content rail. -->
                <ExportImagePanel
                  exportOptions={ctx.exportOptions}
                  isExporting={cardBusy}
                  stepCount={ctx.effectiveSequence?.steps?.length ?? 0}
                  layout="sidebar"
                  onExport={handleCardExport}
                />
              {:else if isVideoUploadActive}
                <VideoPanel
                  {sequence}
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
              isExporting={cardBusy}
              stepCount={ctx.effectiveSequence.steps?.length ?? 0}
              layout="bottom"
              onExport={handleCardExport}
              onClose={ctx.exitEditMode}
            />
          </div>
        {/if}
      {/if}
    </div>
    {#if effectiveMobile && ctx.hasSequence && ctx.effectiveSequence && !ctx.practiceActive && dockTrayState.openCount === 0}
      <!-- Ducks while any ControlDock tray is open — the media switcher is
           noise while the user edits, and the tray gets the room.
           Choreography: the slot height eases closed (outer slide) while
           the bar itself glides down (inner fly), on the SAME 260ms
           cubicOut curve as the tray — reads as the tray displacing the
           bar, not a pop. -->
      <div transition:slide={{ duration: prefersReducedMotion ? 0 : 260, easing: cubicOut }}>
        <div transition:fly={{ y: 72, duration: prefersReducedMotion ? 0 : 260, easing: cubicOut }}>
          <ViewerModeBottomBar
            activeMode={ctx.viewerState.viewerMode}
            webgl2Available={ctx.viewer3DState.webgl2Available}
            onSelectSplit={() => selectSplitMode(ctx)}
            onSelectMode={(mode) => selectViewerMode(ctx, mode)}
          />
        </div>
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
          mirrorOn={ctx.mirrorEnabled}
          onToggleMirror={ctx.handleToggleMirror}
        />
      </div>
    </div>
  {/if}

  {#if deleteConfirmOpen}
    <DeleteConfirmDialog
      word={sequence?.word}
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
    /* Lift the header so the title-trigger dropdown lands above the viewer body. */
    z-index: 20;
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
    /* The title group hosts the menu trigger now, so it must accept clicks. */
    pointer-events: auto;
    overflow: visible;
  }

  .drawer-header-title {
    font-size: var(--font-size-base, 16px);
    font-weight: 600;
    line-height: 1.2;
    color: var(--theme-text, #ffffff);
    white-space: nowrap;
  }

  /* Chevron affordance beside the clickable title; rotates when the menu opens. */
  .drawer-title-caret {
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    transition: transform 180ms ease;
    flex-shrink: 0;
  }
  .drawer-title-caret.open {
    transform: rotate(180deg);
  }
  @media (prefers-reduced-motion: reduce) {
    .drawer-title-caret {
      transition: none;
    }
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
  /* Icon-only variant (mobile): square accent button, no label padding. */
  .header-action-btn.practice.icon-only {
    gap: 0;
    padding: 0;
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

  /* Landscape used to hide the centered title for vertical space. It now hosts the
     overflow-menu trigger, so it must stay reachable — kept visible (practice still
     hides it via .practice-mobile below). */

  /* Mobile-portrait practice: the red "Exit Practice" pill already communicates
     the mode, and a wide labeled pill collides with the absolutely-centered
     title. Drop the redundant centered title (landscape already does this). */
  .practice-mobile .drawer-header-title-group {
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

  /* Flow child of .drawer-body-content (a flex column), NOT an absolute overlay.
     As a flow sibling it claims real height, so .viewer-and-export (flex: 1)
     yields and the card's contain-box shrinks — the card lifts fully above the
     dock instead of hiding behind it. When the tray slides open the footer grows,
     the card reflows up in lockstep (same pattern the practice-bar-rise uses).
     Never covers card content: not the collapsed cat-bar, not the open tray. */
  .export-footer-overlay {
    position: relative;
    flex-shrink: 0;
    z-index: 3;
  }


  @media (prefers-reduced-motion: reduce) {
    .viewer-and-export {
      transition: none;
    }
  }
</style>
