<script lang="ts">
  import { onMount, onDestroy, type Snippet } from "svelte";
  import { getAnimationPlaybackController } from "$lib/shared/animation-engine/get-animation-playback-controller";
  import { getSequenceAnimationOrchestrator } from "$lib/shared/animation-engine/get-sequence-animation-orchestrator";
  import { getLanSyncCoordinator } from "$lib/shared/lan-sync/get-lan-sync-coordinator";
  import { hydrateSequence as hydrateSequenceData } from "$lib/shared/sequence-viewer/services/sequence-data-provider";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { getSequenceMotionVisibility } from "$lib/shared/foundation/services/sequence-motion-profile";
  import type {
    OrchestratorContext,
    ViewMode,
  } from "../domain/viewer-orchestrator-context";
  import { SCENE_BPM_INTENT_KEY } from "$lib/features/scene-3d-collection/services/open-3d-scene";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import {
    generateViewerURL,
    encodePropForURL,
  } from "$lib/shared/navigation/services/sequence-encoder";
  import { createAnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { setAnimationPlaybackRef } from "$lib/shared/coordinators/animation-playback-ref.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import type { EffectType } from "$lib/shared/effects/domain/effects-config";
  import { createScene3DRenderState } from "$lib/shared/3d/scene-features/state/scene-3d-render-state.svelte";
  import { setScene3DRenderContext } from "$lib/shared/3d/scene-features/state/scene-3d-render-context";
  import { lanSyncState } from "$lib/shared/lan-sync/state/lan-sync-state.svelte";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { authDrawerState } from "$lib/shared/auth/state/auth-drawer-state.svelte";
  import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
  import { logShareAction } from "$lib/shared/analytics/services/posthog-activity-logger";
  import {
    getSettings,
    updateSettings,
  } from "$lib/shared/application/state/app-state.svelte";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { calculateThumbnailAspectRatio } from "$lib/shared/render/services/layout-calculator";
  import { loadViewMode } from "$lib/shared/sequence-viewer/services/sequence-modal-persistence";
  import { cellPreWarmer } from "$lib/shared/sequence-viewer/services/cell-pre-warmer";
  import { getScanCardCloudProbe } from "$lib/shared/sequence-viewer/scan-card-cloud-context";
  import { isViewerReadyToAutoplay } from "$lib/shared/sequence-viewer/services/viewer-autoplay-readiness";
  import { shouldAutoplayViewer } from "$lib/shared/sequence-viewer/services/viewer-autoplay-policy";
  import { shouldSequenceViewerDeferEscape } from "$lib/shared/sequence-viewer/domain/sequence-viewer-escape-ownership";
  import { createModalAccessibilityHelper } from "$lib/shared/sequence-viewer/services/modal-accessibility-helper.svelte";
  import { saveSequenceHandoff } from "$lib/shared/coordinators/sequence-handoff.svelte";
  import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
  import { createViewer3DState } from "$lib/shared/3d/state/viewer-3d-state.svelte";
  import { setViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import { viewportFits3D } from "$lib/shared/3d/capabilities/viewport-3d-gate.svelte";
  import { setViewerVisibilityContext } from "../context/viewer-visibility-context";

  import { createPlaybackController } from "./playback-controller.svelte";
  import { createExportCoordinator } from "./export-coordinator.svelte";
  import { createImageCompositionSync } from "./image-composition-sync.svelte";
  import { createAuthActionQueue } from "./auth-action-queue.svelte";
  import { createFullscreenController } from "../state/fullscreen-controller.svelte";
  import { createLibraryActionHandler } from "../state/library-action-handler.svelte";
  import {
    createViewerState,
    type ViewerMode,
  } from "../state/viewer-state.svelte";
  import { createPracticeViewPrefs } from "$lib/shared/sequence-viewer/state/practice-view-prefs.svelte";
  import { createViewerInteractiveServicesState } from "../state/viewer-interactive-services-state.svelte";
  import { createViewerPlaybackPresentationState } from "../state/viewer-playback-presentation-state.svelte";
  import { createViewerLanSyncState } from "../state/viewer-lan-sync-state.svelte";
  import { createViewerOrchestratorContextState } from "../state/viewer-orchestrator-context-state.svelte";
  import { createViewerEditModeState } from "../state/viewer-edit-mode-state.svelte";
  import { createViewer3DActivationState } from "../state/viewer-3d-activation-state.svelte";
  import { createViewerPropVisibilityState } from "../state/viewer-prop-visibility-state.svelte";
  import { createViewerDestinationActions } from "../services/viewer-destination-actions";
  import { createViewerShareActions } from "../services/viewer-share-actions";
  import {
    calculateSinglePlayDuration,
    hasSameResolvedCardLayout,
    resolveEditingPane,
    resolveExportType,
    resolveSceneBpmIntent,
  } from "../services/viewer-orchestrator-model";

  interface Props {
    sequence: SequenceData | null;
    isMobile: boolean;
    initialBpm?: number;
    initialStep?: number;
    initialViewMode?: ViewMode;
    onClose: () => void;
    onUrlParamChange?: (key: string, value: string) => void;
    /** Reports tempo changes made through viewer controls. Internal practice
     *  ramp changes stay private so hosts can persist deliberate choices. */
    onBpmChange?: (bpm: number) => void;
    blockClicks?: boolean;
    handPathMode?: boolean;
    /** Force the animation surface and request playback after assets settle. */
    playOnOpen?: boolean;
    /** Holds playback while a native launch surface covers the viewer. */
    playbackReleased?: boolean;
    forceGuest?: boolean;
    initialRenderMode?: "2d" | "3d";
    /** Initial shared-shell surface. Scan uses card so animation work stays out
     *  of the first visible frame; other hosts retain persisted mode. */
    initialViewerMode?: ViewerMode;
    /** Hold animation/LAN services until the host promotes away from card. */
    deferInteractiveStartup?: boolean;
    /** Fires once the card has settled all of its cells. Progressive hosts use
     *  this to reveal the full viewer without exposing placeholder frames. */
    onCardReady?: () => void;
    initialBlueVisible?: boolean;
    initialRedVisible?: boolean;
    /** Effect to activate on mount (e.g. "trails" for the QR scan landing page).
     *  Defaults to the stored/none config when omitted. */
    initialActiveEffect?: EffectType;
    /** Replay handler for the gated download action (/q scan funnel): runs the
     *  page's export once the guest finishes signing in. Receives the live ctx
     *  because the export needs the playback controller + export options. */
    onGatedDownload?: (ctx: OrchestratorContext) => void;
    children: Snippet<[OrchestratorContext]>;
  }

  let {
    sequence,
    isMobile,
    initialBpm = 60,
    initialStep = 0,
    initialViewMode,
    onClose,
    onUrlParamChange,
    onBpmChange,
    blockClicks = false,
    handPathMode = false,
    playOnOpen = false,
    playbackReleased = true,
    forceGuest = false,
    initialRenderMode,
    initialViewerMode,
    deferInteractiveStartup = false,
    onCardReady,
    initialBlueVisible,
    initialRedVisible,
    initialActiveEffect,
    onGatedDownload,
    children,
  }: Props = $props();

  const modalAnimationState = createAnimationPanelState();

  const playback = createPlaybackController({
    modalAnimationState,
    initialBpm: 60,
    initialStep: 0,
  });

  // One-shot tempo seed from "open saved 3D scene" (consumed at init so the
  // initialBpm effect below can't overwrite it afterwards).
  const _sceneBpmIntent: number | null = (() => {
    try {
      const raw = sessionStorage.getItem(SCENE_BPM_INTENT_KEY);
      sessionStorage.removeItem(SCENE_BPM_INTENT_KEY);
      return resolveSceneBpmIntent(raw);
    } catch {
      return null;
    }
  })();

  $effect.pre(() => {
    playback.currentStepLocal = initialStep;
    playback.bpmLocal = _sceneBpmIntent ?? initialBpm;
  });

  const viewer3DState = createViewer3DState();
  setViewer3DContext(viewer3DState);

  const accessibilityHelper = createModalAccessibilityHelper();

  const exportCoord = createExportCoordinator({
    viewer3DState,
    accessibilityHelper,
  });
  let resolvedCardAutoLayout = $state<
    | import("$lib/shared/render/services/container-aware-layout").ResolvedAutoLayout
    | null
  >(null);

  function setResolvedCardAutoLayout(
    layout:
      | import("$lib/shared/render/services/container-aware-layout").ResolvedAutoLayout
      | null
  ): void {
    if (hasSameResolvedCardLayout(resolvedCardAutoLayout, layout)) return;
    resolvedCardAutoLayout = layout;
  }

  const imgComp = createImageCompositionSync();

  const authQueue = createAuthActionQueue();

  $effect(() => {
    playback.setOnUrlParamChange(onUrlParamChange);
  });

  let viewMode = $state<ViewMode>(playOnOpen ? "animation" : loadViewMode());
  $effect.pre(() => {
    if (playOnOpen) {
      viewMode = "animation";
    } else if (initialViewMode) {
      viewMode = initialViewMode;
    }
  });

  const viewerState = createViewerState();
  if (initialViewerMode) {
    viewerState.setViewerMode(initialViewerMode);
    viewerState.setExportContext(null);
  }
  if (playOnOpen) {
    viewerState.enterExport("animation-export", "animation");
  }
  const practiceViewPrefs = createPracticeViewPrefs();
  playback.setPracticeViewPrefs(practiceViewPrefs);

  if (viewer3DState.renderMode === "3d" && !viewerState.wants3D) {
    viewerState.setSplitPaneContent("left", "animation-3d");
  }

  const editingPane = $derived.by(
    () => resolveEditingPane(viewerState.viewerMode, viewerState.exportContext)
  );

  const exportType = $derived(resolveExportType(editingPane));

  let cellsLoaded = $state(0);
  let totalCells = $state(0);
  let cardReady = $state(false);
  let cardReadyNotified = false;
  const cloudBackedScan = getScanCardCloudProbe();

  const interactive = createViewerInteractiveServicesState(
    {
      modalAnimationState,
      playback,
      viewerState,
      cloudBackedScan,
      getCellsLoaded: () => cellsLoaded,
      getTotalCells: () => totalCells,
      getViewMode: () => viewMode,
      getPlaybackReleased: () => playbackReleased,
    },
    {
      getAnimationPlaybackController,
      getHapticFeedback,
      getLanSyncCoordinator,
      initializeLanSync: (coordinator) => lanSyncState.initialize(coordinator),
      hydrateSequence: hydrateSequenceData,
      preWarmSequence: (loadedSequence, priority) =>
        cellPreWarmer.preWarmSequence(loadedSequence, priority),
      setAnimationPlaybackRef,
      isViewerReadyToAutoplay,
      shouldAutoplayViewer,
      getSettings,
    }
  );

  $effect(() => {
    // Reading the reactive getters keeps the effect attached when services
    // arrive after a native transition has already started.
    void playback.isPlayingLocal;
    void interactive.playbackController;
    interactive.syncPlaybackRelease(playbackReleased);
  });
  const presentation = createViewerPlaybackPresentationState({
    modalAnimationState,
    playback,
  });
  const fullscreen = createFullscreenController({
    getHapticService: () => interactive.hapticService,
    announce: (msg, priority) => accessibilityHelper.announce(msg, priority),
  });
  const viewerLanSync = createViewerLanSyncState(
    {
      playback,
      accessibilityHelper,
      getSequence: () => sequence,
      getPlaybackController: () => interactive.playbackController,
      getHapticService: () => interactive.hapticService,
    },
    {
      getPlaybackState: () => lanSyncState.playbackState,
      getIsConnected: () => lanSyncState.isConnected,
      getIsActive: () => lanSyncState.isActive,
      setLocalSequence: (value) => lanSyncState.setLocalSequence(value),
      toggleSync: (sequenceId, sequenceWord, state) =>
        lanSyncState.toggleSync(sequenceId, sequenceWord, state),
      disconnect: () => lanSyncState.disconnect(),
    }
  );

  function handleRenderProgress(loaded: number, total: number) {
    cellsLoaded = loaded;
    totalCells = total;
    const ready = total > 0 && loaded >= total;
    cardReady = ready;
    if (ready && !cardReadyNotified) {
      cardReadyNotified = true;
      queueMicrotask(() => onCardReady?.());
    }
  }

  const propVisibility = createViewerPropVisibilityState(
    {
      imageComposition: imgComp,
      getSequence: () => sequence,
      getHandPathMode: () => handPathMode,
      getInitialBlueVisible: () => initialBlueVisible,
      getInitialRedVisible: () => initialRedVisible,
      getAnimationServicesReady: () => interactive.animationServicesReady,
      getHapticService: () => interactive.hapticService,
      onUrlParamChange,
    },
    {
      getSettings,
      updateSettings,
      getSequenceMotionVisibility,
      updateAnimationPropTypes: (bluePropType, redPropType) =>
        getSequenceAnimationOrchestrator().updatePropTypes(
          bluePropType,
          redPropType
        ),
      setAnimationDarkMode: (darkMode) =>
        getAnimationVisibilityManager().setDarkMode(darkMode),
      encodePropForUrl: encodePropForURL,
    }
  );
  const viewerVisibility = propVisibility.viewerVisibility;
  setViewerVisibilityContext(viewerVisibility);

  const effectsConfigState = createEffectsConfigState();
  setEffectsConfigContext(effectsConfigState);
  // Activate a requested effect on mount (QR scan page asks for "trails").
  // setActiveEffect keeps tipEffectMap in sync so the renderer doesn't filter tips.
  if (initialActiveEffect)
    effectsConfigState.setActiveEffect(initialActiveEffect);

  const scene3DRenderState = createScene3DRenderState();
  setScene3DRenderContext(scene3DRenderState);

  const effectiveSequence = $derived(
    modalAnimationState.sequenceData ?? sequence
  );

  const singlePlayDuration = $derived(
    calculateSinglePlayDuration(effectiveSequence, playback.bpmLocal)
  );

  const isOwned = $derived(
    !!sequence?.ownerId &&
      !!authState.user?.uid &&
      sequence.ownerId === authState.user.uid
  );

  const libraryActions = createLibraryActionHandler({
    getSequence: () => sequence,
    getIsOwned: () => isOwned,
    getBluePropType: () => getSettings().bluePropType,
    getRedPropType: () => getSettings().redPropType,
    getCatDogModeEnabled: () => getSettings().catDogMode,
    getHapticService: () => interactive.hapticService,
    onDeleteSuccess: () => handleClose(),
  });

  const isPublished = $derived(
    (sequence as LibrarySequence | null)?.visibility === "public"
  );

  $effect(() => {
    libraryActions.syncSavedState(sequence);
  });
  $effect(() => {
    libraryActions.syncFavoriteState(sequence);
  });

  const previewAspectRatio = $derived.by(() => {
    if (!sequence?.steps?.length) return 1;
    const stepCount = sequence.steps.length;
    return calculateThumbnailAspectRatio(stepCount, {
      includeStartPosition: imgComp.imgShowStartPos,
      hasHeader: imgComp.imgShowWord,
      hasFooter: imgComp.imgShowNotes,
    });
  });

  const fullscreenStackVertical = $derived(previewAspectRatio > 1.3);

  createViewer3DActivationState(
    {
      viewer3DState,
      viewerState,
      getSequence: () => sequence,
      getInitialRenderMode: () => initialRenderMode,
      onUrlParamChange,
    },
    {
      setPathShape: (pathShape) =>
        getAnimationVisibilityManager().setPathShape(pathShape),
      viewportFits3D,
    }
  );

  const editMode = createViewerEditModeState({
    viewerState,
    playback,
    interactive,
    exportCoordinator: exportCoord,
    modalAnimationState,
    accessibilityHelper,
    getEditingPane: () => editingPane,
    getEffectiveSequence: () => effectiveSequence,
    getIsHandPath: () => propVisibility.isHandPath,
    getResolvedCardAutoLayout: () => resolvedCardAutoLayout,
  });

  let keydownCleanup: (() => void) | null = null;
  let imageCompositionCleanup: (() => void) | null = null;

  onMount(() => {
    authQueue.bootstrapFromUrl();

    window.addEventListener("keydown", handleKeydown, { capture: true });
    keydownCleanup = () =>
      window.removeEventListener("keydown", handleKeydown, { capture: true });

    imageCompositionCleanup = imgComp.registerObserver();

    playback.registerVisibilityObserver();

    if (!deferInteractiveStartup) interactive.ensureInteractiveServices();
  });

  onDestroy(() => {
    interactive.clearAutoplayTimer();
    playback.stopPracticeIfActive();
    keydownCleanup?.();
    imageCompositionCleanup?.();
    playback.dispose();
    modalAnimationState.dispose();
    exportCoord.dispose();
    viewer3DState.dispose();
    fullscreen.clearControlsTimeout();
  });

  $effect(() => {
    if (
      sequence &&
      interactive.animationServicesReady &&
      interactive.playbackController
    ) {
      void interactive.initializeAnimation(sequence);
    }
  });

  $effect(() => {
    void lanSyncState.playbackState.timestamp;
    void lanSyncState.isConnected;
    viewerLanSync.applyRemotePlayback();
  });

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      // A focused menu, popover, input, or browser-fullscreen surface owns the
      // first Escape press. Closing the viewer here would skip that local
      // dismissal and unexpectedly navigate away from the sequence.
      if (shouldSequenceViewerDeferEscape(event)) return;

      // Modal and drawer layers are registered on the same window event. Let
      // those handlers claim Escape before the viewer applies its fallback.
      queueMicrotask(() => {
        if (event.defaultPrevented) return;

        if (fullscreen.isFullscreen) {
          fullscreen.exitFullscreen();
        } else {
          handleClose();
        }
      });
      return;
    }

    if (event.key === " " || event.code === "Space") {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      interactive.playbackController?.togglePlayback();
      return;
    }
  }

  function handleClose() {
    playback.stopPracticeIfActive();

    if (playback.isPlayingLocal && interactive.playbackController) {
      interactive.playbackController.togglePlayback();
    }
    setAnimationPlaybackRef(null);

    viewerLanSync.disconnect();

    accessibilityHelper.restoreFocus();
    onClose();
  }

  const destinationActions = createViewerDestinationActions(
    {
      playback,
      interactive,
      getSequence: () => sequence,
      getIsAuthenticated: () => authState.isAuthenticated,
      onClose: handleClose,
      enterVideoUpload: () => editMode.enterEditMode("video-upload"),
    },
    {
      saveSequenceHandoff,
      navigate: goto,
      showToast,
      showAuth: (mode, trigger) => authDrawerState.show(mode, trigger),
      savePendingEditSequence: (editSequence) =>
        localStorage.setItem(
          "tka-pending-edit-sequence",
          JSON.stringify(editSequence)
        ),
      openCreateConstruct: () => handleModuleChange("create", "construct"),
      getReturnPath: () =>
        browser ? window.location.pathname : "/browse/gallery",
    }
  );
  const shareActions = createViewerShareActions(
    {
      getSequence: () => sequence,
      getBpm: () => playback.bpmLocal,
      getDarkMode: () => imgComp.imgDarkMode,
      getHapticService: () => interactive.hapticService,
    },
    {
      getCurrentUrl: () => (browser ? window.location.href : ""),
      buildUrl: (shareSequence, metadata) =>
        generateViewerURL(shareSequence, {
          compress: true,
          metadata,
        }).url,
      getNavigator: () =>
        typeof navigator === "undefined" ? null : navigator,
      setLocation: (url) => {
        window.location.href = url;
      },
      openWindow: (url) => {
        window.open(url, "_blank");
      },
      showToast,
      logShareAction,
    }
  );

  function handleBpmChange(bpm: number): void {
    playback.handleBpmChange(bpm);
    onBpmChange?.(bpm);
  }

  function handleStepClick(stepIndex: number): void {
    playback.handleStepClick(stepIndex, blockClicks, editingPane);
  }

  function preparePracticeView(): void {
    if (viewerState.viewerMode === "split") return;
    viewerState.exitExport();
    viewerState.setSplitConfig({
      leftPane: "animation",
      rightPane: "card",
    });
    viewerState.setViewerMode("split");
  }

  function handlePracticeStart(): void {
    preparePracticeView();
    playback.handlePracticeStart();
  }

  function enterPracticeMode(): void {
    preparePracticeView();
    playback.enterPracticeMode();
  }

  const contextState = createViewerOrchestratorContextState({
    modalAnimationState,
    playback,
    presentation,
    interactive,
    lanSync: viewerLanSync,
    fullscreen,
    exportCoordinator: exportCoord,
    imageComposition: imgComp,
    libraryActions,
    practiceViewPrefs,
    viewerState,
    viewerVisibility,
    viewer3DState,
    handlers: {
      setResolvedCardAutoLayout,
      onRenderProgress: handleRenderProgress,
      handlePropTypeChange: propVisibility.handlePropTypeChange,
      enterEditMode: editMode.enterEditMode,
      exitEditMode: editMode.exitEditMode,
      handleExport: editMode.handleExport,
      handleArtExport: editMode.handleArtExport,
      handleOpenInCompose: destinationActions.handleOpenInCompose,
      handleEdit: destinationActions.handleEdit,
      handleVideoUpload: destinationActions.handleVideoUpload,
      handleShare: shareActions.handleShare,
      handleCopyLink: shareActions.handleCopyLink,
      getShareUrl: shareActions.getShareUrl,
      handleOpenInBrowser: shareActions.handleOpenInBrowser,
      invokeGatedAction: (type, realHandler) =>
        authQueue.invokeGatedAction(type, realHandler, sequence),
      openSignInPrompt: () => authQueue.openSignInSheet("account"),
      handleUnifiedDarkModeToggle:
        propVisibility.handleUnifiedDarkModeToggle,
      handlePracticeStart,
      enterPracticeMode,
      handleBpmChange,
      handleStepClick,
      handleClose,
    },
    getSequence: () => sequence,
    getEffectiveSequence: () => effectiveSequence,
    getViewMode: () => viewMode,
    getIsMobile: () => isMobile,
    getFullscreenStackVertical: () => fullscreenStackVertical,
    getEditingPane: () => editingPane,
    getExportType: () => exportType,
    getSinglePlayDuration: () => singlePlayDuration,
    getCardReady: () => cardReady,
    getResolvedCardAutoLayout: () => resolvedCardAutoLayout,
    getIsHandPath: () => propVisibility.isHandPath,
    getBluePropType: () => propVisibility.activeBlueProp,
    getRedPropType: () => propVisibility.activeRedProp,
    getCatDogModeEnabled: () => propVisibility.activeCatDog,
    getIsLoggedIn: () => (forceGuest ? false : authState.isAuthenticated),
    getIsOwned: () => isOwned,
    getIsPublished: () => isPublished,
  });

  $effect(() => {
    authQueue.replayPendingAction({
      handleSave: libraryActions.handleSave,
      handleFavoriteToggle: libraryActions.handleFavoriteToggle,
      handlePublishAction: libraryActions.handlePublishAction,
      handleEdit: destinationActions.handleEdit,
      handleShare: shareActions.handleShare,
      handleDownload: () => onGatedDownload?.(contextState.value),
      handleOpenInBrowser: shareActions.handleOpenInBrowser,
    });
  });
</script>

{@render children(contextState.value)}

<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
  {accessibilityHelper.announcement}
</div>

<!-- The one shared auth surface. AuthModal owns every provider flow (Google,
     Facebook, email/password, magic link) and renders its own contextual copy
     from the `viewer-signin-*` trigger keys, so the viewer holds no auth copy
     or provider code of its own. Lazy so the scan landing doesn't pay for the
     auth bundle until a guest actually hits a gate. AuthModal mounts its own
     GoogleOneTap, which is why the viewer no longer mounts a second one. -->
{#if authQueue.signInSheetOpen}
  {#await import("$lib/shared/auth/components/AuthModal.svelte") then mod}
    <mod.default
      open={authQueue.signInSheetOpen}
      reason={authQueue.signInTrigger}
      onClose={() => authQueue.closeSignInSheet()}
    />
  {/await}
{/if}

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
