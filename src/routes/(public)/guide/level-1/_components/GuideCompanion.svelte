<script lang="ts">
  /**
   * Reader companion — the right-hand panel that live-animates the sequence a
   * page hands up. Wraps the standalone InlineAnimationPlayer in MINIMAL chrome
   * (tap-to-play canvas + thin progress line + hover badge — the showcase idiom,
   * feedback_minimal_player_chrome); NOT the retired UnifiedTimeline scrubber /
   * BpmChips grid. Tempo rides the app-canonical compact BpmQuickPopover (same
   * control PracticeBar uses), driving the player via externalBpm. Keyed by
   * sequence id so a new click remounts a fresh player.
   */
  import { Popover } from "bits-ui";
  import InlineAnimationPlayer from "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte";
  import BpmQuickPopover from "$lib/shared/animation-engine/components/controls/BpmQuickPopover.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  let {
    sequence,
    onClose,
  }: {
    sequence: SequenceData | null;
    onClose: () => void;
  } = $props();

  let bpm = $state(60);
  let bpmOpen = $state(false);
</script>

<div class="companion">
  <div class="head">
    <span class="ttl">Animation</span>
    <div class="actions">
      {#if sequence}
        <Popover.Root bind:open={bpmOpen}>
          <Popover.Trigger>
            {#snippet child({ props })}
              <button
                {...props}
                class="tempo-btn"
                type="button"
                aria-label={`Set tempo, currently ${bpm} BPM`}
              >
                <span class="tempo-val">{bpm}</span>
                <span class="tempo-unit">BPM <i class="fas fa-caret-down" aria-hidden="true"></i></span>
              </button>
            {/snippet}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content side="bottom" align="end" sideOffset={8} collisionPadding={12}>
              <BpmQuickPopover {bpm} onBpmChange={(v) => (bpm = v)} onClose={() => (bpmOpen = false)} />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      {/if}
      <button class="close" onclick={onClose} aria-label="Close animation">✕</button>
    </div>
  </div>
  <div class="body">
    {#if sequence}
      {#key sequence.id}
        <InlineAnimationPlayer {sequence} autoPlay={true} chrome="minimal" externalBpm={bpm} />
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
  .actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  /* Compact tempo trigger — the "what we use" readout button (BpmQuickPopover
     supplies the popover body). */
  .tempo-btn {
    display: inline-flex;
    align-items: baseline;
    gap: 0.3rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.3rem 0.65rem;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    color: var(--theme-text, #fff);
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) and (pointer: fine) {
    .tempo-btn:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    }
  }
  .tempo-btn:active {
    transform: scale(0.97);
  }
  .tempo-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #8b5cf6) 70%, transparent);
    outline-offset: 2px;
  }
  .tempo-val {
    font: 800 1rem/1 system-ui, sans-serif;
    font-variant-numeric: tabular-nums;
  }
  .tempo-unit {
    font: 700 0.6rem/1 system-ui, sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
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
