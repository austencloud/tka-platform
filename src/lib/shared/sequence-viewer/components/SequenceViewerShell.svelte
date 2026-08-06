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
  import { onDestroy, onMount } from "svelte";
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
  import ExportTakeover from "$lib/shared/video-export/components/ExportTakeover.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import { toExportTakeoverPhase } from "$lib/shared/video-export/services/export-takeover-phase";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import RecordSceneChrome from "./record-scene/RecordSceneChrome.svelte";
  import { getClaudeCodeCopier } from "$lib/shared/browse/get-claude-code-copier";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import RobustAvatar from "$lib/shared/components/avatar/RobustAvatar.svelte";
  import { getDeviceDetector } from "$lib/shared/device/get-device-detector";
  import type { DeviceDetector } from "$lib/shared/device/services/device-detector";
  import type { ResponsiveSettings } from "$lib/shared/device/domain/models/device-models";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { VideoExportProgress } from "$lib/shared/compose/domain/video-export-types";
  import DeleteConfirmDialog from "./DeleteConfirmDialog.svelte";
  import VideoPanel from "./video-panel/VideoPanel.svelte";
  import { VIDEO_UPLOAD_ENABLED } from "../config/viewer-feature-flags";
  import ChoreoCardContextMenuHost from "./choreo-card-context-menu/ChoreoCardContextMenuHost.svelte";
  import MotionVisibilityToggle from "./MotionVisibilityToggle.svelte";
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
    type ScanAnalyticsValue,
    type ScanExportStage,
  } from "$lib/shared/analytics/scan-analytics";
  import type { TempoPracticeConfig } from "../services/tempo-practice-orchestrator";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type {
    ViewerControlEventOptions,
    ViewerControlValue,
  } from "../domain/viewer-control-analytics";
  import { scanPropProperties } from "$lib/shared/analytics/scan-prop-attribution";
  import ShareActionMenu from "$lib/shared/share/components/ShareActionMenu.svelte";
  import type { ShareActionMenuItem } from "$lib/shared/share/domain/models/share-action-menu";

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
    /** Adds the standalone host's sign-in/avatar entry to the shared header. */
    onAccountSignIn?: () => void;
    /** One-shot reset to the split view on mount (scan first impression). */
    startInSplit?: boolean;
    /** Present card mode first, then promote after its first stable paint. */
    startInCardThenSplit?: boolean;
    exportOverrides?: ExportOverrides;
    /** Optional "See it in the Guide" action — host supplies the handler; the
     *  shell renders it in the overflow menu. Omitted → not shown. */
    guideAction?: { label: string; onSelect: () => void } | null;
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
  }: Props = $props();

  const scanInstrumentationEnabled = isScanVisit();
  const activeArtExports = new Map<
    "mandala" | "tunnel",
    Record<string, ScanAnalyticsValue>
  >();

  onMount(() =>
    registerScanSessionCleanup((reason) => {
      for (const [artType, properties] of activeArtExports) {
        captureScanExport(artType, "canceled", {
          ...properties,
          reason,
          user_initiated: false,
        });
      }
      activeArtExports.clear();
    })
  );

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

  // The full action row needs more room than the viewer's 768px phone/desktop
  // breakpoint. In this middle range the centered title used to sit on top of
  // Practice and the Left/Right controls. Keep the desktop rail, but move those
  // actions into the title menu and collapse the rail to its icon presentation.
  const FULL_CHROME_MIN_WIDTH = 1080;
  const compactChrome = $derived(isMobile || bodyWidth < FULL_CHROME_MIN_WIDTH);
  // An embed has no account entry, so it also stops being "account crowded" —
  // which hands the More trigger back to the centered title slot and restores
  // the header's title in the one layout that had traded it away for room.
  const hasAccountEntry = $derived(
    !!openAppHref && !!onAccountSignIn && !embedded
  );
  const accountCrowded = $derived(hasAccountEntry && bodyWidth < 460);
  const motionProfile = $derived(
    getSequenceMotionProfile(ctx.effectiveSequence ?? sequence)
  );
  const canToggleMotionVisibility = $derived(
    motionProfile.kind === "paired" || motionProfile.kind === "mixed"
  );

  // Every desktop export (card AND the 2D/3D animation download) puts its settings in
  // a fixed-width sidebar column beside the content rail and the preview. The preview
  // is the hero, so it must NEVER be narrower than the settings sidebar — otherwise
  // the controls dominate a sliver of a preview. Below the width where rail + a hero
  // at least sidebar-wide + the sidebar all fit, the export falls back to the compact
  // bottom dock with the preview as the hero (same layout phones get).
  const EXPORT_SIDEBAR_WIDTH = 560; // keep in sync with --export-sidebar-width in CSS
  const HERO_MIN_WIDTH = 600; // sidebar 560 + 40px so the preview is clearly larger

  // Rail width is user-persisted (ViewerContentRail's RAIL_WIDTH_KEY), so a dragged-
  // wider rail raises the bar correctly instead of silently re-crushing the preview.
  function exportSidebarMinWidth(): number {
    let rail = 180; // ViewerContentRail DEFAULT_WIDTH
    try {
      const raw = localStorage.getItem("tka-viewer-rail-width");
      if (raw) {
        const n = parseInt(raw, 10);
        if (n >= 72 && n <= 300) rail = n;
      }
    } catch {
      /* ignore */
    }
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
      console.warn(
        "SequenceViewerShell: Failed to resolve DeviceDetector",
        error
      );
    }
    return () => deviceCleanup?.();
  });

  let exportSidebarCollapsed = $state(false);

  function toggleExportSidebar() {
    const previous = !exportSidebarCollapsed;
    exportSidebarCollapsed = !exportSidebarCollapsed;
    captureScanSettingChanged({
      group: "export",
      setting: "settings_visible",
      previous_value: previous,
      value: !exportSidebarCollapsed,
      source: "header",
    });
  }

  // Fresh sequence → expanded settings (mirrors the drawer's reset-on-open).
  $effect(() => {
    void sequence;
    exportSidebarCollapsed = false;
  });

  let copyClaudeFeedback = $state(false);
  let shareMenuOpen = $state(false);
  let shareLinkCopied = $state(false);
  let shareLinkFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  type ViewerShareActionId = "share-sequence" | "send-sequence" | "copy-link";

  const shareActions = $derived.by((): ShareActionMenuItem[] => [
    {
      id: "share-sequence",
      label: "Share Sequence…",
      icon: "fa-share-nodes",
      section: "share",
    },
    {
      id: "send-sequence",
      label: "Send in TKA",
      icon: "fa-paper-plane",
      section: "share",
    },
    {
      id: "copy-link",
      label: shareLinkCopied ? "Copied" : "Copy Link",
      icon: shareLinkCopied ? "fa-check" : "fa-link",
      section: "share",
      tone: shareLinkCopied ? "success" : "default",
      closeOnSelect: false,
    },
  ]);
  const shareStatusMessage = $derived(shareLinkCopied ? "Link copied." : "");

  onDestroy(() => {
    if (shareLinkFeedbackTimer) clearTimeout(shareLinkFeedbackTimer);
  });

  async function handleCopyForClaude() {
    if (!sequence) return;
    try {
      const copier = getClaudeCodeCopier();
      const result = await copier.copyForClaude(sequence);
      if (!result.success) {
        captureScanAction("copy_for_claude", { outcome: "failed" });
        return;
      }
      captureScanAction("copy_for_claude", { outcome: "completed" });
      copyClaudeFeedback = true;
      setTimeout(() => {
        copyClaudeFeedback = false;
      }, 1500);
    } catch (error) {
      captureScanAction("copy_for_claude", { outcome: "failed" });
      console.error("[SequenceViewerShell] Copy for Claude failed:", error);
    }
  }

  function handleSendTo() {
    if (!sequence) return;
    captureScanAction("send");
    const propType =
      sequence.intendedProp?.bluePropType ??
      settingsService.settings.bluePropType ??
      "staff";
    const thumbnailUrl = buildThumbnailUrl(
      sequence.word || sequence.name,
      String(propType),
      false
    );
    openSendSequenceSheet(
      buildSequenceSharePayload({ ...sequence, thumbnailUrl })
    );
  }

  function handleShareSequence(): void {
    captureScanAction("share");
    ctx.handleShare();
  }

  async function handleCopyShareLink(): Promise<void> {
    captureScanAction("copy_link");
    const copied = await ctx.handleCopyLink();
    if (!copied) return;

    shareLinkCopied = true;
    if (shareLinkFeedbackTimer) clearTimeout(shareLinkFeedbackTimer);
    shareLinkFeedbackTimer = setTimeout(() => {
      shareLinkCopied = false;
      shareLinkFeedbackTimer = null;
    }, 1800);
  }

  function handleShareActionSelect(actionId: string): void {
    switch (actionId as ViewerShareActionId) {
      case "share-sequence":
        handleShareSequence();
        break;
      case "send-sequence":
        handleSendTo();
        break;
      case "copy-link":
        void handleCopyShareLink();
        break;
    }
  }

  function handleSendToStickerLab() {
    if (!sequence) return;
    captureScanAction("send_to_sticker_lab");
    sendToStickerLab(sequence);
  }

  // Named rail/select handlers shared by the rail and the mobile bottom bar.
  function selectSplitMode(c: OrchestratorContext, track = true) {
    c.ensureInteractiveServices();
    const previousMode = c.viewerState.viewerMode;
    c.viewerState.exitExport();
    // Side-by-side is hard-coded to 2D + Card on every width — the comparison
    // pairing bar was retired, so force the pairing here in case a different
    // one (e.g. 2D + 3D) was persisted before the bar went away.
    c.viewerState.setSplitConfig({ leftPane: "animation", rightPane: "card" });
    c.viewerState.setViewerMode("split");
    if (track) captureScanViewChanged(previousMode, "split", "mode_switcher");
    // NOTE: do NOT force a rerenderTrigger++ here. The ChoreoCard's render
    // $effect already reacts to the pane's prop changes via the cache-aware
    // renderAllCells (in-place swap on a cache hit). rerenderTrigger++ routes to
    // forceRerenderAllCells, which DELETES the caches and blanks every cell to a
    // spinner — that was the whole-grid "flash" seen when switching views.
  }

  function selectViewerMode(
    c: OrchestratorContext,
    mode: ContentType,
    countIntent = true
  ) {
    if (mode !== "card") c.ensureInteractiveServices();
    const previousMode = c.viewerState.viewerMode;
    if (mode === "animation") {
      c.viewerState.enterExport("animation-export", "animation");
    } else if (mode === "animation-3d") {
      c.viewerState.enterExport("animation-export", "animation-3d");
    } else if (mode === "card") {
      c.viewerState.enterExport("image-export");
    } else if (mode === "mandala") {
      c.viewerState.exitExport();
      c.viewerState.setViewerMode("mandala");
    } else if (mode === "tunnel") {
      c.viewerState.exitExport();
      c.viewerState.setViewerMode("tunnel");
    }
    captureScanViewChanged(previousMode, mode, "mode_switcher", {
      count: countIntent,
    });
  }

  // QR play badge (Card mode): switch to the 2D animation view and start
  // playback. handlePlaybackToggle is a toggle, so read isPlayingLocal at click
  // time and only start when paused — never pauses an already-running anim.
  function playFromQr(c: OrchestratorContext) {
    const wasPlaying = c.isPlayingLocal;
    selectViewerMode(c, "animation", false);
    if (!wasPlaying) c.handlePlaybackToggle();
    captureScanPlaybackChanged({
      action: "qr_play",
      previous_value: wasPlaying,
      value: true,
      source: "card_qr_badge",
      bpm: c.bpmLocal,
    });
  }

  // viewerState persists across the whole origin (tka-viewer-mode /
  // exportContext), so a scanner whose localStorage holds a stale app-viewer
  // export context would land mid-export instead of on the split first
  // impression. One-shot reset when the scan host mounts.
  onMount(() => {
    if (startInCardThenSplit) {
      captureScanViewerOpened("card");
    } else if (startInSplit) {
      queueMicrotask(() => {
        selectSplitMode(ctx, false);
        captureScanViewerOpened("split");
      });
    } else {
      captureScanViewerOpened(ctx.viewerState.viewerMode);
    }
  });

  let progressivePromotionScheduled = false;
  $effect(() => {
    if (
      !startInCardThenSplit ||
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
        // Let the card's double-rAF performance mark land first, then activate
        // animation services and the existing Side-by-Side surface.
        promotionTimer = setTimeout(() => selectSplitMode(ctx, false), 0);
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      if (promotionTimer !== undefined) clearTimeout(promotionTimer);
    };
  });

  let deleteConfirmOpen = $state(false);
  let isDeleting = $state(false);

  let rerenderTrigger = $state(0);
  let choreoCardMenuHost: ChoreoCardContextMenuHost | undefined = $state();

  // 3D scene load gate (first-load latched, forwarded from the 3D canvas via
  // ViewerSplitPane). Withholds the Record Scene pill until the stage is set, so
  // it doesn't sit over a black "Setting the stage" pane reading as ready.
  let sceneReady3d = $state(false);

  // ── Derived view flags (were {@const} in the drawer's snippet body) ──
  const isVideoExportActive = $derived(ctx.editingPane === "animation");
  const isImageExportActive = $derived(ctx.editingPane === "image");
  const isVideoUploadActive = $derived(ctx.editingPane === "video-upload");
  const isAnyExportActive = $derived(ctx.editingPane !== null);
  const isRecordSceneActive = $derived(
    isVideoExportActive && ctx.renderMode === "3d" && !ctx.previewBlobUrl
  );
  const isSidebarExportActive = $derived(
    isAnyExportActive && !isRecordSceneActive
  );
  // Every sidebar export (card + the 2D/3D animation download) needs enough
  // width for the 560px settings sidebar to sit beside a usable preview + rail.
  // When the viewer is narrower than that (embedded, split, small window), drive
  // the whole export view into the mobile layout: preview hero on top, settings
  // in the bottom dock, modes in the bottom bar. RecordSceneChrome (3D record)
  // is its own full-bleed UI and is excluded via isRecordSceneActive.
  const cardExportNarrow = $derived(
    isImageExportActive && !isMobile && bodyWidth < exportSidebarMinWidth()
  );
  const videoExportNarrow = $derived(
    isVideoExportActive &&
      !isRecordSceneActive &&
      !isMobile &&
      bodyWidth < exportSidebarMinWidth()
  );
  const effectiveMobile = $derived(
    isMobile || cardExportNarrow || videoExportNarrow
  );
  // The rail is the desktop mode switcher — it stays at every desktop width,
  // including the narrow-export fallback, so Card / 2D Animation don't swap to
  // phone chrome while Split / Mandala / Tunnel keep the rail (inconsistent).
  // Only real mobile (<768) drops the rail for the bottom bar.
  const showRail = $derived(!isMobile);
  // Narrow-desktop export: settings stack under the hero (mobile presentation)
  // but the rail column persists beside them.
  const stackedExportWithRail = $derived(
    isSidebarExportActive && effectiveMobile && !isMobile
  );
  const headerActions = $derived(
    buildHeaderActions(ctx, "full", {
      onDeleteRequest: () => (deleteConfirmOpen = true),
    })
  );

  // ── Export routing: host override (scan gated pipeline) or the orchestrator ──
  const videoBusy = $derived(exportOverrides?.videoBusy ?? ctx.isExporting);
  const videoProgress = $derived(
    exportOverrides?.videoProgress ?? ctx.exportProgress
  );
  const cardBusy = $derived(exportOverrides?.cardBusy ?? ctx.isExporting);
  const showInlineProgress = $derived(
    exportOverrides?.showInlineProgress ?? true
  );
  // The premium export ring over the whole viewer body for the standard
  // animation export. A host that suppresses the
  // inline bar (showInlineProgress=false) does so because it renders its OWN
  // takeover (the scan page), so the shell renders one only when it hasn't.
  // 2D only — 3D export progress lives in Recording3DOverlay.
  const shellRendersTakeover = $derived(showInlineProgress);
  const animTakeover = $derived(
    toExportTakeoverPhase(videoProgress, videoBusy)
  );
  const takeoverLabel = $derived(
    ctx.effectiveSequence?.word ||
      ctx.effectiveSequence?.displayName ||
      ctx.effectiveSequence?.name ||
      ""
  );
  const takeoverWord = $derived(simplifyRepeatedWord(takeoverLabel));
  function videoExportAnalyticsConfig(): Record<string, ScanAnalyticsValue> {
    const options = ctx.exportOptions.getVideoOptions();
    return {
      fps: options.fps,
      loop_count: options.loopCount,
      resolution: String(options.resolution),
      include_start_position: options.includeStartPosition,
      include_end_hold: options.includeEndHold,
      render_mode: ctx.renderMode,
      playback_mode: ctx.playbackMode,
      ...scanPropProperties(ctx.bluePropType, ctx.redPropType),
    };
  }

  function cardExportAnalyticsConfig(): Record<string, ScanAnalyticsValue> {
    return {
      step_count: ctx.effectiveSequence?.steps?.length ?? 0,
      dark_mode: ctx.exportOptions.imageDarkMode,
      include_start_position: ctx.splitPaneImageComposition.showStartPos,
      hand_path: ctx.splitPaneImageComposition.handPathMode ?? false,
      ...scanPropProperties(ctx.bluePropType, ctx.redPropType),
    };
  }

  function handleVideoExport(stage: "requested" | "retry" = "requested") {
    captureScanExport("video", stage, videoExportAnalyticsConfig());
    if (exportOverrides) exportOverrides.onVideoExport();
    else ctx.handleExport();
  }
  function handleCardExport() {
    captureScanExport("card", "requested", cardExportAnalyticsConfig());
    if (exportOverrides) exportOverrides.onCardExport();
    else ctx.handleExport();
  }
  function handleRemix() {
    captureScanAction("remix");
    endScanViewerSession("remix");
    if (onRemix) onRemix();
    else ctx.invokeGatedAction("remix", ctx.handleEdit);
  }
  function recordOpenApp(source: "overflow" | "account_entry") {
    captureScanAction("open_app", { source });
    endScanViewerSession("open_app");
  }
  function handleOpenApp() {
    if (!openAppHref) return;
    recordOpenApp("overflow");
    void goto(openAppHref);
  }
  function handleAccountSignIn() {
    captureScanAction("signin_from_chip");
    onAccountSignIn?.();
  }

  function handleGuideAction(): void {
    if (!guideAction) return;
    captureScanAction("guide");
    endScanViewerSession("guide");
    guideAction.onSelect();
  }

  function handleClose(): void {
    endScanViewerSession("close_button");
    onClose();
  }

  function handleFavoriteToggle(): void {
    captureScanAction("favorite", {
      value: !ctx.isFavorite,
      gated: !ctx.isLoggedIn,
    });
    ctx.invokeGatedAction("favorite", ctx.handleFavoriteToggle);
  }

  function handleSave(): void {
    captureScanAction("save", { gated: !ctx.isLoggedIn });
    ctx.invokeGatedAction("save", ctx.handleSave);
  }

  function handleHeaderVideoUpload(): void {
    captureScanAction("video_upload");
    void headerActions.onVideoUpload?.();
  }

  function handleGalleryVideoUpload(): void {
    captureScanAction("video_upload");
    void ctx.handleVideoUpload();
  }

  function handlePublish(): void {
    captureScanAction("publish");
    void headerActions.onPublish?.();
  }

  function handleUnpublish(): void {
    captureScanAction("unpublish");
    void headerActions.onUnpublish?.();
  }

  function handleDeleteRequest(): void {
    captureScanAction("delete_requested");
    headerActions.onDeleteRequest?.();
  }

  function handleEnterPractice(): void {
    const previousMode = ctx.viewerState.viewerMode;
    ctx.enterPracticeMode();
    captureScanViewChanged(
      previousMode,
      ctx.viewerState.viewerMode,
      "practice_enter",
      { count: false }
    );
    captureScanPracticeChanged("entered");
  }

  function handleExitPractice(): void {
    captureScanPracticeChanged("exited", {
      was_running: ctx.practiceRunning,
      bpm: ctx.bpmLocal,
    });
    ctx.exitPracticeMode();
  }

  function handlePlaybackToggle(source: string): void {
    const wasPlaying = ctx.isPlayingLocal;
    ctx.handlePlaybackToggle();
    captureScanPlaybackChanged({
      action: wasPlaying ? "pause" : "play",
      previous_value: wasPlaying,
      value: !wasPlaying,
      source,
      bpm: ctx.bpmLocal,
      step: ctx.currentStepLocal,
    });
  }

  function handleSystemPlaybackChange(
    playing: boolean,
    source: "system_3d_loading"
  ): void {
    const previous = ctx.isPlayingLocal;
    if (previous === playing) return;
    ctx.handlePlaybackToggle();
    captureScanPlaybackChanged({
      action: playing ? "play" : "pause",
      previous_value: previous,
      value: playing,
      source,
      bpm: ctx.bpmLocal,
      step: ctx.currentStepLocal,
      count: false,
    });
  }

  function handleBpmChange(bpm: number, source: string): void {
    const previous = ctx.bpmLocal;
    ctx.handleBpmChange(bpm);
    captureScanSettingChanged({
      group: "playback",
      setting: "bpm",
      previous_value: previous,
      value: bpm,
      source,
      coalesce: true,
    });
  }

  function handlePropChange(propType: PropType, source: string): void {
    const previousBlue = ctx.bluePropType ? String(ctx.bluePropType) : null;
    const previousRed = ctx.redPropType ? String(ctx.redPropType) : null;
    ctx.handlePropTypeChange(propType);
    const blue = ctx.bluePropType ? String(ctx.bluePropType) : null;
    const red = ctx.redPropType ? String(ctx.redPropType) : null;
    captureScanSettingChanged({
      group: "props",
      setting: "prop_type",
      previous_value: `blue:${previousBlue ?? "none"}|red:${previousRed ?? "none"}`,
      value: `blue:${blue ?? "none"}|red:${red ?? "none"}`,
      previous_blue_prop: previousBlue,
      previous_red_prop: previousRed,
      blue_prop: blue,
      red_prop: red,
      source,
    });
  }

  function handlePlaybackModeChange(
    mode: "continuous" | "step",
    source: string
  ): void {
    const previous = ctx.playbackMode;
    ctx.handlePlaybackModeChange(mode);
    captureScanPlaybackChanged({
      action: "mode",
      previous_value: previous,
      value: mode,
      source,
    });
  }

  function handleViewerControlSetting(
    group: string,
    setting: string,
    previousValue: ViewerControlValue,
    value: ViewerControlValue,
    options: ViewerControlEventOptions = {}
  ): void {
    captureScanSettingChanged({
      group,
      setting,
      previous_value: previousValue,
      value,
      source: group === "record_scene" ? "record_scene" : "video_export",
      coalesce: options.coalesce,
      count: options.count,
    });
  }

  function handleViewer3DSetting(
    group: string,
    setting: string,
    previousValue: ViewerControlValue,
    value: ViewerControlValue,
    options: ViewerControlEventOptions = {}
  ): void {
    captureScanSettingChanged({
      group,
      setting,
      previous_value: previousValue,
      value,
      source: "viewer_3d",
      coalesce: options.coalesce,
      count: options.count,
    });
  }

  function handleViewer3DAction(
    action: string,
    properties: Record<string, ViewerControlValue> = {},
    options: ViewerControlEventOptions = {}
  ): void {
    captureScanAction(
      action,
      { source: "viewer_3d", ...properties },
      { count: options.count }
    );
  }

  function handleStepClick(stepIndex: number): void {
    const previous = ctx.currentStepLocal;
    ctx.handleStepClick(stepIndex);
    captureScanPlaybackChanged({
      action: "step_select",
      previous_value: previous,
      value: stepIndex,
      source: "card_step",
      step: stepIndex,
    });
  }

  function handleProgressBarSeek(targetStep: number): void {
    const previous = ctx.currentStepLocal;
    ctx.handleProgressBarSeek(targetStep);
    captureScanPlaybackChanged({
      action: "seek",
      previous_value: previous,
      value: targetStep,
      source: "progress_bar",
      step: targetStep,
      coalesce: true,
    });
  }

  function handleFocusPane(pane: "animation" | "image"): void {
    captureScanAction("focus_pane", { pane });
    ctx.enterEditMode(pane);
  }

  function handleUnfocusPane(): void {
    captureScanAction("unfocus_pane");
    ctx.exitEditMode();
  }

  function handleMotionToggle(hand: "blue" | "red"): void {
    const previous =
      hand === "blue"
        ? ctx.viewerVisibility.blueMotion
        : ctx.viewerVisibility.redMotion;
    if (hand === "blue") ctx.viewerVisibility.toggleBlue();
    else ctx.viewerVisibility.toggleRed();
    captureScanSettingChanged({
      group: "motion",
      setting: `${hand}_visible`,
      previous_value: previous,
      value: !previous,
      source: "header",
    });
  }

  function practiceConfigProperties(
    config: Partial<TempoPracticeConfig>
  ): Record<string, ScanAnalyticsValue> {
    return {
      start_bpm: config.startBpm ?? null,
      max_bpm: config.maxBpm ?? null,
      increment: config.increment ?? null,
      rounds_per_level: config.roundsPerLevel ?? null,
      target_enabled: config.targetEnabled ?? null,
      target_bpm: config.targetBpm ?? null,
    };
  }

  function handlePracticeSetConfig(patch: Partial<TempoPracticeConfig>): void {
    ctx.handlePracticeSetConfig(patch);
    captureScanPracticeChanged(
      "config_changed",
      {
        changed_fields: Object.keys(patch).sort().join(","),
        ...practiceConfigProperties({
          ...ctx.practiceState.userConfig,
          ...patch,
        }),
      },
      true
    );
  }

  function handlePracticeStart(): void {
    captureScanPracticeChanged(
      "started",
      practiceConfigProperties(ctx.practiceState.userConfig)
    );
    ctx.handlePracticeStart();
  }

  function handlePracticeStepLevel(direction: 1 | -1): void {
    captureScanPracticeChanged("tempo_step", {
      direction,
      bpm: ctx.bpmLocal,
      increment: ctx.practiceState.progress.increment,
    });
    ctx.handlePracticeStepLevel(direction);
  }

  function handlePracticeToggleHold(): void {
    const previous = ctx.practiceState.progress.held;
    captureScanPracticeChanged("hold_changed", {
      previous_value: previous,
      value: !previous,
      bpm: ctx.bpmLocal,
    });
    ctx.handlePracticeToggleHold();
  }

  function handlePracticeStop(): void {
    captureScanPracticeChanged("stopped", { bpm: ctx.bpmLocal });
    ctx.handlePracticeStop();
  }

  function handleToggleMetronome(): void {
    captureScanPracticeChanged("metronome_changed", {
      previous_value: ctx.metronomeEnabled,
      value: !ctx.metronomeEnabled,
    });
    ctx.handleToggleMetronome();
  }

  function handleToggleMirror(): void {
    captureScanPracticeChanged("mirror_changed", {
      previous_value: ctx.mirrorEnabled,
      value: !ctx.mirrorEnabled,
    });
    ctx.handleToggleMirror();
  }

  function handleArtSettingChange(
    group: string,
    setting: string,
    previousValue: ScanAnalyticsValue,
    value: ScanAnalyticsValue,
    coalesce = false,
    source = "art_panel"
  ): void {
    captureScanSettingChanged({
      group,
      setting,
      previous_value: previousValue,
      value,
      source,
      coalesce,
    });
  }

  function handleArtAction(
    action: string,
    properties: Record<string, ScanAnalyticsValue> = {},
    options: ViewerControlEventOptions = {}
  ): void {
    captureScanAction(action, properties, { count: options.count });
  }

  function handleCardSettingChange(
    group: string,
    setting: string,
    previousValue: ScanAnalyticsValue,
    value: ScanAnalyticsValue,
    coalesce = false
  ): void {
    captureScanSettingChanged({
      group,
      setting,
      previous_value: previousValue,
      value,
      source: "card_export",
      coalesce,
    });
  }

  function handleCardContextAction(
    control: string,
    properties: Record<string, ScanAnalyticsValue> = {},
    options: ViewerControlEventOptions = {}
  ): void {
    captureScanAction(
      "card_context_action",
      { control, ...properties },
      { count: options.count }
    );
  }

  function handleDeleteConfirm(): void {
    captureScanAction("delete_confirmed");
  }

  function handleDeleteCancel(): void {
    captureScanAction("delete_canceled");
    deleteConfirmOpen = false;
  }

  function handleArtExport(
    args: Parameters<typeof ctx.handleArtExport>[0]
  ): void {
    ctx.handleArtExport(args);
  }

  function handleArtExportEvent(
    artType: "mandala" | "tunnel",
    stage: ScanExportStage,
    properties: Record<string, ScanAnalyticsValue> = {}
  ): void {
    if (stage === "requested" || stage === "retry") {
      activeArtExports.set(artType, properties);
    } else if (
      stage === "completed" ||
      stage === "failed" ||
      stage === "canceled"
    ) {
      activeArtExports.delete(artType);
    }
    captureScanExport(artType, stage, properties);
  }

  function handleCancelVideoExport(): void {
    captureScanExport("video", "canceled", {
      ...videoExportAnalyticsConfig(),
      user_initiated: true,
    });
    ctx.handleCancelExport();
  }

  function handleStopRecording(): void {
    captureScanAction("recording_stop", {
      elapsed_seconds: Math.round(ctx.recordingElapsed),
      render_mode: "3d",
    });
    ctx.handleStopRecording();
  }

  function handleDismissExportedVideo(): void {
    captureScanAction("exported_video_dismiss");
    ctx.dismissPreview();
  }

  async function handleRedownloadExportedVideo(): Promise<void> {
    captureScanAction("exported_video_redownload");
    await ctx.saveExportedVideo();
  }

  async function handleVideoUploadSaveFirst(): Promise<void> {
    captureScanAction("video_upload_save_first");
    await ctx.handleSave();
  }

  function handleVideoUploadClose(): void {
    captureScanAction("video_upload_close");
    ctx.exitEditMode();
  }
</script>

{#snippet titleTrigger({
  isOpen,
  hasMenu,
}: {
  isOpen: boolean;
  hasMenu: boolean;
})}
  <span class="drawer-header-title">
    {#key `${isAnyExportActive}|${isVideoExportActive}|${isImageExportActive}|${ctx.renderMode}`}
      <span
        class="drawer-header-title-text"
        in:fade|local={{ duration: prefersReducedMotion ? 0 : 150 }}
      >
        {#if isAnyExportActive}
          {isVideoExportActive
            ? ctx.renderMode === "3d"
              ? "Record Scene"
              : "Animation Export"
            : isImageExportActive
              ? "Card Export"
              : "Upload Video"}
        {:else}
          Sequence Viewer
        {/if}
      </span>
    {/key}
  </span>
  {#if hasMenu}
    <i
      class="fas fa-ellipsis-vertical drawer-title-more-glyph"
      class:open={isOpen}
      aria-hidden="true"
    ></i>
  {/if}
{/snippet}

{#snippet overflowMenu(includeMotion: boolean)}
  <ViewerOverflowMenu
    variant="header"
    dropDown
    align="center"
    trigger={titleTrigger}
    isFavorite={headerActions.isFavorite}
    onFavoriteToggle={compactChrome &&
    headerActions.onFavoriteToggle &&
    !embedded
      ? handleFavoriteToggle
      : undefined}
    isSaved={headerActions.isSaved}
    onSave={compactChrome && headerActions.onSave && !embedded
      ? handleSave
      : undefined}
    onRemix={compactChrome && (onRemix ?? headerActions.onRemix) && !embedded
      ? handleRemix
      : undefined}
    onCopyData={authState.isAdmin && !embedded
      ? handleCopyForClaude
      : undefined}
    copyDataFeedback={copyClaudeFeedback}
    onVideoUpload={headerActions.onVideoUpload && !embedded
      ? handleHeaderVideoUpload
      : undefined}
    isPublished={headerActions.isPublished}
    onPublish={headerActions.onPublish && !embedded ? handlePublish : undefined}
    onUnpublish={headerActions.onUnpublish && !embedded
      ? handleUnpublish
      : undefined}
    onDeleteRequest={headerActions.onDeleteRequest && !embedded
      ? handleDeleteRequest
      : undefined}
    onOpenApp={openAppHref && !embedded ? handleOpenApp : undefined}
    onGuideAction={guideAction && !embedded ? handleGuideAction : undefined}
    guideActionLabel={guideAction?.label}
    motionVisibility={includeMotion
      ? {
          showBlue: ctx.viewerVisibility.blueMotion,
          showRed: ctx.viewerVisibility.redMotion,
          onToggleBlue: () => handleMotionToggle("blue"),
          onToggleRed: () => handleMotionToggle("red"),
        }
      : undefined}
    onOpenChange={(open, reason) =>
      captureScanAction(
        open ? "overflow_open" : "overflow_close",
        {},
        {
          count: reason !== "item",
        }
      )}
  />
{/snippet}

<div
  class="drawer-viewer-container"
  class:landscape={isLandscape}
  class:practice-mobile={isMobile && ctx.practiceActive}
  class:has-account-entry={hasAccountEntry}
>
  <header class="drawer-header" class:compact-chrome={compactChrome}>
    <div class="drawer-header-left-actions">
      <!-- Both action sets stay mounted and crossfade so entering
               practice doesn't flash buttons in/out. inert removes the
               hidden layer from focus + pointer + a11y. -->
      <div
        class="left-actions-layer practice"
        class:active={ctx.practiceActive}
        inert={!ctx.practiceActive}
      >
        <button
          type="button"
          class="header-action-btn practice-exit"
          onclick={handleExitPractice}
          aria-label="Exit practice mode"
        >
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          <span>Exit Practice</span>
        </button>
      </div>

      <div
        class="left-actions-layer normal"
        class:active={!ctx.practiceActive}
        inert={ctx.practiceActive}
      >
        {#if compactChrome}
          <!-- Compact chrome keeps Practice visible and moves the engagement
               actions into the explicit More menu. On narrow scan surfaces,
               More joins this left cluster so the account controls cannot
               collide with the centered header slot. -->
          <button
            type="button"
            class="header-action-btn practice icon-only"
            onclick={handleEnterPractice}
            aria-label="Practice"
          >
            <i class="fas fa-dumbbell" aria-hidden="true"></i>
          </button>
          {#if accountCrowded}
            {@render overflowMenu(canToggleMotionVisibility)}
          {/if}
        {:else}
          <button
            type="button"
            class="header-action-btn utility"
            class:favorited={ctx.isFavorite}
            onclick={handleFavoriteToggle}
            aria-label="Favorite sequence"
            aria-pressed={ctx.isFavorite}
            title={ctx.isFavorite ? "Favorited" : "Favorite"}
          >
            <i
              class="{ctx.isFavorite ? 'fas' : 'far'} fa-heart"
              aria-hidden="true"
            ></i>
          </button>

          <button
            data-save-shortcut={!ctx.isSaved ? "" : undefined}
            type="button"
            class="header-action-btn utility"
            class:saved={ctx.isSaved}
            onclick={handleSave}
            disabled={ctx.isSaved}
            aria-label={ctx.isSaved ? "Saved to library" : "Save to library"}
            title={ctx.isSaved ? "Saved to library" : "Save to library"}
          >
            <i class="fas fa-bookmark" aria-hidden="true"></i>
          </button>

          <button
            type="button"
            class="header-action-btn utility"
            onclick={handleRemix}
            aria-label="Remix sequence"
            title="Remix"
          >
            <i class="fas fa-pen-to-square" aria-hidden="true"></i>
          </button>

          <button
            type="button"
            class="header-action-btn practice"
            onclick={handleEnterPractice}
            aria-label="Practice"
          >
            <i class="fas fa-dumbbell" aria-hidden="true"></i>
            <span>Practice</span>
          </button>

          {#if canToggleMotionVisibility}
            <span class="header-action-divider"></span>

            <MotionVisibilityToggle
              onToggleBlue={() => handleMotionToggle("blue")}
              onToggleRed={() => handleMotionToggle("red")}
            />
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
        <!-- The title's visible ellipsis identifies this as the More menu.
             Wide layouts omit actions already shown as buttons. -->
        {#if !accountCrowded}
          {@render overflowMenu(compactChrome && canToggleMotionVisibility)}
        {/if}
      {/if}
    </div>

    <div class="drawer-header-right-actions">
      {#if hasAccountEntry && openAppHref}
        <!-- The slot keeps the same width across auth restoration, so replacing
             "Sign in" with the avatar never nudges the title or close button. -->
        <div class="account-entry-slot">
          {#if authState.isFullAccount}
            <a
              class="account-entry-control avatar"
              href={openAppHref}
              aria-label="Open TKA"
              title="Open TKA"
              onclick={() => recordOpenApp("account_entry")}
            >
              <RobustAvatar
                src={authState.user?.photoURL}
                name={authState.user?.displayName ||
                  authState.user?.email ||
                  "Account"}
                alt=""
                size="sm"
              />
            </a>
          {:else}
            <button
              type="button"
              class="account-entry-control sign-in"
              onclick={handleAccountSignIn}
            >
              <i class="fas fa-user" aria-hidden="true"></i>
              <span>Sign in</span>
            </button>
          {/if}
        </div>
      {/if}

      <!-- Card export settings can't be collapsed on desktop — they're
               required to configure the download. Only Animation Export
               keeps the hide/show toggle. -->
      {#if isAnyExportActive && !effectiveMobile && !isRecordSceneActive && !isImageExportActive}
        <button
          type="button"
          class="header-action-btn utility"
          class:active={!exportSidebarCollapsed}
          onclick={toggleExportSidebar}
          aria-label={exportSidebarCollapsed
            ? "Show export settings"
            : "Hide export settings"}
          title={exportSidebarCollapsed ? "Show settings" : "Hide settings"}
        >
          <i class="fas fa-sliders" aria-hidden="true"></i>
        </button>
      {/if}

      <!-- Share and Close are the two controls that carry the visitor OUT of
           this viewer, so an embed has neither: the share URL in there is the
           demo URL, and there is nothing to close to. See `embedded`. -->
      {#if !embedded}
        <ShareActionMenu
          bind:open={shareMenuOpen}
          actions={shareActions}
          useMobileSheet={isMobile}
          disabled={!ctx.hasSequence}
          ariaLabel="Share sequence"
          sheetTitle="Share sequence"
          tooltip="Share sequence"
          testId="viewer-share-button"
          idBase="viewer-share"
          menuSide="bottom"
          containDesktopMenu={true}
          statusMessage={shareStatusMessage}
          onActionSelect={handleShareActionSelect}
        />

        <!-- The presenter's only real way out of the viewer. Its programmatic
             escape hatch performs a module switch, which changes what sits
             UNDER this drawer and leaves the drawer covering it — so without
             this annotation a viewer with nothing pressable in it (a sequence
             with no animation data, say) is a dead end it cannot leave. -->
        <button
          type="button"
          class="drawer-close-button"
          data-escape-shortcut
          data-escape-shortcut-label="Viewer"
          data-ghost="safe"
          data-ghost-kind="close-overlay"
          data-ghost-label="Close viewer"
          onclick={handleClose}
          aria-label="Close viewer"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {/if}
    </div>
  </header>

  <!-- The presenter reads viewer-open from the viewer itself. It used to hang
       off the 2D/3D toggle, which meant "the viewer is open" was really "the
       viewer is open AND in 3D" — so open-viewer stayed satisfiable while the
       viewer sat open in 2D and the ghost kept trying to open what it was
       already looking at. -->
  <div class="drawer-main" data-ghost-state="viewer-open">
    <div class="drawer-body-content" bind:clientWidth={bodyWidth}>
      {#if ctx.hasSequence && ctx.effectiveSequence}
        <div
          class="viewer-and-export"
          class:export-active={isSidebarExportActive}
          class:record-scene-active={isRecordSceneActive}
          class:desktop={!effectiveMobile}
          class:stacked-rail={stackedExportWithRail}
          class:sidebar-collapsed={exportSidebarCollapsed &&
            !isImageExportActive}
          class:has-rail={showRail}
        >
          {#if showRail}
            <div class="viewer-rail-wrap" class:collapsed={ctx.practiceActive}>
              <ViewerContentRail
                activeMode={ctx.viewerState.viewerMode}
                webgl2Available={ctx.viewer3DState.webgl2Available}
                compact={compactChrome && !isMobile}
                onSelectSplit={() => selectSplitMode(ctx)}
                onSelectMode={(mode) => selectViewerMode(ctx, mode)}
              />
            </div>
          {/if}
          {#if ctx.viewerState.viewerMode === "videos" && !isSidebarExportActive}
            <VideoGallery
              {sequence}
              isOwned={ctx.isOwned}
              isLoggedIn={ctx.isLoggedIn}
              onUpload={ctx.isLoggedIn && VIDEO_UPLOAD_ENABLED
                ? handleGalleryVideoUpload
                : undefined}
            />
          {:else}
            <ViewerSplitPane
              sequence={ctx.effectiveSequence}
              renderMode={ctx.renderMode}
              isExporting={videoBusy}
              bpm={ctx.bpmLocal}
              onBpmChange={(bpm) => handleBpmChange(bpm, "viewer")}
              onPropChange={(prop) => handlePropChange(prop, "viewer")}
              playback={ctx.splitPanePlayback}
              imageComposition={isImageExportActive
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
                isMobile: effectiveMobile,
                isLandscapeMobile: isLandscape,
                focusedPane:
                  ctx.viewerState.viewerMode !== "split"
                    ? ctx.viewerState.viewerMode === "card"
                      ? "image"
                      : "animation"
                    : ctx.editingPane,
                suppressCloseButton: ctx.viewerState.viewerMode !== "split",
              }}
              onRenderProgress={ctx.onRenderProgress}
              onFocusPane={handleFocusPane}
              onUnfocusPane={handleUnfocusPane}
              onStepClick={handleStepClick}
              onQrPlayClick={ctx.practiceActive
                ? undefined
                : () => playFromQr(ctx)}
              onCanvasReady={ctx.handleCanvasReady}
              onAutoLayoutResolved={isImageExportActive
                ? ctx.setResolvedCardAutoLayout
                : undefined}
              {rerenderTrigger}
              onChoreoCardContextMenu={(x, y) =>
                choreoCardMenuHost?.openContextMenu(x, y)}
              onPlaybackToggle={() => handlePlaybackToggle("viewer_transport")}
              onSystemPlaybackChange={handleSystemPlaybackChange}
              onProgressBarSeek={handleProgressBarSeek}
              onProgressBarScrubStart={ctx.handleProgressBarScrubStart}
              onProgressBarScrubEnd={ctx.handleProgressBarScrubEnd}
              playbackMode={ctx.playbackMode}
              onPlaybackModeChange={(mode) =>
                handlePlaybackModeChange(mode, "viewer")}
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
                ? handleGalleryVideoUpload
                : undefined}
              onArtExport={handleArtExport}
              onArtExportEvent={handleArtExportEvent}
              onArtSettingChange={handleArtSettingChange}
              onArtAction={handleArtAction}
              onViewer3DSettingChange={scanInstrumentationEnabled
                ? handleViewer3DSetting
                : undefined}
              onViewer3DAction={scanInstrumentationEnabled
                ? handleViewer3DAction
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
              onStop={handleStopRecording}
              exportProgress={ctx.exportProgress}
              isExporting={ctx.isExporting}
              onCancelExport={handleCancelVideoExport}
            />
          {/if}
          {#if ctx.renderMode !== "3d" && shellRendersTakeover && animTakeover.phase !== "idle"}
            <ExportTakeover
              phase={animTakeover.phase}
              progress={videoProgress?.progress ?? 0}
              phaseLabel={animTakeover.labelKey ? t(animTakeover.labelKey) : ""}
              error={videoProgress?.error ?? null}
              onCancel={handleCancelVideoExport}
              onRetry={() => handleVideoExport("retry")}
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
            isExportMode={isImageExportActive}
            exportOptions={ctx.exportOptions}
            onSendTo={handleSendTo}
            onSendToStickerLab={handleSendToStickerLab}
            stepCount={sequence?.steps?.length ?? 0}
            onAction={handleCardContextAction}
          />
          {#if isRecordSceneActive && ctx.effectiveSequence && sceneReady3d}
            <RecordSceneChrome
              isExporting={ctx.isExporting}
              canvasReady={ctx.canvasReady}
              onExport={() => handleVideoExport()}
              choreography={ctx.viewer3DState.cameraChoreography}
              onSettingChange={scanInstrumentationEnabled
                ? handleViewerControlSetting
                : undefined}
            />
          {/if}
          {#if isSidebarExportActive}
            <div
              class="export-panel-container"
              class:sidebar={!effectiveMobile &&
                (isVideoExportActive || isVideoUploadActive)}
            >
              {#if isVideoExportActive}
                {#if ctx.previewBlobUrl}
                  <VideoPreviewPanel
                    blobUrl={ctx.previewBlobUrl}
                    saveLabel="Save"
                    onDismiss={handleDismissExportedVideo}
                    onRedownload={() => void handleRedownloadExportedVideo()}
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
                    showInlineExportProgress={false}
                    onPropChange={(prop) =>
                      handlePropChange(prop, "video_export")}
                    onPlaybackToggle={() =>
                      handlePlaybackToggle("video_export")}
                    onPlaybackModeChange={(mode) =>
                      handlePlaybackModeChange(mode, "video_export")}
                    onBpmChange={(bpm) => handleBpmChange(bpm, "video_export")}
                    onExport={() => handleVideoExport()}
                    onCancel={handleCancelVideoExport}
                    onSettingChange={scanInstrumentationEnabled
                      ? handleViewerControlSetting
                      : undefined}
                  />
                {/if}
              {:else if isImageExportActive && !isMobile}
                <!-- No onClose on desktop widths: the card export settings are
                     required to configure the download and must stay put.
                     Leave the Download Card mode via the content rail. Below
                     the sidebar threshold the panel stacks under the hero
                     (layout="bottom") while the rail column persists. -->
                <ExportImagePanel
                  exportOptions={ctx.exportOptions}
                  isExporting={cardBusy}
                  stepCount={ctx.effectiveSequence?.steps?.length ?? 0}
                  resolvedAutoLayout={ctx.resolvedCardAutoLayout}
                  layout={effectiveMobile ? "bottom" : "sidebar"}
                  onExport={handleCardExport}
                  onSettingChange={handleCardSettingChange}
                />
              {:else if isVideoUploadActive}
                <VideoPanel
                  {sequence}
                  isOwned={ctx.isOwned}
                  bpm={ctx.bpmLocal}
                  onSaveFirst={handleVideoUploadSaveFirst}
                  onClose={handleVideoUploadClose}
                />
              {/if}
            </div>
          {/if}
        </div>
        {#if isMobile && isImageExportActive && ctx.effectiveSequence}
          <!-- Entrance/exit fly now lives on ControlDock's root
               (shared by every dock); this wrapper only positions. -->
          <div class="export-footer-overlay">
            <ExportImagePanel
              exportOptions={ctx.exportOptions}
              isExporting={cardBusy}
              stepCount={ctx.effectiveSequence.steps?.length ?? 0}
              resolvedAutoLayout={ctx.resolvedCardAutoLayout}
              layout="bottom"
              onExport={handleCardExport}
              onClose={handleUnfocusPane}
              onSettingChange={handleCardSettingChange}
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
          duration: prefersReducedMotion ? 0 : 260,
          easing: cubicOut,
        }}
      >
        <div
          transition:fly={{
            y: 72,
            duration: prefersReducedMotion ? 0 : 260,
            easing: cubicOut,
          }}
        >
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
      <div
        class="bar-pane config"
        class:active={!ctx.practiceRunning}
        inert={ctx.practiceRunning}
      >
        <PracticeSetupBar
          config={ctx.practiceState.userConfig}
          onSetConfig={handlePracticeSetConfig}
          onStart={handlePracticeStart}
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
          onBpmChange={(bpm) => handleBpmChange(bpm, "practice")}
          onPlayPause={() => handlePlaybackToggle("practice")}
          onStepLevel={handlePracticeStepLevel}
          onToggleHold={handlePracticeToggleHold}
          onStop={handlePracticeStop}
          metronomeOn={ctx.metronomeEnabled}
          onToggleMetronome={handleToggleMetronome}
          mirrorOn={ctx.mirrorEnabled}
          onToggleMirror={handleToggleMirror}
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
        handleDeleteConfirm();
        isDeleting = true;
        try {
          await ctx.handleDelete();
        } finally {
          deleteConfirmOpen = false;
          isDeleting = false;
        }
      }}
      onCancel={handleDeleteCancel}
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
    container: viewer-header / inline-size;
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
    /* The title group hosts the explicit More trigger when secondary actions
       exist, so it must accept clicks. */
    pointer-events: auto;
    overflow: visible;
  }

  .drawer-header-title {
    min-width: 0;
    overflow: hidden;
    font-size: var(--font-size-base, 16px);
    font-weight: 600;
    line-height: 1.2;
    color: var(--theme-text, #ffffff);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .drawer-header-title-text {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Compact chrome reserves a mirrored right-action gutter so its centered
     title/More target cannot overlap Share or Close on narrow phones. */
  .drawer-header.compact-chrome .drawer-header-title-group {
    max-width: calc(
      100% - 2 * (12px + 2 * var(--min-touch-target, 44px) + 4px + 4px)
    );
  }

  .takeover-title-text {
    color: var(--theme-text, #ffffff);
    font-size: 1.1rem;
    font-weight: 650;
    letter-spacing: 0.01em;
  }

  /* A familiar overflow glyph makes the title menu discoverable without
     presenting the title itself as a mystery button. */
  .drawer-title-more-glyph {
    font-size: var(--font-size-base, 16px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    transition: color 150ms ease;
    flex-shrink: 0;
  }
  .drawer-title-more-glyph.open {
    color: var(--theme-accent, #a78bfa);
  }

  @media (prefers-reduced-motion: reduce) {
    .drawer-title-more-glyph {
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
    transition:
      background 150ms ease,
      color 150ms ease;
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

  .account-entry-slot {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    inline-size: 5.5rem;
    block-size: var(--min-touch-target, 44px);
    flex: 0 0 5.5rem;
  }

  .account-entry-control {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.18));
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    text-decoration: none;
    transition:
      background 150ms ease,
      border-color 150ms ease;
  }

  .account-entry-control.sign-in {
    inline-size: 100%;
    gap: 7px;
    padding: 0 12px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    white-space: nowrap;
  }

  .account-entry-control.avatar {
    border-color: transparent;
    border-radius: 50%;
    background: transparent;
  }

  .account-entry-control:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.28));
  }

  .account-entry-control:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* The account entry and close button need more room than the title on the
     smallest phones. The More trigger moves to the left cluster in markup; hide
     its title text there so the trigger stays a compact overflow button. */
  @container viewer-header (max-width: 460px) {
    .has-account-entry .drawer-header-title {
      display: none;
    }
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
    transition:
      background 150ms ease,
      color 150ms ease;
  }

  .header-action-btn:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
  }

  .header-action-btn.utility {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
  }

  .header-action-btn.utility:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.18));
  }

  .header-action-btn.utility:disabled {
    cursor: default;
    opacity: 0.62;
  }

  .header-action-btn.active {
    color: var(--theme-accent, #6366f1);
  }

  .header-action-btn.favorited {
    background: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 16%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 45%,
      var(--theme-stroke, transparent)
    );
    color: var(--semantic-error, #ef4444);
  }

  .header-action-btn.saved {
    background: color-mix(
      in srgb,
      var(--theme-accent, #6366f1) 14%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #6366f1) 40%,
      var(--theme-stroke, transparent)
    );
    color: var(--theme-accent, #a78bfa);
  }

  /* Practice entry — labeled accent CTA. Tinted accent fill (no border, like
     .practice-exit) so it stands out from the utility icon buttons. */
  .header-action-btn.practice {
    gap: 8px;
    padding: 0 16px;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-accent, #a78bfa);
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 18%,
      transparent
    );
  }
  .header-action-btn.practice:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 30%,
      transparent
    );
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
    .bar-pane {
      transition: none;
    }
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
    .drawer-viewer-container {
      --ws-dur: 0ms;
    }
    .viewer-rail-wrap,
    .left-actions-layer,
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
