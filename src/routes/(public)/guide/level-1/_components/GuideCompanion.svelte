<script lang="ts">
  /**
   * Reader companion — the right-hand panel that live-animates the sequence a
   * page hands up. Wraps the standalone InlineAnimationPlayer in MINIMAL chrome
   * (tap-to-play canvas + thin progress line + hover badge — the showcase idiom,
   * feedback_minimal_player_chrome); NOT the retired UnifiedTimeline scrubber.
   *
   * Tempo rides the canonical BpmChips ("Unified BPM chip selector", compact
   * variant — presets + its own built-in Custom popover, zero external wiring),
   * driving the player via externalBpm. Keyed by sequence id so a new click
   * remounts a fresh player.
   */
  import InlineAnimationPlayer from "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte";
  import BpmChips from "$lib/shared/animation-engine/components/controls/BpmChips.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  let {
    sequence,
    onClose,
    onStep,
  }: {
    sequence: SequenceData | null;
    onClose: () => void;
    /** Live playback step from the player, forwarded so the reader can ring the
     *  matching on-screen strip cell (see GuideActiveStep). */
    onStep?: (currentStep: number) => void;
  } = $props();

  let bpm = $state(60);
</script>

<div class="companion">
  <div class="head">
    <span class="ttl">Animation</span>
    <button class="close" onclick={onClose} aria-label="Close animation">✕</button>
  </div>

  {#if sequence}
    <div class="tempo-strip">
      <BpmChips {bpm} variant="compact" onBpmChange={(v) => (bpm = v)} />
    </div>
  {/if}

  <div class="body">
    {#if sequence}
      {#key sequence.id}
        <InlineAnimationPlayer
          {sequence}
          autoPlay={true}
          chrome="minimal"
          externalBpm={bpm}
          bluePropType="hand"
          redPropType="hand"
          onStepChange={onStep}
        />
      {/key}
    {:else}
      <p class="hint">Click a sequence on the page to animate it.</p>
    {/if}
  </div>
</div>

<style>
  .companion {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: var(--theme-text, #e8e6f0);
  }
  .head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem 0.6rem 1rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }
  .ttl {
    font: 700 0.9rem system-ui, sans-serif;
    color: var(--theme-text, #e8e6f0);
  }
  .close {
    all: unset;
    cursor: pointer;
    min-width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 1rem;
  }
  @media (hover: hover) and (pointer: fine) {
    .close:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
      color: var(--theme-text, #fff);
    }
  }
  .close:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #8b5cf6) 70%, transparent);
    outline-offset: -2px;
  }

  /* Canonical BpmChips (compact) as a thin full-width tempo strip. */
  .tempo-strip {
    flex: 0 0 auto;
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  /* The player fills the panel — the canvas is the hero, no centering margins. */
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    padding: 0.75rem;
  }
  .body :global(.inline-animation-player) {
    flex: 1;
    min-width: 0;
  }
  .hint {
    margin: auto;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font: italic 0.9rem/1.4 "Cormorant Garamond", Georgia, serif;
    text-align: center;
  }
</style>
