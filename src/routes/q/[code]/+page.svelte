<!--
  /q/[code]/+page.svelte

  QR Video Landing Page

  Minimal page that plays a cached MP4 video of the scanned sequence,
  or renders one on-device via a headless worker if uncached.
  No full app bundle - no SequenceViewerOrchestrator, no animation
  engine, no 3D renderer.

  URL format: /q/{shortCode}

  Flow:
  1. Resolve short code → SequenceData
  2. Compute canonical hash (SequenceEncoder.encode → SHA-256)
  3. HEAD check against R2 CDN for cached video
  4a. Cached: play <video src={r2Url}> instantly
  4b. Uncached: spawn headless worker → render → play → upload to R2
-->
<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { encodeSequence, isInlineEncoded } from "$lib/shared/navigation/services/sequence-encoder";
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
  import { HeadlessAnimationOrchestrator } from "$lib/shared/qr-video/services/HeadlessAnimationOrchestrator";
  import {
    buildTimelineParams,
    calculateFrameTiming,
  } from "$lib/shared/qr-video/domain/qr-video-types";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
  import type {
    WorkerOutMessage,
    RenderRequest,
    PrecomputedFrame,
    TransferableAssets,
  } from "$lib/shared/qr-video/domain/qr-video-types";
  import { loadAssets, loadLetterGlyphs } from "$lib/shared/qr-video/services/WorkerAssetLoader";
  import { getLetterImagePath } from "$lib/shared/pictograph/tka-glyph/utils/letter-image-getter";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import TempoControl from "$lib/shared/sequence-viewer/components/TempoControl.svelte";

  const R2_CDN = "https://pub-f5505ed75927471cb198c54336317370.r2.dev";
  const RENDER_FPS = 60;
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
    | { kind: "rendering"; percent: number; phase: string; word: string }
    | { kind: "playing"; videoUrl: string; word: string; isFirstView: boolean };

  let state = $state<PageState>({ kind: "loading" });

  let resolvedSeq: SequenceData | null = $state(null);
  let seqWord = $state("");

  let videoEl: HTMLVideoElement | null = $state(null);
  let paused = $state(false);
  let displayTime = $state(0);
  let duration = $state(0);
  let playbackRate = $state(1);
  let isScrubbing = $state(false);
  let selectedProp = $state(PropType.STAFF);

  const PROP_OPTIONS: { value: PropType; label: string }[] = [
    { value: PropType.STAFF, label: "Staff" },
    { value: PropType.FAN, label: "Fan" },
    { value: PropType.CLUB, label: "Club" },
    { value: PropType.BUUGENG, label: "Buugeng" },
    { value: PropType.TRIAD, label: "Triad" },
    { value: PropType.MINIHOOP, label: "Hoop" },
    { value: PropType.SWORD, label: "Sword" },
    { value: PropType.HAND, label: "Hand" },
  ];

  let selectedEffect: EffectType = $state("trails");

  const EFFECT_OPTIONS: { value: EffectType; label: string }[] = [
    { value: "none", label: "None" },
    { value: "trails", label: "Trails" },
    { value: "fire", label: "Fire" },
    { value: "smoke", label: "Smoke" },
    { value: "bloom", label: "Bloom" },
    { value: "sparkles", label: "Sparkles" },
    { value: "zap", label: "Zap" },
    { value: "echo", label: "Echo" },
    { value: "ink", label: "Ink" },
    { value: "water", label: "Water" },
    { value: "bubbles", label: "Bubbles" },
    { value: "petals", label: "Petals" },
    { value: "frost", label: "Frost" },
    { value: "silk", label: "Silk" },
    { value: "pulse", label: "Pulse" },
    { value: "led", label: "LED" },
    { value: "charcoal", label: "Charcoal" },
  ];

  let selectedBpm = $state(BASE_BPM);

  function handleBpmChange(newBpm: number) {
    selectedBpm = newBpm;
    playbackRate = newBpm / BASE_BPM;
  }

  const scrubProgress = $derived(duration > 0 ? (displayTime / duration) * 100 : 0);

  const ogWord = $derived(
    (state.kind === "playing" || state.kind === "rendering"
      ? state.word
      : data?.meta?.word) || "Sequence"
  );
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

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  async function computeHash(
    seq: SequenceData,
    propOverride?: PropType,
    effectType?: EffectType,
  ): Promise<string> {
    const pipeString = encodeSequence(seq);
    let input = propOverride
      ? `${pipeString}|prop=${propOverride}`
      : pipeString;
    if (effectType && effectType !== "trails") {
      input += `|effect=${effectType}`;
    }
    const buffer = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuffer), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");
  }

  function videoUrl(hash: string): string {
    return `${R2_CDN}/qr-videos/${hash}.mp4`;
  }

  async function checkR2Cache(hash: string): Promise<boolean> {
    try {
      const res = await fetch(videoUrl(hash), { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function uploadToR2(hash: string, mp4: ArrayBuffer): Promise<void> {
    try {
      await fetch(`/api/qr-video/${hash}`, {
        method: "PUT",
        headers: { "Content-Type": "video/mp4" },
        body: mp4,
      });
    } catch (err) {
      console.warn("[QR Video] Upload to R2 failed:", err);
    }
  }

  function precomputeFrames(
    seq: SequenceData,
    blueProp: PropType,
    redProp: PropType,
    fps: number,
    speed: number,
    loopCount: number
  ): PrecomputedFrame[] {
    const orchestrator = new HeadlessAnimationOrchestrator({
      bluePropType: blueProp,
      redPropType: redProp,
    });

    const initialized = orchestrator.initializeWithDomainData(seq);
    if (!initialized) return [];

    const steps = (seq.steps ?? []).filter((s) => s && s.stepNumber !== 0);
    const stepDurations = steps.map((s) => s.duration ?? 1);
    const stepCount = steps.length;

    const timeline = buildTimelineParams(
      stepDurations,
      speed,
      fps,
      loopCount,
      true,
      true
    );

    const frames: PrecomputedFrame[] = [];

    for (let i = 0; i < timeline.totalFrames; i++) {
      const timing = calculateFrameTiming(
        i,
        timeline.totalFrames,
        timeline.totalDurationWithHolds,
        timeline.startPositionDuration,
        timeline.motionLoopUnits,
        timeline.totalDurationUnits,
        timeline.cumulativeDurations,
        stepDurations,
        stepCount
      );

      orchestrator.calculateState(timing.playbackPosition);
      const propStates = orchestrator.getPropStates();

      frames.push({
        blue: propStates.blue ? { ...propStates.blue } : null,
        red: propStates.red ? { ...propStates.red } : null,
        stepIndex: timing.stepIndex,
        isStartPosition: timing.isStartPosition,
      });
    }

    return frames;
  }

  async function spawnWorker(
    seq: SequenceData,
    hash: string,
    word: string,
    propOverride?: PropType,
    effectOverride?: EffectType,
  ): Promise<void> {
    state = { kind: "rendering", percent: 0, phase: "loading-assets", word };

    const blueProp =
      propOverride ??
      (seq.intendedProp?.bluePropType as PropType) ??
      PropType.STAFF;
    const redProp =
      propOverride ??
      (seq.intendedProp?.redPropType as PropType) ??
      PropType.STAFF;

    const frames = precomputeFrames(seq, blueProp, redProp, RENDER_FPS, 1, 2);
    if (frames.length === 0) {
      state = { kind: "error", message: "Failed to compute animation frames" };
      return;
    }

    const gridMode = seq.gridMode ?? "diamond";
    const propTypeName = String(blueProp ?? "staff").toLowerCase();
    const baseUrl = window.location.origin;

    const steps = (seq.steps ?? []).filter((s) => s && s.stepNumber !== 0);
    const letterPaths = steps
      .map((s) => (s.letter ? getLetterImagePath(s.letter as Letter) : null))
      .filter((p): p is string => p !== null);

    const posGroup = seq.startingPositionGroup ?? "alpha";
    const posGlyphMap: Record<string, string> = {
      alpha: "/images/letters_trimmed/Type6/α.svg",
      beta: "/images/letters_trimmed/Type6/β.svg",
      gamma: "/images/letters_trimmed/Type6/γ.svg",
    };
    const posGlyphPath = posGlyphMap[posGroup];

    const [rawAssets, letterGlyphs, startGlyphs] = await Promise.all([
      loadAssets(baseUrl, gridMode, propTypeName, true),
      loadLetterGlyphs(baseUrl, letterPaths, true),
      posGlyphPath
        ? loadLetterGlyphs(baseUrl, [posGlyphPath], true)
        : Promise.resolve([]),
    ]);

    const assets: TransferableAssets = {
      ...rawAssets,
      letterGlyphs,
      startPositionGlyph: startGlyphs[0] ?? null,
    };

    const worker = new Worker(
      new URL(
        "$lib/shared/qr-video/workers/headless-video-renderer.worker.ts",
        import.meta.url
      ),
      { type: "module" }
    );

    const msg: RenderRequest = {
      type: "render",
      sequenceData: seq,
      frames,
      assets,
      config: {
        fps: RENDER_FPS,
        resolution: 720,
        speed: 1,
        propTypes: { blue: blueProp, red: redProp },
        loopCount: 2,
        includeStartPosition: true,
        includeEndHold: true,
        baseUrl,
        cacheHash: hash,
        effectType: effectOverride ?? selectedEffect,
      },
    };

    const transferables: Transferable[] = [
      assets.gridImage,
      assets.bluePropImage,
      assets.redPropImage,
      ...letterGlyphs,
      ...(assets.startPositionGlyph ? [assets.startPositionGlyph] : []),
    ];
    worker.postMessage(msg, transferables);

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const out = e.data;
      if (out.type === "progress") {
        state = {
          kind: "rendering",
          percent: out.percent,
          phase: out.phase,
          word,
        };
      } else if (out.type === "complete") {
        const blob = new Blob([out.mp4], { type: "video/mp4" });
        const blobUrl = URL.createObjectURL(blob);
        state = { kind: "playing", videoUrl: blobUrl, word, isFirstView: true };
        worker.terminate();
        uploadToR2(hash, out.mp4);
      } else if (out.type === "error") {
        state = { kind: "error", message: out.message };
        worker.terminate();
      }
    };

    worker.onerror = (err) => {
      state = { kind: "error", message: err.message || "Worker crashed" };
      worker.terminate();
    };
  }

  function togglePlay() {
    paused = !paused;
  }

  function handleScrub(e: Event) {
    const t = parseFloat((e.target as HTMLInputElement).value);
    displayTime = t;
    if (videoEl) videoEl.currentTime = t;
  }

  async function handlePropChange(propType: PropType) {
    if (!resolvedSeq || propType === selectedProp) return;
    selectedProp = propType;
    const defaultProp =
      (resolvedSeq.intendedProp?.bluePropType as PropType) ?? PropType.STAFF;
    const propOverride = propType === defaultProp ? undefined : propType;
    const hash = await computeHash(resolvedSeq, propOverride, selectedEffect);
    const cached = await checkR2Cache(hash);
    if (cached) {
      state = {
        kind: "playing",
        videoUrl: videoUrl(hash),
        word: seqWord,
        isFirstView: false,
      };
    } else {
      await spawnWorker(resolvedSeq, hash, seqWord, propOverride, selectedEffect);
    }
  }

  async function handleEffectChange(effect: EffectType) {
    if (!resolvedSeq || effect === selectedEffect) return;
    selectedEffect = effect;
    const defaultProp =
      (resolvedSeq.intendedProp?.bluePropType as PropType) ?? PropType.STAFF;
    const propOverride = selectedProp === defaultProp ? undefined : selectedProp;
    const hash = await computeHash(resolvedSeq, propOverride, effect);
    const cached = await checkR2Cache(hash);
    if (cached) {
      state = {
        kind: "playing",
        videoUrl: videoUrl(hash),
        word: seqWord,
        isFirstView: false,
      };
    } else {
      await spawnWorker(resolvedSeq, hash, seqWord, selectedProp === defaultProp ? undefined : selectedProp, effect);
    }
  }

  function handleDownload() {
    if (state.kind !== "playing") return;
    const a = document.createElement("a");
    a.href = state.videoUrl;
    a.download = `${state.word}.mp4`;
    a.click();
  }

  onMount(async () => {
    if (!shortCode) {
      state = { kind: "error", message: "No short code provided" };
      return;
    }

    try {
      let seq = await shortCodeManager.resolveShortCode(shortCode);
      if (!seq) {
        state = { kind: "error", message: "Sequence not found" };
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

      if (
        !isInlineEncoded(shortCode) &&
        isGenuineScan(shortCode)
      ) {
        captureEvent("qr_video_scanned", {
          short_code: shortCode,
          sequence_word: word,
          country: data?.geo?.country || null,
        });
      }

      const hash = await computeHash(seq);
      const cached = await checkR2Cache(hash);

      if (cached) {
        state = {
          kind: "playing",
          videoUrl: videoUrl(hash),
          word,
          isFirstView: false,
        };
      } else {
        await spawnWorker(seq, hash, word);
      }
    } catch (err: unknown) {
      state = {
        kind: "error",
        message:
          err instanceof Error ? err.message : "Failed to load sequence",
      };
    }
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
  {#if state.kind === "loading"}
    <div class="center-content">
      <div class="spinner"></div>
      <p class="status-text">Loading sequence...</p>
    </div>
  {:else if state.kind === "error"}
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
      <p class="status-text">{state.message}</p>
      <a href="/browse/gallery" class="cta-button">Browse Sequences</a>
    </div>
  {:else if state.kind === "rendering"}
    <div class="center-content">
      <h1 class="word-title">{state.word}</h1>
      <p class="first-view-message">
        You're the first to view this sequence!
      </p>
      <div class="progress-container">
        <div class="progress-bar" style:width="{state.percent}%"></div>
      </div>
      <p class="status-text">
        {#if state.phase === "loading-assets"}
          Loading assets...
        {:else if state.phase === "rendering"}
          Building animation... {state.percent}%
        {:else}
          Finalizing video...
        {/if}
      </p>
      <p class="hint-text">Future scans will load instantly.</p>
      <a href="/browse/gallery" class="link-button">Open TKA Composer</a>
    </div>
  {:else if state.kind === "playing"}
    <div class="player-container">
      <h1 class="word-title">{state.word}</h1>
      {#if state.isFirstView}
        <p class="first-view-badge">First scan render complete!</p>
      {/if}

      <!-- svelte-ignore a11y_media_has_caption -->
      <video
        bind:this={videoEl}
        bind:paused
        bind:duration
        bind:playbackRate
        class="sequence-video"
        src={state.videoUrl}
        autoplay
        loop
        muted
        playsinline
        ontimeupdate={() => {
          if (!isScrubbing && videoEl) displayTime = videoEl.currentTime;
        }}
      ></video>

      <div class="controls">
        <button
          type="button"
          class="play-btn"
          onclick={togglePlay}
          aria-label={paused ? "Play" : "Pause"}
        >
          {#if paused}
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M8 5v14l11-7z" />
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          {/if}
        </button>

        <input
          type="range"
          class="scrubber"
          min="0"
          max={duration || 1}
          step="0.01"
          value={displayTime}
          style="background: linear-gradient(to right, #6366f1 {scrubProgress}%, rgba(255,255,255,0.15) {scrubProgress}%)"
          onpointerdown={() => (isScrubbing = true)}
          oninput={handleScrub}
          onpointerup={() => (isScrubbing = false)}
          onchange={() => (isScrubbing = false)}
        />

        <span class="time-display">
          {formatTime(displayTime)}/{formatTime(duration)}
        </span>
      </div>

      <div class="tempo-row">
        <TempoControl
          bpm={selectedBpm}
          onBpmChange={handleBpmChange}
          showPresets={false}
          showPractice={false}
          presetsMode="popover"
        />
      </div>

      <div class="prop-row">
        <span class="row-label">Prop</span>
        <div class="prop-pills">
          {#each PROP_OPTIONS as opt}
            <button
              type="button"
              class="prop-pill"
              class:active={selectedProp === opt.value}
              onclick={() => handlePropChange(opt.value)}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="effect-row">
        <span class="row-label">Effect</span>
        <div class="effect-pills">
          {#each EFFECT_OPTIONS as opt}
            <button
              type="button"
              class="effect-pill"
              class:active={selectedEffect === opt.value}
              onclick={() => handleEffectChange(opt.value)}
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="actions">
        <button type="button" class="cta-button" onclick={handleDownload}>
          Download
        </button>
        <a href="/browse/gallery" class="cta-button secondary">
          Open TKA Composer
        </a>
      </div>
    </div>
  {/if}
</div>

<style>
  .page {
    min-height: 100vh;
    min-height: 100dvh;
    background: #0f0f1a;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    font-family: system-ui, -apple-system, sans-serif;

    --theme-accent: #6366f1;
    --theme-accent-strong: #4f46e5;
    --theme-card-bg: rgba(255, 255, 255, 0.04);
    --theme-card-hover-bg: rgba(255, 255, 255, 0.08);
    --theme-panel-bg: rgba(15, 15, 26, 0.98);
    --theme-stroke: rgba(255, 255, 255, 0.1);
    --theme-stroke-strong: rgba(255, 255, 255, 0.15);
    --theme-text: #ffffff;
    --theme-text-dim: rgba(255, 255, 255, 0.6);
    --theme-shadow: rgba(0, 0, 0, 0.3);
    --min-touch-target: 44px;
    --duration-fast: 150ms;
    --duration-normal: 200ms;
    --font-size-compact: 12px;
  }

  .center-content {
    text-align: center;
    max-width: 400px;
    width: 100%;
  }

  .player-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 520px;
    width: 100%;
    gap: 0.75rem;
  }

  .word-title {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0;
    letter-spacing: 0.05em;
  }

  .first-view-message {
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.8);
    margin: 0 0 1.5rem;
  }

  .first-view-badge {
    font-size: 0.875rem;
    color: #4ade80;
    margin: 0;
  }

  .progress-container {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #a855f7);
    border-radius: 3px;
    transition: width 200ms ease;
  }

  .status-text {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.6);
    margin: 0 0 0.5rem;
  }

  .hint-text {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
    margin: 0 0 1.5rem;
  }

  .sequence-video {
    width: 100%;
    max-width: 480px;
    aspect-ratio: 1;
    border-radius: 12px;
    background: #000;
    display: block;
  }

  /* ── Transport controls ── */

  .controls {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    max-width: 480px;
  }

  .play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    color: #fff;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .play-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .scrubber {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .scrubber::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    background: #6366f1;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 0 4px rgba(99, 102, 241, 0.5);
  }

  .scrubber::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: #6366f1;
    border: none;
    border-radius: 50%;
    cursor: pointer;
  }

  .time-display {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    min-width: 5.5ch;
    text-align: right;
  }

  /* ── Tempo control ── */

  .tempo-row {
    width: 100%;
    max-width: 480px;
  }

  /* ── Prop selector ── */

  .prop-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    max-width: 480px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .prop-row::-webkit-scrollbar {
    display: none;
  }

  .row-label {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    flex-shrink: 0;
  }

  .prop-pills {
    display: flex;
    gap: 0.375rem;
    flex-wrap: nowrap;
  }

  .prop-pill {
    padding: 0.25rem 0.625rem;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 1rem;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.75rem;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background 120ms ease,
      color 120ms ease;
  }

  .prop-pill:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
  }

  .prop-pill.active {
    background: #6366f1;
    border-color: #6366f1;
    color: #fff;
  }

  /* ── Effect selector ── */

  .effect-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    max-width: 480px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .effect-row::-webkit-scrollbar {
    display: none;
  }

  .effect-pills {
    display: flex;
    gap: 0.375rem;
    flex-wrap: nowrap;
  }

  .effect-pill {
    padding: 0.25rem 0.625rem;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 1rem;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.75rem;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background 120ms ease,
      color 120ms ease;
  }

  .effect-pill:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
  }

  .effect-pill.active {
    background: #6366f1;
    border-color: #6366f1;
    color: #fff;
  }

  /* ── Actions ── */

  .actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 0.25rem;
  }

  .cta-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: 0.75rem 1.5rem;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    text-decoration: none;
    transition: filter 150ms ease;
  }

  .cta-button:hover {
    filter: brightness(1.15);
  }

  .cta-button:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: 2px;
  }

  .cta-button.secondary {
    background: rgba(255, 255, 255, 0.1);
  }

  .link-button {
    display: inline-block;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.875rem;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .link-button:hover {
    color: rgba(255, 255, 255, 0.9);
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

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.15);
    border-top-color: #6366f1;
    border-radius: 50%;
    margin: 0 auto 1rem;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
