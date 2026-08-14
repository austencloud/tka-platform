<script lang="ts">
  import { activateWhenNear } from "$lib/actions/activate-when-near";
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface Props {
    word: string;
    posterUrl?: string | null;
    loadSequence: () => Promise<SequenceData | null>;
  }

  let { word, posterUrl = null, loadSequence }: Props = $props();

  type ResolutionState = "idle" | "loading" | "ready" | "unavailable";

  let sequence = $state<SequenceData | null>(null);
  let resolutionState = $state<ResolutionState>("idle");
  let playerRequested = $state(false);
  let nearViewport = $state(false);
  let visible = $state(false);
  let posterFailed = $state(false);
  let playerLoadState = $state<"idle" | "loading" | "loaded" | "error">("idle");
  let resolutionPromise: Promise<SequenceData | null> | null = null;

  const playerActive = $derived(playerRequested && sequence !== null);
  const loadingRequestedPlayer = $derived(
    playerRequested &&
      (resolutionState === "loading" || playerLoadState === "loading")
  );

  function beginSequenceResolution(
    force = false
  ): Promise<SequenceData | null> {
    if (sequence && !force) return Promise.resolve(sequence);
    if (resolutionPromise && !force) return resolutionPromise;

    resolutionState = "loading";
    if (force) resolutionPromise = null;

    const request = loadSequence()
      .then((resolved) => {
        sequence = resolved;
        resolutionState = resolved ? "ready" : "unavailable";
        return resolved;
      })
      .catch((caught) => {
        console.error(
          "[SequenceMessagePreview] Sequence preview could not be loaded:",
          caught
        );
        sequence = null;
        resolutionState = "unavailable";
        return null;
      })
      .finally(() => {
        if (resolutionPromise === request) resolutionPromise = null;
      });

    resolutionPromise = request;
    return request;
  }

  function activatePreviewWhenNear(node: HTMLElement) {
    return activateWhenNear(node, {
      rootMargin: "180px",
      deferUntilIdle: true,
      idleTimeout: 1200,
      fallbackDelay: 150,
      activate: () => {
        nearViewport = true;
        void beginSequenceResolution();
      },
    });
  }

  function trackPreviewVisibility(node: HTMLElement) {
    if (typeof IntersectionObserver === "undefined") {
      visible = true;
      return {};
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
      },
      { threshold: 0.15 }
    );
    observer.observe(node);

    return {
      destroy() {
        observer.disconnect();
      },
    };
  }

  function requestPlayback(): void {
    playerRequested = true;
    void beginSequenceResolution();
  }

  function retrySequence(): void {
    playerRequested = true;
    void beginSequenceResolution(true);
  }
</script>

{#snippet previewPoster()}
  <div class="poster" class:with-image={posterUrl && !posterFailed}>
    {#if posterUrl && !posterFailed}
      <img
        src={posterUrl}
        alt=""
        loading="lazy"
        onerror={() => (posterFailed = true)}
      />
    {:else}
      <div class="poster-glyph" aria-hidden="true">
        {#if word && word !== "Sequence"}
          <TKAWordGlyph {word} height={30} darkMode />
        {:else}
          <i class="fa-solid fa-arrows-rotate"></i>
        {/if}
      </div>
    {/if}

    <div class="poster-scrim"></div>

    {#if resolutionState === "unavailable"}
      <div class="preview-error" role="alert">
        <span>Preview unavailable</span>
        <button type="button" onclick={retrySequence}>Try again</button>
      </div>
    {:else}
      <button
        type="button"
        class="play-preview"
        onclick={requestPlayback}
        disabled={loadingRequestedPlayer}
        aria-label="Play {word} preview"
      >
        {#if loadingRequestedPlayer}
          <span class="spinner" aria-hidden="true"></span>
          <span>Loading</span>
        {:else}
          <span class="play-disc" aria-hidden="true">
            <i class="fa-solid fa-play"></i>
          </span>
          <span>Play preview</span>
        {/if}
      </button>
    {/if}
  </div>
{/snippet}

<div
  class="sequence-preview"
  data-preview-state={playerActive ? "live" : resolutionState}
  use:activatePreviewWhenNear
  use:trackPreviewVisibility
>
  <div class="live-player">
    <LazyMount
      loader={() =>
        import("$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte")}
      active={playerActive}
      prefetch={nearViewport && sequence !== null}
      placeholder={previewPoster}
      debugName="inbox sequence preview"
      onStatusChange={(status) => (playerLoadState = status)}
      props={{
        sequence,
        autoPlay: true,
        showControls: false,
        chrome: "minimal",
        fill: true,
        interactive: true,
        hoverHint: "none",
        cornerToggle: true,
        playbackAllowed: visible,
        externalBpm: 60,
        disableContextMenu: true,
        hideStepNumbers: true,
        beatIndicators: false,
      }}
    >
      {#snippet error(_caught, retry)}
        <div class="preview-error" role="alert">
          <span>The player could not load.</span>
          <button type="button" onclick={retry}>Try again</button>
        </div>
      {/snippet}
    </LazyMount>
  </div>
</div>

<style>
  .sequence-preview {
    container-type: inline-size;
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 10px;
    background: var(--theme-shadow, #05070a);
    isolation: isolate;
  }

  .poster,
  .live-player,
  .preview-error {
    position: absolute;
    inset: 0;
  }

  .poster {
    display: grid;
    place-items: center;
    overflow: hidden;
    background:
      radial-gradient(
        circle at 50% 42%,
        color-mix(in srgb, var(--theme-accent, #22c55e) 20%, transparent),
        transparent 48%
      ),
      var(--theme-shadow, #05070a);
  }

  .poster img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .poster-glyph {
    width: min(72cqw, 13rem);
    min-height: 2rem;
    display: grid;
    place-items: center;
    color: var(--theme-text, #ffffff);
    opacity: 0.76;
    transform: translateY(-1rem);
  }

  .poster-glyph i {
    font-size: clamp(2rem, 18cqw, 3.5rem);
  }

  .poster-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.02) 35%,
      rgba(0, 0, 0, 0.68) 100%
    );
    pointer-events: none;
  }

  .play-preview {
    position: absolute;
    left: 50%;
    bottom: clamp(0.75rem, 7cqw, 1.25rem);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: var(--touch-target-min, 44px);
    padding: 0.5rem 0.875rem;
    border: 1px solid rgba(255, 255, 255, 0.24);
    border-radius: 999px;
    color: #ffffff;
    background: rgba(7, 10, 14, 0.9);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.34);
    font-size: var(--font-size-min, 14px);
    font-weight: 650;
    white-space: nowrap;
    cursor: pointer;
    transform: translateX(-50%);
    transition:
      background var(--duration-fast, 120ms) ease,
      border-color var(--duration-fast, 120ms) ease,
      transform var(--duration-fast, 120ms) ease;
  }

  .play-preview:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--theme-accent, #22c55e) 72%, white);
    background: rgba(12, 17, 23, 0.96);
    transform: translateX(-50%) translateY(-1px);
  }

  .play-preview:focus-visible,
  .preview-error button:focus-visible {
    outline: 2px solid var(--theme-accent, #22c55e);
    outline-offset: 2px;
  }

  .play-preview:disabled {
    cursor: wait;
    opacity: 0.78;
  }

  .play-disc {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    color: #07100a;
    background: var(--theme-accent, #22c55e);
  }

  .play-disc i {
    padding-left: 0.1rem;
    font-size: 0.75rem;
  }

  .live-player {
    min-width: 0;
    min-height: 0;
    background: var(--theme-shadow, #05070a);
  }

  .preview-error {
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem;
    color: var(--theme-text, #ffffff);
    background: var(--theme-shadow, #05070a);
    font-size: var(--font-size-min, 14px);
    text-align: center;
  }

  .preview-error button {
    min-height: var(--touch-target-min, 44px);
    padding: 0.5rem 1rem;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.22));
    border-radius: 999px;
    color: var(--theme-text, #ffffff);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
  }

  .preview-error button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.16));
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    flex: 0 0 auto;
    border: 2px solid rgba(255, 255, 255, 0.24);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: preview-spin 700ms linear infinite;
  }

  @keyframes preview-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .play-preview {
      transition: none;
    }

    .spinner {
      animation-duration: 1400ms;
    }
  }
</style>
