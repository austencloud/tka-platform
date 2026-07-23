<!--
  /q/[code]/+page.svelte

  QR Scan Landing Page

  Renders the scanned sequence through SequenceViewerShell — the EXACT viewer
  chrome (header, rail, split pane, export panels, practice) the app drawer
  uses, so /q and the in-app viewer are identical by construction. This page
  owns only scan concerns: short-code resolve, the word-glyph loader, scan
  analytics, the gated download pipeline (account funnel), and the composer
  handoff. Breaks out of the root layout via +layout@.svelte.

  URL format: /q/{shortCode}

  Flow:
  1. Resolve short code -> SequenceData
  2. Lazy-load SequenceViewerOrchestrator + SequenceViewerShell
     (parallel with step 1)
  3. Mount orchestrator -> shell (full viewer chrome)
-->
<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import {
    isInlineEncoded,
    parsePropsFromURL,
  } from "$lib/shared/navigation/services/sequence-encoder";
  import { ShortCodeManager } from "$lib/shared/qr/services/short-code-manager";
  import { configureShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
  import { hydrateSequence } from "$lib/shared/navigation/services/sequence-hydrator";
  import { buildCardRenderOptions } from "$lib/shared/share/services/card-render-options";
  import { loopDetector } from "$lib/features/create/generate/circular/services/loop-detector";
  import { registerLoopDetector } from "$lib/shared/create/get-loop-detector";
  import { registerLoopDisplayResolver } from "$lib/shared/loop-labeler/get-loop-display-resolver";
  import { resolveLoopDisplay } from "$lib/features/loop-labeler/services/loop-display-resolver";
  import { initPostHog } from "$lib/shared/analytics/services/posthog";
  import {
    beginScanVisit,
    updateScanAttribution,
    captureScanEvent,
    captureScanExport,
    endScanViewerSession,
    registerScanSessionCleanup,
    refreshScanSessionAttribution,
    type ScanAnalyticsValue,
  } from "$lib/shared/analytics/scan-analytics";
  import { markScan } from "$lib/shared/analytics/scan-perf";
  import { isFirstScanRouteVisit } from "$lib/shared/qr/utils/scan-detection";
  import { getDeviceId } from "$lib/shared/auth/services/device-id-service";
  import {
    authState,
    initializeAuthListener,
  } from "$lib/shared/auth/state/auth-state.svelte";
  import {
    simplifyRepeatedWord,
    compressWord,
  } from "$lib/shared/foundation/utils/word-simplifier";
  import {
    isDashLetter,
    getBaseLetter,
  } from "$lib/shared/pictograph/tka-glyph/utils/letter-image-getter";
  import { resolveScanPropConfig } from "$lib/shared/qr/services/scan-prop-resolver";
  import { updateSettings } from "$lib/shared/application/state/app-state.svelte";
  import { initializeAppServices } from "$lib/shared/application/state/services.svelte";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import {
    handleHMRInit,
    clearModuleChunkRecoveryGuard,
  } from "$lib/shared/hmr-helper";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PublicSequencesLoader } from "$lib/shared/browse/services/public-sequences-loader";
  import type {
    IVideoExportOrchestrator,
    VideoExportProgress,
  } from "$lib/shared/compose/domain/video-export-types";
  import type { OrchestratorContext } from "$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte";
  import { setScanCardCloudProbe } from "$lib/shared/sequence-viewer/scan-card-cloud-context";
  import {
    guideTargetForLetter,
    GUIDE_CODEX_SLUG,
  } from "../../(public)/guide/level-1/_data/guide-content-index";
  import { setGuideScanIntent } from "../../(public)/guide/level-1/_data/guide-scan-intent";
  import { getGlyphCache } from "$lib/shared/render/get-glyph-cache";
  import { shareOrDownloadBlob } from "$lib/shared/foundation/services/file-downloader";
  import { sequenceModalExporter } from "$lib/shared/sequence-viewer/services/sequence-modal-exporter.svelte";
  import {
    SCAN_PLAYBACK_MAX_BPM,
    initialScanPlaybackBpm,
    saveScanPlaybackBpm,
  } from "$lib/shared/sequence-viewer/services/scan-playback-tempo";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import ProgressBar from "$lib/shared/components/loading/ProgressBar.svelte";
  import ToastContainer from "$lib/shared/toast/components/ToastContainer.svelte";
  import ExportTakeover from "$lib/shared/video-export/components/ExportTakeover.svelte";
  import { toExportTakeoverPhase } from "$lib/shared/video-export/services/export-takeover-phase";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import { scanPropProperties } from "$lib/shared/analytics/scan-prop-attribution";
  import {
    scanResolutionFailureCategory,
    type ScanResolutionFailureCategory,
  } from "$lib/shared/analytics/scan-resolution-analytics";
  import { ExportAttemptGuard } from "$lib/shared/sequence-viewer/domain/export-attempt-guard";

  // Scan cards download pre-rendered pictographs from the shared cloud store
  // instead of rasterizing on the scanner's device. Enables probeCloud on every
  // descendant ChoreoCard cell render. Must be set during component init (not in
  // onMount) so the Svelte context resolves for the descendant viewer tree.
  setScanCardCloudProbe(true);

  interface Props {
    data: {
      geo: {
        country: string | null;
        city: string | null;
        lat: number | null;
        lng: number | null;
      };
      meta: {
        word: string | null;
        creator: string | null;
        thumbnailUrl: string | null;
        deckId: string | null;
        deckName: string | null;
        bluePropType: string | null;
        redPropType: string | null;
      };
    };
  }

  const { data }: Props = $props();
  const shortCode = $derived(page.params["code"]);

  type PageState =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "playing"; word: string };

  let pageState = $state<PageState>({ kind: "loading" });

  // Snapshot of connectivity at the moment resolution failed, so the error
  // screen can say "you're offline" instead of blaming the code. A failed
  // resolve while offline is a connectivity problem, not a broken code.
  let failedWhileOffline = $state(false);
  let resolutionFailureCategory = $state<ScanResolutionFailureCategory | null>(
    null
  );

  function captureResolutionFailure(
    category: ScanResolutionFailureCategory,
    stage: "bootstrap" | "resolve" | "load"
  ): void {
    resolutionFailureCategory = category;
    captureScanEvent("qr_scan_resolution", {
      outcome: "failure",
      category,
      stage,
    });
  }

  function captureResolutionAction(
    action: "retry" | "auto_retry_online" | "browse" | "create"
  ): void {
    captureScanEvent("qr_resolution_action", {
      action,
      category: resolutionFailureCategory,
    });
  }

  // Reconnecting while stuck on an offline error: retry automatically.
  function handleBackOnline() {
    if (pageState.kind === "error" && failedWhileOffline) {
      captureResolutionAction("auto_retry_online");
      location.reload();
    }
  }

  // ── Loading-state word glyphs ──
  // The scanned word arrives at SSR (data.meta.word) long before the heavy
  // sequence resolve finishes. We priority-load just this word's glyphs so it
  // paints as a pulsing loader instead of a generic spinner.
  let glyphsReady = $state(false);
  const loaderWord = $derived(
    data?.meta?.word ? simplifyRepeatedWord(data.meta.word) : ""
  );

  // ── Load progress bar ──
  // The heavy resolve+cache+player phase is opaque (one big Promise.all with no
  // sub-progress), so we anchor the bar to real phase completions and trickle
  // it toward each milestone's ceiling in between — it never stalls and never
  // lies about reaching a milestone it hasn't hit. Snaps to 100 on success.
  let loadProgress = $state(0);
  let trickleTimer: ReturnType<typeof setInterval> | null = null;

  function setProgress(v: number) {
    loadProgress = Math.max(loadProgress, v);
  }

  function trickleTo(ceiling: number) {
    stopTrickle();
    trickleTimer = setInterval(() => {
      if (loadProgress < ceiling) {
        setProgress(
          loadProgress + Math.max(0.4, (ceiling - loadProgress) * 0.08)
        );
      }
    }, 200);
  }

  function stopTrickle() {
    if (trickleTimer) {
      clearInterval(trickleTimer);
      trickleTimer = null;
    }
  }

  onDestroy(() => {
    stopTrickle();
    abandonActiveExports("route_unmount");
    endScanViewerSession("route_unmount");
  });

  let resolvedSeq: SequenceData | null = $state(null);
  // Raw word — DATA. Feeds analytics payloads and the OG/title derivations
  // below, which simplify on their own. Never render it directly.
  let seqWord = $state("");
  // Anything a human reads or saves. A LOOP repeats its word by construction,
  // so "FΨFΨFΨFΨ.mp4" is the common case, not the edge case.
  const exportWord = $derived(
    seqWord ? simplifyRepeatedWord(seqWord) : seqWord
  );
  let scanInitialBpm = $state(SCAN_PLAYBACK_MAX_BPM);

  function handleScanBpmChange(bpm: number): void {
    if (shortCode) saveScanPlaybackBpm(shortCode, bpm);
  }

  // ── Viewer ──
  // The orchestrator is the full viewer brain; lazy-loaded so the scan page's
  // first paint (the word-glyph loader) isn't blocked by the viewer chunk.
  let OrchestratorComponent:
    | typeof import("$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte").default
    | null = $state(null);
  // The shell (header + rail + split pane + export panels + practice — the
  // entire drawer chrome, shared verbatim with the app viewer) lazy-loads
  // alongside the orchestrator, so the word-glyph loader paints before the
  // viewer chunk lands. startInSplit on the shell handles the one-shot reset
  // of any stale persisted viewer mode.
  let ShellComponent:
    | typeof import("$lib/shared/sequence-viewer/components/SequenceViewerShell.svelte").default
    | null = $state(null);

  // ── Export state (drives the QR ExportTakeover overlay + native share) ──
  let isExporting = $state(false);
  let exportProgress = $state<VideoExportProgress | null>(null);
  let activeVideoExportOrchestrator: IVideoExportOrchestrator | null = null;
  const videoExportAttempt = new ExportAttemptGuard();
  let activeVideoExportConfig: Record<string, ScanAnalyticsValue> | null = null;
  // Separate from isExporting so the card-image export's button-busy state never
  // triggers the video ExportTakeover overlay (different pipeline, much faster).
  let isCardExporting = $state(false);
  const cardExportAttempt = new ExportAttemptGuard();
  let activeCardExportConfig: Record<string, ScanAnalyticsValue> | null = null;

  onMount(() =>
    registerScanSessionCleanup((reason) => abandonActiveExports(reason))
  );

  // ── Export takeover overlay (dim scrim + progress ring over the live canvas) ──
  const takeover = $derived(toExportTakeoverPhase(exportProgress, isExporting));

  // ── Layout detection ──
  // Same breakpoint as SequenceViewerDrawerHost (<768 = mobile) so the
  // orchestrator and the shared shell agree with the app viewer exactly.
  let viewportWidth = $state(0);

  const isViewerMobile = $derived(
    viewportWidth > 0 ? viewportWidth < 768 : true
  );

  // ── OG metadata ──
  const rawWord = $derived(
    (pageState.kind === "playing" ? pageState.word : data?.meta?.word) ||
      "Sequence"
  );
  // Browser-tab title + OG/Twitter meta are all UTF-8, so keep the real Greek
  // glyphs (Σ, Δ, Λ…) here. greekToAscii ("sig", "del") is for filenames/URLs
  // only — using it for display turned the tab title into mojibake-looking ASCII.
  const displayWord = $derived(
    rawWord !== "Sequence" ? simplifyRepeatedWord(rawWord) : "Sequence"
  );
  const ogDesc = $derived(
    displayWord !== "Sequence"
      ? `Watch the ${displayWord} flow sequence`
      : "Watch this flow sequence"
  );
  const ogImage = $derived(
    data?.meta?.thumbnailUrl || "https://tkaflowarts.com/og-default.png"
  );

  const stubBrowseLoader = {
    loadSequenceMetadata: async () => [],
    loadFullSequenceData: async () => null,
    removeFromCache: () => {},
    addToCache: () => {},
    warmFromCache: () => {},
    refreshFromFirestore: async () => [],
  } as unknown as PublicSequencesLoader;

  const shortCodeManager = new ShortCodeManager(stubBrowseLoader);

  function videoExportAnalyticsConfig(
    ctx: OrchestratorContext
  ): Record<string, ScanAnalyticsValue> {
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

  function cardExportAnalyticsConfig(
    ctx: OrchestratorContext
  ): Record<string, ScanAnalyticsValue> {
    return {
      step_count: resolvedSeq?.steps?.length ?? 0,
      dark_mode: ctx.exportOptions.imageDarkMode,
      include_start_position: ctx.splitPaneImageComposition.showStartPos,
      hand_path: ctx.splitPaneImageComposition.handPathMode ?? false,
      ...scanPropProperties(ctx.bluePropType, ctx.redPropType),
    };
  }

  // ── Download (reuses the orchestrator's live controller + the QR share UX) ──
  // The orchestrator owns the playback controller driving the canvas; we grab it
  // from the children-snippet context to feed the offscreen export engine, then
  // deliver via the native share sheet (mobile) or disk (desktop).
  async function handleExport(ctx: OrchestratorContext) {
    const analyticsConfig = videoExportAnalyticsConfig(ctx);
    if (!resolvedSeq || !ctx.playbackController || !ctx.modalAnimationState) {
      captureScanExport("video", "failed", {
        ...analyticsConfig,
        reason: "not_ready",
      });
      return;
    }

    // The live 2D animation canvas inside the shared shell (AnimatorCanvas
    // renders into CanvasSurface's .canvas-wrapper).
    const canvasEl =
      document.querySelector<HTMLCanvasElement>(
        ".scan-viewer .canvas-wrapper canvas"
      ) ?? document.querySelector<HTMLCanvasElement>(".scan-viewer canvas");
    if (!canvasEl) {
      captureScanExport("video", "failed", {
        ...analyticsConfig,
        reason: "canvas_unavailable",
      });
      return;
    }

    const attemptToken = videoExportAttempt.begin();
    if (attemptToken === null) return;

    isExporting = true;
    exportProgress = null;
    activeVideoExportConfig = analyticsConfig;
    captureScanExport("video", "started", analyticsConfig);

    let orchestrator: IVideoExportOrchestrator | null = null;
    try {
      try {
        const { getVideoExportOrchestrator } =
          await import("$lib/shared/animation-engine/get-video-export-orchestrator");
        orchestrator = getVideoExportOrchestrator();
      } catch {
        const [
          { VideoExportOrchestrator },
          { getVideoExporter },
          { getCompositeVideoRenderer },
          { getExportGlyphPrerenderer },
          { getBackgroundVideoEncoder },
        ] = await Promise.all([
          import("$lib/features/compose/services/video-export-orchestrator"),
          import("$lib/shared/animation-engine/get-video-exporter"),
          import("$lib/shared/animation-engine/get-composite-video-renderer"),
          import("$lib/shared/animation-engine/get-export-glyph-prerenderer"),
          import("$lib/shared/animation-engine/get-background-video-encoder"),
        ]);
        orchestrator = new VideoExportOrchestrator(
          getVideoExporter(),
          getCompositeVideoRenderer(),
          getExportGlyphPrerenderer(),
          getBackgroundVideoEncoder()
        );
      }
      if (!orchestrator) throw new Error("Video export unavailable");
      activeVideoExportOrchestrator = orchestrator;
      if (!videoExportAttempt.isActive(attemptToken)) {
        orchestrator.cancelExport();
        return;
      }

      const opts = ctx.exportOptions.getVideoOptions();

      const blob = await orchestrator.executeExport(
        canvasEl,
        ctx.playbackController,
        ctx.modalAnimationState,
        (progress) => {
          if (videoExportAttempt.isActive(attemptToken)) {
            exportProgress = progress;
          }
        },
        {
          compositeMode: "none",
          // This page shares/downloads the returned blob itself below
          // (shareOrDownloadBlob). Suppress the orchestrator's own download.
          autoDownload: false,
          fps: opts.fps,
          loopCount: opts.loopCount,
          resolution: opts.resolution,
          includeAnimationStartPosition: opts.includeStartPosition,
          includeEndHold: opts.includeEndHold,
          // Thread the orchestrator's resolved prop so the offscreen export
          // engine loads matching textures. The player mounts dark.
          bluePropType: ctx.bluePropType,
          redPropType: ctx.redPropType,
          previewDarkMode: true,
        }
      );
      if (!videoExportAttempt.isActive(attemptToken)) return;

      // Mobile: open the native share sheet so the user picks where the MP4 goes
      // (Files, Photos, a message…) instead of a blind background download.
      // Desktop: straight to disk.
      const result = await shareOrDownloadBlob(blob, `${exportWord}.mp4`, {
        title: exportWord,
      });
      finishVideoExportAttempt(
        attemptToken,
        result.canceled ? "canceled" : result.success ? "completed" : "failed",
        {
          ...analyticsConfig,
          delivery: result.method,
          ...(result.canceled || result.success
            ? {}
            : { reason: "delivery_failed" }),
        }
      );
    } catch (err) {
      if (
        finishVideoExportAttempt(attemptToken, "failed", {
          ...analyticsConfig,
          reason: "export_error",
        })
      ) {
        console.error("[QR] Download failed:", err);
      }
    } finally {
      if (activeVideoExportOrchestrator === orchestrator) {
        activeVideoExportOrchestrator = null;
      }
      isExporting = false;
      exportProgress = null;
    }
  }

  function finishVideoExportAttempt(
    token: number,
    stage: "completed" | "failed" | "canceled",
    properties: Record<string, ScanAnalyticsValue>
  ): boolean {
    if (!videoExportAttempt.finish(token)) return false;
    captureScanExport("video", stage, properties);
    activeVideoExportConfig = null;
    return true;
  }

  // ── Card-image export (the choreo-card customization row's Share/Download) ──
  // Built from ctx.splitPaneImageComposition (the resolved values the card is
  // already rendering), so the downloaded PNG matches the on-screen card exactly.
  // sequenceModalExporter lazily resolves its renderer via getSequenceRenderer().
  async function handleCardExport(ctx: OrchestratorContext) {
    if (!resolvedSeq || isCardExporting) return;
    const ic = ctx.splitPaneImageComposition;
    const analyticsConfig = cardExportAnalyticsConfig(ctx);
    const attemptToken = cardExportAttempt.begin();
    if (attemptToken === null) return;
    isCardExporting = true;
    activeCardExportConfig = analyticsConfig;
    captureScanExport("card", "started", analyticsConfig);
    try {
      const renderOptions = buildCardRenderOptions(resolvedSeq, {
        darkMode: ic.darkMode,
        userName: ic.userName,
        isHandPath: ic.handPathMode ?? false,
      });
      await sequenceModalExporter.exportImage(
        renderOptions,
        { sequence: resolvedSeq, userName: ic.userName },
        {
          onSuccess: () => {
            finishCardExportAttempt(attemptToken, "completed", analyticsConfig);
          },
          onCanceled: () => {
            finishCardExportAttempt(attemptToken, "canceled", analyticsConfig);
          },
          onError: (m) => {
            if (
              finishCardExportAttempt(attemptToken, "failed", {
                ...analyticsConfig,
                reason: "export_error",
              })
            ) {
              console.error("[QR] Card export failed:", m);
            }
          },
          onHaptic: () => {},
        }
      );
      if (cardExportAttempt.isActive(attemptToken)) {
        finishCardExportAttempt(attemptToken, "failed", {
          ...analyticsConfig,
          reason: "not_ready",
        });
      }
    } catch (err) {
      if (
        finishCardExportAttempt(attemptToken, "failed", {
          ...analyticsConfig,
          reason: "export_error",
        })
      ) {
        console.error("[QR] Card export failed:", err);
      }
    } finally {
      isCardExporting = false;
    }
  }

  function finishCardExportAttempt(
    token: number,
    stage: "completed" | "failed" | "canceled",
    properties: Record<string, ScanAnalyticsValue>
  ): boolean {
    if (!cardExportAttempt.finish(token)) return false;
    captureScanExport("card", stage, properties);
    activeCardExportConfig = null;
    return true;
  }

  // ── Download gate (account-creation funnel) ──
  // Watching stays free; taking the export home requires a free account.
  // invokeGatedAction runs the export immediately for full accounts; for
  // guests it queues ?pending=download, opens the SignInSheet, and the
  // orchestrator's replay resumes the export after sign-in (onGatedDownload
  // on the orchestrator below). pendingExportKind remembers WHICH export was
  // requested so the replay resumes the right one — page state only, so a
  // webview handoff falls back to the primary video export.
  let pendingExportKind: "video" | "card" = "video";

  function requestGatedExport(
    ctx: OrchestratorContext,
    kind: "video" | "card"
  ) {
    pendingExportKind = kind;
    if (!authState.isFullAccount) {
      captureScanExport(
        kind,
        "gated",
        kind === "card"
          ? cardExportAnalyticsConfig(ctx)
          : videoExportAnalyticsConfig(ctx)
      );
    }
    ctx.invokeGatedAction("download", () =>
      kind === "card" ? handleCardExport(ctx) : handleExport(ctx)
    );
  }

  // ── Open in Composer (festival signup funnel) ──
  // Stores the scanned sequence as a pending edit (the exact handoff the
  // viewer's Remix uses; the create module consumes it on init) and heads to
  // the construct tab. ?sheet=auth opens the sign-up sheet on arrival for
  // signed-out scanners — auth isn't initialized on this bare route, so
  // MainApplication makes that call and drops the sheet for signed-in users.
  function openInComposer() {
    if (!resolvedSeq) return;
    try {
      localStorage.setItem(
        "tka-pending-edit-sequence",
        JSON.stringify(resolvedSeq)
      );
    } catch {
      // Storage unavailable (private mode) — still navigate; the composer
      // just starts empty.
    }
    void goto("/create/construct?sheet=auth");
  }

  function closeViewer(): void {
    abandonActiveExports("viewer_close");
    endScanViewerSession("close_button");
    void goto(`/browse/gallery?from=scan&code=${shortCode}`);
  }

  function cancelVideoExport(ctx: OrchestratorContext): void {
    const token = videoExportAttempt.token;
    if (token !== null) {
      finishVideoExportAttempt(token, "canceled", {
        ...(activeVideoExportConfig ?? videoExportAnalyticsConfig(ctx)),
        user_initiated: true,
      });
    }
    activeVideoExportOrchestrator?.cancelExport();
    isExporting = false;
  }

  function retryVideoExport(ctx: OrchestratorContext): void {
    if (videoExportAttempt.active) return;
    captureScanExport("video", "retry", videoExportAnalyticsConfig(ctx));
    void handleExport(ctx);
  }

  function abandonActiveExports(reason: string): void {
    const videoToken = videoExportAttempt.abandon();
    if (videoToken !== null) {
      captureScanExport("video", "canceled", {
        ...(activeVideoExportConfig ?? {}),
        reason,
        user_initiated: false,
      });
      activeVideoExportConfig = null;
      activeVideoExportOrchestrator?.cancelExport();
      activeVideoExportOrchestrator = null;
      isExporting = false;
      exportProgress = null;
    }

    const cardToken = cardExportAttempt.abandon();
    if (cardToken !== null) {
      captureScanExport("card", "canceled", {
        ...(activeCardExportConfig ?? {}),
        reason,
        user_initiated: false,
      });
      activeCardExportConfig = null;
      sequenceModalExporter.cancel();
      isCardExporting = false;
    }
  }

  // ── See it in the Guide (physical book companion) ──
  // Non-destructive: maps the scanned sequence to a guide destination and
  // navigates there. A single-step sequence is a lone base letter — land on
  // its codex cell and auto-animate it. Anything longer (a word) lands on the
  // codex with the full sequence for the companion to play.
  function seeInGuide(): void {
    const seq = resolvedSeq;
    if (!seq) return;
    const label = seq.steps?.length === 1 ? (seq.word ?? "").trim() : "";
    const target = label ? guideTargetForLetter(label) : null;
    if (target?.cellKey) {
      setGuideScanIntent({ slug: target.slug, cellKey: target.cellKey });
      void goto(`/learn/guide/${target.slug}`);
    } else {
      setGuideScanIntent({ slug: GUIDE_CODEX_SLUG, sequence: seq });
      void goto(`/learn/guide/${GUIDE_CODEX_SLUG}`);
    }
  }

  // Unique base letters for a word, reusing the renderer's own tokenization so
  // the priority-loaded glyphs exactly match what TKAWordGlyph will request.
  function wordBaseLetters(word: string): string[] {
    if (!word) return [];
    const seen = new Set<string>();
    for (const segment of compressWord(word)) {
      for (const token of segment.tokens) {
        const base = isDashLetter(token) ? getBaseLetter(token) : token;
        if (base) seen.add(base);
      }
    }
    return [...seen];
  }

  // Signed-in scanner: wire the deferred library/video/QR registrations the bare
  // /q route skipped. save/favorite/publish call getLibraryRepository(), which
  // THROWS without registerPublicIndexSyncerFactory() (done in deferred-registrations,
  // normally run once at root startup — a bootstrap this route bypasses). Gated on
  // auth so guests never pull the heavy video-export / profanity-list chunks. One-shot.
  let deferredWired = false;
  $effect(() => {
    const isAuthenticated = authState.isAuthenticated;
    refreshScanSessionAttribution();
    if (isAuthenticated && !deferredWired) {
      deferredWired = true;
      void import("$lib/shared/composition-root/deferred-registrations");
    }
  });

  onMount(async () => {
    markScan("start");
    if (browser) {
      // Analytics before anything else on this route. The root layout starts
      // PostHog too, but it does so from its own onMount — which on a scan is
      // racing the settings/theme/auth work below. initPostHog is idempotent,
      // so calling it here just means whichever bootstrap wins arms session
      // replay at the earliest possible moment instead of the latest.
      void initPostHog().catch(() => {});

      // The universal route load already opened this visit before SvelteKit's
      // automatic SPA $pageview. Enrich that same visit with the live auth
      // getter; beginScanVisit preserves its id and session progress.
      if (shortCode) {
        beginScanVisit(shortCode, {
          sequenceWord: data.meta?.word ?? null,
          deckId: data.meta?.deckId ?? null,
          deckName: data.meta?.deckName ?? null,
          blueProp: data.meta?.bluePropType ?? null,
          redProp: data.meta?.redPropType ?? null,
          isAuthenticated: () => authState.isAuthenticated,
        });
      }

      const checkViewport = () => {
        viewportWidth = window.innerWidth;
      };
      checkViewport();
      window.addEventListener("resize", checkViewport);
      onDestroy(() => window.removeEventListener("resize", checkViewport));

      // The bare /q layout skips the root-layout bootstrap (composition-root),
      // so the critical registrations never fire on this route. Wire the three
      // the scan viewer actually consumes:
      //  - short-code manager: getShortCodeManager() (ChoreoCard's QR generator)
      //  - LOOP detector: getLoopDetector() throws otherwise, so the
      //    compositional QR encoder errors and every code falls back to flat
      //    (bigger codes + a console warning on every generation).
      //  - loop display resolver: tryGet…() degrades silently, dropping the
      //    LOOP component labels on the scanned ChoreoCard.
      configureShortCodeManager(stubBrowseLoader);
      registerLoopDetector(loopDetector);
      registerLoopDisplayResolver(resolveLoopDisplay);

      // The bare /q layout also skips initializeAppServices(), so the settings
      // service is null — every updateSettings() (the scanned card's prop seed
      // below AND the in-player prop picker) no-ops with a console warning.
      // Idempotent init wires the singleton so prop changes actually apply.
      await initializeAppServices();

      // Chrome color parity: run the SAME background→theme pipeline
      // MainApplication runs (sets --theme-* on :root), seeded from the
      // scanner's persisted settings — a fresh guest gets the default
      // background's theme. Without this the scan chrome renders the .page
      // fallback palette and drifts from the app viewer's colors.
      try {
        await settingsService.loadSettings();
        const { applyThemeForBackground } =
          await import("$lib/shared/settings/utils/background-theme-calculator");
        const bgType = settingsService.currentSettings?.backgroundType;
        if (bgType) applyThemeForBackground(bgType);
      } catch {
        // Theme pipeline unavailable — component-level var fallbacks still render.
      }

      // The bare /q layout also skips MainInterface, the only caller of
      // handleHMRInit(). Without it, NONE of the HMR resilience runs on this
      // route — a failed HMR apply (a dynamic import transiently resolving to
      // undefined → `mod.default` throws) dead-ends the page and spams the
      // console on every refresh with no self-heal. Wire it here so /q gets the
      // same failed-apply recovery + dynamic-import retry as the rest of the app.
      handleHMRInit();

      // Auth-aware scan (Increment 3): the bare /q layout skips the root auth
      // bootstrap, and forceGuest hid every signed-in action. Fire-and-forget the
      // listener so it reads the already-persisted Firebase session in the
      // background — guest first paint is unaffected (auth resolves to null;
      // funnel-only stays), and a signed-in scanner's header lights up. The heavy
      // library/video/QR registrations those actions need are wired lazily and
      // only for signed-in users (the auth $effect above), so guests never pull
      // the video-export / profanity chunks.
      void initializeAuthListener();
    }

    if (!shortCode) {
      captureResolutionFailure("missing_code", "bootstrap");
      pageState = { kind: "error", message: "No short code provided" };
      return;
    }

    try {
      setProgress(8);
      trickleTo(30);

      // Paint the word as a pulsing glyph loader ASAP — just this word's
      // glyphs, before the heavy resolve + full glyph cache init below.
      const baseLetters = wordBaseLetters(loaderWord);
      if (baseLetters.length > 0) {
        try {
          await getGlyphCache().loadGlyphsByLetter(baseLetters);
          glyphsReady = true;
        } catch {
          /* leave glyphsReady false -> dots placeholder */
        }
      }

      // Heaviest phase: short-code resolve + full glyph cache + viewer chunk.
      // No sub-progress available, so trickle toward 85 until it completes.
      setProgress(35);
      trickleTo(85);

      // `/q` is the scan-attribution boundary. This gate only deduplicates the
      // route visit; browser APIs cannot prove whether a camera opened it.
      const shouldRecordScan =
        !isInlineEncoded(shortCode) && isFirstScanRouteVisit(shortCode);
      const scanPrintId = page.url.searchParams.get("pid") || null;

      // Load the shortcode and viewer chunks concurrently. Scan-card cells are
      // cloud-only, so the phone no longer initializes the complete render glyph
      // cache or starts a local raster worker before first paint.
      //
      // resolveShortCodeWithRecord, not resolveShortCode: the record is the only
      // client-side source of deck attribution, and it costs nothing extra —
      // the resolver already fetched it and used to throw it away.
      const [resolution, OrchestratorModule, ShellModule] = await Promise.all([
        shortCodeManager.resolveShortCodeWithRecord(shortCode),
        import("$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte"),
        import("$lib/shared/sequence-viewer/components/SequenceViewerShell.svelte"),
      ]);

      const record = resolution.record;
      let seq = resolution.sequence;
      markScan("shortcode-resolved");
      if (!seq) {
        stopTrickle();
        failedWhileOffline = !navigator.onLine;
        captureResolutionFailure(
          scanResolutionFailureCategory({
            hasShortCode: true,
            online: navigator.onLine,
            sequenceMissing: true,
          }),
          "resolve"
        );
        pageState = { kind: "error", message: "Sequence not found" };
        return;
      }

      setProgress(88);
      trickleTo(96);

      seq = await hydrateSequence(seq, {
        loopDetector,
      });

      scanInitialBpm = initialScanPlaybackBpm(shortCode, seq);
      resolvedSeq = seq;
      markScan("hydrated");
      const word = seq.word || seq.name || "Sequence";
      seqWord = word;
      // Raw word, not simplified: analytics is DATA, and the expanded form is
      // what joins against sequence records. Display surfaces simplify on their
      // own. Every scan event from here on carries it.
      updateScanAttribution({ sequenceWord: word });

      // The URL identifies the physical card that was scanned. The shortcode
      // record and sequence intent cover reconstructed links and older cards.
      // Keep blue and red independent so mixed-prop cards stay mixed.
      const scanPropConfig = resolveScanPropConfig(
        seq,
        parsePropsFromURL(page.url.searchParams),
        record
      );
      updateScanAttribution({
        blueProp: String(scanPropConfig.bluePropType),
        redProp: String(scanPropConfig.redPropType),
      });
      updateSettings({
        bluePropType: scanPropConfig.bluePropType,
        redPropType: scanPropConfig.redPropType,
        catDogMode: scanPropConfig.catDogMode,
      });

      OrchestratorComponent = OrchestratorModule.default;
      ShellComponent = ShellModule.default;

      // Deck attribution, record first. SSR meta was the SOLE source until
      // 2026-07-20 and it was null on every scan ever recorded (the
      // firebase-admin lookup never ran on workerd), so deck_id was
      // structurally always null. The resolved record is the authoritative
      // copy — it is the same doc SSR was trying to read — and SSR meta is
      // now only the backstop for records that predate the stamped fields or
      // resolved from the skinny R2 snapshot.
      //
      // Resolve this outside the first-visit gate. A failed-load retry should
      // not write another scan, but its remix/download/control events still
      // need the deck they came from.
      const deckId = record?.deckId ?? data?.meta?.deckId ?? null;
      const deckName = record?.deckName ?? data?.meta?.deckName ?? null;
      updateScanAttribution({ deckId, deckName });

      if (shouldRecordScan) {
        const geo = data?.geo;

        captureScanEvent("card_scanned", {
          country: geo?.country || null,
          city: geo?.city || null,
          ...scanPropProperties(
            scanPropConfig.bluePropType,
            scanPropConfig.redPropType
          ),
        });

        // Persist the scan to Firestore so the in-app Scan Activity tab lights
        // up. This is the real card-scan path; unlike the client-only callers
        // (viewer drawer, /sequence), it has the Cloudflare geo from the server
        // load (data.geo), so these are the events that carry real country/city.
        //
        // Attribute a signed-in scanner: the bare /q layout fire-and-forgets the
        // auth listener, so give the persisted Firebase session a brief moment to
        // resolve before recording. Raced against a short timeout so an anonymous
        // scan (or a slow auth resolve) never stalls the write — it just records
        // userId: null and stays anonymous.
        let scannerUserId: string | null = null;
        try {
          await Promise.race([
            initializeAuthListener(),
            new Promise((resolve) => setTimeout(resolve, 1500)),
          ]);
          scannerUserId = authState.user?.uid ?? null;
        } catch {
          scannerUserId = null;
        }

        shortCodeManager.incrementScanCount(shortCode).catch(() => {});
        void shortCodeManager
          .logScanEvent(shortCode, {
            printId: scanPrintId,
            country: geo?.country ?? null,
            city: geo?.city ?? null,
            userAgent: navigator.userAgent,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            referrer: document.referrer || null,
            userId: scannerUserId,
            deviceId: getDeviceId(),
            lat: geo?.lat ?? null,
            lng: geo?.lng ?? null,
            // Durable copy of the attribution the PostHog event carries.
            // PostHog history can never be rewritten; these Firestore docs can
            // be enriched later, so the deck belongs on them too.
            deckId,
            deckName,
            bluePropType: scanPropConfig.bluePropType,
            redPropType: scanPropConfig.redPropType,
            catDogMode: scanPropConfig.catDogMode,
          })
          .catch(() => {});
        void shortCodeManager
          .logJourneyPoint(shortCode, {
            printId: scanPrintId,
            lat: geo?.lat ?? null,
            lng: geo?.lng ?? null,
            city: geo?.city ?? null,
            country: geo?.country ?? null,
          })
          .catch(() => {});
      }

      stopTrickle();
      setProgress(100);
      captureScanEvent("qr_scan_resolution", {
        outcome: "success",
        category: "resolved",
        stage: "ready",
      });
      pageState = { kind: "playing", word };
      markScan("card-mount");

      // Clean load → re-arm the module-chunk self-heal so a later mid-write edit
      // can trigger one fresh recovery reload again (the guard is one-shot).
      clearModuleChunkRecoveryGuard();
    } catch (err: unknown) {
      stopTrickle();
      failedWhileOffline = !navigator.onLine;
      captureResolutionFailure(
        scanResolutionFailureCategory({
          hasShortCode: !!shortCode,
          online: navigator.onLine,
        }),
        "load"
      );
      pageState = {
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to load sequence",
      };
    }
  });
</script>

<svelte:window ononline={handleBackOnline} />

<svelte:head>
  <title>{displayWord} · TKA</title>
  <meta name="description" content={ogDesc} />
  <meta property="og:type" content="video.other" />
  <meta property="og:title" content="{displayWord} · TKA" />
  <meta property="og:description" content={ogDesc} />
  <meta property="og:image" content={ogImage} />
  <meta
    property="og:url"
    content="https://tkaflowarts.com/q/{page.params.code}"
  />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{displayWord} · TKA" />
  <meta name="twitter:description" content={ogDesc} />
  <meta name="twitter:image" content={ogImage} />
  <meta name="theme-color" content="#0f0f1a" />
</svelte:head>

<div class="page">
  {#if pageState.kind === "loading"}
    <div class="center-content">
      {#if glyphsReady && loaderWord}
        <div class="word-loader">
          <TKAWordGlyph word={loaderWord} height={40} darkMode fitToParent />
        </div>
        <div class="loader-progress">
          <ProgressBar percent={loadProgress} height={4} />
        </div>
      {:else}
        <div class="dots-loader" aria-label="Loading">
          <span></span><span></span><span></span>
        </div>
      {/if}
    </div>
  {:else if pageState.kind === "error"}
    <div class="center-content">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="error-icon"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      {#if failedWhileOffline}
        <h1 class="error-heading">You're offline</h1>
        <p class="status-text">
          This code needs a connection to look up. It retries automatically when
          you're back online.
        </p>
        <div class="error-actions">
          <button
            type="button"
            class="cta-button"
            onclick={() => {
              captureResolutionAction("retry");
              location.reload();
            }}
          >
            <i class="fas fa-rotate-right" aria-hidden="true"></i>
            Try Again
          </button>
        </div>
      {:else}
        <h1 class="error-heading">This sequence isn't available</h1>
        <p class="status-text">
          The code may be broken, or the sequence was deleted by its owner.
        </p>
        <div class="error-actions">
          <a
            href="/browse/gallery"
            class="cta-button"
            onclick={() => captureResolutionAction("browse")}
          >
            <i class="fas fa-compass" aria-hidden="true"></i>
            Browse Sequences
          </a>
          <a
            href="/create"
            class="cta-button ghost"
            onclick={() => captureResolutionAction("create")}
          >
            <i class="fas fa-pen" aria-hidden="true"></i>
            Create Your Own
          </a>
        </div>
      {/if}
    </div>
  {:else if pageState.kind === "playing" && OrchestratorComponent && ShellComponent && resolvedSeq}
    <OrchestratorComponent
      sequence={resolvedSeq}
      isMobile={isViewerMobile}
      initialRenderMode="2d"
      initialBpm={scanInitialBpm}
      initialActiveEffect="trails"
      onBpmChange={handleScanBpmChange}
      onClose={closeViewer}
      onGatedDownload={(ctx) =>
        pendingExportKind === "card"
          ? void handleCardExport(ctx)
          : void handleExport(ctx)}
    >
      {#snippet children(ctx)}
        <div class="scan-viewer">
          <!-- The one true viewer chrome, shared verbatim with the app drawer.
               Scan deltas ride in as props: close exits to the gallery, Remix
               runs the guest-friendly composer handoff, the title menu gains
               Open TKA, and Download routes through the gated page pipeline
               (account funnel + native share sheet). -->
          <ShellComponent
            {ctx}
            sequence={resolvedSeq!}
            isMobile={isViewerMobile}
            startInSplit
            onClose={closeViewer}
            onRemix={openInComposer}
            openAppHref={`/browse/gallery?from=scan&code=${shortCode}`}
            guideAction={{ label: "See it in the Guide", onSelect: seeInGuide }}
            exportOverrides={{
              onVideoExport: () => requestGatedExport(ctx, "video"),
              onCardExport: () => requestGatedExport(ctx, "card"),
              videoBusy: isExporting,
              videoProgress: exportProgress,
              cardBusy: isCardExporting,
              showInlineProgress: false,
            }}
          />
          <ExportTakeover
            phase={takeover.phase}
            progress={exportProgress?.progress ?? 0}
            phaseLabel={takeover.labelKey ? t(takeover.labelKey) : ""}
            error={exportProgress?.error ?? null}
            onCancel={() => cancelVideoExport(ctx)}
            onRetry={() => retryVideoExport(ctx)}
          >
            {#snippet title()}
              <!-- displayWord, not rawWord: the glyph row is read by a human,
                   and a repeated word always renders in its smallest form. -->
              <TKAWordGlyph word={displayWord} height={28} darkMode fitToParent />
            {/snippet}
          </ExportTakeover>
        </div>
      {/snippet}
    </OrchestratorComponent>
    <ToastContainer />
  {/if}
</div>

<style>
  .page {
    height: 100vh;
    height: 100dvh;
    background: #0f0f1a;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    overflow: hidden;

    /* Non-theme tokens only. The --theme-* / --semantic-* palette comes from
       the SAME background→theme pipeline the app runs (applyThemeForBackground
       sets them on :root in onMount) — declaring them here would shadow the
       root values for this whole subtree and drift the chrome color from the
       app viewer. */
    --min-touch-target: 44px;
    --font-size-min: 14px;
    --font-size-compact: 12px;
    --duration-normal: 150ms;
    --duration-emphasis: 250ms;
    --duration-dramatic: 350ms;
    --scrollbar-track: rgba(255, 255, 255, 0.04);
    --scrollbar-thumb: rgba(255, 255, 255, 0.12);
    --scrollbar-thumb-hover: rgba(255, 255, 255, 0.2);
  }

  /* ── Non-playing states ── */

  .center-content {
    text-align: center;
    max-width: 400px;
    width: 100%;
    padding: 1rem;
  }

  .status-text {
    font-size: 0.875rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    margin: 0 0 0.5rem;
  }

  .error-icon {
    color: #ef4444;
    margin-bottom: 1rem;
  }

  .error-heading {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
  }

  .error-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-top: 0.5rem;
  }

  .cta-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: var(--min-touch-target);
    padding: 0.75rem 1.5rem;
    background: var(--theme-accent, #0891b2);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    text-decoration: none;
  }

  .cta-button.ghost {
    background: rgba(18, 18, 28, 0.85);
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.14));
    color: var(--theme-text, #ffffff);
  }

  .word-loader {
    display: flex;
    justify-content: center;
    width: 100%;
    animation: word-pulse 1.4s ease-in-out infinite;
  }

  .loader-progress {
    width: 160px;
    max-width: 60%;
    margin: 1rem auto 0;
  }

  @keyframes word-pulse {
    0%,
    100% {
      opacity: 0.35;
      transform: scale(0.97);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
  }

  .dots-loader {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }

  .dots-loader span {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--theme-accent, #0891b2);
    animation: dot-pulse 1.2s ease-in-out infinite;
  }

  .dots-loader span:nth-child(2) {
    animation-delay: 0.2s;
  }
  .dots-loader span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes dot-pulse {
    0%,
    100% {
      opacity: 0.3;
      transform: scale(0.8);
    }
    50% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .word-loader,
    .dots-loader span {
      animation: none;
    }
    .word-loader {
      opacity: 0.85;
    }
  }

  /* ── Player ── */

  /* Full-bleed host for the shared viewer shell — no inset card, no max-width
     cap: the scan page IS the viewer, edge to edge, exactly like the app
     drawer. position:relative anchors the ExportTakeover overlay (absolute
     inset:0) over the whole viewer. */
  .scan-viewer {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
