<!--
  SequenceViewerShell.svelte

  THE sequence-viewer chrome: header (actions + title-menu trigger + close),
  content rail / bottom bar, split pane body, export sidebars/docks, practice
  workstation, delete dialog. Extracted verbatim from SequenceViewerDrawerHost
  so every host renders the IDENTICAL viewer — the app drawer (inside Drawer)
  and the /sequence standalone route both mount this one component.

  Host deltas are props, not forks:
  - onClose: drawer dismissal vs standalone Back navigation
  - openAppHref: standalone hosts add an app-launch item to the title menu
  - onAccountSignIn: scan-origin viewers add their account entry
  - exportOverrides: scan-origin viewers gate Download through account signup
  - startInCardThenSplit: scan-origin viewers present the card first, then
    promote the same shell to Side-by-Side after the card's painted frame

  Do NOT rebuild scan-specific header/body variants — extend this shell.
-->
<script lang="ts">
  import { onDestroy, onMount, type Snippet } from "svelte";
  import { slide, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { goto } from "$app/navigation";
  import ViewerSplitPane from "./ViewerSplitPane.svelte";
  import ViewerWorkspacePanels from "./ViewerWorkspacePanels.svelte";
  import ViewerContentRail from "./ViewerContentRail.svelte";
  import ViewerModeBottomBar from "./ViewerModeBottomBar.svelte";
  import { dockTrayState } from "./ControlDock.svelte";
  import type { OrchestratorContext } from "../domain/viewer-orchestrator-context";
  import {
    createVideoPlayheadBridge,
    setVideoPlayheadContext,
  } from "../context/video-playhead-context";
  import SequenceVideos from "./sequence-videos/SequenceVideos.svelte";
  import ViewerHeader from "./ViewerHeader.svelte";
  import FullscreenControls from "./FullscreenControls.svelte";
  import ExportVideoDrawer from "$lib/shared/animation-panel/components/AnimationPanel.svelte";
  import ExportImagePanel from "./ExportImagePanel.svelte";
  import VideoPreviewPanel from "./VideoPreviewPanel.svelte";
  import PracticeBar from "./PracticeBar.svelte";
  import PostStudioPane from "./PostStudioPane.svelte";
  import PracticeSetupBar from "./PracticeSetupBar.svelte";
  import Recording3DOverlay from "./Recording3DOverlay.svelte";
  import ExportTakeover from "$lib/shared/video-export/components/ExportTakeover.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import { toExportTakeoverPhase } from "$lib/shared/video-export/services/export-takeover-phase";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import RecordSceneChrome from "./record-scene/RecordSceneChrome.svelte";
  import { getDeviceDetector } from "$lib/shared/device/get-device-detector";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import DeleteConfirmDialog from "./DeleteConfirmDialog.svelte";
  import PostShareSheet from "$lib/shared/share/components/PostShareSheet.svelte";
  import { VIDEO_UPLOAD_ENABLED } from "../config/viewer-feature-flags";
  import { canAccessPostStudio } from "../services/post-studio-access";
  import ChoreoCardContextMenuHost from "./choreo-card-context-menu/ChoreoCardContextMenuHost.svelte";
  import {
    openSendSequenceSheet,
    buildSequenceSharePayload,
    buildThumbnailUrl,
  } from "$lib/shared/inbox/state/send-sequence-state.svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { createGlobalChiralitySeam } from "$lib/shared/settings/components/tabs/prop-type/prop-chirality-seam";
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
  import type {
    TunnelComposition,
    TunnelSaveTarget,
  } from "../tunnel/tunnel-composition";
  import { createViewerInspectorHostState } from "../state/viewer-inspector-host-state.svelte";
  import { setViewerInspectorHostContext } from "../context/viewer-inspector-host-context";

  /** Host-owned export pipeline (such as the scan-origin account gate).
      Absent → the orchestrator's own ctx.handleExport pipeline (the app). */
  interface Props {
    ctx: OrchestratorContext;
    sequence: SequenceData;
    isMobile: boolean;
    onClose: () => void;
    /** Override the header/menu Remix action when a host needs custom routing. */
    onRemix?: () => void;
    /** Adds an "Open Flow Arts Composer" item to the title menu (scan funnel exit). */
    openAppHref?: string;
    /** Adds the standalone host's sign-in/avatar entry to the shared header. */
    onAccountSignIn?: () => void;
    /** One-shot reset to the split view on mount. */
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
     * `/q/<code>?demo=1`, which hands off to `/sequence`. Once that screen accepts a pointer (HeroPhone's
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
     *   - Every menu item that navigates away (Open Flow Arts Composer, Remix, Guide) or
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
    tunnelComposition?: TunnelComposition | null;
    tunnelSaveTarget?: TunnelSaveTarget | null;
    onTunnelSaved?: import("../tunnel/tunnel-snapshot").TunnelSavedCallback;
    /** Route-owned context placed between the canonical header and viewer body. */
    contextContent?: Snippet;
    /** The full-page sequence route keeps its immersive transport overlay. */
    showFullscreenControls?: boolean;
    /** Host intent: enter through Share and open the canonical sheet once. */
    shareOnOpen?: boolean;
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
    shareOnOpen = false,
    tunnelComposition = null,
    tunnelSaveTarget = null,
    onTunnelSaved,
  }: Props = $props();

  let viewerWorkspaceElement = $state<HTMLElement | null>(null);
  let artInspectorTarget = $state<HTMLElement | null>(null);
  const inspectorHost = createViewerInspectorHostState();
  setViewerInspectorHostContext(inspectorHost);
  $effect(() => inspectorHost.setTarget(artInspectorTarget));

  const scanInstrumentationEnabled = isScanVisit();
  const layout = createViewerShellLayoutState(
    {
      getContext: () => ctx,
      getSequence: () => sequence,
      getIsMobile: () => isMobile,
      getWorkspaceElement: () => viewerWorkspaceElement,
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
      openSendSequenceSheet,
      buildSequenceSharePayload,
      buildThumbnailUrl,
      sendToStickerLab,
      captureScanAction,
    }
  );
  // One playhead for the performance video and the notation beside it. The
  // videos pane picks this up through context rather than three layers of
  // props, and reaches it from the full Videos surface and the split-pane
  // companion alike.
  const videoPlayhead = createVideoPlayheadBridge({
    setPlaybackSource: (source) => ctx.setPlaybackSource(source),
    setActiveStepMap: (map) => ctx.setActiveStepMap(map),
    onVideoTimeUpdate: (seconds) => ctx.onVideoTimeUpdate(seconds),
  });
  setVideoPlayheadContext(videoPlayhead);

  const interactions = createViewerShellInteractionState(
    {
      getContext: () => ctx,
      getVideoPlayhead: () => videoPlayhead,
      getExportOverrides: () => exportOverrides,
      getOnRemix: () => onRemix,
      getOpenAppHref: () => openAppHref,
      getOnAccountSignIn: () => onAccountSignIn,
      onClose,
    },
    {
      navigate: goto,
      openExternalHref: (href) => window.location.assign(href),
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

  let consumedShareOnOpen = false;
  $effect(() => {
    if (!shareOnOpen || consumedShareOnOpen) return;
    consumedShareOnOpen = true;
    void Promise.resolve().then(() => share.selectAction("share-sequence"));
  });

  /**
   * Resolves the sheet's video slot against the art-share session.
   *
   * Mandala runs its own worker pipeline and now hands the file back instead of
   * saving it. Tunnel bakes through the shared exporter, so its result is
   * already the same `previewBlobUrl` the animation export uses — only the
   * request differs, and the pane's inline preview is suppressed while the
   * sheet owns it.
   */
  /**
   * A rendered post supersedes every other video the share sheet could offer.
   * Post Studio composes the 9:16 file deliberately, so once one exists it is
   * unambiguously what "share the video" means — the same way a mandala or
   * tunnel bake takes the slot when the share came from those surfaces.
   */
  let postStudioVideoUrl = $state<string | null>(null);
  function adoptPostStudioRender(blob: Blob): void {
    if (postStudioVideoUrl) URL.revokeObjectURL(postStudioVideoUrl);
    postStudioVideoUrl = URL.createObjectURL(blob);
  }
  onDestroy(() => {
    if (postStudioVideoUrl) URL.revokeObjectURL(postStudioVideoUrl);
  });

  const artShareVideo = $derived.by(() => {
    const target = share.artShare;

    // Not for a scene share: that session is ABOUT a live 3D take, and a post
    // render left behind by the studio would both stand in for the take and
    // no-op the request that records it.
    if (postStudioVideoUrl && !target && !share.sceneShare) {
      return {
        blobUrl: postStudioVideoUrl,
        exporting: false,
        progress: null,
        label: "Post",
        // Post Studio owns re-rendering; the sheet must not kick off an
        // animation export that would replace the composed post.
        request: () => Promise.resolve(),
      };
    }

    if (target?.artType === "mandala") {
      const mandala = target.mandalaController;
      return {
        blobUrl: mandala.exportBlobUrl,
        exporting: mandala.exporting,
        progress: mandala.exporting ? mandala.exportProgress : null,
        label: "Mandala",
        request: () => Promise.resolve(mandala.startExport({ deliver: false })),
      };
    }

    if (target?.artType === "tunnel") {
      return {
        blobUrl: ctx.previewBlobUrl,
        exporting: ctx.isExporting,
        progress: ctx.exportProgress?.progress ?? null,
        label: "Tunnel",
        request: () => interactions.handleArtExport(target),
      };
    }

    return {
      blobUrl: ctx.previewBlobUrl,
      exporting: ctx.isExporting,
      progress: ctx.exportProgress?.progress ?? null,
      // Same export either way — `handleExport` records the live stage when 3D
      // is the editing pane. Only a share that came FROM the 3D rail names it
      // that, because only there is the user unambiguously looking at a scene.
      label: share.sceneShare ? "Scene" : "Video",
      request: requestShareVideo,
    };
  });

  /**
   * True while a share armed the animation export pane on the viewer's behalf.
   *
   * `handleExport` refuses outright unless the editing pane is "animation" or
   * "image" (export-coordinator.svelte.ts), and a viewer that has never opened
   * Export sits at `null` — which is every fresh page load. So Share → Video on
   * a page the user just landed on reported "The render didn't start." with
   * nothing on screen they could do about it. Arm the pane for them, and put the
   * viewer back the way they left it once the sheet is done with it.
   */
  let armedExportForShare = $state(false);

  function requestShareVideo(): Promise<boolean> {
    if (ctx.editingPane !== "animation") {
      // setExportContext, NOT enterEditMode/enterExport: those also move
      // viewerMode, and moving it remounts the 3D canvas — so the export ran one
      // tick later against unregistered Threlte refs and bailed with "3D scene
      // not ready for export." The export context alone is what `editingPane`
      // reads, and leaving the view where it is keeps the live stage the take
      // needs already mounted.
      ctx.viewerState.setExportContext("animation-export");
      armedExportForShare = true;
    }
    return ctx.handleExport({ autoDeliver: false });
  }

  $effect(() => {
    if (!armedExportForShare) return;
    // Not while the sheet is up, and not during a live take — the sheet is only
    // hidden then, and exiting would tear down the export the take is feeding.
    if (share.postSheetOpen || awaitingSceneTake) return;
    armedExportForShare = false;
    ctx.viewerState.exitExport();
  });

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

  /**
   * Share sheet ⇄ 3D scene take.
   *
   * Picking Video in the share sheet asks the viewer to export. In 2D that is a
   * background render and the sheet fills in. In 3D it is a live camera
   * performance: the scene records in real time and ends when the user presses
   * Stop on the REC pill. The sheet covers the stage and shows none of that, so
   * the take used to look like a hung "Rendering video…" over a scene the user
   * could neither see nor stop. Step aside for the take, come back with it.
   */
  let awaitingSceneTake = $state(false);
  /** previewBlobUrl at step-aside, so an older export can't count as the take. */
  let takeBaselineUrl = $state<string | null>(null);

  $effect(() => {
    if (!ctx.isRecording3D || !share.postSheetOpen) return;
    awaitingSceneTake = true;
    takeBaselineUrl = ctx.previewBlobUrl;
    share.suspendForSceneTake();
  });

  $effect(() => {
    if (!awaitingSceneTake) return;
    // Came back on their own — the sheet is theirs again, stop waiting to
    // reopen it.
    if (share.postSheetOpen) {
      awaitingSceneTake = false;
      return;
    }
    if (ctx.isRecording3D || ctx.isExporting) return;
    const url = ctx.previewBlobUrl;
    if (!url || url === takeBaselineUrl) return;
    awaitingSceneTake = false;
    share.resumeAfterSceneTake();
  });
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
      ? interactions.handleAccountOpenApp
      : undefined}
    guideAction={embedded ? null : guideAction}
    isFavorite={interactions.headerActions.isFavorite}
    onFavoriteToggle={interactions.headerActions.onFavoriteToggle && !embedded
      ? interactions.handleFavoriteToggle
      : undefined}
    isSaved={interactions.headerActions.isSaved}
    isSaving={interactions.headerActions.isSaving}
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
          bind:this={viewerWorkspaceElement}
          class="viewer-and-export"
          class:export-active={layout.isWorkspaceInspectorActive}
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
                footerAction={!embedded && !layout.compactChrome && guideAction
                  ? {
                      label: guideAction.label,
                      icon: "fa-book-open",
                      onSelect: guideAction.onSelect,
                    }
                  : undefined}
                onSelectSplit={() => layout.selectSplitMode()}
                onSelectMode={(mode) => layout.selectViewerMode(mode)}
              />
            </div>
          {/if}
          <ViewerWorkspacePanels
            direction={layout.effectiveMobile ? "vertical" : "horizontal"}
            inspectorActive={layout.isWorkspaceInspectorActive}
            inspectorCollapsed={layout.exportSidebarCollapsed &&
              !layout.isImageExportActive}
          >
            {#snippet stage()}
              <div class="viewer-stage-container">
                {#if layout.showPostStudio}
                  <PostStudioPane
                    sequence={ctx.effectiveSequence}
                    resolvedCardAutoLayout={ctx.resolvedCardAutoLayout}
                    onExported={adoptPostStudioRender}
                    onSharePost={() => share.sharePost()}
                  />
                {:else if layout.showVideoGallery}
                  <SequenceVideos
                    {sequence}
                    isOwned={ctx.isOwned || ctx.isOwnedLibraryRecord}
                    isLoggedIn={ctx.isLoggedIn}
                    bpm={ctx.bpmLocal}
                    canUpload={ctx.isLoggedIn && VIDEO_UPLOAD_ENABLED}
                    uploadRequested={layout.isVideoUploadActive}
                    onSaveFirst={interactions.handleVideoUploadSaveFirst}
                    onSaveToLibrary={interactions.handleSave}
                    onUploadOpenChange={interactions.handleVideoWorkOpenChange}
                  />
                {:else}
                  <ViewerSplitPane
                    sequence={ctx.effectiveSequence}
                    {tunnelComposition}
                    {tunnelSaveTarget}
                    {onTunnelSaved}
                    renderMode={ctx.renderMode}
                    isExporting={interactions.videoBusy}
                    bpm={ctx.bpmLocal}
                    onBpmChange={(bpm) =>
                      interactions.handleBpmChange(bpm, "viewer")}
                    onSaveToLibrary={interactions.handleSave}
                    onPropChange={(prop) =>
                      interactions.handlePropChange(prop, "viewer")}
                    onFanAppearanceChange={ctx.handleFanAppearanceChange}
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
                      suppressCloseButton:
                        ctx.viewerState.viewerMode !== "split",
                    }}
                    onRenderProgress={ctx.onRenderProgress}
                    onFocusPane={interactions.handleFocusPane}
                    onUnfocusPane={interactions.handleUnfocusPane}
                    onStepClick={interactions.handleStepClick}
                    onQrPlayClick={ctx.practiceActive
                      ? undefined
                      : layout.playFromQr}
                    onCanvasReady={ctx.handleCanvasReady}
                    cardAutoLayoutOverride={layout.cardAutoLayoutOverride}
                    cardContainSizeMotion={layout.cardContainSizeMotion}
                    onAutoLayoutResolved={(resolved, width, height) => {
                      // Keep the last Card box that was large enough to read.
                      // A collapsing hidden Card must not replace that shape
                      // with the wide, shallow grid its exit briefly measures.
                      layout.rememberReadableCardAutoLayout(
                        resolved,
                        width,
                        height
                      );
                      if (resolved || layout.isImageExportActive) {
                        ctx.setResolvedCardAutoLayout(resolved);
                      }
                    }}
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
                    onArtShare={share.setArtShareTarget}
                    artShareActive={!!share.artShare}
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
                    phaseLabel={animTakeover.labelKey
                      ? t(animTakeover.labelKey)
                      : ""}
                    error={interactions.videoProgress?.error ?? null}
                    onCancel={interactions.handleCancelVideoExport}
                    onRetry={() => interactions.handleVideoExport("retry")}
                  >
                    {#snippet title()}
                      {#if motionProfile.kind === "solo"}
                        <span class="takeover-title-text">{takeoverLabel}</span>
                      {:else}
                        <TKAWordGlyph
                          word={takeoverWord}
                          height={28}
                          darkMode
                        />
                      {/if}
                    {/snippet}
                  </ExportTakeover>
                {/if}
                <ChoreoCardContextMenuHost
                  bind:this={choreoCardMenuHost}
                  sequence={ctx.effectiveSequence ?? sequence}
                  onSaveToLibrary={interactions.handleSave}
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
              </div>
            {/snippet}

            {#snippet inspector()}
              <div
                class="export-panel-container"
                class:card-settings={layout.isImageExportActive}
                class:art-settings={layout.isArtInspectorActive}
                class:sidebar={!layout.effectiveMobile &&
                  (layout.isVideoExportActive || layout.isVideoUploadActive)}
              >
                {#if layout.isVideoExportActive || layout.isArtInspectorActive}
                  <div
                    class="inspector-content-layer motion-settings-layer"
                    data-active={layout.isVideoExportActive}
                    inert={!layout.isVideoExportActive || undefined}
                    aria-hidden={!layout.isVideoExportActive}
                  >
                    {#if ctx.previewBlobUrl}
                      <VideoPreviewPanel
                        blobUrl={ctx.previewBlobUrl}
                        saveLabel="Save"
                        onDismiss={interactions.handleDismissExportedVideo}
                        onRedownload={() =>
                          void interactions.handleRedownloadExportedVideo()}
                      />
                    {:else}
                      <!-- No tempo and no playback mode on the Motion page: the
                       transport under the canvas carries both and is visible
                       from every page of this panel. Showing them here too put
                       one setting on screen twice in two different controls.
                       `bpm` and `playbackMode` still come in — the export page
                       reads them for its duration estimate. -->
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
                        fanAppearance={ctx.fanAppearance}
                        onFanAppearanceChange={ctx.handleFanAppearanceChange}
                        propChirality={createGlobalChiralitySeam()}
                        sequence={ctx.effectiveSequence}
                        showInlineExportProgress={false}
                        showTempoControls={false}
                        onPropChange={(prop) =>
                          interactions.handlePropChange(prop, "video_export")}
                        onPlaybackToggle={() =>
                          interactions.handlePlaybackToggle("video_export")}
                        onBpmChange={(bpm) =>
                          interactions.handleBpmChange(bpm, "video_export")}
                        onExport={() => interactions.handleVideoExport()}
                        onCancel={interactions.handleCancelVideoExport}
                        onSettingChange={scanInstrumentationEnabled
                          ? interactions.handleViewerControlSetting
                          : undefined}
                      />
                    {/if}
                  </div>
                  <div
                    class="inspector-content-layer art-settings-layer"
                    data-active={layout.isArtInspectorActive}
                    bind:this={artInspectorTarget}
                    data-viewer-art-inspector-target
                  ></div>
                {:else if layout.isImageExportActive && !isMobile}
                  <!-- No onClose on desktop widths: the card settings shape what
                     Share hands over and must stay put. Leave the Card pane via
                     the content rail. Below the sidebar threshold the panel
                     stacks under the hero (layout="bottom") while the rail
                     column persists. -->
                  <ExportImagePanel
                    exportOptions={ctx.exportOptions}
                    stepCount={ctx.effectiveSequence?.steps?.length ?? 0}
                    resolvedAutoLayout={ctx.resolvedCardAutoLayout}
                    layout={layout.effectiveMobile ? "bottom" : "sidebar"}
                    onSettingChange={interactions.handleCardSettingChange}
                  />
                {/if}
              </div>
            {/snippet}
          </ViewerWorkspacePanels>
        </div>
        {#if isMobile && layout.isImageExportActive && ctx.effectiveSequence}
          <!-- Entrance/exit fly now lives on ControlDock's root
               (shared by every dock); this wrapper only positions. -->
          <div class="export-footer-overlay">
            <ExportImagePanel
              exportOptions={ctx.exportOptions}
              stepCount={ctx.effectiveSequence.steps?.length ?? 0}
              resolvedAutoLayout={ctx.resolvedCardAutoLayout}
              layout="bottom"
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
          onBpmChange={(bpm) => interactions.handleBpmChange(bpm, "practice")}
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
       /sequence surfaces are identical by construction. `autoDeliver: false`
       because the sheet delivers the render itself — without it the same take
       also lands in Downloads and toasts behind the drawer. -->
  <!-- The video slot follows whatever the share was about. From Mandala it is
       the mandala's own worker render; from Tunnel it is the kaleidoscope bake
       (which already lands in the shared exporter's preview slot, so only the
       request differs); otherwise it is the sequence animation. -->
  <PostShareSheet
    isOpen={share.postSheetOpen}
    sequence={ctx.effectiveSequence ?? null}
    shareUrl={share.postSheetOpen ? share.getShareUrl() : ""}
    videoBlobUrl={artShareVideo.blobUrl}
    isExportingVideo={artShareVideo.exporting}
    isRecordingScene={!share.artShare && ctx.isRecording3D}
    exportProgress={artShareVideo.progress}
    onRequestVideo={artShareVideo.request}
    videoLabel={artShareVideo.label}
    initialArtifact={share.artShare ||
    share.sceneShare ||
    (share.postShare && !!postStudioVideoUrl)
      ? "video"
      : "card"}
    resolvedCardAutoLayout={ctx.resolvedCardAutoLayout}
    onSendInTka={() => share.sendToInbox()}
    onOpenPostStudio={canAccessPostStudio()
      ? () => layout.selectViewerMode("post-studio")
      : undefined}
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
    display: flex;
    flex-direction: row;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .viewer-stage-container {
    position: relative;
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  /* The settings column never grew with the viewport, so on a big screen its
     panels stayed a phone-width strip and paid for it in height: the effects
     inspector spent four rows on eight looks and scrolled. Wider here is
     cheaper than taller — the extra width lets the inspector put its looks
     beside its controls and fit one screen (4k-native-layout.md, the 1680
     seam). The canvas beside it is still the larger half at every tier. */
  @media (min-width: 1680px) {
    .viewer-and-export {
      --export-sidebar-width: 800px;
    }
  }

  /* At 4K@100% and on a jam TV nothing is scaling for you, so this tier has to
     step the composition, not nudge it: 1000px puts the effects inspector past
     its 52rem seam, where each look becomes a horizontal study instead of a
     stacked card. The canvas is still well over half the screen at 3840. */
  @media (min-width: 2600px) {
    .viewer-and-export {
      --export-sidebar-width: 1000px;
    }
  }

  .viewer-and-export:not(.desktop)
    .viewer-stage-container
    :global(.view-container) {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .viewer-and-export.desktop .viewer-stage-container :global(.view-container) {
    position: relative;
    inset: auto;
  }

  /* The 3D scene rail pins its Presets/Save cluster to the same corner the
     Record Scene pill anchors to (SceneControlRail: right 0.75rem, bottom
     5rem, z-index 30 — above the pill). When the rail is present, shift the
     pill left of the rail column (0.75rem gutter + 48px buttons + 0.75rem
     gap) so the two never stack. Compact workspaces replace the rail with
     the bottom bar and keep the pill's default inset. */
  :global(
    .viewer-and-export.record-scene-active:has(
        [data-scene-control-workspace]:not([data-presentation="compact"])
      )
  ) {
    --record-scene-right: calc(1.5rem + 48px);
    /* Shifting the pill left of the rail parks it over the inspector column
       instead, where it covers the performer hub's bottom-anchored tab bar.
       Raise the inspector's floor above the pill (80px inset + 45px pill +
       12px gap) so the panel ends where the pill begins. Only the inspector
       reads this var; the rail keeps its own bottom and its own z-index. */
    --scene-controls-bottom: calc(80px + 45px + 12px);
  }

  /* Compact workspaces center the Performer/Scene action bar along the same
     bottom band the pill anchors to. Lift the pill above the bar (57px bar
     + 12px gap) instead of shifting it sideways — the bar is centered, so
     no horizontal inset can guarantee clearance. */
  :global(
    .viewer-and-export.record-scene-active:has(
        [data-scene-control-workspace][data-presentation="compact"]
      )
  ) {
    --record-scene-bottom: calc(80px + 57px + 12px);
  }

  .export-panel-container {
    position: relative;
    overflow: hidden;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    isolation: isolate;
    min-width: 0;
  }

  .export-panel-container.art-settings {
    overflow: hidden;
  }

  .inspector-content-layer {
    position: absolute;
    inset: 0;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition:
      opacity var(--transition-normal),
      visibility 0s linear var(--duration-normal);
  }

  .inspector-content-layer[data-active="true"] {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transition:
      opacity var(--transition-normal),
      visibility 0s linear 0s;
  }

  .motion-settings-layer {
    overflow-y: auto;
  }

  :global(:root[data-motion-preference="reduce"]) .inspector-content-layer {
    transition-duration: 0ms, 0s;
  }

  /* PanelGroup owns the dock's structural motion. Keep Card settings composed
     at their destination width inside that moving viewport, so chip wrapping
     and vertical centering do not invent a second, accidental transition. */
  .viewer-and-export.desktop .export-panel-container.card-settings {
    display: flex;
    justify-content: flex-end;
    overflow: hidden;
  }

  .viewer-and-export.desktop
    .export-panel-container.card-settings
    :global(.export-panel:not(.inline)) {
    width: var(--export-sidebar-width);
    min-width: var(--export-sidebar-width);
    flex: 0 0 var(--export-sidebar-width);
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

  .viewer-and-export:not(.desktop).export-active
    .viewer-stage-container
    :global(.view-container) {
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
</style>
