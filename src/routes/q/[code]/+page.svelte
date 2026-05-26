<!--
  /q/[code]/+page.svelte

  QR Scan Landing Page

  Minimal page that plays a live 2D Canvas animation of the scanned sequence.
  Uses shared ExportVideoDrawer for all controls (effects, effort, playback,
  display, export) — same components as the sequence viewer's Download Animation.

  URL format: /q/{shortCode}

  Flow:
  1. Resolve short code -> SequenceData
  2. Lazy-load AnimationPlayer + GlyphCache (parallel with step 1)
  3. Mount AnimationPlayer -> live 2D playback
  4. Lazy-load ExportVideoDrawer for shared controls
-->
<script lang="ts">
  import { page } from "$app/stores";
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { isInlineEncoded } from "$lib/shared/navigation/services/sequence-encoder";
  import { ShortCodeManager } from "$lib/shared/qr/services/implementations/ShortCodeManager";
  import { hydrateSequence } from "$lib/shared/navigation/services/implementations/SequenceHydrator";
  import { loopDetector } from "$lib/features/create/generate/circular/services/implementations/LOOPDetector";
  import { gridModeDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridModeDeriver";
  import { getLetterDeriver } from "$lib/shared/navigation/getLetterDeriver";
  import { getPositionDeriver } from "$lib/shared/navigation/getPositionDeriver";
  import { captureEvent } from "$lib/shared/analytics/services/posthog";
  import { isGenuineScan } from "$lib/shared/qr/utils/scan-detection";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { greekToAscii } from "$lib/shared/create/domain/spell-constants";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
  import type { VideoExportProgress } from "$lib/shared/compose/domain/video-export-types";
  import type { PlaybackMode } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { createExportOptionsState } from "$lib/shared/animation-panel/state/export-options-state.svelte";
  import { getGlyphCache } from "$lib/shared/render/getGlyphCache";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/implementations/AnimationPlaybackController";
  import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";

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
  const shortCode = $derived($page.params["code"]);

  type PageState =
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "playing"; word: string };

  let pageState = $state<PageState>({ kind: "loading" });

  let resolvedSeq: SequenceData | null = $state(null);
  let seqWord = $state("");

  let selectedProp = $state(PropType.STAFF);

  function handlePropChange(propType: PropType) {
    if (propType === selectedProp) return;
    selectedProp = propType;
  }

  // ── Playback state ──
  let selectedBpm = $state(BASE_BPM);
  let AnimationPlayerComponent: typeof import("$lib/shared/sequence-viewer/components/AnimationPlayer.svelte").default | null = $state(null);
  let playbackController = $state<AnimationPlaybackController | null>(null);
  let animPanelState = $state<AnimationPanelState | null>(null);

  // ── Effects + export state ──
  const effectsConfig = createEffectsConfigState();
  setEffectsConfigContext(effectsConfig);

  const exportOptions = createExportOptionsState();
  let isExporting = $state(false);
  let exportProgress = $state<VideoExportProgress | null>(null);

  // ── Derived from AnimationPanelState ──
  const isPlaying = $derived(animPanelState?.isPlaying ?? false);
  const playbackModeLocal = $derived<PlaybackMode>(animPanelState?.playbackMode ?? "continuous");

  const singlePlayDuration = $derived.by(() => {
    if (!resolvedSeq?.steps?.length || selectedBpm <= 0) return 0;
    const totalDurationUnits = resolvedSeq.steps.reduce((sum, s) => sum + (s.duration ?? 1), 0);
    const speed = selectedBpm / 60;
    return totalDurationUnits / speed;
  });

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

  // ── Playback callbacks for ExportVideoDrawer ──
  function handlePlaybackToggle() {
    playbackController?.togglePlayback();
  }

  function handlePlaybackModeChange(mode: PlaybackMode) {
    animPanelState?.setPlaybackMode(mode);
  }

  function handleBpmChange(newBpm: number) {
    selectedBpm = newBpm;
    const speed = newBpm / BASE_BPM;
    playbackController?.setSpeed(speed);
  }

  // ── Download (uses export options from ExportVideoDrawer) ──
  async function handleDownload() {
    if (!resolvedSeq || !playbackController || !animPanelState) return;

    const canvasEl = document.querySelector<HTMLCanvasElement>(".canvas-area canvas");
    if (!canvasEl) return;

    isExporting = true;
    exportProgress = null;

    try {
      let orchestrator;
      try {
        const { getVideoExportOrchestrator } = await import(
          "$lib/shared/animation-engine/getVideoExportOrchestrator"
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
          import("$lib/features/compose/services/implementations/VideoExportOrchestrator"),
          import("$lib/shared/animation-engine/getVideoExporter"),
          import("$lib/shared/animation-engine/getCompositeVideoRenderer"),
          import("$lib/shared/animation-engine/getExportGlyphPrerenderer"),
          import("$lib/shared/animation-engine/getBackgroundVideoEncoder"),
        ]);
        orchestrator = new VideoExportOrchestrator(
          getVideoExporter(),
          getCompositeVideoRenderer(),
          getExportGlyphPrerenderer(),
          getBackgroundVideoEncoder()
        );
      }

      const opts = exportOptions.getVideoOptions();

      const blob = await orchestrator.executeExport(
        canvasEl,
        playbackController,
        animPanelState,
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
        }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${seqWord}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[QR] Download failed:", err);
    } finally {
      isExporting = false;
      exportProgress = null;
    }
  }

  onMount(async () => {
    if (browser) {
      const checkViewport = () => {
        viewportWidth = window.innerWidth;
        viewportHeight = window.innerHeight;
      };
      checkViewport();
      window.addEventListener("resize", checkViewport);

      // Cleanup handled by onDestroy below
      const cleanup = () => window.removeEventListener("resize", checkViewport);
      onDestroy(cleanup);
    }

    if (!shortCode) {
      pageState = { kind: "error", message: "No short code provided" };
      return;
    }

    try {
      const [seq_, PlayerModule] = await Promise.all([
        shortCodeManager.resolveShortCode(shortCode),
        getGlyphCache().initialize().then(() =>
          import("$lib/shared/sequence-viewer/components/AnimationPlayer.svelte")
        ),
      ]);

      let seq = seq_;
      if (!seq) {
        pageState = { kind: "error", message: "Sequence not found" };
        return;
      }

      seq = await hydrateSequence(seq, {
        letterDeriver: getLetterDeriver(),
        positionDeriver: getPositionDeriver(),
        loopDetector,
        gridModeDeriver,
      });

      resolvedSeq = seq;
      const word = seq.word || seq.name || "Sequence";
      seqWord = word;
      selectedProp =
        (seq.intendedProp?.bluePropType as PropType) ?? PropType.STAFF;

      AnimationPlayerComponent = PlayerModule.default;

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

      effectsConfig.setActiveEffect("trails");

      pageState = { kind: "playing", word };
    } catch (err: unknown) {
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
    content="https://tkaflowarts.com/q/{$page.params.code}"
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
      <div class="spinner"></div>
      <p class="status-text">Loading sequence...</p>
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
  {:else if pageState.kind === "playing" && AnimationPlayerComponent && resolvedSeq}
    <div class="player-layout" class:sidebar-mode={isSidebarLayout}>
      <div class="word-title">
        <TKAWordGlyph word={rawWord} height={28} darkMode />
      </div>
      <div class="canvas-area">
        <svelte:component
          this={AnimationPlayerComponent}
          sequence={resolvedSeq}
          autoPlay={true}
          showControls={false}
          bluePropType={selectedProp}
          redPropType={selectedProp}
          previewDarkMode={true}
          onControllerReady={(ctrl, state) => {
            playbackController = ctrl;
            animPanelState = state;
          }}
          onStepChange={() => {}}
        />
      </div>

      <div class="controls-column">
        <div class="drawer-host">
          {#await import("$lib/shared/animation-panel/components/AnimationPanel.svelte") then mod}
            <mod.default
              {exportOptions}
              {isExporting}
              {exportProgress}
              canvasReady={!!playbackController}
              layout={drawerLayout}
              {singlePlayDuration}
              isPlaying={isPlaying}
              bpm={selectedBpm}
              renderMode="2d"
              playbackMode={playbackModeLocal}
              selectedPropType={selectedProp}
              onPropChange={handlePropChange}
              onPlaybackToggle={handlePlaybackToggle}
              onPlaybackModeChange={handlePlaybackModeChange}
              onBpmChange={handleBpmChange}
              onExport={handleDownload}
              secondaryAction={{ label: "Open TKA", href: `/browse/gallery?from=scan&code=${shortCode}`, icon: "fa-compass" }}
            />
          {/await}
        </div>
      </div>
    </div>
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

  .word-title {
    display: flex;
    justify-content: center;
    margin: 0;
    flex-shrink: 0;
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

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.15);
    border-top-color: var(--theme-accent);
    border-radius: 50%;
    margin: 0 auto 1rem;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
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
    grid-template-rows: auto 1fr;
    align-items: stretch;
    padding: 8px 12px;
    gap: 8px;
  }

  .sidebar-mode .word-title {
    grid-column: 1 / -1;
  }

  .sidebar-mode .canvas-area {
    grid-column: 1;
    grid-row: 2;
    max-width: none;
    min-height: 0;
  }

  .sidebar-mode .controls-column {
    grid-column: 2;
    grid-row: 2;
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
