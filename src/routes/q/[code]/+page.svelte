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
  import { HeadlessAnimationOrchestrator } from "$lib/shared/qr-video/services/HeadlessAnimationOrchestrator";
  import {
    buildTimelineParams,
    calculateFrameTiming,
  } from "$lib/shared/qr-video/domain/qr-video-types";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
  import type { WorkerOutMessage, RenderRequest, PrecomputedFrame, TransferableAssets } from "$lib/shared/qr-video/domain/qr-video-types";
  import { loadAssets, loadLetterGlyphs } from "$lib/shared/qr-video/services/WorkerAssetLoader";
  import { getLetterImagePath } from "$lib/shared/pictograph/tka-glyph/utils/letter-image-getter";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";

  const R2_CDN = "https://pub-f5505ed75927471cb198c54336317370.r2.dev";

  interface Props {
    data: {
      geo: {
        country: string | null;
        city: string | null;
      };
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

  const ogWord = $derived(
    (state.kind === "playing" || state.kind === "rendering" ? state.word : data?.meta?.word) || "Sequence"
  );
  const ogDesc = $derived(
    ogWord !== "Sequence" ? `Watch the ${ogWord} flow sequence` : "Watch this flow sequence"
  );
  const ogImage = $derived(data?.meta?.thumbnailUrl || "https://tkaflowarts.com/og-default.png");

  const stubBrowseLoader = {
    loadSequenceMetadata: async () => [],
    loadFullSequenceData: async () => null,
    removeFromCache: () => {},
    addToCache: () => {},
    warmFromCache: () => {},
    refreshFromFirestore: async () => [],
  } as unknown as PublicSequencesLoader;

  const shortCodeManager = new ShortCodeManager(stubBrowseLoader);

  async function computeHash(seq: SequenceData): Promise<string> {
    const pipeString = encodeSequence(seq);
    const buffer = new TextEncoder().encode(pipeString);
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
        blue: propStates.blue
          ? { ...propStates.blue }
          : null,
        red: propStates.red
          ? { ...propStates.red }
          : null,
        stepIndex: timing.stepIndex,
        isStartPosition: timing.isStartPosition,
      });
    }

    return frames;
  }

  async function spawnWorker(
    seq: SequenceData,
    hash: string,
    word: string
  ): Promise<void> {
    state = { kind: "rendering", percent: 0, phase: "loading-assets", word };

    const blueProp =
      (seq.intendedProp?.bluePropType as PropType) ?? PropType.STAFF;
    const redProp =
      (seq.intendedProp?.redPropType as PropType) ?? PropType.STAFF;

    const frames = precomputeFrames(seq, blueProp, redProp, 30, 1, 2);
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

    const [assets, letterGlyphs] = await Promise.all([
      loadAssets(baseUrl, gridMode, propTypeName, true),
      loadLetterGlyphs(baseUrl, letterPaths, true),
    ]);

    assets.letterGlyphs = letterGlyphs;

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
        fps: 30,
        resolution: 720,
        speed: 1,
        propTypes: { blue: blueProp, red: redProp },
        loopCount: 2,
        includeStartPosition: true,
        includeEndHold: true,
        baseUrl,
        cacheHash: hash,
      },
    };

    const transferables: Transferable[] = [
      assets.gridImage,
      assets.bluePropImage,
      assets.redPropImage,
      ...letterGlyphs,
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

      const word = seq.word || seq.name || "Sequence";

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
        message: err instanceof Error ? err.message : "Failed to load sequence",
      };
    }
  });

  function handleDownload() {
    if (state.kind !== "playing") return;
    const a = document.createElement("a");
    a.href = state.videoUrl;
    a.download = `${state.word}.mp4`;
    a.click();
  }
</script>

<svelte:head>
  <title>{ogWord} - TKA</title>
  <meta name="description" content={ogDesc} />
  <meta property="og:type" content="video.other" />
  <meta property="og:title" content="{ogWord} - TKA" />
  <meta property="og:description" content={ogDesc} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:url" content="https://tkaflowarts.com/q/{$page.params.code}" />
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
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="error-icon">
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
    <div class="video-container">
      <h1 class="word-title">{state.word}</h1>
      {#if state.isFirstView}
        <p class="first-view-badge">First scan render complete!</p>
      {/if}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video
        class="sequence-video"
        src={state.videoUrl}
        autoplay
        loop
        muted
        playsinline
      ></video>
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
  }

  .center-content {
    text-align: center;
    max-width: 400px;
    width: 100%;
  }

  .video-container {
    text-align: center;
    max-width: 600px;
    width: 100%;
  }

  .word-title {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0 0 0.75rem;
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
    margin: 0 0 1rem;
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
    max-width: 500px;
    aspect-ratio: 1;
    border-radius: 12px;
    background: #000;
    margin-bottom: 1.5rem;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
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
