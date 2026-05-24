<!--
  /q/[code]/+page.svelte

  QR Scan Landing Page

  Minimal page that plays a live 2D Canvas animation of the scanned sequence
  using a lazy-loaded AnimationPlayer component. No worker, no MP4 encoding,
  no R2 caching - the production animation engine renders directly.

  URL format: /q/{shortCode}

  Flow:
  1. Resolve short code → SequenceData
  2. Lazy-load AnimationPlayer + GlyphCache (parallel with step 1)
  3. Mount AnimationPlayer → live 2D playback
-->
<script lang="ts">
  import { page } from "$app/stores";
  import { onMount, onDestroy } from "svelte";
  import { isInlineEncoded } from "$lib/shared/navigation/services/sequence-encoder";
  import { ShortCodeManager } from "$lib/shared/qr/services/implementations/ShortCodeManager";
  import { hydrateSequence } from "$lib/shared/navigation/services/implementations/SequenceHydrator";
  import { loopDetector } from "$lib/features/create/generate/circular/services/implementations/LOOPDetector";
  import { gridModeDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridModeDeriver";
  import { getLetterDeriver } from "$lib/shared/navigation/getLetterDeriver";
  import { getPositionDeriver } from "$lib/shared/navigation/getPositionDeriver";
  import { captureEvent } from "$lib/shared/analytics/services/posthog";
  import { isGenuineScan } from "$lib/shared/qr/utils/scan-detection";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { EffectType } from "$lib/shared/effects/domain/EffectsConfig";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
  import TempoControl from "$lib/shared/sequence-viewer/components/TempoControl.svelte";
  import { EFFECTS, type EffectMeta } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
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

  const PROP_OPTIONS: { value: PropType; label: string }[] = [
    { value: PropType.STAFF, label: "Staff" },
    { value: PropType.SIMPLESTAFF, label: "Simple Staff" },
    { value: PropType.STAFF2, label: "Staff v2" },
    { value: PropType.FAN, label: "Fan" },
    { value: PropType.CLUB, label: "Club" },
    { value: PropType.BUUGENG, label: "Buugeng" },
    { value: PropType.FRACTALGENG, label: "Fractalgeng" },
    { value: PropType.TRIGENG, label: "Trigeng" },
    { value: PropType.TRIAD, label: "Triad" },
    { value: PropType.MINIHOOP, label: "Hoop" },
    { value: PropType.SWORD, label: "Sword" },
    { value: PropType.HAND, label: "Hand" },
    { value: PropType.TRIQUETRA, label: "Triquetra" },
    { value: PropType.TRIQUETRA2, label: "Triquetra 2" },
    { value: PropType.CHICKEN, label: "Chicken" },
    { value: PropType.GUITAR, label: "Guitar" },
    { value: PropType.UKULELE, label: "Ukulele" },
    { value: PropType.DOUBLESTAR, label: "Double Star" },
    { value: PropType.EIGHTRINGS, label: "Eight Rings" },
    { value: PropType.CONTACTBALL, label: "Contact Ball" },
    { value: PropType.DOUBLECONTACTBALL, label: "Dbl Contact" },
    { value: PropType.QUIAD, label: "Quiad" },
    { value: PropType.TORCH, label: "Torch" },
  ];

  let selectedEffect: EffectType = $state("trails");
  let showPropOverlay = $state(false);
  let showEffectOverlay = $state(false);
  let propSectionOpen = $state(false);
  let effectSectionOpen = $state(false);

  const PROP_SVG_MAP: Record<string, string> = {
    [PropType.STAFF]: "/images/props/buttons/staff.svg",
    [PropType.SIMPLESTAFF]: "/images/props/buttons/simple_staff.svg",
    [PropType.STAFF2]: "/images/props/buttons/staff_v2.svg",
    [PropType.FAN]: "/images/props/buttons/fan.svg",
    [PropType.CLUB]: "/images/props/buttons/club.svg",
    [PropType.BUUGENG]: "/images/props/buttons/buugeng.svg",
    [PropType.FRACTALGENG]: "/images/props/buttons/fractalgeng.svg",
    [PropType.TRIGENG]: "/images/props/buttons/trigeng.svg",
    [PropType.TRIAD]: "/images/props/buttons/triad.svg",
    [PropType.MINIHOOP]: "/images/props/buttons/minihoop.svg",
    [PropType.SWORD]: "/images/props/buttons/sword.svg",
    [PropType.HAND]: "/images/props/buttons/hand.svg",
    [PropType.TRIQUETRA]: "/images/props/buttons/triquetra.svg",
    [PropType.TRIQUETRA2]: "/images/props/buttons/triquetra2.svg",
    [PropType.CHICKEN]: "/images/props/buttons/chicken.svg",
    [PropType.GUITAR]: "/images/props/buttons/guitar.svg",
    [PropType.UKULELE]: "/images/props/buttons/ukulele.svg",
    [PropType.DOUBLESTAR]: "/images/props/buttons/doublestar.svg",
    [PropType.EIGHTRINGS]: "/images/props/buttons/eightrings.svg",
    [PropType.CONTACTBALL]: "/images/props/buttons/contactball.svg",
    [PropType.DOUBLECONTACTBALL]: "/images/props/buttons/doublecontactball.svg",
    [PropType.QUIAD]: "/images/props/buttons/quiad.svg",
    [PropType.TORCH]: "/images/props/buttons/torch.svg",
  };

  const selectedEffectMeta = $derived(
    EFFECTS.find((e) => e.id === selectedEffect) ?? EFFECTS[0]!
  );

  const selectedPropLabel = $derived(
    PROP_OPTIONS.find((o) => o.value === selectedProp)?.label ?? "Staff"
  );

  let selectedBpm = $state(BASE_BPM);

  let AnimationPlayerComponent: typeof import("$lib/shared/sequence-viewer/components/AnimationPlayer.svelte").default | null = $state(null);
  let playbackController = $state<AnimationPlaybackController | null>(null);
  let animPanelState = $state<AnimationPanelState | null>(null);
  let isAnimPlaying = $state(false);
  let currentAnimStep = $state(0);
  let isDownloading = $state(false);
  let downloadProgress = $state(0);

  const effectsConfig = createEffectsConfigState();
  setEffectsConfigContext(effectsConfig);

  const rawWord = $derived(
    (pageState.kind === "playing"
      ? pageState.word
      : data?.meta?.word) || "Sequence"
  );
  const ogWord = $derived(rawWord);
  const ogDesc = $derived(
    ogWord !== "Sequence"
      ? `Watch the ${ogWord} flow sequence`
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

  function applyEffectToConfig(effect: EffectType) {
    // Effects are toggled via the tipEffectMap — set the cell-wide ("*") key
    // to the selected effect. "none" disables all effects.
    effectsConfig.setTipEffectMap({ "*": { effect } });
  }

  function handleEffectChange(effect: EffectType) {
    if (effect === selectedEffect) return;
    selectedEffect = effect;
    applyEffectToConfig(effect);
  }

  function handleBpmChange(newBpm: number) {
    selectedBpm = newBpm;
    const speed = newBpm / BASE_BPM;
    playbackController?.setSpeed(speed);
  }

  function handlePropChange(propType: PropType) {
    if (propType === selectedProp) return;
    selectedProp = propType;
    // AnimationPlayer receives prop types as props — Svelte reactivity handles the rest
  }

  async function handleDownload() {
    if (!resolvedSeq || !playbackController || !animPanelState) return;

    const canvasEl = document.querySelector<HTMLCanvasElement>(".canvas-area canvas");
    if (!canvasEl) return;

    isDownloading = true;
    downloadProgress = 0;

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

      const blob = await orchestrator.executeExport(
        canvasEl,
        playbackController,
        animPanelState,
        (progress) => {
          downloadProgress = Math.round(progress.progress);
        },
        {
          compositeMode: "none",
          fps: 60,
          loopCount: 2,
          resolution: 720,
          includeAnimationStartPosition: true,
          includeEndHold: true,
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
      isDownloading = false;
      downloadProgress = 0;
    }
  }

  onMount(async () => {
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
        captureEvent("qr_video_scanned", {
          short_code: shortCode,
          sequence_word: word,
          country: data?.geo?.country || null,
        });
      }

      applyEffectToConfig(selectedEffect);

      pageState = { kind: "playing", word };
    } catch (err: unknown) {
      pageState = {
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to load sequence",
      };
    }
  });

  onDestroy(() => {
    // AnimationPlayer manages its own lifecycle (controller.dispose, animState.dispose)
  });
</script>

<svelte:head>
  <title>{ogWord} - TKA</title>
  <meta name="description" content={ogDesc} />
  <meta property="og:type" content="video.other" />
  <meta property="og:title" content="{ogWord} - TKA" />
  <meta property="og:description" content={ogDesc} />
  <meta property="og:image" content={ogImage} />
  <meta
    property="og:url"
    content="https://tkaflowarts.com/q/{$page.params.code}"
  />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{ogWord} - TKA" />
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
    <div class="player-layout">
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
          onStepChange={(stepIndex, playing) => {
            currentAnimStep = stepIndex ?? 0;
            isAnimPlaying = playing;
          }}
        />
      </div>

      <div class="player-controls">
        <div class="tempo-row">
          <TempoControl
            bpm={selectedBpm}
            onBpmChange={handleBpmChange}
            showPresets={false}
            showPractice={false}
            presetsMode="popover"
          />
        </div>

        <div class="button-grid">
          <button
            type="button"
            class="grid-btn"
            onclick={() => (showPropOverlay = true)}
          >
            <img
              src={PROP_SVG_MAP[selectedProp] ?? "/images/props/buttons/staff.svg"}
              alt=""
              class="grid-btn-icon prop-icon"
            />
            <span class="grid-btn-text">
              <span class="grid-btn-label">Prop</span>
              <span class="grid-btn-sub">{selectedPropLabel}</span>
            </span>
            <i class="fa-solid fa-chevron-right grid-btn-chevron"></i>
          </button>

          <button
            type="button"
            class="grid-btn"
            onclick={() => (showEffectOverlay = true)}
          >
            <i
              class="fa-solid {selectedEffectMeta.icon} grid-btn-fa"
              style:color={selectedEffectMeta.color}
            ></i>
            <span class="grid-btn-text">
              <span class="grid-btn-label">Effects</span>
              <span class="grid-btn-sub">{selectedEffectMeta.label}</span>
            </span>
            <i class="fa-solid fa-chevron-right grid-btn-chevron"></i>
          </button>

          <button type="button" class="grid-btn primary" onclick={handleDownload} disabled={isDownloading}>
            <i class="fa-solid {isDownloading ? 'fa-spinner fa-spin' : 'fa-download'} grid-btn-fa"></i>
            <span class="grid-btn-label">{isDownloading ? `${downloadProgress}%` : 'Download'}</span>
          </button>

          <a href="/browse/gallery" class="grid-btn cta">
            <i class="fa-solid fa-compass grid-btn-fa"></i>
            <span class="grid-btn-label">Open TKA</span>
          </a>
        </div>

        <div class="desktop-sections">
          <button type="button" class="section-header" onclick={() => propSectionOpen = !propSectionOpen}>
            <img
              src={PROP_SVG_MAP[selectedProp] ?? "/images/props/buttons/staff.svg"}
              alt=""
              class="section-header-icon"
            />
            <span class="section-header-text">
              <span class="section-header-label">Prop</span>
              <span class="section-header-value">{selectedPropLabel}</span>
            </span>
            <i class="fa-solid fa-chevron-down section-chevron" class:open={propSectionOpen}></i>
          </button>
          {#if propSectionOpen}
            <div class="desktop-grid">
              {#each PROP_OPTIONS as opt}
                <button
                  type="button"
                  class="overlay-option"
                  class:active={selectedProp === opt.value}
                  onclick={() => { handlePropChange(opt.value); propSectionOpen = false; }}
                >
                  <img src={PROP_SVG_MAP[opt.value] ?? ""} alt="" class="overlay-prop-img" />
                  <span class="overlay-option-label">{opt.label}</span>
                </button>
              {/each}
            </div>
          {/if}

          <button type="button" class="section-header" onclick={() => effectSectionOpen = !effectSectionOpen}>
            <i
              class="fa-solid {selectedEffectMeta.icon} section-header-fa"
              style:color={selectedEffectMeta.color}
            ></i>
            <span class="section-header-text">
              <span class="section-header-label">Effects</span>
              <span class="section-header-value">{selectedEffectMeta.label}</span>
            </span>
            <i class="fa-solid fa-chevron-down section-chevron" class:open={effectSectionOpen}></i>
          </button>
          {#if effectSectionOpen}
            <div class="desktop-grid">
              <button
                type="button"
                class="overlay-option"
                class:active={selectedEffect === "none"}
                onclick={() => { handleEffectChange("none"); effectSectionOpen = false; }}
              >
                <i class="fa-solid fa-ban overlay-effect-icon" style:color="#888"></i>
                <span class="overlay-option-label">None</span>
              </button>
              {#each EFFECTS as eff}
                <button
                  type="button"
                  class="overlay-option"
                  class:active={selectedEffect === eff.id}
                  onclick={() => { handleEffectChange(eff.id as EffectType); effectSectionOpen = false; }}
                >
                  <i class="fa-solid {eff.icon} overlay-effect-icon" style:color={eff.color}></i>
                  <span class="overlay-option-label">{eff.label}</span>
                </button>
              {/each}
            </div>
          {/if}

          <div class="desktop-actions">
            <button type="button" class="grid-btn primary" onclick={handleDownload} disabled={isDownloading}>
              <i class="fa-solid {isDownloading ? 'fa-spinner fa-spin' : 'fa-download'} grid-btn-fa"></i>
              <span class="grid-btn-label">{isDownloading ? `${downloadProgress}%` : 'Download'}</span>
            </button>
            <a href="/browse/gallery" class="grid-btn cta">
              <i class="fa-solid fa-compass grid-btn-fa"></i>
              <span class="grid-btn-label">Open TKA</span>
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Prop overlay -->
    {#if showPropOverlay}
      <div class="overlay-backdrop" role="presentation" onclick={() => (showPropOverlay = false)}>
        <div class="overlay-panel" role="dialog" aria-label="Select prop" onclick={(e) => e.stopPropagation()}>
          <div class="overlay-header">
            <h2 class="overlay-title">Prop</h2>
            <button type="button" class="overlay-close" onclick={() => (showPropOverlay = false)} aria-label="Close">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="overlay-grid">
            {#each PROP_OPTIONS as opt}
              <button
                type="button"
                class="overlay-option"
                class:active={selectedProp === opt.value}
                onclick={() => { handlePropChange(opt.value); showPropOverlay = false; }}
              >
                <img src={PROP_SVG_MAP[opt.value] ?? ""} alt="" class="overlay-prop-img" />
                <span class="overlay-option-label">{opt.label}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- Effect overlay -->
    {#if showEffectOverlay}
      <div class="overlay-backdrop" role="presentation" onclick={() => (showEffectOverlay = false)}>
        <div class="overlay-panel" role="dialog" aria-label="Select effect" onclick={(e) => e.stopPropagation()}>
          <div class="overlay-header">
            <h2 class="overlay-title">Effects</h2>
            <button type="button" class="overlay-close" onclick={() => (showEffectOverlay = false)} aria-label="Close">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="overlay-grid">
            <button
              type="button"
              class="overlay-option"
              class:active={selectedEffect === "none"}
              onclick={() => { handleEffectChange("none"); showEffectOverlay = false; }}
            >
              <i class="fa-solid fa-ban overlay-effect-icon" style:color="#888"></i>
              <span class="overlay-option-label">None</span>
            </button>
            {#each EFFECTS as eff}
              <button
                type="button"
                class="overlay-option"
                class:active={selectedEffect === eff.id}
                onclick={() => { handleEffectChange(eff.id as EffectType); showEffectOverlay = false; }}
              >
                <i class="fa-solid {eff.icon} overlay-effect-icon" style:color={eff.color}></i>
                <span class="overlay-option-label">{eff.label}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}
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

    --accent: #6366f1;
    --accent-strong: #4f46e5;
    --card-bg: rgba(255, 255, 255, 0.06);
    --card-hover: rgba(255, 255, 255, 0.1);
    --stroke: rgba(255, 255, 255, 0.1);
    --text-dim: rgba(255, 255, 255, 0.6);
    --min-touch: 44px;
  }

  /* ── Non-playing states (loading, error) ── */

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
    color: var(--text-dim);
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
    min-height: var(--min-touch);
    padding: 0.75rem 1.5rem;
    background: var(--accent);
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
    border-top-color: var(--accent);
    border-radius: 50%;
    margin: 0 auto 1rem;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Player layout — fills viewport, no scroll ── */

  .player-layout {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: 100%;
    padding: 8px 8px;
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

  /* ── Controls below canvas — fixed height, never scrolls ── */

  .player-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 480px;
    gap: 6px;
    flex-shrink: 0;
  }

  /* ── Tempo ── */

  .tempo-row {
    width: 100%;
  }

  /* ── 2x2 button grid ── */

  .button-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    width: 100%;
  }

  .grid-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: var(--min-touch);
    padding: 6px 8px;
    background: var(--card-bg);
    border: 1px solid var(--stroke);
    border-radius: 10px;
    color: #fff;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    transition: background 120ms ease;
    overflow: hidden;
  }

  .grid-btn:hover {
    background: var(--card-hover);
  }

  .grid-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .grid-btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    justify-content: center;
  }

  .grid-btn.primary:hover {
    background: var(--accent-strong);
  }

  .grid-btn.cta {
    justify-content: center;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border-color: #7c3aed;
    font-weight: 600;
  }

  .grid-btn.cta:hover {
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
  }

  .grid-btn-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    object-fit: contain;
  }

  .prop-icon {
    filter: brightness(0) invert(1);
  }

  .grid-btn-fa {
    font-size: 14px;
    flex-shrink: 0;
    width: 20px;
    text-align: center;
  }

  .grid-btn-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    min-width: 0;
  }

  .grid-btn-label {
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .grid-btn-sub {
    font-size: 0.6rem;
    color: var(--text-dim);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .grid-btn-chevron {
    font-size: 9px;
    color: var(--text-dim);
    flex-shrink: 0;
  }

  @media (max-width: 359px) {
    .grid-btn {
      padding: 4px 6px;
      gap: 4px;
      justify-content: center;
    }
    .grid-btn-text { display: none; }
    .grid-btn-chevron { display: none; }
    .grid-btn-icon { width: 24px; height: 24px; }
    .grid-btn-fa { font-size: 18px; width: 24px; }
  }

  /* ── Overlay panels ── */

  .overlay-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 100;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fadeIn 150ms ease;
  }

  .overlay-panel {
    background: #1a1a2e;
    border-radius: 16px 16px 0 0;
    width: 100%;
    max-width: min(480px, 100vw);
    max-height: 70dvh;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px;
    animation: slideUp 200ms ease;
    scrollbar-width: none;
  }

  .overlay-panel::-webkit-scrollbar { display: none; }

  .overlay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .overlay-title {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0;
  }

  .overlay-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch);
    height: var(--min-touch);
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 18px;
    cursor: pointer;
  }

  .overlay-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  @media (max-width: 380px) {
    .overlay-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .overlay-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 72px;
    padding: 8px 4px;
    background: var(--card-bg);
    border: 1px solid transparent;
    border-radius: 10px;
    color: #fff;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }

  .overlay-option:hover {
    background: var(--card-hover);
  }

  .overlay-option.active {
    background: rgba(99, 102, 241, 0.15);
    border-color: var(--accent);
  }

  .overlay-prop-img {
    width: 32px;
    height: 32px;
    object-fit: contain;
    filter: brightness(0) invert(1);
  }

  .overlay-effect-icon {
    font-size: 24px;
  }

  .overlay-option-label {
    font-size: 0.7rem;
    color: var(--text-dim);
    text-align: center;
    line-height: 1.2;
  }

  .overlay-option.active .overlay-option-label {
    color: #fff;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  /* ── Desktop sections (hidden on mobile) ── */

  .desktop-sections {
    display: none;
  }

  /* ── Landscape: side-by-side layout ── */

  @media (orientation: landscape), (min-aspect-ratio: 5/4) {
    .player-layout {
      display: grid;
      grid-template-columns: 1fr 220px;
      grid-template-rows: auto 1fr;
      padding: 8px 12px;
      gap: 8px;
    }

    .word-title {
      grid-column: 1 / -1;
    }

    .canvas-area {
      grid-column: 1;
      grid-row: 2;
      max-width: none;
      min-height: 0;
    }

    .player-controls {
      grid-column: 2;
      grid-row: 2;
      max-width: none;
      justify-content: center;
    }

    .button-grid {
      grid-template-columns: 1fr;
      gap: 4px;
    }

    .overlay-panel {
      max-width: 520px;
      border-radius: 16px;
      max-height: 80dvh;
    }

    .overlay-backdrop {
      align-items: center;
    }
  }

  /* ── Wider portrait tablets (Z Fold portrait) ── */

  @media (min-width: 600px) and (min-height: 800px) {
    .player-layout {
      max-width: 600px;
      margin: 0 auto;
      gap: 8px;
    }

    .canvas-area {
      max-width: 560px;
    }

    .player-controls {
      max-width: 560px;
    }

    .overlay-panel {
      max-width: 560px;
      border-radius: 16px;
      max-height: 60dvh;
    }

    .overlay-backdrop {
      align-items: center;
    }
  }

  /* ── Desktop: expandable prop/effect sections ── */

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    background: var(--card-bg);
    border: 1px solid var(--stroke);
    border-radius: 10px;
    color: #fff;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .section-header:hover {
    background: var(--card-hover);
  }

  .section-header-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
    filter: brightness(0) invert(1);
    flex-shrink: 0;
  }

  .section-header-fa {
    font-size: 16px;
    width: 20px;
    text-align: center;
    flex-shrink: 0;
  }

  .section-header-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
    text-align: left;
  }

  .section-header-label {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .section-header-value {
    font-size: 0.85rem;
    font-weight: 500;
  }

  .section-chevron {
    font-size: 10px;
    color: var(--text-dim);
    transition: transform 200ms ease;
    flex-shrink: 0;
  }

  .section-chevron.open {
    transform: rotate(180deg);
  }

  @media (min-width: 960px) {
    .player-layout {
      display: grid;
      grid-template-columns: 1fr 340px;
      grid-template-rows: auto 1fr;
      max-width: 1000px;
      margin: 0 auto;
      padding: 16px 24px;
      gap: 16px;
    }

    .word-title {
      grid-column: 1 / -1;
    }

    .canvas-area {
      grid-column: 1;
      grid-row: 2;
      max-width: none;
      min-height: 0;
    }

    .player-controls {
      grid-column: 2;
      grid-row: 2;
      max-width: none;
      justify-content: flex-start;
      overflow-y: auto;
      scrollbar-width: none;
      gap: 12px;
    }

    .player-controls::-webkit-scrollbar {
      display: none;
    }

    .button-grid {
      display: none;
    }

    .desktop-sections {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
    }

    .desktop-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }

    .desktop-grid .overlay-option {
      min-height: 60px;
      padding: 6px 4px;
      gap: 4px;
    }

    .desktop-grid .overlay-prop-img {
      width: 26px;
      height: 26px;
    }

    .desktop-grid .overlay-effect-icon {
      font-size: 20px;
    }

    .desktop-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 4px;
    }

    .overlay-panel {
      max-width: 600px;
      border-radius: 16px;
      max-height: 70dvh;
    }

    .overlay-backdrop {
      align-items: center;
    }
  }

  @media (min-width: 1440px) {
    .player-layout {
      max-width: 1200px;
      grid-template-columns: 1fr 380px;
    }

    .desktop-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
</style>
