import type { DeviceDetector } from "$lib/shared/device/services/device-detector";
import type { ResponsiveSettings } from "$lib/shared/device/domain/models/device-models";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { ResolvedAutoLayout } from "$lib/shared/render/services/container-aware-layout";
import type { ContentType } from "./viewer-state.svelte";
import type { SelectableViewerMode } from "../services/viewer-modes";
import type { OrchestratorContext } from "../domain/viewer-orchestrator-context";
import { resolveExportSidebarMinWidth } from "../services/viewer-shell-model";
import { withViewerModeDissolve } from "$lib/shared/transitions/viewer-mode-dissolve";
import { motionDuration } from "$lib/shared/transitions/motion";
import { DURATION, STAGGER } from "$lib/shared/transitions/transitions";
import { MIN_VIEWER_PANE_REVEAL_SIZE } from "../components/viewer-panel-layout";

interface ViewerShellLayoutInputs {
  getContext: () => OrchestratorContext;
  getSequence: () => SequenceData;
  getIsMobile: () => boolean;
  getWorkspaceElement: () => HTMLElement | null;
  startInSplit: boolean;
  startInCardThenSplit: boolean;
}

interface ViewerShellLayoutDependencies {
  getDeviceDetector: () => DeviceDetector;
  captureScanSettingChanged: typeof import("$lib/shared/analytics/scan-analytics").captureScanSettingChanged;
  captureScanViewChanged: typeof import("$lib/shared/analytics/scan-analytics").captureScanViewChanged;
  captureScanViewerOpened: typeof import("$lib/shared/analytics/scan-analytics").captureScanViewerOpened;
  captureScanPlaybackChanged: typeof import("$lib/shared/analytics/scan-analytics").captureScanPlaybackChanged;
}

export function createViewerShellLayoutState(
  inputs: ViewerShellLayoutInputs,
  dependencies: ViewerShellLayoutDependencies
) {
  let prefersReducedMotion = $state(false);
  let bodyWidth = $state(typeof window !== "undefined" ? window.innerWidth : 0);
  let responsiveSettings = $state<ResponsiveSettings | null>(null);
  let exportSidebarCollapsed = $state(false);
  let cardAutoLayoutOverride = $state<ResolvedAutoLayout | null>(null);
  let lastReadableCardAutoLayout: ResolvedAutoLayout | null = null;
  let cardAutoLayoutReleaseTimer: ReturnType<typeof setTimeout> | undefined;
  let cardAutoLayoutReleaseFrame = 0;
  let cardAutoLayoutReleaseSettleFrame = 0;
  let cardAutoLayoutReleaseVersion = 0;
  let cardContainSizeMotion = $state<"focus" | "return" | null>(null);
  let cardContainSizeMotionTimer: ReturnType<typeof setTimeout> | undefined;
  let cardLayoutSequenceKey = "";
  let progressivePromotionScheduled = false;
  let splitModePromotionTimer: ReturnType<typeof setTimeout> | undefined;
  let splitModePromotionVersion = 0;

  const isMobile = $derived(inputs.getIsMobile());
  const isLandscape = $derived(responsiveSettings?.isLandscapeMobile ?? false);
  const compactChrome = $derived(isMobile || bodyWidth < 1080);

  const isVideoExportActive = $derived(
    inputs.getContext().editingPane === "animation"
  );
  const isImageExportActive = $derived(
    inputs.getContext().editingPane === "image"
  );
  const isVideoUploadActive = $derived(
    inputs.getContext().editingPane === "video-upload"
  );
  const isAnyExportActive = $derived(inputs.getContext().editingPane !== null);
  const isRecordSceneActive = $derived(
    isVideoExportActive &&
      inputs.getContext().renderMode === "3d" &&
      !inputs.getContext().previewBlobUrl
  );
  // Uploading a performance no longer occupies the sidebar - SequenceVideos
  // owns the uploader inside the viewer body - so it does not take the export
  // layout with it.
  const isSidebarExportActive = $derived(
    isAnyExportActive && !isRecordSceneActive && !isVideoUploadActive
  );
  const isArtInspectorActive = $derived(
    inputs.getContext().viewerState.viewerMode === "mandala" ||
      inputs.getContext().viewerState.viewerMode === "tunnel"
  );
  const showVideoGallery = $derived(
    inputs.getContext().viewerState.viewerMode === "videos" &&
      !isSidebarExportActive
  );
  // Post Studio takes the whole viewer body, the same way the video gallery
  // does. It owns its own export, so an export sidebar alongside it would be
  // two render buttons for two different files.
  const showPostStudio = $derived(
    inputs.getContext().viewerState.viewerMode === "post-studio" &&
      !isSidebarExportActive
  );

  const exportSidebarMinWidth = $derived.by(() => {
    let persistedRailWidth: string | null = null;
    try {
      persistedRailWidth = localStorage.getItem("tka-viewer-rail-width");
    } catch {
      // Private browsing and locked-down embeds can deny storage. The default
      // rail width keeps the preview usable without persistence.
    }
    return resolveExportSidebarMinWidth(persistedRailWidth);
  });

  const cardExportNarrow = $derived(
    isImageExportActive && !isMobile && bodyWidth < exportSidebarMinWidth
  );
  const videoExportNarrow = $derived(
    isVideoExportActive &&
      !isRecordSceneActive &&
      !isMobile &&
      bodyWidth < exportSidebarMinWidth
  );
  const effectiveMobile = $derived(
    isMobile || cardExportNarrow || videoExportNarrow
  );
  const isWorkspaceInspectorActive = $derived(
    isSidebarExportActive || (isArtInspectorActive && !effectiveMobile)
  );
  const showRail = $derived(!isMobile);
  const stackedExportWithRail = $derived(
    isSidebarExportActive && effectiveMobile && !isMobile
  );

  $effect(() => {
    void inputs.getSequence();
    exportSidebarCollapsed = false;
  });

  $effect(() => {
    const sequence = inputs.getSequence();
    // Focus/export modes can wrap the same sequence in a fresh object. Only
    // invalidate the lease when inputs that can alter the Auto grid change.
    const nextKey = `${sequence.id ?? ""}:${sequence.steps
      .map((step) => step.duration ?? 1)
      .join(",")}`;
    if (nextKey === cardLayoutSequenceKey) return;
    cardLayoutSequenceKey = nextKey;
    cardAutoLayoutOverride = null;
    lastReadableCardAutoLayout = null;
    cancelCardAutoLayoutRelease();
  });

  function cancelCardAutoLayoutRelease(): void {
    cardAutoLayoutReleaseVersion += 1;
    if (cardAutoLayoutReleaseTimer !== undefined) {
      clearTimeout(cardAutoLayoutReleaseTimer);
      cardAutoLayoutReleaseTimer = undefined;
    }
    if (cardAutoLayoutReleaseFrame) {
      cancelAnimationFrame(cardAutoLayoutReleaseFrame);
      cardAutoLayoutReleaseFrame = 0;
    }
    if (cardAutoLayoutReleaseSettleFrame) {
      cancelAnimationFrame(cardAutoLayoutReleaseSettleFrame);
      cardAutoLayoutReleaseSettleFrame = 0;
    }
  }

  function cancelSplitModePromotion(): void {
    splitModePromotionVersion += 1;
    if (splitModePromotionTimer !== undefined) {
      clearTimeout(splitModePromotionTimer);
      splitModePromotionTimer = undefined;
    }
  }

  function startCardContainSizeMotion(
    phase: "focus" | "return",
    leadDuration = 0
  ): void {
    if (cardContainSizeMotionTimer !== undefined) {
      clearTimeout(cardContainSizeMotionTimer);
      cardContainSizeMotionTimer = undefined;
    }

    const spatialDuration = motionDuration(
      DURATION.emphasis + DURATION.normal + leadDuration
    );
    // Reduced motion replaces the resize with a snapshot dissolve, but the
    // Card's internal cells still need to stay pinned until that dissolve and
    // its final ResizeObserver paints are complete.
    const lifetime =
      spatialDuration > 0 ? spatialDuration : DURATION.normal + STAGGER.normal;
    cardContainSizeMotion = phase;

    cardContainSizeMotionTimer = setTimeout(() => {
      cardContainSizeMotionTimer = undefined;
      cardContainSizeMotion = null;
    }, lifetime);
  }

  function leaseCardAutoLayout(): void {
    cancelCardAutoLayoutRelease();
    const resolved = lastReadableCardAutoLayout;
    if (resolved?.stepCount === inputs.getSequence().steps.length) {
      cardAutoLayoutOverride = { ...resolved };
    }
  }

  function rememberReadableCardAutoLayout(
    layout: ResolvedAutoLayout | null,
    width: number,
    height: number
  ): void {
    if (
      !layout ||
      layout.stepCount !== inputs.getSequence().steps.length ||
      width < MIN_VIEWER_PANE_REVEAL_SIZE ||
      height < MIN_VIEWER_PANE_REVEAL_SIZE
    ) {
      return;
    }

    lastReadableCardAutoLayout = { ...layout };
  }

  function releaseCardAutoLayoutAfterWorkspaceMotion(
    transition: ViewTransition | null,
    leadDuration = 0
  ): void {
    cancelCardAutoLayoutRelease();
    const releaseVersion = cardAutoLayoutReleaseVersion;
    const releaseAfterSettledPaints = () => {
      if (releaseVersion !== cardAutoLayoutReleaseVersion) return;
      // ResizeObserver publishes the final split dimensions after layout. Give
      // it two paints so releasing the override cannot expose the focused
      // Card's stale measurement for a single 5×2 frame.
      cardAutoLayoutReleaseFrame = requestAnimationFrame(() => {
        cardAutoLayoutReleaseFrame = 0;
        cardAutoLayoutReleaseSettleFrame = requestAnimationFrame(() => {
          cardAutoLayoutReleaseSettleFrame = 0;
          if (releaseVersion !== cardAutoLayoutReleaseVersion) return;
          cardAutoLayoutOverride = null;
        });
      });
    };

    if (transition) {
      void transition.finished.catch(() => {}).then(releaseAfterSettledPaints);
      return;
    }

    cardAutoLayoutReleaseTimer = setTimeout(() => {
      cardAutoLayoutReleaseTimer = undefined;
      releaseAfterSettledPaints();
    }, DURATION.emphasis + leadDuration);
  }

  function enterSplitMode(
    ctx: OrchestratorContext,
    previousMode: string,
    track: boolean
  ): number {
    const closeInspector = () => {
      // A person leaving Card should get the playback state they arrived with.
      // Startup promotion is different: it has no prior viewing session to
      // restore and should not announce that an export was closed.
      if (track && ctx.editingPane === "image") ctx.exitEditMode();
      else ctx.viewerState.exitExport();
    };
    const revealSplit = () => {
      if (previousMode === "card") {
        startCardContainSizeMotion("return");
      }
      ctx.viewerState.setSplitConfig({
        leftPane: "animation",
        rightPane: "card",
      });
      ctx.viewerState.setViewerMode("split");
    };

    const leadDuration =
      previousMode === "card" || previousMode === "animation"
        ? motionDuration(STAGGER.normal)
        : 0;
    closeInspector();
    if (leadDuration === 0) {
      revealSplit();
      return 0;
    }

    cancelSplitModePromotion();
    const promotionVersion = splitModePromotionVersion;
    splitModePromotionTimer = setTimeout(() => {
      splitModePromotionTimer = undefined;
      if (promotionVersion !== splitModePromotionVersion) return;
      revealSplit();
    }, leadDuration);
    return leadDuration;
  }

  $effect(() => {
    const ctx = inputs.getContext();
    if (
      !inputs.startInCardThenSplit ||
      progressivePromotionScheduled ||
      !ctx.cardReady
    ) {
      return;
    }

    progressivePromotionScheduled = true;
    let secondFrame = 0;
    let promotionTimer: ReturnType<typeof setTimeout> | undefined;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        // The card receives its stable painted frame before animation services
        // activate and Side-by-Side replaces the first impression.
        promotionTimer = setTimeout(() => selectSplitMode(false), 0);
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      if (promotionTimer !== undefined) clearTimeout(promotionTimer);
    };
  });

  function mount(): () => void {
    const cleanups: Array<() => void> = [];
    const mediaQuery = matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion = mediaQuery.matches;
    const onReduceChange = () => (prefersReducedMotion = mediaQuery.matches);
    mediaQuery.addEventListener("change", onReduceChange);
    cleanups.push(() =>
      mediaQuery.removeEventListener("change", onReduceChange)
    );

    try {
      const deviceDetector = dependencies.getDeviceDetector();
      responsiveSettings = deviceDetector.getResponsiveSettings();
      cleanups.push(
        deviceDetector.onCapabilitiesChanged(() => {
          responsiveSettings = deviceDetector.getResponsiveSettings();
        })
      );
    } catch (error) {
      console.warn(
        "SequenceViewerShell: Failed to resolve DeviceDetector",
        error
      );
    }

    const ctx = inputs.getContext();
    if (inputs.startInCardThenSplit) {
      dependencies.captureScanViewerOpened("card");
    } else if (inputs.startInSplit) {
      queueMicrotask(() => {
        selectSplitMode(false);
        dependencies.captureScanViewerOpened("split");
      });
    } else {
      dependencies.captureScanViewerOpened(ctx.viewerState.viewerMode);
    }

    return () => {
      cancelCardAutoLayoutRelease();
      cancelSplitModePromotion();
      if (cardContainSizeMotionTimer !== undefined) {
        clearTimeout(cardContainSizeMotionTimer);
      }
      for (const cleanup of cleanups) cleanup();
    };
  }

  function toggleExportSidebar(): void {
    const previous = !exportSidebarCollapsed;
    exportSidebarCollapsed = !exportSidebarCollapsed;
    dependencies.captureScanSettingChanged({
      group: "export",
      setting: "settings_visible",
      previous_value: previous,
      value: !exportSidebarCollapsed,
      source: "header",
    });
  }

  function selectSplitMode(track = true): void {
    cancelSplitModePromotion();
    const ctx = inputs.getContext();
    ctx.ensureInteractiveServices();
    const previousMode = ctx.viewerState.viewerMode;
    if (
      (previousMode === "card" || previousMode === "animation") &&
      !cardAutoLayoutOverride
    ) {
      leaseCardAutoLayout();
    }
    let leadDuration = 0;
    const transition = withViewerModeDissolve(
      inputs.getWorkspaceElement(),
      previousMode,
      "split",
      () => {
        leadDuration = enterSplitMode(ctx, previousMode, track);
      }
    );
    if (previousMode === "card" || previousMode === "animation") {
      releaseCardAutoLayoutAfterWorkspaceMotion(transition, leadDuration);
    }
    if (track) {
      dependencies.captureScanViewChanged(
        previousMode,
        "split",
        "mode_switcher"
      );
    }
  }

  function selectViewerMode(
    mode: SelectableViewerMode,
    countIntent = true
  ): void {
    cancelSplitModePromotion();
    const ctx = inputs.getContext();
    const previousMode = ctx.viewerState.viewerMode;
    if (previousMode === mode) return;
    if (previousMode === "split" && mode === "card") {
      startCardContainSizeMotion("focus");
    }
    if (mode !== "card") ctx.ensureInteractiveServices();
    if (mode === "card") {
      leaseCardAutoLayout();
    } else if (previousMode === "split" && mode === "animation") {
      // The covered Card still owns the last readable Side-by-Side shape.
      // Holding it across the 2D visit prevents an interrupted return from
      // publishing a pencil-thin Auto grid before Card focus takes over.
      leaseCardAutoLayout();
    } else if (previousMode === "card" && !cardAutoLayoutOverride) {
      leaseCardAutoLayout();
    }

    const transition = withViewerModeDissolve(
      inputs.getWorkspaceElement(),
      previousMode,
      mode,
      () => {
        if (mode === "animation") {
          if (ctx.editingPane === "image") ctx.exitEditMode();
          ctx.viewerState.enterExport("animation-export", "animation");
        } else if (mode === "animation-3d") {
          if (ctx.editingPane === "image") ctx.exitEditMode();
          ctx.viewerState.enterExport("animation-export", "animation-3d");
        } else if (mode === "card") {
          ctx.enterEditMode("image");
        } else if (mode === "videos") {
          // Video is a gallery view. Close a previous export inspector before
          // showing it so the gallery, rather than the old inspector, owns the
          // viewer body.
          if (ctx.editingPane) ctx.exitEditMode();
          else ctx.viewerState.exitExport();
          ctx.viewerState.setViewerMode(mode);
        } else if (mode === "mandala" || mode === "tunnel") {
          if (ctx.editingPane === "image") ctx.exitEditMode();
          else ctx.viewerState.exitExport();
          ctx.viewerState.setViewerMode(mode);
        } else if (mode === "post-studio") {
          // Same shape as the gallery: the studio owns the whole viewer body and
          // its own render, so any open inspector has to close before it appears.
          if (ctx.editingPane) ctx.exitEditMode();
          else ctx.viewerState.exitExport();
          ctx.viewerState.setViewerMode(mode);
        }
      }
    );
    if (previousMode === "card" && mode !== "card") {
      releaseCardAutoLayoutAfterWorkspaceMotion(transition);
    }
    dependencies.captureScanViewChanged(previousMode, mode, "mode_switcher", {
      count: countIntent,
    });
  }

  function playFromQr(): void {
    const ctx = inputs.getContext();
    const wasPlaying = ctx.isPlayingLocal;
    selectViewerMode("animation", false);
    if (!inputs.getContext().isPlayingLocal) ctx.handlePlaybackToggle();
    dependencies.captureScanPlaybackChanged({
      action: "qr_play",
      previous_value: wasPlaying,
      value: true,
      source: "card_qr_badge",
      bpm: ctx.bpmLocal,
    });
  }

  return {
    get prefersReducedMotion() {
      return prefersReducedMotion;
    },
    get bodyWidth() {
      return bodyWidth;
    },
    set bodyWidth(value: number) {
      bodyWidth = value;
    },
    get isLandscape() {
      return isLandscape;
    },
    get compactChrome() {
      return compactChrome;
    },
    get exportSidebarCollapsed() {
      return exportSidebarCollapsed;
    },
    get cardAutoLayoutOverride() {
      return cardAutoLayoutOverride;
    },
    get cardContainSizeMotion() {
      return cardContainSizeMotion;
    },
    rememberReadableCardAutoLayout,
    get isVideoExportActive() {
      return isVideoExportActive;
    },
    get isImageExportActive() {
      return isImageExportActive;
    },
    get isVideoUploadActive() {
      return isVideoUploadActive;
    },
    get isAnyExportActive() {
      return isAnyExportActive;
    },
    get isRecordSceneActive() {
      return isRecordSceneActive;
    },
    get isSidebarExportActive() {
      return isSidebarExportActive;
    },
    get isArtInspectorActive() {
      return isArtInspectorActive;
    },
    get isWorkspaceInspectorActive() {
      return isWorkspaceInspectorActive;
    },
    get showVideoGallery() {
      return showVideoGallery;
    },
    get showPostStudio() {
      return showPostStudio;
    },
    get effectiveMobile() {
      return effectiveMobile;
    },
    get showRail() {
      return showRail;
    },
    get stackedExportWithRail() {
      return stackedExportWithRail;
    },
    mount,
    toggleExportSidebar,
    selectSplitMode,
    selectViewerMode,
    playFromQr,
  };
}
