<!--
  ComposerTunnelDemo

  The Tunnel section's live embed: the real kaleidoscope renderer
  (TunnelArtView) multiplying the baked demo fixture across a 4-fold ring.

  Follows TunnelDetailPreview's per-instance seam (the proven pattern for
  mounting the tunnel outside the sequence viewer): local TunnelViewController,
  local effects-config context with persist:false, stub playback. Unlike the
  collection preview we apply only defaults to the controller, so the global
  visibility/trail singletons are left untouched — but the controller DOES
  persist its view state to localStorage on config change, so that key is
  captured on mount and restored on destroy.

  This component statically imports the heavy tunnel stack — the page must
  mount it through LazyMount so none of it lands in the eager graph.
-->
<script lang="ts">
  import { MediaQuery } from "svelte/reactivity";
  import { onDestroy } from "svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import TunnelArtView from "$lib/shared/sequence-viewer/tunnel/TunnelArtView.svelte";
  import { TunnelViewController } from "$lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte";
  import {
    loadTunnelViewState,
    saveTunnelViewState,
  } from "$lib/shared/sequence-viewer/tunnel/tunnel-view-state";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import {
    createSequenceData,
    type SequenceData,
  } from "$lib/shared/foundation/domain/models/sequence-data";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { ViewerPlaybackState } from "$lib/shared/sequence-viewer/domain/viewer-prop-groups";

  /** The per-visit demo sequence, provided by the page (no baked canon). */
  let { sequence: sourceSequence }: { sequence: SequenceData } = $props();

  const reduceMotion = new MediaQuery("(prefers-reduced-motion: reduce)");
  let playing = $state(!reduceMotion.current);
  let fold = $state(4);

  $effect(() => {
    if (reduceMotion.current) playing = false;
  });

  const prevTunnelViewState = loadTunnelViewState();

  const effects = createEffectsConfigState(undefined, { persist: false });
  setEffectsConfigContext(effects);

  const sequence = createSequenceData({
    id: "composer-tunnel-demo",
    name: sourceSequence.word,
    word: sourceSequence.word,
    steps: sourceSequence.steps,
    gridMode: sourceSequence.gridMode,
  });

  const controller = new TunnelViewController({ getSequence: () => sequence });
  controller.active = true;

  $effect(() => {
    controller.applyConfig({
      fold,
      mirror: false,
      flip: false,
      invert: false,
      echo: false,
      staggerSteps: 0,
      speedOverrides: {},
    });
  });

  const playback = {
    animationState: { sequenceData: undefined },
  } as unknown as ViewerPlaybackState;

  onDestroy(() => {
    saveTunnelViewState(prevTunnelViewState);
  });
</script>

<div class="tunnel-demo">
  <div class="stage">
    <div
      class="art"
      role="img"
      aria-label="Live tunnel performance of {simplifyRepeatedWord(
        sequence.word
      )}, multiplied across {fold} copies"
    >
      <TunnelArtView
        {sequence}
        {playback}
        {controller}
        bpm={60}
        bluePropType="staff"
        redPropType="staff"
        bind:playing
      />
    </div>
    <button
      type="button"
      class="pause-toggle"
      aria-label={playing ? "Pause preview" : "Play preview"}
      onclick={() => (playing = !playing)}
    >
      <i class="fas {playing ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
    </button>
  </div>

  <div class="fold-row">
    <span class="control-label">Performers</span>
    <SegmentedControl
      options={[
        { value: "2", label: "2" },
        { value: "4", label: "4" },
        { value: "8", label: "8" },
      ]}
      value={String(fold)}
      onchange={(v) => (fold = Number(v))}
      ariaLabel="Tunnel performers"
      color="accent"
      size="sm"
    />
  </div>
</div>

<style>
  /* Spacing to the prose above is owned by the host's duo grid gap. */
  .stage {
    position: relative;
    aspect-ratio: 1;
    max-width: min(30rem, 100%);
    margin-inline: auto;
    background: #000;
    border-radius: 18px;
    overflow: hidden;
    border: 1px solid oklch(0.4 0.04 270 / 0.18);
  }
  .art {
    position: absolute;
    inset: 0;
  }
  /* Ultrawide: the duo column has the room — the kaleidoscope becomes a
     near-viewport moment (height-keyed, so it scales with the screen).
     Keep in sync with the page's .sk-stage-square placeholder. */
  @media (min-width: 1680px) {
    .stage {
      max-width: min(72vh, 100%);
    }
  }

  .pause-toggle {
    position: absolute;
    right: 12px;
    bottom: 12px;
    width: max(var(--min-touch-target, 48px), 48px);
    height: max(var(--min-touch-target, 48px), 48px);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.85);
    font-size: 14px;
    cursor: pointer;
    backdrop-filter: blur(4px);
  }
  .pause-toggle:hover {
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
  }
  .pause-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #8b8cff);
    outline-offset: 3px;
  }

  /* Deterministic footprint: capped width, one-line labels, so the row is
     always exactly one 52px control tall — the page's tunnel skeleton
     reserves this exact height (no-layout-shift). */
  .fold-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    margin-top: 1rem;
    width: min(100%, 22rem);
    margin-inline: auto;
  }
  .control-label {
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: oklch(0.74 0.018 270);
  }

  .fold-row :global(.segment) {
    min-height: max(var(--min-touch-target, 48px), 48px);
  }
</style>
