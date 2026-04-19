<!--
TransportBar.svelte

Cohesive transport control: a small circular play knob that protrudes from
the top-center of the segmented progress bar. Scrub gestures are handled
inside SegmentedSequenceProgressBar itself; this component just composes
the two pieces.
-->
<script lang="ts">
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import SegmentedSequenceProgressBar from "./SegmentedSequenceProgressBar.svelte";

  let {
    steps = [],
    currentStep = 0,
    visible = true,
    darkMode = false,
    onSeek = null,
    onScrubStart = null,
    onScrubEnd = null,
    variant = "gradient",
    showLabels = false,
    isPlaying = false,
    onPlaybackToggle = null,
  }: {
    steps?: readonly StepData[];
    currentStep?: number;
    visible?: boolean;
    darkMode?: boolean;
    onSeek?: ((targetStep: number) => void) | null;
    onScrubStart?: (() => void) | null;
    onScrubEnd?: (() => void) | null;
    variant?:
      | "minimal"
      | "raised"
      | "rounded"
      | "neon"
      | "gradient"
      | "labeled"
      | "gradient-labeled";
    showLabels?: boolean;
    isPlaying?: boolean;
    onPlaybackToggle?: (() => void) | null;
  } = $props();

  const showKnob = $derived(!!onPlaybackToggle);
</script>

{#if visible && steps.length > 0}
  <div
    class="transport-bar-wrapper"
    class:dark-mode={darkMode}
    class:has-knob={showKnob}
  >
    {#if showKnob}
      <button
        type="button"
        class="play-knob"
        class:is-playing={isPlaying}
        onclick={(e) => {
          e.stopPropagation();
          onPlaybackToggle?.();
        }}
        aria-label={isPlaying ? "Pause" : "Play"}
        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
      >
        <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
      </button>
    {/if}

    <SegmentedSequenceProgressBar
      {steps}
      {currentStep}
      visible={true}
      {darkMode}
      {onSeek}
      {onScrubStart}
      {onScrubEnd}
      {variant}
      {showLabels}
    />
  </div>
{/if}

<style>
  .transport-bar-wrapper {
    position: relative;
    width: 100%;
    box-sizing: border-box;
  }

  /* Reserve space for the protruding knob ONLY when one is rendered.
     Otherwise the bar sits flush against the canvas above it. */
  .transport-bar-wrapper.has-knob {
    padding-top: 14px;
  }

  /* Knob design: small (32px), sits roughly half on the bar / half above.
     Protrudes only ~14px above the bar so canvas overlap stays minimal.
     No panel-bg ring (would form a visible halo over transparent canvas).
     Drop shadow + accent border do the elevation read. */
  .play-knob {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: white;
    font-size: 12px;
    cursor: pointer;
    z-index: 3;
    -webkit-tap-highlight-color: transparent;
    transition:
      transform 120ms ease,
      background 150ms ease,
      border-color 150ms ease,
      box-shadow 150ms ease;
    /* Paused (default): saturated accent — invites the play action */
    background: var(--theme-accent, #6366f1);
    border: 1.5px solid color-mix(in srgb, var(--theme-accent, #6366f1) 80%, white 20%);
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.45),
      0 1px 3px rgba(0, 0, 0, 0.4);
  }

  /* Playing: receded — pause is a hold action, not the primary CTA */
  .play-knob.is-playing {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, rgba(20, 20, 28, 0.9));
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    box-shadow:
      0 3px 8px rgba(0, 0, 0, 0.4),
      0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .play-knob:hover {
    transform: translateX(-50%) scale(1.08);
  }
  .play-knob:not(.is-playing):hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 90%, white 10%);
  }
  .play-knob.is-playing:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 50%, rgba(20, 20, 28, 0.9));
  }

  .play-knob:active {
    transform: translateX(-50%) scale(0.94);
  }

  .play-knob:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 3px;
  }

  /* Optical centering: the play triangle reads off-center without nudging */
  .play-knob:not(.is-playing) i {
    margin-left: 1.5px;
  }

  @media (prefers-reduced-motion: reduce) {
    .play-knob {
      transition: none;
    }
    .play-knob:hover {
      transform: translateX(-50%);
    }
  }
</style>
