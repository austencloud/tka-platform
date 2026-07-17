<!--
  ComposerTunnelDemo

  The Tunnel section's live embed: the real kaleidoscope renderer
  (TunnelArtView) multiplying the CΨΩX fixture across a 4-fold ring.

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
  import { onDestroy } from "svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import TunnelArtView from "$lib/shared/sequence-viewer/tunnel/TunnelArtView.svelte";
  import { TunnelViewController } from "$lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte";
  import {
    loadTunnelViewState,
    saveTunnelViewState,
  } from "$lib/shared/sequence-viewer/tunnel/tunnel-view-state";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { setEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { ViewerPlaybackState } from "$lib/shared/sequence-viewer/domain/viewer-prop-groups";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import demoJson from "$lib/shared/landing/data/demo-sequence.json";

  let playing = $state(true);
  let fold = $state(4);

  const prevTunnelViewState = loadTunnelViewState();

  const effects = createEffectsConfigState(undefined, { persist: false });
  setEffectsConfigContext(effects);

  const sequence = createSequenceData({
    id: "composer-tunnel-demo",
    name: "CΨΩX",
    word: (demoJson as { word: string }).word,
    steps: (demoJson as { steps: unknown[] }).steps as StepData[],
    gridMode: (demoJson as { gridMode?: string }).gridMode as never,
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
  <div class="stage" role="img" aria-label="Live tunnel preview: the demo sequence multiplied across {fold} performers">
    <TunnelArtView
      {sequence}
      {playback}
      {controller}
      bpm={60}
      bluePropType="staff"
      redPropType="staff"
      bind:playing
    />
    <button
      type="button"
      class="pause-toggle"
      aria-pressed={!playing}
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
  /* Ultrawide: the duo column has the room — let the kaleidoscope earn it.
     Keep in sync with the page's .sk-stage-square placeholder. */
  @media (min-width: 2200px) {
    .stage {
      max-width: min(40rem, 100%);
    }
  }

  .pause-toggle {
    position: absolute;
    right: 12px;
    bottom: 12px;
    width: 44px;
    height: 44px;
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
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: oklch(0.6 0.02 270);
  }

</style>
