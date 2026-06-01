<!--
  /q/[code]/+page.svelte

  QR Scan Landing Page

  Plays the scanned sequence in the full sequence-viewer experience MINUS 3D:
  2D animation, choreo card, mandala (with undulation), and side-by-side — all
  with the redesigned ControlDock controls. Reuses SequenceViewerOrchestrator
  (forceGuest) so there's no duplicated viewer brain; Three.js is lazy-loaded
  out of ViewerSplitPane, so the scan page stays lightweight and chrome-free
  (this route breaks out of the root layout via +layout@.svelte).

  URL format: /q/{shortCode}

  Flow:
  1. Resolve short code -> SequenceData
  2. Lazy-load SequenceViewerOrchestrator + GlyphCache (parallel with step 1)
  3. Mount orchestrator -> ViewerSplitPane (2D panes) + control drawer
  4. Lazy-load AnimationPanel drawer for shared controls
-->
<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { isInlineEncoded } from "$lib/shared/navigation/services/sequence-encoder";
  import { ShortCodeManager } from "$lib/shared/qr/services/short-code-manager";
  import { configureShortCodeManager } from "$lib/shared/qr/get-short-code-manager";
  import { hydrateSequence } from "$lib/shared/navigation/services/sequence-hydrator";
  import { loopDetector } from "$lib/features/create/generate/circular/services/loop-detector";
  import { captureEvent } from "$lib/shared/analytics/services/posthog";
  import { isGenuineScan } from "$lib/shared/qr/utils/scan-detection";
  import { simplifyRepeatedWord, compressWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { isDashLetter, getBaseLetter } from "$lib/shared/pictograph/tka-glyph/utils/letter-image-getter";
  import { greekToAscii } from "$lib/shared/create/domain/spell-constants";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { updateSettings } from "$lib/shared/application/state/app-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PublicSequencesLoader } from "$lib/shared/browse/services/public-sequences-loader";
  import type { VideoExportProgress } from "$lib/shared/compose/domain/video-export-types";
  import {
    COMPARISON_MODE_LAYOUTS,
    splitConfigToMode,
    type SplitConfig,
    type ComparisonMode,
  } from "$lib/shared/sequence-viewer/services/viewer-state-persistence";
  import type { OrchestratorContext } from "$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte";
  import { getGlyphCache } from "$lib/shared/render/get-glyph-cache";
  import { shareOrDownloadBlob } from "$lib/shared/foundation/services/file-downloader";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import ProgressBar from "$lib/shared/components/loading/ProgressBar.svelte";
  import ComparisonModeBar from "$lib/shared/sequence-viewer/components/ComparisonModeBar.svelte";
  import ToastContainer from "$lib/shared/toast/components/ToastContainer.svelte";
  import ExportTakeover from "$lib/shared/video-export/components/ExportTakeover.svelte";
  import type { ExportPhase } from "$lib/shared/video-export/components/ExportTakeover.svelte";

  const BASE_BPM = 60;

  interface Props {
    data: {
      geo: { country: string | null; city: string | null };
      meta: {
        word: string | null;
        creator: string | null;
        thumbnailUrl: string | null;
        deckId: string | null;
        deckName: string | null;
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
        setProgress(loadProgress + Math.max(0.4, (ceiling - loadProgress) * 0.08));
      }
    }, 200);
  }

  function stopTrickle() {
    if (trickleTimer) {
      clearInterval(trickleTimer);
      trickleTimer = null;
    }
  }

  onDestroy(stopTrickle);

  let resolvedSeq: SequenceData | null = $state(null);
  let seqWord = $state("");

  // ── Viewer ──
  // The orchestrator is the full viewer brain; lazy-loaded so the scan page's
  // first paint (the word-glyph loader) isn't blocked by the viewer chunk.
  let OrchestratorComponent:
    | typeof import("$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte").default
    | null = $state(null);
  // ViewerSplitPane lazy-loads alongside the orchestrator (it pulls the 2D pane
  // components), so the word-glyph loader paints before the viewer chunk lands.
  let ViewerSplitPaneComponent:
    | typeof import("$lib/shared/sequence-viewer/components/ViewerSplitPane.svelte").default
    | null = $state(null);

  // Comparison-mode layout for the embedded split pane. Defaults to the
  // animation/card side-by-side; the in-pane ComparisonModeBar (desktop) and
  // the mobile switcher let the user move between animation / card / mandala.
  let qrSplitConfig = $state<SplitConfig>({ leftPane: "animation", rightPane: "card" });
  // Non-3D comparison modes offered on the scan page (Three.js never loads).
  const QR_MODES: ComparisonMode[] = ["2d-card", "2d-mandala"];
  const qrComparisonMode = $derived(splitConfigToMode(qrSplitConfig));

  // ── Export state (drives the QR ExportTakeover overlay + native share) ──
  let isExporting = $state(false);
  let exportProgress = $state<VideoExportProgress | null>(null);

  // ── Export takeover overlay (dim scrim + progress ring over the live canvas) ──
  const takeoverPhase = $derived<ExportPhase>(
    !isExporting ? "idle"
    : exportProgress?.stage === "error" ? "error"
    : exportProgress?.stage === "encoding" ? "encoding"
    : exportProgress?.stage === "complete" ? "complete"
    : "capturing",
  );
  const takeoverLabel = $derived(
    takeoverPhase === "encoding" ? "Encoding…"
    : takeoverPhase === "complete" ? "Done"
    : "Rendering",
  );

  // ── Layout detection ──
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);

  const isSidebarLayout = $derived(
    viewportWidth >= 960 ||
    (viewportHeight > 0 && viewportWidth / viewportHeight >= 5 / 4)
  );
  const drawerLayout = $derived<"sidebar" | "bottom">(isSidebarLayout ? "sidebar" : "bottom");

  // ── OG metadata ──
  const rawWord = $derived(
    (pageState.kind === "playing"
      ? pageState.word
      : data?.meta?.word) || "Sequence"
  );
  const displayWord = $derived(
    rawWord !== "Sequence"
      ? greekToAscii(simplifyRepeatedWord(rawWord))
      : "Sequence"
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

  // ── Download (reuses the orchestrator's live controller + the QR share UX) ──
  // The orchestrator owns the playback controller driving the canvas; we grab it
  // from the children-snippet context to feed the offscreen export engine, then
  // deliver via the native share sheet (mobile) or disk (desktop).
  async function handleExport(ctx: OrchestratorContext) {
    if (!resolvedSeq || !ctx.playbackController || !ctx.modalAnimationState) return;

    const canvasEl = document.querySelector<HTMLCanvasElement>(".canvas-area canvas");
    if (!canvasEl) return;

    isExporting = true;
    exportProgress = null;

    try {
      let orchestrator;
      try {
        const { getVideoExportOrchestrator } = await import(
          "$lib/shared/animation-engine/get-video-export-orchestrator"
        );
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

      const opts = ctx.exportOptions.getVideoOptions();

      const blob = await orchestrator.executeExport(
        canvasEl,
        ctx.playbackController,
        ctx.modalAnimationState,
        (progress) => {
          exportProgress = progress;
        },
        {
          compositeMode: "none",
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

      // Mobile: open the native share sheet so the user picks where the MP4 goes
      // (Files, Photos, a message…) instead of a blind background download.
      // Desktop: straight to disk.
      await shareOrDownloadBlob(blob, `${seqWord}.mp4`, { title: seqWord });
    } catch (err) {
      console.error("[QR] Download failed:", err);
    } finally {
      isExporting = false;
      exportProgress = null;
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

  onMount(async () => {
    if (browser) {
      const checkViewport = () => {
        viewportWidth = window.innerWidth;
        viewportHeight = window.innerHeight;
      };
      checkViewport();
      window.addEventListener("resize", checkViewport);
      onDestroy(() => window.removeEventListener("resize", checkViewport));

      // The bare /q layout skips the root-layout bootstrap, so the short-code
      // manager (used by ChoreoCard's QR generator) is never configured. Wire
      // the stub loader so getShortCodeManager() resolves instead of throwing.
      configureShortCodeManager(stubBrowseLoader);
    }

    if (!shortCode) {
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

      const [seq_, OrchestratorModule, SplitPaneModule] = await Promise.all([
        shortCodeManager.resolveShortCode(shortCode),
        getGlyphCache().initialize().then(() =>
          import("$lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte")
        ),
        import("$lib/shared/sequence-viewer/components/ViewerSplitPane.svelte"),
      ]);

      let seq = seq_;
      if (!seq) {
        stopTrickle();
        pageState = { kind: "error", message: "Sequence not found" };
        return;
      }

      setProgress(88);
      trickleTo(96);

      seq = await hydrateSequence(seq, {
        loopDetector,
      });

      resolvedSeq = seq;
      const word = seq.word || seq.name || "Sequence";
      seqWord = word;

      // Printed cards encode their prop in the QR URL (?bp=<type>), and the
      // sequence itself carries intendedProp. Seed the app settings so the
      // orchestrator's prop resolver renders the scanned card's real prop
      // (triad/fan/etc.) instead of the staff default. Validate against the
      // enum so a junk param can't poison the player.
      const propValues = Object.values(PropType) as string[];
      const urlProp = page.url.searchParams.get("bp");
      const urlPropType =
        urlProp && propValues.includes(urlProp) ? (urlProp as PropType) : null;
      const seedProp =
        urlPropType ??
        (seq.intendedProp?.bluePropType as PropType | undefined) ??
        null;
      if (seedProp) {
        updateSettings({ bluePropType: seedProp, redPropType: seedProp });
      }

      OrchestratorComponent = OrchestratorModule.default;
      ViewerSplitPaneComponent = SplitPaneModule.default;

      if (!isInlineEncoded(shortCode) && isGenuineScan(shortCode)) {
        captureEvent("card_scanned", {
          short_code: shortCode,
          sequence_word: word,
          deck_id: data?.meta?.deckId || null,
          deck_name: data?.meta?.deckName || null,
          country: data?.geo?.country || null,
          city: data?.geo?.city || null,
        });
      }

      stopTrickle();
      setProgress(100);
      pageState = { kind: "playing", word };
    } catch (err: unknown) {
      stopTrickle();
      pageState = {
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to load sequence",
      };
    }
  });
</script>

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
          <TKAWordGlyph word={loaderWord} height={40} darkMode />
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
      <h1 class="error-heading">Sequence Not Found</h1>
      <p class="status-text">{pageState.message}</p>
      <a href="/browse/gallery" class="cta-button">Browse Sequences</a>
    </div>
  {:else if pageState.kind === "playing" && OrchestratorComponent && resolvedSeq}
    <OrchestratorComponent
      sequence={resolvedSeq}
      isMobile={!isSidebarLayout}
      forceGuest={true}
      initialRenderMode="2d"
      initialBpm={BASE_BPM}
      initialActiveEffect="trails"
      onClose={() => goto(`/browse/gallery?from=scan&code=${shortCode}`)}
    >
      {#snippet children(ctx)}
        <div class="player-layout" class:sidebar-mode={isSidebarLayout}>
          <div class="canvas-area">
            <ComparisonModeBar
              current={qrComparisonMode}
              allowed={QR_MODES}
              onSelect={(m) => (qrSplitConfig = COMPARISON_MODE_LAYOUTS[m])}
            />
            {#if ctx.effectiveSequence && ViewerSplitPaneComponent}
            <ViewerSplitPaneComponent
              sequence={ctx.effectiveSequence}
              renderMode="2d"
              bpm={ctx.bpmLocal}
              onBpmChange={ctx.handleBpmChange}
              playback={ctx.splitPanePlayback}
              imageComposition={ctx.splitPaneImageComposition}
              propRendering={ctx.splitPanePropRendering}
              layout={{
                isFullscreen: false,
                fullscreenStackVertical: false,
                isMobile: !isSidebarLayout,
                isLandscapeMobile: false,
                focusedPane: ctx.editingPane,
                suppressCloseButton: ctx.editingPane !== null,
              }}
              splitConfig={qrSplitConfig}
              onFocusPane={ctx.enterEditMode}
              onUnfocusPane={ctx.exitEditMode}
              onStepClick={ctx.handleStepClick}
              onCanvasReady={ctx.handleCanvasReady}
              onPlaybackToggle={ctx.handlePlaybackToggle}
              onProgressBarSeek={ctx.handleProgressBarSeek}
              onProgressBarScrubStart={ctx.handleProgressBarScrubStart}
              onProgressBarScrubEnd={ctx.handleProgressBarScrubEnd}
              playbackMode={ctx.playbackMode}
              onPlaybackModeChange={ctx.handlePlaybackModeChange}
            />
            {/if}
            <ExportTakeover
              phase={takeoverPhase}
              progress={exportProgress?.progress ?? 0}
              phaseLabel={takeoverLabel}
              error={exportProgress?.error ?? null}
              onCancel={() => { isExporting = false; }}
              onRetry={() => handleExport(ctx)}
            >
              {#snippet title()}
                <TKAWordGlyph word={rawWord} height={28} darkMode />
              {/snippet}
            </ExportTakeover>
          </div>

          <div class="controls-column">
            <div class="drawer-host">
              {#await import("$lib/shared/animation-panel/components/AnimationPanel.svelte") then mod}
                <mod.default
                  exportOptions={ctx.exportOptions}
                  {isExporting}
                  {exportProgress}
                  canvasReady={!!ctx.playbackController}
                  layout={drawerLayout}
                  singlePlayDuration={ctx.singlePlayDuration}
                  isPlaying={ctx.isPlayingLocal}
                  bpm={ctx.bpmLocal}
                  renderMode="2d"
                  showInlineExportProgress={false}
                  playbackMode={ctx.playbackMode}
                  selectedPropType={ctx.bluePropType}
                  onPropChange={ctx.handlePropTypeChange}
                  onPlaybackToggle={ctx.handlePlaybackToggle}
                  onPlaybackModeChange={ctx.handlePlaybackModeChange}
                  onBpmChange={ctx.handleBpmChange}
                  onExport={() => handleExport(ctx)}
                  secondaryAction={{ label: "Open TKA", href: `/browse/gallery?from=scan&code=${shortCode}`, icon: "fa-compass" }}
                />
              {/await}
            </div>
          </div>
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
    font-family: system-ui, -apple-system, sans-serif;
    overflow: hidden;

    /* Theme variables for shared components */
    --theme-panel-bg: rgba(18, 18, 28, 0.98);
    --theme-card-bg: rgba(255, 255, 255, 0.04);
    --theme-card-hover-bg: rgba(255, 255, 255, 0.08);
    --theme-stroke: rgba(255, 255, 255, 0.1);
    --theme-stroke-strong: rgba(255, 255, 255, 0.18);
    --theme-text: #ffffff;
    --theme-text-dim: rgba(255, 255, 255, 0.6);
    --theme-accent: #6366f1;
    --theme-shadow: rgba(0, 0, 0, 0.3);
    --min-touch-target: 44px;
    --font-size-min: 14px;
    --font-size-compact: 12px;
    --duration-normal: 150ms;
    --duration-emphasis: 250ms;
    --duration-dramatic: 350ms;
    --semantic-error: #f87171;
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
    color: var(--theme-text-dim);
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

  .cta-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--min-touch-target);
    padding: 0.75rem 1.5rem;
    background: var(--theme-accent);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    text-decoration: none;
  }

  .word-loader {
    display: flex;
    justify-content: center;
    animation: word-pulse 1.4s ease-in-out infinite;
  }

  .loader-progress {
    width: 160px;
    max-width: 60%;
    margin: 1rem auto 0;
  }

  @keyframes word-pulse {
    0%, 100% { opacity: 0.35; transform: scale(0.97); }
    50% { opacity: 1; transform: scale(1); }
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
    background: var(--theme-accent);
    animation: dot-pulse 1.2s ease-in-out infinite;
  }

  .dots-loader span:nth-child(2) { animation-delay: 0.2s; }
  .dots-loader span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes dot-pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1); }
  }

  @media (prefers-reduced-motion: reduce) {
    .word-loader,
    .dots-loader span {
      animation: none;
    }
    .word-loader { opacity: 0.85; }
  }

  /* ── Player layout ── */

  .player-layout {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: 100%;
    padding: 8px;
    gap: 6px;
    overflow: hidden;
  }

  .canvas-area {
    position: relative;
    flex: 1 1 0;
    min-height: 0;
    width: 100%;
    max-width: 480px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    overflow: hidden;
    background: #000;
  }

  /* ── Controls column ── */

  .controls-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 480px;
    gap: 6px;
    flex-shrink: 0;
  }

  .drawer-host {
    width: 100%;
  }

  /* ── Sidebar mode (landscape + desktop) ── */

  .player-layout.sidebar-mode {
    display: grid;
    grid-template-columns: 1fr 260px;
    grid-template-rows: 1fr;
    align-items: stretch;
    padding: 8px 12px;
    gap: 8px;
  }

  .sidebar-mode .canvas-area {
    grid-column: 1;
    grid-row: 1;
    max-width: none;
    min-height: 0;
  }

  .sidebar-mode .controls-column {
    grid-column: 2;
    grid-row: 1;
    max-width: none;
    overflow: hidden;
  }

  .sidebar-mode .drawer-host {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ── Wider tablets ── */

  @media (min-width: 600px) and (min-height: 800px) {
    .player-layout:not(.sidebar-mode) {
      max-width: 600px;
      margin: 0 auto;
      gap: 8px;
    }

    .player-layout:not(.sidebar-mode) .canvas-area {
      max-width: 560px;
    }

    .player-layout:not(.sidebar-mode) .controls-column {
      max-width: 560px;
    }
  }

  /* ── Desktop ── */

  @media (min-width: 960px) {
    .player-layout.sidebar-mode {
      grid-template-columns: 1fr 340px;
      max-width: 1000px;
      margin: 0 auto;
      padding: 16px 24px;
      gap: 16px;
    }

  }

  @media (min-width: 1440px) {
    .player-layout.sidebar-mode {
      max-width: 1200px;
      grid-template-columns: 1fr 380px;
    }
  }
</style>
