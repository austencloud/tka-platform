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
  import { EFFECTS, type EffectMeta } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";

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

  let pageState = $state<PageState>({ kind: "loading" });

  let resolvedSeq: SequenceData | null = $state(null);
  let seqWord = $state("");

  let videoEl: HTMLVideoElement | null = $state(null);
  let paused = $state(false);
  let displayTime = $state(0);
  let duration = $state(0);
  let playbackRate = $state(1);
  let isScrubbing = $state(false);
  let selectedProp = $state(PropType.STAFF);
  let bgRenderPercent = $state(-1);
  let bgRenderPhase = $state("");
  let activeWorker: Worker | null = null;

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
  let showPropOverlay = $state(false);
  let showEffectOverlay = $state(false);

  const PROP_SVG_MAP: Record<string, string> = {
    [PropType.STAFF]: "/images/props/buttons/staff.svg",
    [PropType.FAN]: "/images/props/buttons/fan.svg",
    [PropType.CLUB]: "/images/props/buttons/club.svg",
    [PropType.BUUGENG]: "/images/props/buttons/buugeng.svg",
    [PropType.TRIAD]: "/images/props/buttons/triad.svg",
    [PropType.MINIHOOP]: "/images/props/buttons/minihoop.svg",
    [PropType.SWORD]: "/images/props/buttons/sword.svg",
    [PropType.HAND]: "/images/props/buttons/hand.svg",
  };

  const selectedEffectMeta = $derived(
    EFFECTS.find((e) => e.id === selectedEffect) ?? EFFECTS[0]!
  );

  const selectedPropLabel = $derived(
    PROP_OPTIONS.find((o) => o.value === selectedProp)?.label ?? "Staff"
  );

  let selectedBpm = $state(BASE_BPM);

  function handleBpmChange(newBpm: number) {
    selectedBpm = newBpm;
    playbackRate = newBpm / BASE_BPM;
  }

  const scrubProgress = $derived(duration > 0 ? (displayTime / duration) * 100 : 0);

  const ogWord = $derived(
    (pageState.kind === "playing" || pageState.kind === "rendering"
      ? pageState.word
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
    const isBackground = pageState.kind === "playing";

    if (activeWorker) {
      activeWorker.terminate();
      activeWorker = null;
    }

    if (isBackground) {
      bgRenderPercent = 0;
      bgRenderPhase = "loading-assets";
    } else {
      pageState = { kind: "rendering", percent: 0, phase: "loading-assets", word };
    }

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
      if (!isBackground) {
        pageState = { kind: "error", message: "Failed to compute animation frames" };
      }
      bgRenderPercent = -1;
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
    activeWorker = worker;

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
      if (activeWorker !== worker) return;
      const out = e.data;
      if (out.type === "progress") {
        if (isBackground) {
          bgRenderPercent = out.percent;
          bgRenderPhase = out.phase;
        } else {
          pageState = {
            kind: "rendering",
            percent: out.percent,
            phase: out.phase,
            word,
          };
        }
      } else if (out.type === "complete") {
        const blob = new Blob([out.mp4], { type: "video/mp4" });
        const blobUrl = URL.createObjectURL(blob);
        pageState = { kind: "playing", videoUrl: blobUrl, word, isFirstView: !isBackground };
        bgRenderPercent = -1;
        activeWorker = null;
        worker.terminate();
        uploadToR2(hash, out.mp4);
      } else if (out.type === "error") {
        if (!isBackground) {
          pageState = { kind: "error", message: out.message };
        }
        bgRenderPercent = -1;
        activeWorker = null;
        worker.terminate();
      }
    };

    worker.onerror = (err) => {
      if (activeWorker !== worker) return;
      if (!isBackground) {
        pageState = { kind: "error", message: err.message || "Worker crashed" };
      }
      bgRenderPercent = -1;
      activeWorker = null;
      worker.terminate();
    };
  }

  function togglePlay() {
    paused = !paused;
  }

  let wasPlayingBeforeScrub = false;

  function startScrub() {
    isScrubbing = true;
    wasPlayingBeforeScrub = !paused;
    if (videoEl && !paused) videoEl.pause();
  }

  function handleScrub(e: Event) {
    const t = parseFloat((e.target as HTMLInputElement).value);
    displayTime = t;
    if (videoEl) videoEl.currentTime = t;
  }

  function endScrub() {
    isScrubbing = false;
    if (videoEl && wasPlayingBeforeScrub) videoEl.play();
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
      pageState = {
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
      pageState = {
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
    if (pageState.kind !== "playing") return;
    const a = document.createElement("a");
    a.href = pageState.videoUrl;
    a.download = `${pageState.word}.mp4`;
    a.click();
  }

  onMount(async () => {
    if (!shortCode) {
      pageState = { kind: "error", message: "No short code provided" };
      return;
    }

    try {
      let seq = await shortCodeManager.resolveShortCode(shortCode);
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
        pageState = {
          kind: "playing",
          videoUrl: videoUrl(hash),
          word,
          isFirstView: false,
        };
      } else {
        await spawnWorker(seq, hash, word);
      }
    } catch (err: unknown) {
      pageState = {
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
  {:else if pageState.kind === "rendering"}
    <div class="center-content">
      <h1 class="word-title">{pageState.word}</h1>
      <p class="first-view-message">
        Rendering your sequence...
      </p>
      <div class="progress-container">
        <div class="progress-bar" style:width="{pageState.percent}%"></div>
      </div>
      <p class="status-text">
        {#if pageState.phase === "loading-assets"}
          Loading assets...
        {:else if pageState.phase === "rendering"}
          Building animation... {pageState.percent}%
        {:else}
          Finalizing video...
        {/if}
      </p>
      <p class="hint-text">Future scans will load instantly.</p>
      <a href="/browse/gallery" class="link-button">Open TKA Composer</a>
    </div>
  {:else if pageState.kind === "playing"}
    <div class="player-layout">
      <h1 class="word-title">{pageState.word}</h1>
      <div class="video-area">
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
          bind:this={videoEl}
          bind:paused
          bind:duration
          bind:playbackRate
          class="sequence-video"
          src={pageState.videoUrl}
          autoplay
          loop
          muted
          playsinline
          preload="auto"
          ontimeupdate={() => {
            if (!isScrubbing && videoEl) displayTime = videoEl.currentTime;
          }}
        ></video>
        {#if bgRenderPercent >= 0}
          <div class="bg-render-overlay">
            <div class="bg-render-bar">
              <div class="bg-render-fill" style:width="{bgRenderPercent}%"></div>
            </div>
            <span class="bg-render-label">
              {bgRenderPhase === "loading-assets" ? "Loading..." : `Rendering ${bgRenderPercent}%`}
            </span>
          </div>
        {/if}
      </div>

      <div class="player-controls">
        <div class="transport">
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
            onpointerdown={startScrub}
            oninput={handleScrub}
            onpointerup={endScrub}
            onchange={endScrub}
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

          <button type="button" class="grid-btn primary" onclick={handleDownload}>
            <i class="fa-solid fa-download grid-btn-fa"></i>
            <span class="grid-btn-label">Download</span>
          </button>

          <a href="/browse/gallery" class="grid-btn secondary">
            <i class="fa-solid fa-compass grid-btn-fa"></i>
            <span class="grid-btn-label">Open TKA</span>
          </a>
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

  /* ── Non-playing states (loading, error, rendering) ── */

  .center-content {
    text-align: center;
    max-width: 400px;
    width: 100%;
    padding: 1rem;
  }

  .word-title {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    letter-spacing: 0.05em;
    text-align: center;
    flex-shrink: 0;
  }

  .first-view-message {
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.8);
    margin: 0 0 1.5rem;
  }

  .first-view-badge {
    font-size: 0.75rem;
    color: #4ade80;
    margin: 0;
    flex-shrink: 0;
    text-align: center;
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
    color: var(--text-dim);
    margin: 0 0 0.5rem;
  }

  .hint-text {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
    margin: 0 0 1.5rem;
  }

  .link-button {
    display: inline-block;
    color: var(--text-dim);
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
    padding: 8px 12px;
    gap: 6px;
    overflow: hidden;
  }

  .video-area {
    position: relative;
    flex: 1 1 0;
    min-height: 0;
    width: 100%;
    max-width: 480px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sequence-video {
    width: 100%;
    aspect-ratio: 1;
    max-height: 100%;
    border-radius: 10px;
    background: #000;
    display: block;
    object-fit: contain;
  }

  .bg-render-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 6px 10px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
    border-radius: 0 0 10px 10px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .bg-render-bar {
    flex: 1;
    height: 3px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    overflow: hidden;
  }

  .bg-render-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width 200ms ease;
  }

  .bg-render-label {
    font-size: 0.625rem;
    color: rgba(255, 255, 255, 0.7);
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── Controls below video — fixed height, never scrolls ── */

  .player-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 480px;
    gap: 6px;
    flex-shrink: 0;
  }

  /* ── Transport ── */

  .transport {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }

  .play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch);
    height: var(--min-touch);
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
    min-height: var(--min-touch);
  }

  .scrubber::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: var(--accent);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 0 4px rgba(99, 102, 241, 0.5);
  }

  .scrubber::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: var(--accent);
    border: none;
    border-radius: 50%;
    cursor: pointer;
  }

  .time-display {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.5);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  /* ── Tempo ── */

  .tempo-row {
    width: 100%;
  }

  /* ── 2×2 button grid ── */

  .button-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    width: 100%;
  }

  .grid-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch);
    padding: 8px 12px;
    background: var(--card-bg);
    border: 1px solid var(--stroke);
    border-radius: 10px;
    color: #fff;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    transition: background 120ms ease;
  }

  .grid-btn:hover {
    background: var(--card-hover);
  }

  .grid-btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    justify-content: center;
  }

  .grid-btn.primary:hover {
    background: var(--accent-strong);
  }

  .grid-btn.secondary {
    justify-content: center;
  }

  .grid-btn-icon {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    object-fit: contain;
  }

  .prop-icon {
    filter: brightness(0) invert(1);
  }

  .grid-btn-fa {
    font-size: 16px;
    flex-shrink: 0;
    width: 22px;
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
    font-size: 0.8rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .grid-btn-sub {
    font-size: 0.65rem;
    color: var(--text-dim);
    line-height: 1.2;
  }

  .grid-btn-chevron {
    font-size: 10px;
    color: var(--text-dim);
    flex-shrink: 0;
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
    max-width: 480px;
    max-height: 70dvh;
    overflow-y: auto;
    padding: 16px;
    animation: slideUp 200ms ease;
  }

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
    gap: 8px;
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

  /* ── Landscape / wide (Z Fold landscape, tablets) ── */

  @media (min-width: 700px) and (max-height: 800px) {
    .player-layout {
      display: grid;
      grid-template-columns: 1fr 260px;
      grid-template-rows: auto 1fr;
      padding: 8px 16px;
      gap: 8px;
    }

    .word-title {
      grid-column: 1 / -1;
      font-size: 1.1rem;
    }

    .first-view-badge {
      grid-column: 1 / -1;
    }

    .video-area {
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

    .video-area {
      max-width: 560px;
    }

    .player-controls {
      max-width: 560px;
    }

    .word-title {
      font-size: 1.5rem;
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
</style>
