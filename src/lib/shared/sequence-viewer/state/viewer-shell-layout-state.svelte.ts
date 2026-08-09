import type { DeviceDetector } from "$lib/shared/device/services/device-detector";
import type { ResponsiveSettings } from "$lib/shared/device/domain/models/device-models";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { ContentType } from "./viewer-state.svelte";
import type { OrchestratorContext } from "../components/SequenceViewerOrchestrator.svelte";
import { resolveExportSidebarMinWidth } from "../services/viewer-shell-model";

interface ViewerShellLayoutInputs {
  getContext: () => OrchestratorContext;
  getSequence: () => SequenceData;
  getIsMobile: () => boolean;
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
  let progressivePromotionScheduled = false;

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
  const isSidebarExportActive = $derived(
    isAnyExportActive && !isRecordSceneActive
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
  const showRail = $derived(!isMobile);
  const stackedExportWithRail = $derived(
    isSidebarExportActive && effectiveMobile && !isMobile
  );

  $effect(() => {
    void inputs.getSequence();
    exportSidebarCollapsed = false;
  });

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
    const ctx = inputs.getContext();
    ctx.ensureInteractiveServices();
    const previousMode = ctx.viewerState.viewerMode;
    ctx.viewerState.exitExport();
    ctx.viewerState.setSplitConfig({
      leftPane: "animation",
      rightPane: "card",
    });
    ctx.viewerState.setViewerMode("split");
    if (track) {
      dependencies.captureScanViewChanged(
        previousMode,
        "split",
        "mode_switcher"
      );
    }
  }

  function selectViewerMode(mode: ContentType, countIntent = true): void {
    const ctx = inputs.getContext();
    if (mode !== "card") ctx.ensureInteractiveServices();
    const previousMode = ctx.viewerState.viewerMode;
    if (mode === "animation") {
      ctx.viewerState.enterExport("animation-export", "animation");
    } else if (mode === "animation-3d") {
      ctx.viewerState.enterExport("animation-export", "animation-3d");
    } else if (mode === "card") {
      ctx.viewerState.enterExport("image-export");
    } else if (mode === "mandala" || mode === "tunnel") {
      ctx.viewerState.exitExport();
      ctx.viewerState.setViewerMode(mode);
    }
    dependencies.captureScanViewChanged(previousMode, mode, "mode_switcher", {
      count: countIntent,
    });
  }

  function playFromQr(): void {
    const ctx = inputs.getContext();
    const wasPlaying = ctx.isPlayingLocal;
    selectViewerMode("animation", false);
    if (!wasPlaying) ctx.handlePlaybackToggle();
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
