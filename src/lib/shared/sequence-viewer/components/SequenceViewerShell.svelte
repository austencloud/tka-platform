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
  - onAccountSignIn: scan adds its sign-in/avatar account entry
  - exportOverrides: scan routes Download through its gated page pipeline
  - startInSplit: scan force-resets persisted viewer mode to the split first
    impression
  - startInCardThenSplit: scan presents the live card first, then promotes the
    same shell to Side-by-Side after the card's painted frame

  Do NOT rebuild scan-specific header/body variants — extend this shell.
-->
<script lang="ts">
  import { onDestroy, onMount, type Snippet } from "svelte";
  import { slide, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { goto } from "$app/navigation";
  import ViewerSplitPane from "./ViewerSplitPane.svelte";
  import ViewerContentRail from "./ViewerContentRail.svelte";
  import ViewerModeBottomBar from "./ViewerModeBottomBar.svelte";
  import { dockTrayState } from "./ControlDock.svelte";
  import type { OrchestratorContext } from "../domain/viewer-orchestrator-context";
  import VideoGallery from "./VideoGallery.svelte";
  import ViewerHeader from "./ViewerHeader.svelte";
  import FullscreenControls from "./FullscreenControls.svelte";
  import ExportVideoDrawer from "$lib/shared/animation-panel/components/AnimationPanel.svelte";
  import ExportImagePanel from "./ExportImagePanel.svelte";
  import VideoPreviewPanel from "./VideoPreviewPanel.svelte";
  import PracticeBar from "./PracticeBar.svelte";
  import PracticeSetupBar from "./PracticeSetupBar.svelte";
  import Recording3DOverlay from "./Recording3DOverlay.svelte";
  import ExportTakeover from "$lib/shared/video-export/components/ExportTakeover.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import { toExportTakeoverPhase } from "$lib/shared/video-export/services/export-takeover-phase";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import RecordSceneChrome from "./record-scene/RecordSceneChrome.svelte";
  import { getClaudeCodeCopier } from "$lib/shared/browse/get-claude-code-copier";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { getDeviceDetector } from "$lib/shared/device/get-device-detector";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import DeleteConfirmDialog from "./DeleteConfirmDialog.svelte";
  import PostShareSheet from "$lib/shared/share/components/PostShareSheet.svelte";
  import VideoPanel from "./video-panel/VideoPanel.svelte";
  import { VIDEO_UPLOAD_ENABLED } from "../config/viewer-feature-flags";
  import ChoreoCardContextMenuHost from "./choreo-card-context-menu/ChoreoCardContextMenuHost.svelte";
  import {
    openSendSequenceSheet,
    buildSequenceSharePayload,
    buildThumbnailUrl,
  } from "$lib/shared/inbox/state/send-sequence-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { sendToStickerLab } from "$lib/shared/sequence-viewer/services/send-to-sticker-lab";
  import { getSequenceMotionProfile } from "$lib/shared/foundation/services/sequence-motion-profile";
  import {
    captureScanAction,
    captureScanExport,
    captureScanPlaybackChanged,
    captureScanPracticeChanged,
    captureScanSettingChanged,
    captureScanViewerOpened,
    captureScanViewChanged,
    endScanViewerSession,
    isScanVisit,
    registerScanSessionCleanup,
  } from "$lib/shared/analytics/scan-analytics";
  import { createViewerShellLayoutState } from "../state/viewer-shell-layout-state.svelte";
  import { createViewerShellShareState } from "../state/viewer-shell-share-state.svelte";
  import {
    createViewerShellInteractionState,
    type ViewerShellExportOverrides,
    type ViewerShellGuideAction,
  } from "../state/viewer-shell-interaction-state.svelte";

  /** Host-owned export pipeline (the scan page's gated share-sheet flow).
      Absent → the orchestrator's own ctx.handleExport pipeline (the app). */
  interface Props {
    ctx: OrchestratorContext;
    sequence: SequenceData;
    isMobile: boolean;
    onClose: () => void;
    /** Override the header/menu Remix action (scan: composer handoff + ?sheet=auth). */
    onRemix?: () => void;
    /** Adds an "Open TKA" item to the title menu (scan funnel exit). */
    openAppHref?: string;
    /** Adds the standalone host's sign-in/avatar entry to the shared header. */
    onAccountSignIn?: () => void;
    /** One-shot reset to the split view on mount (scan first impression). */
    startInSplit?: boolean;
    /** Present card mode first, then promote after its first stable paint. */
    startInCardThenSplit?: boolean;
    exportOverrides?: ViewerShellExportOverrides;
    /** Optional "See it in the Guide" action — host supplies the handler; the
     *  shell renders it in the overflow menu. Omitted → not shown. */
    guideAction?: ViewerShellGuideAction | null;
    /**
     * THE VIEWER IS INSIDE SOMEONE ELSE'S PAGE — trim the chrome that has
     * nowhere to go.
     *
     * The shop hero puts a phone on its front door and iframes the literal
     * `/q/<code>?demo=1`. Once that screen accepts a pointer (HeroPhone's
     * live gate), every control in the header is reachable — including the
     * ones whose whole job is to LEAVE the scan. Close navigated the frame to
     * /browse/gallery, so the phone on a shop page ended up showing the browse
     * app. Austen (2026-08-04): "we don't want it to navigate back to browse we
     * should just deactivate the buttons that don't make sense in this
     * context."
     *
     * Hidden, not disabled: a visible button that ignores a press reads as
     * broken, which is worse than a button that was never there. What goes:
     *
     *   - Close — the embed has nowhere to close TO.
     *   - The account entry — an auth flow trapped in a marketing iframe, and
     *     its signed-in variant is a link to /browse/gallery.
     *   - Share — `getViewerShareDetails()` seeds from `window.location.href`,
     *     which in here is the `?demo=1` URL. Sharing from the hero would put
     *     demo-flagged links into the world, and demo links suppress scan
     *     analytics by design. "Open this scan" beside the phone is the honest
     *     way out, and it carries the clean code.
     *   - Every menu item that navigates away (Open TKA, Remix, Guide) or
     *     opens the sign-in gate (Favorite, Save), plus the owner-only
     *     management actions — a marketing page must not be able to publish or
     *     delete a sequence.
     *
     * What stays: the entire viewer. Bottom-nav views, the content rail,
     * playback, practice, the step cells, motion visibility. That is the part
     * the hero is there to show.
     */
    embedded?: boolean;
    /** Route hosts can replace the drawer's Close control with a Back control. */
    navigation?: { label: string };
    /** Route-owned context placed between the canonical header and viewer body. */
    contextContent?: Snippet;
    /** The full-page sequence route keeps its immersive transport overlay. */
    showFullscreenControls?: boolean;
  }

  let {
    ctx,
    sequence,
    isMobile,
    onClose,
    onRemix,
    openAppHref,
    onAccountSignIn,
    startInSplit = false,
    startInCardThenSplit = false,
    exportOverrides,
    guideAction = null,
    embedded = false,
    navigation,
    contextContent,
    showFullscreenControls = false,
  }: Props = $props();

  const scanInstrumentationEnabled = isScanVisit();
  const layout = createViewerShellLayoutState(
    {
      getContext: () => ctx,
      getSequence: () => sequence,
      getIsMobile: () => isMobile,
      startInSplit,
      startInCardThenSplit,
    },
    {
      getDeviceDetector,
      captureScanSettingChanged,
      captureScanViewChanged,
      captureScanViewerOpened,
      captureScanPlaybackChanged,
    }
  );
  const share = createViewerShellShareState(
    {
      getContext: () => ctx,
      getSequence: () => sequence,
      getDefaultBluePropType: () => settingsService.settings.bluePropType,
    },
    {
      copyForClaude: (value) => getClaudeCodeCopier().copyForClaude(value),
      openSendSequenceSheet,
      buildSequenceSharePayload,
      buildThumbnailUrl,
      sendToStickerLab,
      captureScanAction,
    }
  );
  const interactions = createViewerShellInteractionState(
    {
      getContext: () => ctx,
      getExportOverrides: () => exportOverrides,
      getOnRemix: () => onRemix,
      getOpenAppHref: () => openAppHref,
      getOnAccountSignIn: () => onAccountSignIn,
      onClose,
    },
    {
      navigate: goto,
      captureScanAction,
      captureScanExport,
      captureScanPlaybackChanged,
      captureScanPracticeChanged,
      captureScanSettingChanged,
      captureScanViewChanged,
      endScanViewerSession,
      registerScanSessionCleanup,
    }
  );

  onMount(() => {
    const cleanupLayout = layout.mount();
    const cleanupInteractions = interactions.mount();
    return () => {
      cleanupLayout();
      cleanupInteractions();
    };
  });
  onDestroy(share.destroy);

  const motionProfile = $derived(
    getSequenceMotionProfile(ctx.effectiveSequence ?? sequence)
  );
  const canToggleMotionVisibility = $derived(
    motionProfile.kind === "paired" || motionProfile.kind === "mixed"
  );

  let rerenderTrigger = $state(0);
  let choreoCardMenuHost: ChoreoCardContextMenuHost | undefined = $state();

  // 3D scene load gate (first-load latched, forwarded from the 3D canvas via
  // ViewerSplitPane). Withholds the Record Scene pill until the stage is set, so
  // it doesn't sit over a black "Setting the stage" pane reading as ready.
  let sceneReady3d = $state(false);

  const shellRendersTakeover = $derived(interactions.showInlineProgress);
  const animTakeover = $derived(
    toExportTakeoverPhase(interactions.videoProgress, interactions.videoBusy)
  );
  const takeoverLabel = $derived(
    ctx.effectiveSequence?.word ||
      ctx.effectiveSequence?.displayName ||
      ctx.effectiveSequence?.name ||
      ""
  );
  const takeoverWord = $derived(simplifyRepeatedWord(takeoverLabel));
</script>

<div
  class="drawer-viewer-container"
  class:landscape={layout.isLandscape}
  class:practice-mobile={isMobile && ctx.practiceActive}
>
  <ViewerHeader
    {ctx}
    sequence={ctx.effectiveSequence ?? sequence}
    {isMobile}
    viewerWidth={layout.bodyWidth}
    onClose={interactions.handleClose}
    hidden={ctx.isFullscreen}
    {embedded}
    {navigation}
    {openAppHref}
    onAccountSignIn={!embedded ? onAccountSignIn : undefined}
    onAccountOpenApp={openAppHref && !embedded
      ? () => interactions.recordOpenApp("account_entry")
      : undefined}
    {guideAction}
    isFavorite={interactions.headerActions.isFavorite}
    onFavoriteToggle={interactions.headerActions.onFavoriteToggle && !embedded
      ? interactions.handleFavoriteToggle
      : undefined}
    isSaved={interactions.headerActions.isSaved}
    onSave={interactions.headerActions.onSave && !embedded
      ? interactions.handleSave
      : undefined}
    onRemix={(onRemix ?? interactions.headerActions.onRemix) && !embedded
      ? interactions.handleRemix
      : undefined}
    onPracticeToggle={interactions.headerActions.showPractice
      ? ctx.practiceActive
        ? interactions.handleExitPractice
        : interactions.handleEnterPractice
      : undefined}
    {canToggleMotionVisibility}
    onMotionToggleBlue={() => interactions.handleMotionToggle("blue")}
    onMotionToggleRed={() => interactions.handleMotionToggle("red")}
    onCopyData={authState.isAdmin && !embedded
      ? share.copyForClaude
      : undefined}
    copyDataFeedback={share.copyClaudeFeedback}
    onVideoUpload={interactions.headerActions.onVideoUpload && !embedded
      ? interactions.handleHeaderVideoUpload
      : undefined}
    isPublished={interactions.headerActions.isPublished}
    onPublish={interactions.headerActions.onPublish && !embedded
      ? interactions.handlePublish
      : undefined}
    onUnpublish={interactions.headerActions.onUnpublish && !embedded
      ? interactions.handleUnpublish
      : undefined}
    onDeleteRequest={interactions.headerActions.onDeleteRequest && !embedded
      ? interactions.handleDeleteRequest
      : undefined}
    onOpenApp={openAppHref && !embedded
      ? interactions.handleOpenApp
      : undefined}
    exportSettings={layout.isAnyExportActive &&
    !layout.effectiveMobile &&
    !layout.isRecordSceneActive &&
    !layout.isImageExportActive
      ? {
          expanded: !layout.exportSidebarCollapsed,
          onToggle: layout.toggleExportSidebar,
        }
      : null}
    shareActions={share.actions}
    shareStatusMessage={share.statusMessage}
    onShareActionSelect={share.selectAction}
    onOverflowOpenChange={(open, reason) =>
      captureScanAction(
        open ? "overflow_open" : "overflow_close",
        {},
        { count: reason !== "item" }
      )}
  />

  {#if contextContent && !ctx.isFullscreen}
    {@render contextContent()}
  {/if}

  <!-- The presenter reads viewer-open from the viewer itself. It used to hang
       off the 2D/3D toggle, which meant "the viewer is open" was really "the
       viewer is open AND in 3D" — so open-viewer stayed satisfiable while the
       viewer sat open in 2D and the ghost kept trying to open what it was
       already looking at. -->
  <div
    class="drawer-main"
    data-ghost-state="viewer-open"
    data-sequence-viewer-shell
  >
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="drawer-body-content"
      bind:clientWidth={layout.bodyWidth}
      onclick={showFullscreenControls && ctx.isFullscreen
        ? ctx.handleFullscreenTap
        : undefined}
      onkeydown={showFullscreenControls && ctx.isFullscreen
        ? (event) => {
            if (event.key === "Enter" || event.key === " ") {
              ctx.handleFullscreenTap();
            }
          }
        : undefined}
      role={showFullscreenControls && ctx.isFullscreen ? "button" : undefined}
      tabindex={showFullscreenControls && ctx.isFullscreen ? 0 : undefined}
    >
      {#if showFullscreenControls && ctx.isFullscreen}
        <FullscreenControls
          visible={ctx.fullscreenControlsVisible}
          viewMode={ctx.viewMode}
          isPlaying={ctx.isPlayingLocal}
          bpm={ctx.bpmLocal}
          onExit={ctx.exitFullscreen}
          onPlaybackToggle={ctx.handlePlaybackToggle}
          onStepHalfBeatBackward={ctx.stepHalfBeatBackward}
          onStepHalfBeatForward={ctx.stepHalfBeatForward}
          onStepFullBeatBackward={ctx.stepFullBeatBackward}
          onStepFullBeatForward={ctx.stepFullBeatForward}
          onRestartToStart={ctx.restartToStart}
          onBpmChange={ctx.handleBpmChange}
        />
      {/if}
      {#if ctx.hasSequence && ctx.effectiveSequence}
        <div
          class="viewer-and-export"
          class:export-active={layout.isSidebarExportActive}
          class:record-scene-active={layout.isRecordSceneActive}
          class:desktop={!layout.effectiveMobile}
          class:stacked-rail={layout.stackedExportWithRail}
          class:sidebar-collapsed={layout.exportSidebarCollapsed &&
            !layout.isImageExportActive}
          class:has-rail={layout.showRail}
        >
          {#if layout.showRail}
            <div class="viewer-rail-wrap" class:collapsed={ctx.practiceActive}>
              <ViewerContentRail
                activeMode={ctx.viewerState.viewerMode}
                webgl2Available={ctx.viewer3DState.webgl2Available}
                compact={layout.compactChrome && !isMobile}
                onSelectSplit={() => layout.selectSplitMode()}
                onSelectMode={(mode) => layout.selectViewerMode(mode)}
              />
            </div>
          {/if}
          {#if ctx.viewerState.viewerMode === "videos" && !layout.isSidebarExportActive}
            <VideoGallery
              {sequence}
              isOwned={ctx.isOwned}
              isLoggedIn={ctx.isLoggedIn}
              onUpload={ctx.isLoggedIn && VIDEO_UPLOAD_ENABLED
                ? interactions.handleGalleryVideoUpload
                : undefined}
            />
          {:else}
            <ViewerSplitPane
              sequence={ctx.effectiveSequence}
              renderMode={ctx.renderMode}
              isExporting={interactions.videoBusy}
              bpm={ctx.bpmLocal}
              onBpmChange={(bpm) => interactions.handleBpmChange(bpm, "viewer")}
              onPropChange={(prop) => interactions.handlePropChange(prop, "viewer")}
              playback={ctx.splitPanePlayback}
              imageComposition={layout.isImageExportActive
                ? {
                    ...ctx.splitPaneImageComposition,
                    darkMode: ctx.exportOptions.imageDarkMode,
                    forceContain: true,
                  }
                : ctx.splitPaneImageComposition}
              propRendering={ctx.splitPanePropRendering}
              layout={{
                isFullscreen: ctx.isFullscreen,
                fullscreenStackVertical: ctx.fullscreenStackVertical,
                isMobile: layout.effectiveMobile,
                isLandscapeMobile: layout.isLandscape,
                focusedPane:
                  ctx.viewerState.viewerMode !== "split"
                    ? ctx.viewerState.viewerMode === "card"
                      ? "image"
                      : "animation"
                    : ctx.editingPane,
                suppressCloseButton: ctx.viewerState.viewerMode !== "split",
              }}
              onRenderProgress={ctx.onRenderProgress}
              onFocusPane={interactions.handleFocusPane}
              onUnfocusPane={interactions.handleUnfocusPane}
              onStepClick={interactions.handleStepClick}
              onQrPlayClick={ctx.practiceActive
                ? undefined
                : layout.playFromQr}
              onCanvasReady={ctx.handleCanvasReady}
              onAutoLayoutResolved={layout.isImageExportActive
                ? ctx.setResolvedCardAutoLayout
                : undefined}
              {rerenderTrigger}
              onChoreoCardContextMenu={(x, y) =>
                choreoCardMenuHost?.openContextMenu(x, y)}
              onPlaybackToggle={() =>
                interactions.handlePlaybackToggle("viewer_transport")}
              onSystemPlaybackChange={interactions.handleSystemPlaybackChange}
              onProgressBarSeek={interactions.handleProgressBarSeek}
              onProgressBarScrubStart={ctx.handleProgressBarScrubStart}
              onProgressBarScrubEnd={ctx.handleProgressBarScrubEnd}
              playbackMode={ctx.playbackMode}
              onPlaybackModeChange={(mode) =>
                interactions.handlePlaybackModeChange(mode, "viewer")}
              onSceneReadyChange={(ready) => (sceneReady3d = ready)}
              splitConfig={ctx.viewerState.viewerMode === "split"
                ? { leftPane: "animation", rightPane: "card" }
                : ctx.viewerState.viewerMode === "card"
                  ? { ...ctx.viewerState.splitConfig, rightPane: "card" }
                  : ctx.viewerState.viewerMode === "animation" ||
                      ctx.viewerState.viewerMode === "animation-3d" ||
                      ctx.viewerState.viewerMode === "mandala" ||
                      ctx.viewerState.viewerMode === "tunnel"
                    ? {
                        ...ctx.viewerState.splitConfig,
                        leftPane: ctx.viewerState.viewerMode,
                      }
                    : ctx.viewerState.splitConfig}
              isLoggedIn={ctx.isLoggedIn}
              onVideoUpload={ctx.isLoggedIn && VIDEO_UPLOAD_ENABLED
                ? interactions.handleGalleryVideoUpload
                : undefined}
              onArtExport={interactions.handleArtExport}
              onArtExportEvent={interactions.handleArtExportEvent}
              onArtSettingChange={interactions.handleArtSettingChange}
              onArtAction={interactions.handleArtAction}
              onViewer3DSettingChange={scanInstrumentationEnabled
                ? interactions.handleViewer3DSetting
                : undefined}
              onViewer3DAction={scanInstrumentationEnabled
                ? interactions.handleViewer3DAction
                : undefined}
              practiceActive={ctx.practiceActive}
              practiceRunning={ctx.practiceRunning}
              practiceCountdown={ctx.practiceCountdown}
              practiceCellSize={ctx.practiceViewPrefs.cellSize}
              practiceCanvasFraction={0.5}
              practiceMirrorEnabled={ctx.mirrorEnabled}
            />
          {/if}
          {#if ctx.renderMode === "3d" && (ctx.countdownValue > 0 || ctx.isRecording3D || ctx.isExporting)}
            <Recording3DOverlay
              countdownValue={ctx.countdownValue}
              isRecording={ctx.isRecording3D}
              elapsed={ctx.recordingElapsed}
              onStop={interactions.handleStopRecording}
              exportProgress={ctx.exportProgress}
              isExporting={ctx.isExporting}
              onCancelExport={interactions.handleCancelVideoExport}
            />
          {/if}
          {#if ctx.renderMode !== "3d" && shellRendersTakeover && animTakeover.phase !== "idle"}
            <ExportTakeover
              phase={animTakeover.phase}
              progress={interactions.videoProgress?.progress ?? 0}
              phaseLabel={animTakeover.labelKey ? t(animTakeover.labelKey) : ""}
              error={interactions.videoProgress?.error ?? null}
              onCancel={interactions.handleCancelVideoExport}
              onRetry={() => interactions.handleVideoExport("retry")}
            >
              {#snippet title()}
                {#if motionProfile.kind === "solo"}
                  <span class="takeover-title-text">{takeoverLabel}</span>
                {:else}
                  <TKAWordGlyph word={takeoverWord} height={28} darkMode />
                {/if}
              {/snippet}
            </ExportTakeover>
          {/if}
          <ChoreoCardContextMenuHost
            bind:this={choreoCardMenuHost}
            onRerender={() => {
              rerenderTrigger++;
            }}
            isExportMode={layout.isImageExportActive}
            exportOptions={ctx.exportOptions}
            onSendTo={share.sendToInbox}
            onSendToStickerLab={share.sendToStickerLab}
            stepCount={sequence?.steps?.length ?? 0}
            onAction={interactions.handleCardContextAction}
          />
          {#if layout.isRecordSceneActive && ctx.effectiveSequence && sceneReady3d}
            <RecordSceneChrome
              isExporting={ctx.isExporting}
              canvasReady={ctx.canvasReady}
              onExport={() => interactions.handleVideoExport()}
              choreography={ctx.viewer3DState.cameraChoreography}
              onSettingChange={scanInstrumentationEnabled
                ? interactions.handleViewerControlSetting
                : undefined}
            />
          {/if}
          {#if layout.isSidebarExportActive}
            <div
              class="export-panel-container"
              class:sidebar={!layout.effectiveMobile &&
                (layout.isVideoExportActive || layout.isVideoUploadActive)}
            >
              {#if layout.isVideoExportActive}
                {#if ctx.previewBlobUrl}
                  <VideoPreviewPanel
                    blobUrl={ctx.previewBlobUrl}
                    saveLabel="Save"
                    onDismiss={interactions.handleDismissExportedVideo}
                    onRedownload={() =>
                      void interactions.handleRedownloadExportedVideo()}
                  />
                {:else}
                  <ExportVideoDrawer
                    exportOptions={ctx.exportOptions}
                    isExporting={interactions.videoBusy}
                    exportProgress={interactions.videoProgress}
                    canvasReady={ctx.canvasReady}
                    layout={layout.effectiveMobile ? "bottom" : "sidebar"}
                    singlePlayDuration={ctx.singlePlayDuration}
                    isPlaying={ctx.isPlayingLocal}
                    bpm={ctx.bpmLocal}
                    renderMode={ctx.renderMode}
                    playbackMode={ctx.playbackMode}
                    selectedPropType={ctx.bluePropType}
                    showInlineExportProgress={false}
                    onPropChange={(prop) =>
                      interactions.handlePropChange(prop, "video_export")}
                    onPlaybackToggle={() =>
                      interactions.handlePlaybackToggle("video_export")}
                    onPlaybackModeChange={(mode) =>
                      interactions.handlePlaybackModeChange(
                        mode,
                        "video_export"
                      )}
                    onBpmChange={(bpm) =>
                      interactions.handleBpmChange(bpm, "video_export")}
                    onExport={() => interactions.handleVideoExport()}
                    onCancel={interactions.handleCancelVideoExport}
                    onSettingChange={scanInstrumentationEnabled
                      ? interactions.handleViewerControlSetting
                      : undefined}
                  />
                {/if}
              {:else if layout.isImageExportActive && !isMobile}
                <!-- No onClose on desktop widths: the card export settings are
                     required to configure the download and must stay put.
                     Leave the Download Card mode via the content rail. Below
                     the sidebar threshold the panel stacks under the hero
                     (layout="bottom") while the rail column persists. -->
                <ExportImagePanel
                  exportOptions={ctx.exportOptions}
                  isExporting={interactions.cardBusy}
                  stepCount={ctx.effectiveSequence?.steps?.length ?? 0}
                  resolvedAutoLayout={ctx.resolvedCardAutoLayout}
                  layout={layout.effectiveMobile ? "bottom" : "sidebar"}
                  onExport={interactions.handleCardExport}
                  onSettingChange={interactions.handleCardSettingChange}
                />
              {:else if layout.isVideoUploadActive}
                <VideoPanel
                  {sequence}
                  isOwned={ctx.isOwned}
                  bpm={ctx.bpmLocal}
                  onSaveFirst={interactions.handleVideoUploadSaveFirst}
                  onClose={interactions.handleVideoUploadClose}
                />
              {/if}
            </div>
          {/if}
        </div>
        {#if isMobile && layout.isImageExportActive && ctx.effectiveSequence}
          <!-- Entrance/exit fly now lives on ControlDock's root
               (shared by every dock); this wrapper only positions. -->
          <div class="export-footer-overlay">
            <ExportImagePanel
              exportOptions={ctx.exportOptions}
              isExporting={interactions.cardBusy}
              stepCount={ctx.effectiveSequence.steps?.length ?? 0}
              resolvedAutoLayout={ctx.resolvedCardAutoLayout}
              layout="bottom"
              onExport={interactions.handleCardExport}
              onClose={interactions.handleUnfocusPane}
              onSettingChange={interactions.handleCardSettingChange}
            />
          </div>
        {/if}
      {/if}
    </div>
    {#if isMobile && ctx.hasSequence && ctx.effectiveSequence && !ctx.practiceActive && dockTrayState.openCount === 0}
      <!-- Ducks while any ControlDock tray is open — the media switcher is
           noise while the user edits, and the tray gets the room.
           Choreography: the slot height eases closed (outer slide) while
           the bar itself glides down (inner fly), on the SAME 260ms
           cubicOut curve as the tray — reads as the tray displacing the
           bar, not a pop. -->
      <div
        transition:slide={{
          duration: layout.prefersReducedMotion ? 0 : 260,
          easing: cubicOut,
        }}
      >
        <div
          transition:fly={{
            y: 72,
            duration: layout.prefersReducedMotion ? 0 : 260,
            easing: cubicOut,
          }}
        >
          <ViewerModeBottomBar
            activeMode={ctx.viewerState.viewerMode}
            webgl2Available={ctx.viewer3DState.webgl2Available}
            onSelectSplit={() => layout.selectSplitMode()}
            onSelectMode={(mode) => layout.selectViewerMode(mode)}
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
      <div
        class="bar-pane config"
        class:active={!ctx.practiceRunning}
        inert={ctx.practiceRunning}
      >
        <PracticeSetupBar
          config={ctx.practiceState.userConfig}
          onSetConfig={interactions.handlePracticeSetConfig}
          onStart={interactions.handlePracticeStart}
        />
      </div>
      <div
        class="bar-pane cockpit"
        class:active={ctx.practiceRunning}
        inert={!ctx.practiceRunning}
      >
        <PracticeBar
          progress={ctx.practiceState.progress}
          bpm={ctx.bpmLocal}
          isPlaying={ctx.isPlayingLocal}
          onBpmChange={(bpm) =>
            interactions.handleBpmChange(bpm, "practice")}
          onPlayPause={() => interactions.handlePlaybackToggle("practice")}
          onStepLevel={interactions.handlePracticeStepLevel}
          onToggleHold={interactions.handlePracticeToggleHold}
          onStop={interactions.handlePracticeStop}
          metronomeOn={ctx.metronomeEnabled}
          onToggleMetronome={interactions.handleToggleMetronome}
          mirrorOn={ctx.mirrorEnabled}
          onToggleMirror={interactions.handleToggleMirror}
        />
      </div>
    </div>
  {/if}

  {#if interactions.deleteConfirmOpen}
    <DeleteConfirmDialog
      word={sequence?.word}
      isDeleting={interactions.isDeleting}
      positioning="absolute"
      onConfirm={interactions.handleDeleteConfirm}
      onCancel={interactions.handleDeleteCancel}
    />
  {/if}

  <!-- Post handoff. Lives in the shell, never in a host, so the drawer, /q and
       /sequence surfaces are identical by construction. -->
  <PostShareSheet
    isOpen={share.postSheetOpen}
    sequence={ctx.effectiveSequence ?? null}
    shareUrl={share.postSheetOpen ? share.getShareUrl() : ""}
    videoBlobUrl={ctx.previewBlobUrl}
    isExportingVideo={ctx.isExporting}
    exportProgress={ctx.exportProgress?.progress ?? null}
    onRequestVideo={ctx.handleExport}
    onClose={() => share.setPostSheetOpen(false)}
  />
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
    .bar-pane {
      transition: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .drawer-viewer-container {
      --ws-dur: 0ms;
    }
    .viewer-rail-wrap,
    .practice-bar-rise {
      transition: none;
    }
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

  /* Narrow-desktop export (Card / 2D Animation below the sidebar threshold):
     the settings stack under the hero exactly like the phone layout, but the
     rail keeps its column — otherwise entering Card/2D at these widths swapped
     the whole chrome to phone mode while Split/Mandala/Tunnel kept the rail. */
  .viewer-and-export.stacked-rail {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
  }
  .viewer-and-export.stacked-rail .viewer-rail-wrap {
    grid-column: 1;
    grid-row: 1 / -1;
  }
  .viewer-and-export.stacked-rail :global(.view-container) {
    grid-column: 2;
    grid-row: 1;
    position: relative;
    inset: auto;
    min-height: 0;
    overflow: hidden;
  }
  .viewer-and-export.stacked-rail .export-panel-container {
    grid-column: 2;
    grid-row: 2;
    border-left: none;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow: visible;
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
